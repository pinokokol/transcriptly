import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatTranscript, transcribe } from "../src/index";
import type { Transcript, TranscriptFormat } from "../src/index";
import { resolveSource } from "../src/resolve";

import type { TranscriptCache } from "./cache";
import type { ServerConfig } from "./env";
import type { DailyBudget, SlidingWindowLimiter } from "./limits";
import { DEMO_HEADER, jsonResponse, toHttpError, transcriptResponse } from "./respond";
import { isValidEmail, recordSignup } from "./waitlist";

const FORMATS = ["md", "txt", "json", "srt"] as const;

export interface ServerContext {
  config: ServerConfig;
  cache: TranscriptCache;
  budget: DailyBudget;
  transcriptLimiter: SlidingWindowLimiter;
  lookupLimiter: SlidingWindowLimiter;
  deps: {
    transcribe: typeof transcribe;
    resolveSource: typeof resolveSource;
  };
}

export function defaultDependencies(): ServerContext["deps"] {
  return { transcribe, resolveSource };
}

function parseFormat(value: string | null): TranscriptFormat | undefined {
  if (value === null) return "md";
  return (FORMATS as readonly string[]).includes(value)
    ? (value as TranscriptFormat)
    : undefined;
}

function rateLimited(retryAfterSeconds: number, message: string): Response {
  return jsonResponse(429, { error: message }, { "Retry-After": String(retryAfterSeconds) });
}

async function produceTranscript(
  context: ServerContext,
  clientKey: string,
  source: string,
  format: TranscriptFormat,
  headers: Record<string, string>,
  cacheable = true,
): Promise<Response> {
  const { cache, budget, transcriptLimiter, config, deps } = context;
  const responseHeaders = { ...headers, "X-Transcriptly": DEMO_HEADER };

  const cacheKey = cache.key(source, "asr");
  if (cacheable) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return transcriptResponse(formatTranscript(cached, format), format, {
        ...responseHeaders,
        "X-Transcriptly-Cache": "hit",
      });
    }
  }

  const decision = transcriptLimiter.check(clientKey);
  if (!decision.allowed) {
    return rateLimited(
      decision.retryAfterSeconds,
      "Rate limit reached for this demo. Run transcriptly locally for unlimited use.",
    );
  }

  const resolved = await deps.resolveSource(source);
  const duration = resolved.metadata.duration;
  if (duration !== undefined && duration > config.limits.maxDurationSeconds) {
    return jsonResponse(
      413,
      {
        error: `Demo cap is ${Math.floor(config.limits.maxDurationSeconds / 60)} minutes; this source is ${Math.ceil(duration / 60)} minutes. Run transcriptly locally for longer media.`,
      },
      responseHeaders,
    );
  }
  const estimatedSeconds = duration ?? config.limits.maxDurationSeconds;
  if (budget.remainingSeconds() < estimatedSeconds) {
    return rateLimited(
      3600,
      "The demo's daily transcription budget is used up. Try tomorrow or run transcriptly locally.",
    );
  }

  transcriptLimiter.record(clientKey);
  const transcript: Transcript = await deps.transcribe(resolved.location, {
    mode: "asr",
    engine: config.asrEngine,
    model: config.asrEngine === "local" ? config.whisperModel : undefined,
  });
  budget.spend(duration ?? transcript.segments.at(-1)?.end ?? 0);
  if (cacheable) cache.put(cacheKey, transcript);

  return transcriptResponse(formatTranscript(transcript, format), format, {
    ...responseHeaders,
    "X-Transcriptly-Cache": "miss",
  });
}

export async function handleTranscriptGet(
  context: ServerContext,
  url: URL,
  clientKey: string,
  headers: Record<string, string>,
): Promise<Response> {
  const source = url.searchParams.get("url")?.trim();
  if (!source) return jsonResponse(400, { error: 'Missing "url" query parameter.' }, headers);
  const format = parseFormat(url.searchParams.get("format"));
  if (!format) return jsonResponse(400, { error: "format must be md, txt, json, or srt." }, headers);

  try {
    return await produceTranscript(context, clientKey, source, format, headers);
  } catch (error) {
    process.stderr.write(`transcript error: ${String(error)}\n`);
    const { status, message } = toHttpError(error);
    return jsonResponse(status, { error: message }, headers);
  }
}

export async function handleTranscriptPost(
  context: ServerContext,
  request: Request,
  url: URL,
  clientKey: string,
  headers: Record<string, string>,
): Promise<Response> {
  const format = parseFormat(url.searchParams.get("format"));
  if (!format) return jsonResponse(400, { error: "format must be md, txt, json, or srt." }, headers);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse(400, { error: 'Send multipart form data with a "file" field.' }, headers);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse(400, { error: 'Send multipart form data with a "file" field.' }, headers);
  }
  if (file.size > context.config.limits.maxUploadBytes) {
    const capMb = Math.floor(context.config.limits.maxUploadBytes / (1024 * 1024));
    return jsonResponse(413, { error: `Upload cap is ${capMb} MB.` }, headers);
  }

  const workingDirectory = await mkdtemp(join(tmpdir(), "transcriptly-upload-"));
  try {
    const uploadPath = join(workingDirectory, file.name.replace(/[^\w.-]/g, "_") || "upload");
    await writeFile(uploadPath, new Uint8Array(await file.arrayBuffer()));
    return await produceTranscript(context, clientKey, uploadPath, format, headers, false);
  } catch (error) {
    process.stderr.write(`upload transcript error: ${String(error)}\n`);
    const { status, message } = toHttpError(error);
    return jsonResponse(status, { error: message }, headers);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function handleInfo(
  context: ServerContext,
  url: URL,
  clientKey: string,
  headers: Record<string, string>,
): Promise<Response> {
  const source = url.searchParams.get("url")?.trim();
  if (!source) return jsonResponse(400, { error: 'Missing "url" query parameter.' }, headers);

  const decision = context.lookupLimiter.check(clientKey);
  if (!decision.allowed) {
    return rateLimited(decision.retryAfterSeconds, "Rate limit reached. Slow down a little.");
  }
  context.lookupLimiter.record(clientKey);

  try {
    const resolved = await context.deps.resolveSource(source);
    return jsonResponse(
      200,
      {
        title: resolved.metadata.title ?? null,
        duration: resolved.metadata.duration ?? null,
        platform: resolved.metadata.platform ?? null,
        captionTracks: resolved.captionTracks,
      },
      { ...headers, "X-Transcriptly": DEMO_HEADER },
    );
  } catch (error) {
    process.stderr.write(`info error: ${String(error)}\n`);
    const { status, message } = toHttpError(error);
    return jsonResponse(status, { error: message }, headers);
  }
}

export async function handleWaitlist(
  context: ServerContext,
  request: Request,
  clientKey: string,
  headers: Record<string, string>,
): Promise<Response> {
  const decision = context.lookupLimiter.check(clientKey);
  if (!decision.allowed) {
    return rateLimited(decision.retryAfterSeconds, "Rate limit reached. Slow down a little.");
  }
  context.lookupLimiter.record(clientKey);

  let email: unknown;
  try {
    email = ((await request.json()) as { email?: unknown }).email;
  } catch {
    return jsonResponse(400, { error: 'Send JSON: {"email": "you@example.com"}.' }, headers);
  }
  if (typeof email !== "string" || !isValidEmail(email.trim())) {
    return jsonResponse(400, { error: "That does not look like an email address." }, headers);
  }

  await recordSignup(email.trim(), context.config.dataDir, context.config.discordWebhookUrl);
  return jsonResponse(200, { ok: true, message: "You are on the list. Thanks!" }, headers);
}
