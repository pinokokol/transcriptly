import { createRequire } from "node:module";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { configuredLocalModel } from "./cli/config";
import {
  CaptionsUnavailableError,
  CommandExecutionError,
  ConfigurationError,
  InvalidOptionError,
  InvalidSourceError,
  MissingBinaryError,
  MissingModelError,
  SourceNotFoundError,
  TranscriptlyError,
  TranscriptionError,
  UnsupportedUrlError,
} from "./errors";
import { formatTranscript } from "./format";
import { resolveSource } from "./resolve";
import { transcribe, type TranscriptFormat, type TranscriptionMode } from "./transcribe";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };

const FORMATS = ["md", "txt", "json", "srt"] as const;
const MODES = ["asr", "captions"] as const;

export const MISSING_MODEL_MESSAGE =
  "No local model is installed. Run `transcriptly setup` in a terminal once.";

export const MCP_TOOLS: Tool[] = [
  {
    name: "get_transcript",
    description:
      "Transcribe audio or video and return the transcript as Markdown, plain text, JSON, or SRT. Supports YouTube, TikTok, Facebook, X, Reddit, and other platform URLs through yt-dlp, direct media URLs, and local file paths. ASR uses the user's configured local Whisper model; captions mode uses an available caption track.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          minLength: 1,
          description: "A supported HTTP(S) URL or local audio/video file path.",
        },
        format: {
          type: "string",
          enum: FORMATS,
          default: "md",
          description: "Transcript output format.",
        },
        mode: {
          type: "string",
          enum: MODES,
          default: "asr",
          description: "Use local speech recognition or an existing caption track.",
        },
      },
      required: ["source"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_video_info",
    description:
      "Inspect a source without transcribing or downloading media. Returns title, duration in seconds, platform, and available manual and automatic caption tracks. Supports YouTube, TikTok, Facebook, X, Reddit, and other platform URLs through yt-dlp, direct media URLs, and local file paths. This is the cheap way to check duration and captions before committing to a transcription.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          minLength: 1,
          description: "A supported HTTP(S) URL or local audio/video file path.",
        },
      },
      required: ["source"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

export interface McpDependencies {
  transcribe: typeof transcribe;
  resolveSource: typeof resolveSource;
  configuredLocalModel: typeof configuredLocalModel;
}

const DEFAULT_DEPENDENCIES: McpDependencies = {
  transcribe,
  resolveSource,
  configuredLocalModel,
};

class ToolInputError extends Error {}

function argumentsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolInputError("Tool arguments must be an object.");
  }
  return value as Record<string, unknown>;
}

function rejectExtraArguments(
  args: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const extra = Object.keys(args).find((key) => !allowed.includes(key));
  if (extra) throw new ToolInputError(`Unexpected argument "${extra}".`);
}

function sourceArgument(args: Record<string, unknown>): string {
  if (typeof args.source !== "string" || !args.source.trim()) {
    throw new ToolInputError('"source" must be a non-empty URL or local file path.');
  }
  return args.source.trim();
}

function enumArgument<T extends string>(
  args: Record<string, unknown>,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = args[name] ?? fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ToolInputError(`"${name}" must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function normalizedMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

export function mcpErrorMessage(error: unknown): string {
  if (error instanceof MissingModelError) return MISSING_MODEL_MESSAGE;
  if (error instanceof MissingBinaryError) {
    return `Missing required tool: ${error.binary}. Run \`transcriptly setup\` for install help.`;
  }
  if (error instanceof SourceNotFoundError) {
    return `File not found: ${error.path}. Check the path and try again.`;
  }
  if (error instanceof UnsupportedUrlError) {
    return "Unsupported URL. Use a URL supported by yt-dlp, a direct media URL, or a local file path.";
  }
  if (error instanceof CommandExecutionError) {
    if (error.binary === "yt-dlp") {
      return "yt-dlp could not inspect that source. Check the URL and try again.";
    }
    if (error.binary === "ffmpeg" || error.binary === "ffprobe") {
      return `${error.binary} could not read that media. Check the source and try again.`;
    }
    if (error.binary === "whisper-cli") {
      return "Local transcription failed. Check the model and media, then try again.";
    }
    return `${error.binary} failed. Check that it is installed and try again.`;
  }
  if (error instanceof CaptionsUnavailableError) {
    return `${normalizedMessage(error.message)} Use mode "asr" to transcribe the audio instead.`;
  }
  if (
    error instanceof ConfigurationError ||
    error instanceof InvalidOptionError ||
    error instanceof InvalidSourceError ||
    error instanceof TranscriptionError
  ) {
    return normalizedMessage(error.message);
  }
  if (error instanceof TranscriptlyError) return normalizedMessage(error.message);
  if (error instanceof ToolInputError) return error.message;
  return error instanceof Error
    ? normalizedMessage(error.message)
    : "Unexpected tool error. Check the source and try again.";
}

async function getTranscript(
  value: unknown,
  dependencies: McpDependencies,
): Promise<CallToolResult> {
  const args = argumentsObject(value);
  rejectExtraArguments(args, ["source", "format", "mode"]);
  const source = sourceArgument(args);
  const format = enumArgument<TranscriptFormat>(args, "format", FORMATS, "md");
  const mode = enumArgument<TranscriptionMode>(args, "mode", MODES, "asr");
  const model = mode === "asr" ? await dependencies.configuredLocalModel() : undefined;
  if (mode === "asr" && !model) return errorResult(MISSING_MODEL_MESSAGE);

  const transcript = await dependencies.transcribe(source, { format, mode, model });
  return textResult(formatTranscript(transcript, format));
}

async function getVideoInfo(
  value: unknown,
  dependencies: McpDependencies,
): Promise<CallToolResult> {
  const args = argumentsObject(value);
  rejectExtraArguments(args, ["source"]);
  const resolved = await dependencies.resolveSource(sourceArgument(args));
  return textResult(
    JSON.stringify(
      {
        title: resolved.metadata.title ?? null,
        duration: resolved.metadata.duration ?? null,
        platform: resolved.metadata.platform ?? null,
        captionTracks: {
          manual: resolved.captionTracks.manual,
          automatic: resolved.captionTracks.automatic,
        },
      },
      null,
      2,
    ),
  );
}

export async function callTranscriptlyTool(
  name: string,
  args: unknown,
  dependencies: McpDependencies = DEFAULT_DEPENDENCIES,
): Promise<CallToolResult> {
  try {
    if (name === "get_transcript") return await getTranscript(args, dependencies);
    if (name === "get_video_info") return await getVideoInfo(args, dependencies);
    return errorResult(`Unknown tool "${name}".`);
  } catch (error) {
    return errorResult(mcpErrorMessage(error));
  }
}

export function createMcpServer(
  dependencies: McpDependencies = DEFAULT_DEPENDENCIES,
): Server {
  const server = new Server(
    { name: "transcriptly", version: VERSION },
    { capabilities: { tools: {} } },
  );
  server.onerror = (error) => {
    process.stderr.write(`MCP server error: ${normalizedMessage(error.message)}\n`);
  };
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    callTranscriptlyTool(
      request.params.name,
      request.params.arguments ?? {},
      dependencies,
    ),
  );
  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}
