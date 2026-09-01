import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UnsupportedUrlError } from "../src/index";
import { TranscriptCache } from "../server/cache";
import { DEMO_LIMITS } from "../server/config";
import { loadConfig } from "../server/env";
import { DailyBudget, SlidingWindowLimiter } from "../server/limits";
import { clientKeyFrom, corsHeaders, toHttpError } from "../server/respond";
import { isValidEmail, recordSignup } from "../server/waitlist";

describe("SlidingWindowLimiter", () => {
  test("allows up to the limit then blocks with Retry-After", () => {
    const limiter = new SlidingWindowLimiter([{ limit: 2, windowMs: 60_000 }]);
    const now = 1_000_000;
    limiter.record("ip", now);
    limiter.record("ip", now + 1000);
    const blocked = limiter.check("ip", now + 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(58);
    expect(limiter.check("other", now + 2000).allowed).toBe(true);
  });

  test("frees a slot once the window slides past", () => {
    const limiter = new SlidingWindowLimiter([{ limit: 1, windowMs: 10_000 }]);
    limiter.record("ip", 0);
    expect(limiter.check("ip", 9_999).allowed).toBe(false);
    expect(limiter.check("ip", 10_001).allowed).toBe(true);
  });
});

describe("DailyBudget", () => {
  test("persists spending across restarts and rolls over by UTC day", () => {
    const dir = mkdtempSync(join(tmpdir(), "budget-"));
    const day1 = Date.UTC(2026, 8, 1, 10);
    const first = new DailyBudget(dir, 100, day1);
    first.spend(60, day1);
    expect(first.remainingSeconds(day1)).toBe(40);

    const restarted = new DailyBudget(dir, 100, day1);
    expect(restarted.remainingSeconds(day1)).toBe(40);

    const day2 = Date.UTC(2026, 8, 2, 10);
    expect(restarted.remainingSeconds(day2)).toBe(100);
  });
});

describe("TranscriptCache", () => {
  test("stores by source+mode and misses on unknown keys", () => {
    const cache = new TranscriptCache(mkdtempSync(join(tmpdir(), "cache-")));
    const transcript = {
      source: { input: "x", type: "platform-url" as const },
      metadata: {},
      segments: [{ start: 0, end: 1, text: "hi" }],
      text: "hi",
    };
    const key = cache.key("https://example.com/v", "asr");
    expect(cache.get(key)).toBeUndefined();
    cache.put(key, transcript);
    expect(cache.get(key)?.text).toBe("hi");
    expect(cache.key(" https://example.com/v ", "asr")).toBe(key);
    expect(cache.key("https://example.com/v", "captions")).not.toBe(key);
  });
});

describe("waitlist", () => {
  test("validates emails loosely", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a b@c.d")).toBe(false);
    expect(isValidEmail(`${"x".repeat(255)}@b.co`)).toBe(false);
  });

  test("appends to file and posts to webhook", async () => {
    const dir = mkdtempSync(join(tmpdir(), "waitlist-"));
    const calls: Array<{ url: string; body: string }> = [];
    const fakeFetch = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return new Response("ok");
    }) as typeof fetch;

    await recordSignup("a@b.co", dir, "https://hook.example/x", fakeFetch);
    expect(readFileSync(join(dir, "waitlist.txt"), "utf8")).toContain(" a@b.co\n");
    expect(calls[0]?.body).toContain("a@b.co");
  });

  test("webhook failure does not throw", async () => {
    const dir = mkdtempSync(join(tmpdir(), "waitlist-"));
    const failingFetch = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    await recordSignup("a@b.co", dir, "https://hook.example/x", failingFetch);
    expect(readFileSync(join(dir, "waitlist.txt"), "utf8")).toContain("a@b.co");
  });
});

describe("respond", () => {
  test("maps typed errors without leaking internals", () => {
    const unsupported = toHttpError(new UnsupportedUrlError("https://x", "secret detail"));
    expect(unsupported.status).toBe(422);
    expect(unsupported.message).not.toContain("secret");
    expect(toHttpError(new Error("boom")).status).toBe(500);
  });

  test("CORS only echoes allowed origins", () => {
    const allowed = corsHeaders("https://ok.example", ["https://ok.example"]);
    expect(allowed["Access-Control-Allow-Origin"]).toBe("https://ok.example");
    expect(corsHeaders("https://evil.example", ["https://ok.example"])).toEqual({});
    expect(corsHeaders(null, ["https://ok.example"])).toEqual({});
  });
});

describe("loadConfig", () => {
  test("reads env for machine config and code for demo limits", () => {
    const config = loadConfig({ ASR_ENGINE: "local", PORT: "9000" });
    expect(config.asrEngine).toBe("local");
    expect(config.port).toBe(9000);
    expect(config.limits).toEqual(DEMO_LIMITS);
    expect(loadConfig({}).asrEngine).toBe("groq");
  });

});

describe("clientKeyFrom", () => {
  test("ignores proxy headers unless trustProxy is on", () => {
    const headers = new Headers({ "X-Forwarded-For": "1.2.3.4" });
    expect(clientKeyFrom(headers, false)).toBeUndefined();
  });

  test("takes the first X-Forwarded-For entry when trusted", () => {
    const headers = new Headers({ "X-Forwarded-For": "1.2.3.4, 10.0.0.1" });
    expect(clientKeyFrom(headers, true)).toBe("1.2.3.4");
    expect(clientKeyFrom(new Headers(), true)).toBeUndefined();
  });
});
