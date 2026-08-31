import { existsSync } from "node:fs";
import { basename, extname, resolve as resolvePath } from "node:path";

import {
  CommandExecutionError,
  InvalidSourceError,
  SourceNotFoundError,
  UnsupportedUrlError,
} from "./errors";
import { runCommand } from "./process";

export type SourceKind = "platform-url" | "media-url" | "local-file";

export interface TranscriptMetadata {
  title?: string;
  duration?: number;
  platform?: string;
}

export interface CaptionTracks {
  manual: string[];
  automatic: string[];
}

export interface ResolvedSource {
  input: string;
  location: string;
  kind: SourceKind;
  metadata: TranscriptMetadata;
  captionTracks: CaptionTracks;
}

const MEDIA_EXTENSIONS = new Set([
  ".aac",
  ".aiff",
  ".avi",
  ".flac",
  ".m3u8",
  ".m4a",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".oga",
  ".ogg",
  ".opus",
  ".ts",
  ".wav",
  ".webm",
]);

function parseHttpUrl(source: string): URL | undefined {
  try {
    const url = new URL(source);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new InvalidSourceError(source, "only HTTP(S) URLs and local file paths are supported");
    }
    return url;
  } catch (error) {
    if (error instanceof InvalidSourceError) throw error;
    return undefined;
  }
}

export function classifySource(source: string): SourceKind {
  const value = source.trim();
  if (!value) throw new InvalidSourceError(source, "the source is empty");

  const url = parseHttpUrl(value);
  if (!url) return "local-file";

  return MEDIA_EXTENSIONS.has(extname(url.pathname).toLowerCase())
    ? "media-url"
    : "platform-url";
}

function finiteDuration(value: unknown): number | undefined {
  const duration = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function captionLanguages(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value);
}

async function resolveUrl(input: string, kind: SourceKind): Promise<ResolvedSource> {
  let stdout: string;
  try {
    ({ stdout } = await runCommand("yt-dlp", [
      "--dump-single-json",
      "--no-playlist",
      "--no-warnings",
      input,
    ]));
  } catch (error) {
    if (
      error instanceof CommandExecutionError &&
      /unsupported url|no suitable extractor/i.test(error.stderr)
    ) {
      throw new UnsupportedUrlError(input, error.stderr, { cause: error });
    }
    throw error;
  }

  let info: Record<string, unknown>;
  try {
    info = JSON.parse(stdout) as Record<string, unknown>;
  } catch (error) {
    throw new InvalidSourceError(input, "yt-dlp returned invalid metadata JSON");
  }

  const rawPlatform = stringValue(info.extractor_key) ?? stringValue(info.extractor);
  const platform = rawPlatform && !/^generic$/i.test(rawPlatform) ? rawPlatform : undefined;

  return {
    input,
    location: input,
    kind,
    metadata: {
      title: stringValue(info.title),
      duration: finiteDuration(info.duration),
      platform,
    },
    captionTracks: {
      manual: captionLanguages(info.subtitles),
      automatic: captionLanguages(info.automatic_captions),
    },
  };
}

async function resolveLocal(input: string): Promise<ResolvedSource> {
  const path = resolvePath(input);
  if (!existsSync(path)) throw new SourceNotFoundError(path);

  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:format_tags=title:stream=duration",
    "-of",
    "json",
    path,
  ]);

  let info: {
    format?: { duration?: unknown; tags?: { title?: unknown } };
    streams?: Array<{ duration?: unknown }>;
  };
  try {
    info = JSON.parse(stdout) as typeof info;
  } catch {
    throw new InvalidSourceError(input, "ffprobe returned invalid metadata JSON");
  }

  const streamDuration = info.streams?.map((stream) => finiteDuration(stream.duration)).find(
    (duration): duration is number => duration !== undefined,
  );

  return {
    input,
    location: path,
    kind: "local-file",
    metadata: {
      title: stringValue(info.format?.tags?.title) ?? basename(path, extname(path)),
      duration: finiteDuration(info.format?.duration) ?? streamDuration,
    },
    captionTracks: { manual: [], automatic: [] },
  };
}

export async function resolveSource(source: string): Promise<ResolvedSource> {
  const input = source.trim();
  const kind = classifySource(input);
  return kind === "local-file" ? resolveLocal(input) : resolveUrl(input, kind);
}
