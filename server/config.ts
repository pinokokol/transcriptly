import type { ServerLimits } from "./env";

/**
 * Demo policy, versioned in code on purpose: these are product decisions,
 * not deployment knobs. Change them here, in a commit.
 */
export const DEMO_LIMITS: ServerLimits = {
  transcriptsPerHour: 5,
  transcriptsPerDay: 20,
  lookupsPerMinute: 60,
  maxDurationSeconds: 1800,
  dailyBudgetSeconds: 25_200,
  maxUploadBytes: 25 * 1024 * 1024,
};
