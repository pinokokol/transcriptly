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

export async function fetchTranscript(url: string): Promise<TranscriptJson> {
  const response = await fetch(
    `${API_BASE}/api/transcript?url=${encodeURIComponent(url)}&format=json`,
  );
  if (!response.ok) await readError(response);
  return (await response.json()) as TranscriptJson;
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
