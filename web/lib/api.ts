// Same-origin in production (Caddy routes /api/* to the API container);
// NEXT_PUBLIC_API_BASE points local dev at a locally running server.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type TranscriptFormat = "md" | "txt" | "json" | "srt";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptJson {
  source: { input: string; type: string };
  metadata: { title?: string; duration?: number; platform?: string };
  segments: TranscriptSegment[];
  text: string;
}

export type ProgressStage = {
  stage: "resolving" | "downloading" | "transcribing" | "cached";
  title?: string;
  duration?: number;
};

export interface VideoInfo {
  title: string | null;
  duration: number | null;
  platform: string | null;
  captionTracks: { manual: string[]; automatic: string[] };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<never> {
  let message = `Request failed (${response.status}).`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Non-JSON error body; keep the generic message.
  }
  throw new ApiError(response.status, message);
}

async function readTranscriptStream(
  response: Response,
  onStage: (stage: ProgressStage) => void,
): Promise<TranscriptJson> {
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/event-stream")) {
    if (!response.ok) await readError(response);
    return (await response.json()) as TranscriptJson;
  }

  if (!response.body) throw new ApiError(500, "The progress stream had no response body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: TranscriptJson | undefined;

  const readFrame = (frame: string): void => {
    if (!frame || frame.startsWith(":")) return;
    const lines = frame.split("\n");
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
    const dataText = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!event || !dataText) return;

    const data = JSON.parse(dataText) as unknown;
    if (event === "stage") onStage(data as ProgressStage);
    if (event === "result") result = data as TranscriptJson;
    if (event === "error") {
      const error = data as { status?: number; error?: string };
      throw new ApiError(error.status ?? 500, error.error ?? "Transcription failed.");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      readFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  readFrame(buffer);

  if (!result) throw new ApiError(500, "The progress stream ended before returning a transcript.");
  return result;
}

export async function fetchTranscript(url: string): Promise<TranscriptJson> {
  const response = await fetch(
    `${API_BASE}/api/transcript?url=${encodeURIComponent(url)}&format=json`,
  );
  if (!response.ok) await readError(response);
  return (await response.json()) as TranscriptJson;
}

export async function streamTranscript(
  url: string,
  onStage: (stage: ProgressStage) => void,
): Promise<TranscriptJson> {
  const response = await fetch(
    `${API_BASE}/api/transcript?url=${encodeURIComponent(url)}&progress=1&format=json`,
  );
  return readTranscriptStream(response, onStage);
}

export async function fetchTranscriptAs(url: string, format: TranscriptFormat): Promise<string> {
  const response = await fetch(
    `${API_BASE}/api/transcript?url=${encodeURIComponent(url)}&format=${format}`,
  );
  if (!response.ok) await readError(response);
  return response.text();
}

export async function uploadTranscript(file: File): Promise<TranscriptJson> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/api/transcript?format=json`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) await readError(response);
  return (await response.json()) as TranscriptJson;
}

export async function streamUpload(
  file: File,
  onStage: (stage: ProgressStage) => void,
): Promise<TranscriptJson> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/api/transcript?progress=1&format=json`, {
    method: "POST",
    body: form,
  });
  return readTranscriptStream(response, onStage);
}

export async function fetchInfo(url: string): Promise<VideoInfo> {
  const response = await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(url)}`);
  if (!response.ok) await readError(response);
  return (await response.json()) as VideoInfo;
}

export async function joinWaitlist(email: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) await readError(response);
}
