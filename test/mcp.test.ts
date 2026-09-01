import { describe, expect, test } from "bun:test";

import {
  MISSING_MODEL_MESSAGE,
  callTranscriptlyTool,
  type McpDependencies,
} from "../src/mcp";
import { UnsupportedUrlError } from "../src/errors";
import type { Transcript, TranscribeOptions } from "../src/transcribe";

const TRANSCRIPT: Transcript = {
  source: { input: "sample.wav", type: "local-file" },
  metadata: { title: "Sample", duration: 1.25 },
  segments: [{ start: 0, end: 1.25, text: "Hello from Transcriptly." }],
  text: "Hello from Transcriptly.",
};

function dependencies(
  overrides: Partial<McpDependencies> = {},
): McpDependencies {
  return {
    transcribe: async () => TRANSCRIPT,
    resolveSource: async (source) => ({
      input: source,
      location: source,
      kind: "local-file",
      metadata: { title: "Sample", duration: 1.25 },
      captionTracks: { manual: [], automatic: [] },
    }),
    configuredLocalModel: async () => "small",
    ...overrides,
  };
}

function resultText(result: Awaited<ReturnType<typeof callTranscriptlyTool>>): string {
  const content = result.content[0];
  if (!content || content.type !== "text") throw new Error("expected text content");
  return content.text;
}

describe("MCP tools", () => {
  test("validates tool input without calling the core", async () => {
    let calls = 0;
    const deps = dependencies({
      transcribe: async () => {
        calls += 1;
        return TRANSCRIPT;
      },
    });

    const missing = await callTranscriptlyTool("get_transcript", {}, deps);
    const format = await callTranscriptlyTool(
      "get_transcript",
      { source: "sample.wav", format: "pdf" },
      deps,
    );
    const extra = await callTranscriptlyTool(
      "get_video_info",
      { source: "sample.wav", download: true },
      deps,
    );

    expect(missing.isError).toBe(true);
    expect(resultText(missing)).toContain('"source" must be a non-empty');
    expect(format.isError).toBe(true);
    expect(resultText(format)).toContain('"format" must be one of: md, txt, json, srt');
    expect(extra.isError).toBe(true);
    expect(resultText(extra)).toBe('Unexpected argument "download".');
    expect(calls).toBe(0);
  });

  test("uses ASR and Markdown defaults with the configured local model", async () => {
    let received: { source: string; options: TranscribeOptions } | undefined;
    const result = await callTranscriptlyTool(
      "get_transcript",
      { source: " sample.wav " },
      dependencies({
        transcribe: async (source, options) => {
          received = { source, options: options ?? {} };
          return TRANSCRIPT;
        },
      }),
    );

    expect(result.isError).toBeUndefined();
    expect(received).toEqual({
      source: "sample.wav",
      options: { format: "md", mode: "asr", model: "small" },
    });
    expect(resultText(result)).toBe(
      "# Sample\n\n**[00:00]** Hello from Transcriptly.",
    );
  });

  test("maps a missing model to one-time setup guidance", async () => {
    const result = await callTranscriptlyTool(
      "get_transcript",
      { source: "sample.wav" },
      dependencies({ configuredLocalModel: async () => undefined }),
    );

    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe(MISSING_MODEL_MESSAGE);
  });

  test("maps an unsupported URL to an actionable tool error", async () => {
    const result = await callTranscriptlyTool(
      "get_video_info",
      { source: "https://example.invalid/watch" },
      dependencies({
        resolveSource: async (source) => {
          throw new UnsupportedUrlError(source);
        },
      }),
    );

    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe(
      "Unsupported URL. Use a URL supported by yt-dlp, a direct media URL, or a local file path.",
    );
  });

  test("returns video metadata and caption tracks from resolve only", async () => {
    let transcribeCalls = 0;
    const result = await callTranscriptlyTool(
      "get_video_info",
      { source: "https://www.youtube.com/watch?v=sample" },
      dependencies({
        transcribe: async () => {
          transcribeCalls += 1;
          return TRANSCRIPT;
        },
        resolveSource: async (source) => ({
          input: source,
          location: source,
          kind: "platform-url",
          metadata: { title: "A video", duration: 42.5, platform: "Youtube" },
          captionTracks: {
            manual: ["en", "sl"],
            automatic: ["de"],
          },
        }),
      }),
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(resultText(result))).toEqual({
      title: "A video",
      duration: 42.5,
      platform: "Youtube",
      captionTracks: { manual: ["en", "sl"], automatic: ["de"] },
    });
    expect(transcribeCalls).toBe(0);
  });
});
