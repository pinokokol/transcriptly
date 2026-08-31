import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAsrEngine } from "./asr";
import { extractAudio } from "./audio";
import { downloadCaptions } from "./captions";
import { InvalidOptionError } from "./errors";
import { normalizeSegments } from "./normalize";
import { resolveSource, type SourceKind, type TranscriptMetadata } from "./resolve";

export type { SourceKind, TranscriptMetadata } from "./resolve";

export type TranscriptionMode = "asr" | "captions";
export type TranscriptFormat = "md" | "txt" | "json" | "srt";
export type AsrEngineName = "local" | "groq";

export interface TranscribeOptions {
  mode?: TranscriptionMode;
  format?: TranscriptFormat;
  lang?: string;
  model?: string;
  engine?: AsrEngineName;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptSource {
  input: string;
  type: SourceKind;
}

export interface Transcript {
  source: TranscriptSource;
  metadata: TranscriptMetadata;
  segments: TranscriptSegment[];
  text: string;
}

function validateOptions(options: TranscribeOptions): void {
  if (options.mode !== undefined && options.mode !== "asr" && options.mode !== "captions") {
    throw new InvalidOptionError("mode", options.mode, '"asr" or "captions"');
  }
  if (options.engine !== undefined && options.engine !== "local" && options.engine !== "groq") {
    throw new InvalidOptionError("engine", options.engine, '"local" or "groq"');
  }
  if (
    options.format !== undefined &&
    !(["md", "txt", "json", "srt"] as const).includes(options.format)
  ) {
    throw new InvalidOptionError(
      "format",
      options.format,
      '"md", "txt", "json", or "srt"',
    );
  }
}

export async function transcribe(
  source: string,
  options: TranscribeOptions = {},
): Promise<Transcript> {
  validateOptions(options);
  const resolved = await resolveSource(source);
  const workingDirectory = await mkdtemp(join(tmpdir(), "transcriptly-"));

  try {
    const rawSegments =
      (options.mode ?? "asr") === "captions"
        ? await downloadCaptions(resolved, workingDirectory, options.lang)
        : await createAsrEngine(options.engine ?? "local").transcribe(
            await extractAudio(resolved, workingDirectory),
            { lang: options.lang, model: options.model },
          );
    const segments = normalizeSegments(rawSegments);

    return {
      source: { input: resolved.input, type: resolved.kind },
      metadata: resolved.metadata,
      segments,
      text: segments.map((segment) => segment.text).join(" "),
    };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
