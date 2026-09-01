import { DEMO_LIMITS } from "./config";

export interface ServerLimits {
  transcriptsPerHour: number;
  transcriptsPerDay: number;
  lookupsPerMinute: number;
  maxDurationSeconds: number;
  dailyBudgetSeconds: number;
  maxUploadBytes: number;
}

export interface ServerConfig {
  port: number;
  asrEngine: "groq" | "local";
  groqApiKey?: string;
  discordWebhookUrl?: string;
  allowedOrigins: string[];
  cacheDir: string;
  dataDir: string;
  trustProxy: boolean;
  whisperModel?: string;
  limits: ServerLimits;
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  // 0 is valid (PORT=0 asks the OS for a random port).
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const engine = env.ASR_ENGINE === "local" ? "local" : "groq";
  return {
    port: integer(env.PORT, 8787),
    asrEngine: engine,
    groqApiKey: env.GROQ_API_KEY || undefined,
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL || undefined,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    cacheDir: env.CACHE_DIR || "server/.cache",
    dataDir: env.DATA_DIR || "server/.data",
    trustProxy: env.TRUST_PROXY === "1",
    whisperModel: env.WHISPER_MODEL || undefined,
    limits: DEMO_LIMITS,
  };
}
