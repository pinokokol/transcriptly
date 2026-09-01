import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface LimitWindow {
  limit: number;
  windowMs: number;
}

export interface LimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** In-memory sliding-window limiter; state is per-process by design (single box). */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly windows: readonly LimitWindow[]) {}

  check(key: string, now = Date.now()): LimitDecision {
    const timestamps = this.pruned(key, now);
    let retryAfterMs = 0;

    for (const { limit, windowMs } of this.windows) {
      const inWindow = timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (inWindow.length >= limit) {
        const oldest = inWindow[inWindow.length - limit]!;
        retryAfterMs = Math.max(retryAfterMs, oldest + windowMs - now);
      }
    }

    return {
      allowed: retryAfterMs === 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  record(key: string, now = Date.now()): void {
    this.pruned(key, now).push(now);
  }

  private pruned(key: string, now: number): number[] {
    const longest = Math.max(...this.windows.map((window) => window.windowMs));
    const kept = (this.hits.get(key) ?? []).filter((timestamp) => now - timestamp < longest);
    this.hits.set(key, kept);
    return kept;
  }
}

interface BudgetState {
  date: string;
  spentSeconds: number;
}

function utcDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Global daily audio-seconds budget, persisted so restarts do not reset it. */
export class DailyBudget {
  private readonly path: string;
  private state: BudgetState;

  constructor(dataDir: string, private readonly limitSeconds: number, now = Date.now()) {
    this.path = join(dataDir, "budget.json");
    this.state = { date: utcDate(now), spentSeconds: 0 };
    try {
      const loaded = JSON.parse(readFileSync(this.path, "utf8")) as BudgetState;
      if (loaded.date === this.state.date && Number.isFinite(loaded.spentSeconds)) {
        this.state = loaded;
      }
    } catch {
      // Missing or corrupt state file starts a fresh day.
    }
  }

  remainingSeconds(now = Date.now()): number {
    this.rollover(now);
    return Math.max(0, this.limitSeconds - this.state.spentSeconds);
  }

  spend(seconds: number, now = Date.now()): void {
    this.rollover(now);
    this.state.spentSeconds += Math.max(0, seconds);
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.state));
  }

  private rollover(now: number): void {
    const today = utcDate(now);
    if (this.state.date !== today) {
      this.state = { date: today, spentSeconds: 0 };
    }
  }
}
