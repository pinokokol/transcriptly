import type { Transcript, TranscriptFormat } from "./transcribe";

function wholeSecondTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function formatSrtTimestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

export function formatMarkdown(transcript: Transcript): string {
  const title = transcript.metadata.title ?? "Transcript";
  const body = transcript.segments
    .map((segment) => `**[${wholeSecondTimestamp(segment.start)}]** ${segment.text}`)
    .join("\n\n");
  return body ? `# ${title}\n\n${body}` : `# ${title}`;
}

export function formatText(transcript: Transcript): string {
  return transcript.text;
}

export function formatJson(transcript: Transcript): string {
  return JSON.stringify(transcript, null, 2);
}

export function formatSrt(transcript: Transcript): string {
  return transcript.segments
    .map(
      (segment, index) =>
        `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\n${segment.text}`,
    )
    .join("\n\n");
}

export function formatTranscript(
  transcript: Transcript,
  format: TranscriptFormat,
): string {
  switch (format) {
    case "md":
      return formatMarkdown(transcript);
    case "txt":
      return formatText(transcript);
    case "json":
      return formatJson(transcript);
    case "srt":
      return formatSrt(transcript);
  }
}
