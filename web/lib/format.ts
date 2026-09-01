import type { TranscriptFormat, TranscriptJson } from "./api";

/* Client-side twins of src/format.ts, so copy and download work from the JSON
   the page already holds (uploads included) without another request. */

function wholeSecondTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(remaining)}` : `${pad(minutes)}:${pad(remaining)}`;
}

function srtTimestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)},${String(milliseconds).padStart(3, "0")}`;
}

export function formatTranscript(transcript: TranscriptJson, format: TranscriptFormat): string {
  switch (format) {
    case "md": {
      const title = transcript.metadata.title ?? "Transcript";
      const body = transcript.segments
        .map((segment) => `**[${wholeSecondTimestamp(segment.start)}]** ${segment.text}`)
        .join("\n\n");
      return body ? `# ${title}\n\n${body}` : `# ${title}`;
    }
    case "txt":
      return transcript.text;
    case "json":
      return JSON.stringify(transcript, null, 2);
    case "srt":
      return transcript.segments
        .map(
          (segment, index) =>
            `${index + 1}\n${srtTimestamp(segment.start)} --> ${srtTimestamp(segment.end)}\n${segment.text}`,
        )
        .join("\n\n");
  }
}

export const MIME_TYPES: Record<TranscriptFormat, string> = {
  md: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  srt: "text/plain;charset=utf-8",
  json: "application/json;charset=utf-8",
};

/** "Me at the zoo" -> "me-at-the-zoo.srt" */
export function downloadName(transcript: TranscriptJson, format: TranscriptFormat): string {
  const base = (transcript.metadata.title ?? "transcript")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return `${base || "transcript"}.${format}`;
}

export function downloadTranscript(transcript: TranscriptJson, format: TranscriptFormat): void {
  const blob = new Blob([formatTranscript(transcript, format)], { type: MIME_TYPES[format] });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = downloadName(transcript, format);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
}
