import { describe, expect, test } from "bun:test";

import {
  formatJson,
  formatMarkdown,
  formatSrt,
  formatSrtTimestamp,
  formatText,
  formatTranscript,
} from "../src/format";
import type { Transcript } from "../src/transcribe";

const transcript: Transcript = {
  source: { input: "https://example.com/watch/123", type: "platform-url" },
  metadata: { title: "Example", duration: 65.5, platform: "ExampleVideo" },
  segments: [
    { start: 0, end: 1.25, text: "Hello." },
    { start: 61.2, end: 65.5, text: "Goodbye." },
  ],
  text: "Hello. Goodbye.",
};

describe("formatters", () => {
  test("formats Markdown with segment timestamps", () => {
    expect(formatMarkdown(transcript)).toBe(
      "# Example\n\n**[00:00]** Hello.\n\n**[01:01]** Goodbye.",
    );
    expect(formatTranscript(transcript, "md")).toBe(formatMarkdown(transcript));
  });

  test("formats plain text", () => {
    expect(formatText(transcript)).toBe("Hello. Goodbye.");
    expect(formatTranscript(transcript, "txt")).toBe("Hello. Goodbye.");
  });

  test("formats lossless pretty JSON", () => {
    expect(JSON.parse(formatJson(transcript))).toEqual(transcript);
    expect(formatTranscript(transcript, "json")).toBe(formatJson(transcript));
  });

  test("formats numbered SRT cues and millisecond timestamps", () => {
    expect(formatSrtTimestamp(3661.007)).toBe("01:01:01,007");
    expect(formatSrt(transcript)).toBe(
      "1\n00:00:00,000 --> 00:00:01,250\nHello.\n\n" +
        "2\n00:01:01,200 --> 00:01:05,500\nGoodbye.",
    );
    expect(formatTranscript(transcript, "srt")).toBe(formatSrt(transcript));
  });
});
