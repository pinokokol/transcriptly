import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  GROQ_MODEL,
  GROQ_TRANSCRIPTIONS_URL,
  GroqAsrEngine,
  parseWhisperJson,
  resolveModelPath,
} from "../src/asr";
import { ConfigurationError, MissingModelError } from "../src/errors";

describe("parseWhisperJson", () => {
  test("maps whisper.cpp millisecond offsets to seconds", () => {
    expect(
      parseWhisperJson({
        transcription: [
          {
            offsets: { from: 1250, to: 3500 },
            text: " hello ",
          },
        ],
      }),
    ).toEqual([{ start: 1.25, end: 3.5, text: "hello" }]);
  });
});

describe("GroqAsrEngine", () => {
  test("constructs the OpenAI-compatible multipart request", async () => {
    const directory = await mkdtemp(join(tmpdir(), "transcriptly-groq-test-"));
    const audioPath = join(directory, "audio.wav");
    await writeFile(audioPath, "RIFF fake wav");

    let capturedUrl: string | URL | Request | undefined;
    let capturedInit: RequestInit | undefined;
    const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return Response.json({
        text: "Hello world.",
        segments: [{ start: 0.1, end: 1.2, text: " Hello world. " }],
      });
    }) as typeof fetch;

    try {
      const segments = await new GroqAsrEngine(mockFetch, "test-key").transcribe(
        audioPath,
        { lang: "en", model: "ignored-for-groq" },
      );
      expect(segments).toEqual([{ start: 0.1, end: 1.2, text: "Hello world." }]);
      expect(capturedUrl).toBe(GROQ_TRANSCRIPTIONS_URL);
      expect(capturedInit?.method).toBe("POST");
      expect(new Headers(capturedInit?.headers).get("Authorization")).toBe(
        "Bearer test-key",
      );
      const form = capturedInit?.body as FormData;
      expect(form.get("model")).toBe(GROQ_MODEL);
      expect(form.get("response_format")).toBe("verbose_json");
      expect(form.get("timestamp_granularities[]")).toBe("segment");
      expect(form.get("language")).toBe("en");
      expect(form.get("file")).toBeInstanceOf(Blob);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("requires GROQ_API_KEY without making a request", async () => {
    const originalKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      await expect(new GroqAsrEngine().transcribe("unused.wav", {})).rejects.toBeInstanceOf(
        ConfigurationError,
      );
    } finally {
      if (originalKey === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = originalKey;
    }
  });
});

test("resolveModelPath reports both the model and missing path", () => {
  const missing = join(tmpdir(), "transcriptly-model-that-does-not-exist.bin");
  try {
    resolveModelPath(missing);
    throw new Error("expected resolveModelPath to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(MissingModelError);
    expect((error as MissingModelError).model).toBe(missing);
    expect((error as MissingModelError).path).toBe(missing);
  }
});
