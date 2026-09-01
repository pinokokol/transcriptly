import {
  CaptionsUnavailableError,
  CommandExecutionError,
  InvalidOptionError,
  InvalidSourceError,
  SourceNotFoundError,
  TranscriptlyError,
  UnsupportedUrlError,
} from "../src/index";
import type { TranscriptFormat } from "../src/index";

export const FREE_TIER_HEADER =
  "free tier with limits; run it yourself: https://github.com/pinokokol/transcriptly or join the waitlist: https://transcriptly.dev/#waitlist";

const CONTENT_TYPES: Record<TranscriptFormat, string> = {
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  srt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
};

/**
 * Client address for rate limiting. Undefined means use the socket address.
 * Trusting X-Forwarded-For is safe behind Caddy 2.5+, which strips the
 * header from untrusted clients before appending the real address.
 */
export function clientKeyFrom(headers: Headers, trustProxy: boolean): string | undefined {
  if (!trustProxy) return undefined;
  return headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || undefined;
}

export function corsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function transcriptResponse(
  text: string,
  format: TranscriptFormat,
  headers: Record<string, string>,
): Response {
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": CONTENT_TYPES[format], ...headers },
  });
}

export type SseEventName = "stage" | "result" | "error";

export function sseResponse(
  run: (emit: (event: SseEventName, data: unknown) => void) => Promise<void>,
  headers: Record<string, string>,
): Response {
  const encoder = new TextEncoder();
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let open = true;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (text: string): void => {
        if (open) controller.enqueue(encoder.encode(text));
      };
      const emit = (event: SseEventName, data: unknown): void => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      pingTimer = setInterval(() => enqueue(": ping\n\n"), 15_000);
      void run(emit).finally(() => {
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = undefined;
        if (open) {
          open = false;
          controller.close();
        }
      });
    },
    cancel() {
      open = false;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = undefined;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      ...headers,
    },
  });
}

export interface HttpError {
  status: number;
  message: string;
}

/** Friendly HTTP mapping; server paths and binary names never leak to clients. */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof SourceNotFoundError) {
    return { status: 404, message: "That file was not found on the server." };
  }
  if (error instanceof UnsupportedUrlError) {
    return {
      status: 422,
      message: "Unsupported URL. Use a link yt-dlp understands or a direct media URL.",
    };
  }
  if (error instanceof CaptionsUnavailableError) {
    return { status: 422, message: "No captions available for that source. Try mode=asr." };
  }
  if (error instanceof InvalidSourceError || error instanceof InvalidOptionError) {
    return { status: 400, message: "Invalid request. Check the URL and parameters." };
  }
  if (error instanceof CommandExecutionError) {
    return {
      status: 502,
      message: "Could not fetch or process that source. Check the URL and try again.",
    };
  }
  if (error instanceof TranscriptlyError) {
    return { status: 500, message: "Transcription backend error. Try again later." };
  }
  return { status: 500, message: "Unexpected server error. Try again later." };
}
