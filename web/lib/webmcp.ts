import {
  fetchInfo,
  fetchTranscriptAs,
  streamTranscript,
  streamUpload,
  type ProgressStage,
  type TranscriptJson,
} from "./api";
import { formatTranscript } from "./format";

// WebMCP draft: https://webmachinelearning.github.io/webmcp/
interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, options: { signal?: AbortSignal }) => Promise<unknown>;
}

interface ModelContext {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): Promise<void>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export interface AgentActivity {
  id: number;
  tool: string;
  detail: string;
  status: "running" | "done" | "error";
  startedAt: number;
  durationMs?: number;
}

export interface WebMcpHooks {
  onActivityStart: (activity: AgentActivity) => void;
  onActivityUpdate?: (id: number, detail: string) => void;
  onActivityEnd: (id: number, status: "done" | "error", durationMs: number) => void;
  /** The file a human dropped on the page, if any - agents cannot reach the disk themselves. */
  getDroppedFile: () => File | null;
  /** Mirrors an agent-fetched transcript into the page so the human sees what the agent got. */
  showTranscript: (transcript: TranscriptJson, source: string) => void;
}

export function isWebMcpAvailable(): boolean {
  return typeof document !== "undefined" && !!document.modelContext;
}

/**
 * ?mockmcp=1 installs a capture-only stand-in when the browser has no WebMCP,
 * so the agent flow can be exercised (and filmed) without a WebMCP build:
 * window.__callTool("get_transcript", {url}) behaves like a real agent call.
 */
function installMockIfRequested(): void {
  if (typeof location === "undefined" || document.modelContext) return;
  if (!new URLSearchParams(location.search).has("mockmcp")) return;
  const tools: ModelContextTool[] = [];
  document.modelContext = {
    registerTool: async (tool) => {
      tools.push(tool);
    },
  };
  (window as unknown as Record<string, unknown>).__callTool = (
    name: string,
    input: Record<string, unknown> = {},
  ) => tools.find((tool) => tool.name === name)?.execute(input, {});
}

let nextActivityId = 1;

async function tracked<T>(
  hooks: WebMcpHooks,
  tool: string,
  detail: string,
  run: (id: number) => Promise<T>,
): Promise<T> {
  const id = nextActivityId++;
  const startedAt = Date.now();
  hooks.onActivityStart({ id, tool, detail, status: "running", startedAt });
  try {
    const result = await run(id);
    hooks.onActivityEnd(id, "done", Date.now() - startedAt);
    return result;
  } catch (error) {
    hooks.onActivityEnd(id, "error", Date.now() - startedAt);
    throw error;
  }
}

function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function progressDetail(stage: ProgressStage): string {
  if (stage.stage === "cached" || stage.stage === "resolving") return stage.stage;
  const title = stage.title?.trim();
  const duration = stage.duration === undefined ? undefined : formatDuration(stage.duration);
  const context = [title, duration && (title ? `(${duration})` : duration)].filter(Boolean).join(" ");
  return context ? `${stage.stage} · ${context}` : stage.stage;
}

/** Registers the page's three tools; resolves to the count (0 if WebMCP is absent). */
export async function registerTranscriptlyTools(
  hooks: WebMcpHooks,
  signal: AbortSignal,
): Promise<number> {
  installMockIfRequested();
  const context = document.modelContext;
  if (!context) return 0;

  await context.registerTool(
    {
      name: "get_transcript",
      title: "Get transcript",
      description:
        "Transcribe a video or audio URL (YouTube, TikTok, Facebook, X, Reddit, direct media links) and return the full transcript as text in the requested format. To deliver a file, call this with the format you need (md, srt, txt, or json) and save the returned text with the matching extension; the page's copy and download buttons work for the human only, and repeat calls for the same URL are instant. The transcript is also shown to the human on the page.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Video or audio URL." },
          format: {
            type: "string",
            enum: ["md", "txt", "json", "srt"],
            default: "md",
            description:
              "md: Markdown with timestamps (default). txt: plain text. srt: subtitle file. json: title, duration, and segments with start and end seconds.",
          },
        },
        required: ["url"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        const url = String(input.url ?? "");
        const format = (input.format as "md" | "txt" | "json" | "srt") ?? "md";
        return tracked(hooks, "get_transcript", url, async (id) => {
          const transcript = await streamTranscript(url, (stage) =>
            hooks.onActivityUpdate?.(id, progressDetail(stage)),
          );
          hooks.showTranscript(transcript, url);
          return format === "json"
            ? JSON.stringify(transcript, null, 2)
            : fetchTranscriptAs(url, format);
        });
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "get_video_info",
      title: "Get video info",
      description:
        "Look up a video's title, duration in seconds, platform, and available caption tracks without transcribing. Cheap - use it to check duration before a long transcription.",
      inputSchema: {
        type: "object",
        properties: { url: { type: "string", description: "Video or audio URL." } },
        required: ["url"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        const url = String(input.url ?? "");
        return tracked(hooks, "get_video_info", url, () => fetchInfo(url));
      },
    },
    { signal },
  );

  await context.registerTool(
    {
      name: "transcribe_file",
      title: "Transcribe the dropped file",
      description:
        "Transcribe the media file the human has dropped onto this page and return the full transcript as text in the requested format (md, txt, srt, or json; save it with the matching extension for a file). Agents cannot access the user's disk - if no file is loaded, ask the human to drag one onto the page first.",
      inputSchema: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["md", "txt", "json", "srt"],
            default: "txt",
            description: "md: Markdown with timestamps. txt: plain text (default). srt: subtitle file. json: full structure.",
          },
        },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        const format = (input.format as "md" | "txt" | "json" | "srt") ?? "txt";
        const file = hooks.getDroppedFile();
        if (!file) {
          return "No file is loaded. Ask the human to drag an audio or video file onto the page, then call this tool again.";
        }
        return tracked(hooks, "transcribe_file", file.name, async (id) => {
          const transcript = await streamUpload(file, (stage) =>
            hooks.onActivityUpdate?.(id, progressDetail(stage)),
          );
          hooks.showTranscript(transcript, file.name);
          return formatTranscript(transcript, format);
        });
      },
    },
    { signal },
  );

  return 3;
}
