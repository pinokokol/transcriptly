import { createRequire } from "node:module";

import { TranscriptCache } from "./cache";
import { loadConfig, type ServerConfig } from "./env";
import {
  defaultDependencies,
  handleInfo,
  handleTranscriptGet,
  handleTranscriptPost,
  handleWaitlist,
  type ServerContext,
} from "./handlers";
import { DailyBudget, SlidingWindowLimiter } from "./limits";
import { corsHeaders, jsonResponse } from "./respond";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function createContext(
  config: ServerConfig,
  deps: ServerContext["deps"] = defaultDependencies(),
): ServerContext {
  return {
    config,
    cache: new TranscriptCache(config.cacheDir),
    budget: new DailyBudget(config.dataDir, config.limits.dailyBudgetSeconds),
    transcriptLimiter: new SlidingWindowLimiter([
      { limit: config.limits.transcriptsPerHour, windowMs: HOUR_MS },
      { limit: config.limits.transcriptsPerDay, windowMs: DAY_MS },
    ]),
    lookupLimiter: new SlidingWindowLimiter([
      { limit: config.limits.lookupsPerMinute, windowMs: 60_000 },
    ]),
    deps,
  };
}

export function startServer(context: ServerContext) {
  const { config } = context;

  return Bun.serve({
    port: config.port,
    idleTimeout: 240,
    fetch: async (request, server) => {
      const url = new URL(request.url);
      const origin = request.headers.get("Origin");
      const cors = corsHeaders(origin, config.allowedOrigins);
      const forwarded = request.headers.get("X-Forwarded-For");
      const clientKey =
        (config.trustProxy && forwarded?.split(",")[0]?.trim()) ||
        server.requestIP(request)?.address ||
        "unknown";

      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

      const started = Date.now();
      const response = await route(context, request, url, clientKey, cors);
      process.stderr.write(
        `${request.method} ${url.pathname} ${response.status} ${Date.now() - started}ms\n`,
      );
      return response;
    },
  });
}

async function route(
  context: ServerContext,
  request: Request,
  url: URL,
  clientKey: string,
  cors: Record<string, string>,
): Promise<Response> {
  const { pathname } = url;

  if (pathname === "/api/health" && request.method === "GET") {
    return jsonResponse(200, { ok: true, version: VERSION }, cors);
  }
  if (pathname === "/api/transcript" && request.method === "GET") {
    return handleTranscriptGet(context, url, clientKey, cors);
  }
  if (pathname === "/api/transcript" && request.method === "POST") {
    return handleTranscriptPost(context, request, url, clientKey, cors);
  }
  if (pathname === "/api/info" && request.method === "GET") {
    return handleInfo(context, url, clientKey, cors);
  }
  if (pathname === "/api/waitlist" && request.method === "POST") {
    return handleWaitlist(context, request, clientKey, cors);
  }

  return jsonResponse(
    404,
    { error: "Not found. Docs: https://github.com/pinokokol/transcriptly" },
    cors,
  );
}

if (import.meta.main) {
  const config = loadConfig();
  if (config.asrEngine === "groq" && !config.groqApiKey) {
    process.stderr.write("Refusing to start: ASR_ENGINE=groq requires GROQ_API_KEY.\n");
    process.exit(1);
  }
  const server = startServer(createContext(config));
  process.stderr.write(`transcriptly API listening on :${server.port} (${config.asrEngine})\n`);
}
