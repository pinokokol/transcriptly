import { existsSync } from "node:fs";
import { join } from "node:path";

import { TranscriptionError } from "./errors";
import { runCommand } from "./process";
import type { ResolvedSource } from "./resolve";

export async function extractAudio(
  source: ResolvedSource,
  outputDirectory: string,
): Promise<string> {
  const outputPath = join(outputDirectory, "audio.wav");

  if (source.kind === "local-file") {
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source.location,
      "-map",
      "0:a:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ]);
  } else {
    await runCommand("yt-dlp", [
      "--no-playlist",
      "--no-warnings",
      "--extract-audio",
      "--audio-format",
      "wav",
      "--postprocessor-args",
      "ffmpeg:-ar 16000 -ac 1",
      "--output",
      join(outputDirectory, "audio.%(ext)s"),
      source.location,
    ]);
  }

  if (!existsSync(outputPath)) {
    throw new TranscriptionError(
      `Audio extraction completed without producing the expected WAV file at "${outputPath}".`,
    );
  }

  return outputPath;
}
