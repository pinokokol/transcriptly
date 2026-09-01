import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve as resolvePath } from "node:path";

import { ConfigurationError, MissingModelError, TranscriptionError } from "./errors";
import { runCommand } from "./process";
import type { TranscriptSegment } from "./transcribe";

export const GROQ_TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MODEL = "whisper-large-v3-turbo";

export interface AsrOptions {
  lang?: string;
  model?: string;
}

export interface AsrEngine {
  transcribe(audioPath: string, options: AsrOptions): Promise<TranscriptSegment[]>;
}

function isModelPath(model: string): boolean {
  return (
    isAbsolute(model) ||
    model.startsWith(".") ||
    model.startsWith("~") ||
    model.includes("/") ||
    extname(model) === ".bin"
  );
}

export function resolveModelPath(model = "small"): string {
  const path = isModelPath(model)
    ? resolvePath(model.startsWith("~/") ? join(homedir(), model.slice(2)) : model)
    : join(homedir(), ".cache", "transcriptly", "models", `ggml-${model}.bin`);

  if (!existsSync(path)) throw new MissingModelError(model, path);
  return path;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function timestampValue(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!match) return undefined;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  );
}

export function parseWhisperJson(value: unknown): TranscriptSegment[] {
  if (!value || typeof value !== "object") return [];
  const transcription = (value as { transcription?: unknown }).transcription;
  if (!Array.isArray(transcription)) return [];

  return transcription.flatMap((entry): TranscriptSegment[] => {
    if (!entry || typeof entry !== "object") return [];
    const segment = entry as {
      text?: unknown;
      start?: unknown;
      end?: unknown;
      offsets?: { from?: unknown; to?: unknown };
      timestamps?: { from?: unknown; to?: unknown };
    };
    const text = typeof segment.text === "string" ? segment.text.trim() : "";
    if (!text) return [];

    const offsetStart = numberValue(segment.offsets?.from);
    const offsetEnd = numberValue(segment.offsets?.to);
    const start =
      numberValue(segment.start) ??
      (offsetStart === undefined ? undefined : offsetStart / 1000) ??
      timestampValue(segment.timestamps?.from) ??
      0;
    const end =
      numberValue(segment.end) ??
      (offsetEnd === undefined ? undefined : offsetEnd / 1000) ??
      timestampValue(segment.timestamps?.to) ??
      start;

    return [{ start, end, text }];
  });
}

export class LocalAsrEngine implements AsrEngine {
  async transcribe(audioPath: string, options: AsrOptions): Promise<TranscriptSegment[]> {
    const modelPath = resolveModelPath(options.model);
    const outputPrefix = join(dirname(audioPath), "whisper");

    await runCommand("whisper-cli", [
      "--model",
      modelPath,
      "--file",
      audioPath,
      "--language",
      options.lang ?? "auto",
      "--output-json",
      "--output-file",
      outputPrefix,
      "--no-prints",
    ]);

    const outputPath = `${outputPrefix}.json`;
    let json: unknown;
    try {
      json = JSON.parse(await readFile(outputPath, "utf8"));
    } catch (error) {
      throw new TranscriptionError(
        `whisper-cli did not produce valid JSON at "${outputPath}".`,
        { cause: error },
      );
    }

    const segments = parseWhisperJson(json);
    if (segments.length === 0) {
      throw new TranscriptionError("whisper-cli returned no transcription segments.");
    }
    return segments;
  }
}

interface GroqSegment {
  start?: unknown;
  end?: unknown;
  text?: unknown;
}

interface GroqResponse {
  text?: unknown;
  segments?: unknown;
}

/**
 * Groq caps uploads at 25 MB and raw 16 kHz WAV crosses that after ~13 minutes.
 * Re-encode to 64 kbps mono MP3 (about 0.5 MB per minute) before uploading.
 */
export async function compressForUpload(audioPath: string): Promise<string> {
  const target = `${audioPath.replace(/\.wav$/i, "")}.mp3`;
  try {
    await runCommand("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      audioPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "64k",
      target,
    ]);
  } catch (error) {
    throw new TranscriptionError("Could not compress audio for upload.", { cause: error });
  }
  return target;
}

export class GroqAsrEngine implements AsrEngine {
  constructor(
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly apiKey?: string,
    private readonly prepareUpload: (audioPath: string) => Promise<string> = compressForUpload,
  ) {}

  async transcribe(audioPath: string, options: AsrOptions): Promise<TranscriptSegment[]> {
    const apiKey = this.apiKey ?? process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ConfigurationError(
        "GROQ_API_KEY is required when the ASR engine is \"groq\".",
      );
    }

    const uploadPath = await this.prepareUpload(audioPath);
    const form = new FormData();
    const audio = new Blob([new Uint8Array(await readFile(uploadPath))]);
    form.append("file", audio, basename(uploadPath));
    form.append("model", GROQ_MODEL);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    if (options.lang) form.append("language", options.lang);

    let response: Response;
    try {
      response = await this.fetchImplementation(GROQ_TRANSCRIPTIONS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (error) {
      throw new TranscriptionError("Groq transcription request failed.", { cause: error });
    }

    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 1_500);
      throw new TranscriptionError(
        `Groq transcription failed with HTTP ${response.status}: ${detail || response.statusText}`,
      );
    }

    let result: GroqResponse;
    try {
      result = (await response.json()) as GroqResponse;
    } catch (error) {
      throw new TranscriptionError("Groq returned invalid transcription JSON.", { cause: error });
    }

    const rawSegments = Array.isArray(result.segments)
      ? (result.segments as GroqSegment[])
      : [];
    const segments = rawSegments.flatMap((segment): TranscriptSegment[] => {
      const text = typeof segment.text === "string" ? segment.text.trim() : "";
      if (!text) return [];
      return [
        {
          start: numberValue(segment.start) ?? 0,
          end: numberValue(segment.end) ?? numberValue(segment.start) ?? 0,
          text,
        },
      ];
    });

    if (segments.length > 0) return segments;
    const text = typeof result.text === "string" ? result.text.trim() : "";
    if (text) return [{ start: 0, end: 0, text }];
    throw new TranscriptionError("Groq returned no transcription text or segments.");
  }
}

export function createAsrEngine(engine: "local" | "groq"): AsrEngine {
  return engine === "groq" ? new GroqAsrEngine() : new LocalAsrEngine();
}
