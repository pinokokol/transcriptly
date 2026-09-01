import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Transcript } from "../src/index";
import type { ResolvedSource } from "../src/resolve";
import { loadConfig, type ServerLimits } from "../server/env";
import { createContext, startServer } from "../server/index";

const LIVE = process.env.LIVE === "1";

const FAKE_TRANSCRIPT: Transcript = {
  source: { input: "https://example.com/v", type: "platform-url" },
  metadata: { title: "Fake", duration: 10, platform: "Test" },
  segments: [{ start: 0, end: 10, text: "hello from the fake transcript" }],
  text: "hello from the fake transcript",
};

function fakeResolved(input: string, duration: number): ResolvedSource {
  return {
    input,
    location: input,
    kind: "platform-url",
    metadata: { title: "Fake", duration, platform: "Test" },
    captionTracks: { manual: ["en"], automatic: [] },
  };
}

function bootFakeServer(
  overrides: Record<string, string> = {},
  limitOverrides: Partial<ServerLimits> = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "server-test-"));
  const base = loadConfig({
    PORT: "0",
    ASR_ENGINE: "local",
    CACHE_DIR: join(dir, "cache"),
    DATA_DIR: join(dir, "data"),
    ALLOWED_ORIGINS: "https://demo.example",
    ...overrides,
  });
  const config = { ...base, limits: { ...base.limits, ...limitOverrides } };
  const context = createContext(config, {
    transcribe: async () => FAKE_TRANSCRIPT,
    resolveSource: async (source: string) =>
      fakeResolved(source, source.includes("long") ? 7200 : 10),
  });
  const server = startServer(context);
  return { server, dir, base: `http://localhost:${server.port}` };
}

describe("API integration (fake pipeline)", () => {
  const { server, dir, base } = bootFakeServer({}, { transcriptsPerHour: 2 });
  afterAll(() => server.stop(true));

  test("health", async () => {
    const response = await fetch(`${base}/api/health`);
    const body = (await response.json()) as { ok: boolean; version: string };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test("transcript happy path, then cache hit, then rate limit", async () => {
    const first = await fetch(`${base}/api/transcript?url=https://example.com/a`);
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Transcriptly-Cache")).toBe("miss");
    expect(first.headers.get("X-Transcriptly")).toContain("demo only");
    expect(await first.text()).toContain("hello from the fake transcript");

    const cached = await fetch(`${base}/api/transcript?url=https://example.com/a`);
    expect(cached.headers.get("X-Transcriptly-Cache")).toBe("hit");

    const second = await fetch(`${base}/api/transcript?url=https://example.com/b`);
    expect(second.status).toBe(200);

    const limited = await fetch(`${base}/api/transcript?url=https://example.com/c`);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);

    const cachedAfterLimit = await fetch(`${base}/api/transcript?url=https://example.com/a&format=srt`);
    expect(cachedAfterLimit.status).toBe(200);
  });

  test("rejects overlong sources with 413", async () => {
    const boot = bootFakeServer();
    try {
      const response = await fetch(`${boot.base}/api/transcript?url=https://example.com/long-one`);
      expect(response.status).toBe(413);
      expect(((await response.json()) as { error: string }).error).toContain("30 minutes");
    } finally {
      boot.server.stop(true);
    }
  });

  test("validates parameters", async () => {
    expect((await fetch(`${base}/api/transcript`)).status).toBe(400);
    expect((await fetch(`${base}/api/transcript?url=x&format=doc`)).status).toBe(400);
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });

  test("info endpoint returns metadata", async () => {
    const response = await fetch(`${base}/api/info?url=https://example.com/a`);
    const body = (await response.json()) as { title: string; duration: number };
    expect(response.status).toBe(200);
    expect(body.title).toBe("Fake");
    expect(body.duration).toBe(10);
  });

  test("CORS echoes allowed origin only", async () => {
    const allowed = await fetch(`${base}/api/health`, {
      headers: { Origin: "https://demo.example" },
    });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://demo.example");

    const denied = await fetch(`${base}/api/health`, {
      headers: { Origin: "https://evil.example" },
    });
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const preflight = await fetch(`${base}/api/transcript`, {
      method: "OPTIONS",
      headers: { Origin: "https://demo.example" },
    });
    expect(preflight.status).toBe(204);
  });

  test("waitlist appends to file and pings the webhook", async () => {
    const hooks: string[] = [];
    const hookServer = Bun.serve({
      port: 0,
      fetch: async (request) => {
        hooks.push(await request.text());
        return new Response("ok");
      },
    });
    const boot = bootFakeServer({ DISCORD_WEBHOOK_URL: `http://localhost:${hookServer.port}/hook` });
    try {
      const bad = await fetch(`${boot.base}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nope" }),
      });
      expect(bad.status).toBe(400);

      const ok = await fetch(`${boot.base}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pino@example.com" }),
      });
      expect(ok.status).toBe(200);
      expect(readFileSync(join(boot.dir, "data", "waitlist.txt"), "utf8")).toContain(
        "pino@example.com",
      );
      expect(hooks[0]).toContain("pino@example.com");
    } finally {
      boot.server.stop(true);
      hookServer.stop(true);
    }
  });
});

describe.if(LIVE)("API integration (real local pipeline)", () => {
  test("POST upload transcribes a real spoken fixture", async () => {
    const fixture = join(mkdtempSync(join(tmpdir(), "live-")), "spoken.wav");
    const { runCommand } = await import("../src/process");
    await runCommand("say", ["-o", fixture, "--data-format=LEF32@22050", "the quick brown fox"]);

    const dir = mkdtempSync(join(tmpdir(), "server-live-"));
    const config = loadConfig({
      PORT: "0",
      ASR_ENGINE: "local",
      WHISPER_MODEL: "small",
      CACHE_DIR: join(dir, "cache"),
      DATA_DIR: join(dir, "data"),
    });
    const server = startServer(createContext(config));
    try {
      const form = new FormData();
      form.append("file", new File([readFileSync(fixture)], "spoken.wav"));
      const response = await fetch(`http://localhost:${server.port}/api/transcript?format=txt`, {
        method: "POST",
        body: form,
      });
      const text = await response.text();
      expect(response.status).toBe(200);
      expect(text.toLowerCase()).toContain("quick brown fox");
    } finally {
      server.stop(true);
    }
  }, 120_000);
});
