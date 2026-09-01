import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatTranscript, transcribe } from "../src/index";
import type { Transcript, TranscriptFormat, TranscriptMetadata } from "../src/index";
import { resolveSource } from "../src/resolve";

import type { TranscriptCache } from "./cache";
import type { ServerConfig } from "./env";
import type { DailyBudget, SlidingWindowLimiter } from "./limits";
import {
  FREE_TIER_HEADER,
  jsonResponse,
  sseResponse,
  toHttpError,
  transcriptResponse,
} from "./respond";
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

interface PipelineStage {
  stage: "resolving" | "downloading" | "transcribing" | "cached";
  title?: string;
  duration?: number;
}

interface PipelineSuccess {
  ok: true;
  transcript: Transcript;
  cache: "hit" | "miss";
}

interface PipelineFailure {
  ok: false;
  status: number;
  error: string;
  retryAfter?: number;
  plainHeaders: "request" | "tier" | "rate-limit";
}

type PipelineOutcome = PipelineSuccess | PipelineFailure;
type EmitProgress = (stage: PipelineStage) => void;

interface PipelineOptions {
  cacheable: boolean;
  sourceKind: "url" | "upload";
  errorLabel: "transcript" | "upload transcript";
}

function pipelineError(
  status: number,
  error: string,
  plainHeaders: PipelineFailure["plainHeaders"],
  retryAfter?: number,
): PipelineFailure {
  return { ok: false, status, error, plainHeaders, retryAfter };
}

async function runTranscriptPipeline(
  context: ServerContext,
  clientKey: string,
  source: string,
  options: PipelineOptions,
  emit: EmitProgress,
): Promise<PipelineOutcome> {
  const { cache, budget, transcriptLimiter, config, deps } = context;
  try {
    const cacheKey = cache.key(source, "asr");
    if (options.cacheable) {
      const cached = cache.get(cacheKey);
      if (cached) {
        emit({ stage: "cached" });
        return { ok: true, transcript: cached, cache: "hit" };
      }
    }

    const decision = transcriptLimiter.check(clientKey);
    if (!decision.allowed) {
      return pipelineError(
        429,
        `Free tier limit reached: ${config.limits.transcriptsPerHour} transcriptions per hour, ${config.limits.transcriptsPerDay} per day. Run transcriptly locally for unlimited use, or join the waitlist for a paid tier: https://transcriptly.dev/#waitlist`,
        "rate-limit",
        decision.retryAfterSeconds,
      );
    }

    if (options.sourceKind === "url") emit({ stage: "resolving" });

    const resolved = await deps.resolveSource(source);
    const metadata: TranscriptMetadata = resolved.metadata;
    const duration = metadata.duration;
    if (options.sourceKind === "url") {
      emit({ stage: "downloading", title: metadata.title, duration });
    }
    if (duration !== undefined && duration > config.limits.maxDurationSeconds) {
      return pipelineError(
        413,
        `The free tier caps videos at ${Math.floor(config.limits.maxDurationSeconds / 60)} minutes; this one is ${Math.ceil(duration / 60)} minutes. Run transcriptly locally for longer media, or join the waitlist for a paid tier: https://transcriptly.dev/#waitlist`,
        "tier",
      );
    }
    const estimatedSeconds = duration ?? config.limits.maxDurationSeconds;
    if (budget.remainingSeconds() < estimatedSeconds) {
      return pipelineError(
        429,
        "Today's free tier budget is used up. Try tomorrow, run transcriptly locally, or join the waitlist for a paid tier: https://transcriptly.dev/#waitlist",
        "rate-limit",
        3600,
      );
    }

    transcriptLimiter.record(clientKey);
    if (options.sourceKind === "upload") emit({ stage: "transcribing" });
    const transcript: Transcript = await deps.transcribe(
      resolved.location,
      {
        mode: "asr",
        engine: config.asrEngine,
        model: config.asrEngine === "local" ? config.whisperModel : undefined,
      },
      {
        onAudioReady:
          options.sourceKind === "url"
            ? () => emit({ stage: "transcribing", duration })
            : undefined,
      },
    );
    budget.spend(duration ?? transcript.segments.at(-1)?.end ?? 0);
    if (options.cacheable) cache.put(cacheKey, transcript);

    return { ok: true, transcript, cache: "miss" };
  } catch (error) {
    process.stderr.write(`${options.errorLabel} error: ${String(error)}\n`);
    const { status, message } = toHttpError(error);
    return pipelineError(status, message, "request");
  }
}

function plainPipelineResponse(
  outcome: PipelineOutcome,
  format: TranscriptFormat,
  headers: Record<string, string>,
): Response {
  if (outcome.ok) {
    return transcriptResponse(formatTranscript(outcome.transcript, format), format, {
      ...headers,
      "X-Transcriptly": FREE_TIER_HEADER,
      "X-Transcriptly-Cache": outcome.cache,
    });
  }
  if (outcome.plainHeaders === "rate-limit") {
    return rateLimited(outcome.retryAfter ?? 0, outcome.error);
  }
  return jsonResponse(
    outcome.status,
    { error: outcome.error },
    outcome.plainHeaders === "tier" ? { ...headers, "X-Transcriptly": FREE_TIER_HEADER } : headers,
  );
}

function streamingResponse(
  headers: Record<string, string>,
  run: (emit: EmitProgress) => Promise<PipelineOutcome>,
): Response {
  return sseResponse(async (send) => {
    const outcome = await run((stage) => send("stage", stage));
    if (outcome.ok) {
      send("result", outcome.transcript);
    } else {
      send("error", {
        status: outcome.status,
        error: outcome.error,
        ...(outcome.retryAfter !== undefined ? { retryAfter: outcome.retryAfter } : {}),
      });
    }
  }, { ...headers, "X-Transcriptly": FREE_TIER_HEADER });
}

function streamingError(
  headers: Record<string, string>,
  status: number,
  error: string,
  retryAfter?: number,
): Response {
  return streamingResponse(headers, async () =>
    pipelineError(status, error, "request", retryAfter),
  );
}

export async function handleTranscriptGet(
  context: ServerContext,
  url: URL,
  clientKey: string,
  headers: Record<string, string>,
): Promise<Response> {
  const source = url.searchParams.get("url")?.trim();
  const progress = url.searchParams.get("progress") === "1";
  if (!source) {
    const error = 'Missing "url" query parameter.';
    return progress ? streamingError(headers, 400, error) : jsonResponse(400, { error }, headers);
  }
  const formatValue = url.searchParams.get("format");
  if (progress && formatValue !== null && formatValue !== "json") {
    return jsonResponse(400, { error: "format must be md, txt, json, or srt." }, headers);
  }
  const format = progress ? "json" : parseFormat(formatValue);
  if (!format) return jsonResponse(400, { error: "format must be md, txt, json, or srt." }, headers);

  const run = (emit: EmitProgress) =>
    runTranscriptPipeline(
      context,
      clientKey,
      source,
      { cacheable: true, sourceKind: "url", errorLabel: "transcript" },
      emit,
    );
  if (progress) return streamingResponse(headers, run);
  return plainPipelineResponse(await run(() => {}), format, headers);
}

export async function handleTranscriptPost(
  context: ServerContext,
  request: Request,
  url: URL,
  clientKey: string,
  headers: Record<string, string>,
): Promise<Response> {
  const progress = url.searchParams.get("progress") === "1";
  const formatValue = url.searchParams.get("format");
  if (progress && formatValue !== null && formatValue !== "json") {
    return jsonResponse(400, { error: "format must be md, txt, json, or srt." }, headers);
  }
  const format = progress ? "json" : parseFormat(formatValue);
  if (!format) return jsonResponse(400, { error: "format must be md, txt, json, or srt." }, headers);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    const error = 'Send multipart form data with a "file" field.';
    return progress ? streamingError(headers, 400, error) : jsonResponse(400, { error }, headers);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    const error = 'Send multipart form data with a "file" field.';
    return progress ? streamingError(headers, 400, error) : jsonResponse(400, { error }, headers);
  }
  if (file.size > context.config.limits.maxUploadBytes) {
    const capMb = Math.floor(context.config.limits.maxUploadBytes / (1024 * 1024));
    const error = `The free tier caps uploads at ${capMb} MB. Run transcriptly locally for bigger files, or join the waitlist for a paid tier: https://transcriptly.dev/#waitlist`;
    return progress ? streamingError(headers, 413, error) : jsonResponse(413, { error }, headers);
  }

  const workingDirectory = await mkdtemp(join(tmpdir(), "transcriptly-upload-"));
  let cleanupInStream = false;
  try {
    const uploadPath = join(workingDirectory, file.name.replace(/[^\w.-]/g, "_") || "upload");
    await writeFile(uploadPath, new Uint8Array(await file.arrayBuffer()));
    const run = (emit: EmitProgress) =>
      runTranscriptPipeline(
        context,
        clientKey,
        uploadPath,
        { cacheable: false, sourceKind: "upload", errorLabel: "upload transcript" },
        emit,
      );
    if (progress) {
      cleanupInStream = true;
      return streamingResponse(headers, async (emit) => {
        try {
          return await run(emit);
        } finally {
          await rm(workingDirectory, { recursive: true, force: true });
        }
      });
    }
    return plainPipelineResponse(await run(() => {}), format, headers);
  } catch (error) {
    process.stderr.write(`upload transcript error: ${String(error)}\n`);
    const { status, message } = toHttpError(error);
    return progress
      ? streamingError(headers, status, message)
      : jsonResponse(status, { error: message }, headers);
  } finally {
    if (!cleanupInStream) await rm(workingDirectory, { recursive: true, force: true });
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
      { ...headers, "X-Transcriptly": FREE_TIER_HEADER },
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
