import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { CaptionsUnavailableError, CommandExecutionError } from "./errors";
import { runCommand } from "./process";
import type { ResolvedSource } from "./resolve";
import type { TranscriptSegment } from "./transcribe";

function parseTimestamp(value: string): number | undefined {
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!match) return undefined;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  );
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    );
}

function cleanCueText(lines: readonly string[]): string {
  return decodeEntities(
    lines
      .join(" ")
      .replace(/<\d{2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function comparableWord(word: string): string {
  return word.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function removeRollingOverlap(previous: string, current: string): string {
  const previousWords = previous.split(/\s+/);
  const currentWords = current.split(/\s+/);
  const maximum = Math.min(previousWords.length, currentWords.length);

  for (let size = maximum; size > 0; size -= 1) {
    const suffix = previousWords.slice(-size).map(comparableWord);
    const prefix = currentWords.slice(0, size).map(comparableWord);
    if (suffix.every((word, index) => word && word === prefix[index])) {
      return currentWords.slice(size).join(" ");
    }
  }

  return current;
}

export function dedupeCaptionSegments(
  segments: readonly TranscriptSegment[],
): TranscriptSegment[] {
  const deduped: TranscriptSegment[] = [];
  let previousRaw: TranscriptSegment | undefined;

  for (const segment of segments) {
    let text = segment.text;
    const overlapsInTime = previousRaw && segment.start <= previousRaw.end + 0.25;
    if (previousRaw && overlapsInTime) {
      text = removeRollingOverlap(previousRaw.text, text).trim();
    }

    if (text) {
      deduped.push({ ...segment, text });
    } else if (deduped.length > 0) {
      deduped[deduped.length - 1]!.end = Math.max(
        deduped[deduped.length - 1]!.end,
        segment.end,
      );
    }
    previousRaw = segment;
  }

  return deduped;
}

export function parseVtt(vtt: string): TranscriptSegment[] {
  const lines = vtt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const segments: TranscriptSegment[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line || line === "WEBVTT") continue;
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/.test(line)) {
      while (index + 1 < lines.length && lines[index + 1]!.trim()) index += 1;
      continue;
    }

    let timing = line;
    if (!timing.includes("-->") && lines[index + 1]?.includes("-->")) {
      timing = lines[++index]!.trim();
    }
    if (!timing.includes("-->")) continue;

    const [rawStart, rawEndAndSettings] = timing.split("-->", 2);
    const rawEnd = rawEndAndSettings?.trim().split(/\s+/, 1)[0];
    const start = rawStart ? parseTimestamp(rawStart) : undefined;
    const end = rawEnd ? parseTimestamp(rawEnd) : undefined;
    if (start === undefined || end === undefined) continue;

    const cueLines: string[] = [];
    while (index + 1 < lines.length && lines[index + 1]!.trim()) {
      cueLines.push(lines[++index]!);
    }
    const text = cleanCueText(cueLines);
    if (text) segments.push({ start, end, text });
  }

  return dedupeCaptionSegments(segments);
}

function matchingLanguage(languages: readonly string[], language: string): string | undefined {
  const requested = language.toLocaleLowerCase();
  return (
    languages.find((candidate) => candidate.toLocaleLowerCase() === requested) ??
    languages.find((candidate) =>
      candidate.toLocaleLowerCase().startsWith(`${requested}-`),
    )
  );
}

function selectTrack(
  source: ResolvedSource,
  language?: string,
): { language: string; automatic: boolean } | undefined {
  const { manual, automatic } = source.captionTracks;
  if (language) {
    const manualMatch = matchingLanguage(manual, language);
    if (manualMatch) return { language: manualMatch, automatic: false };
    const automaticMatch = matchingLanguage(automatic, language);
    if (automaticMatch) return { language: automaticMatch, automatic: true };
    return undefined;
  }

  const preferredManual = matchingLanguage(manual, "en");
  if (preferredManual) return { language: preferredManual, automatic: false };
  if (manual[0]) return { language: manual[0], automatic: false };
  const preferredAutomatic = matchingLanguage(automatic, "en");
  if (preferredAutomatic) return { language: preferredAutomatic, automatic: true };
  if (automatic[0]) return { language: automatic[0], automatic: true };
  return undefined;
}

export async function downloadCaptions(
  source: ResolvedSource,
  outputDirectory: string,
  language?: string,
): Promise<TranscriptSegment[]> {
  if (source.kind === "local-file") {
    throw new CaptionsUnavailableError(source.input, language);
  }

  const track = selectTrack(source, language);
  if (!track) throw new CaptionsUnavailableError(source.input, language);

  try {
    await runCommand("yt-dlp", [
      "--skip-download",
      "--no-playlist",
      "--no-warnings",
      track.automatic ? "--write-auto-subs" : "--write-subs",
      "--sub-langs",
      track.language,
      "--sub-format",
      "vtt",
      "--output",
      join(outputDirectory, "captions.%(language)s.%(ext)s"),
      source.location,
    ]);
  } catch (error) {
    throw new CaptionsUnavailableError(source.input, language, { cause: error });
  }

  const files = (await readdir(outputDirectory)).filter(
    (file) => file.startsWith("captions.") && file.endsWith(".vtt"),
  );
  const captionFile = files[0];
  if (!captionFile) throw new CaptionsUnavailableError(source.input, language);

  const segments = parseVtt(await readFile(join(outputDirectory, captionFile), "utf8"));
  if (segments.length === 0) throw new CaptionsUnavailableError(source.input, language);
  return segments;
}
