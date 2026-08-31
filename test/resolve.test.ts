import { describe, expect, test } from "bun:test";

import { InvalidSourceError } from "../src/errors";
import { classifySource } from "../src/resolve";

describe("classifySource", () => {
  test("classifies platform URLs without network access", () => {
    expect(classifySource("https://www.youtube.com/watch?v=abc")).toBe("platform-url");
    expect(classifySource("https://www.tiktok.com/@person/video/123")).toBe("platform-url");
  });

  test("classifies direct media URLs by pathname extension", () => {
    expect(classifySource("https://cdn.example.com/media/clip.MP4?token=abc")).toBe(
      "media-url",
    );
    expect(classifySource("http://example.com/live/stream.m3u8")).toBe("media-url");
  });

  test("classifies relative and absolute paths as local files", () => {
    expect(classifySource("./recording.wav")).toBe("local-file");
    expect(classifySource("/tmp/recording.mp3")).toBe("local-file");
  });

  test("rejects empty sources and unsupported URL schemes", () => {
    expect(() => classifySource("  ")).toThrow(InvalidSourceError);
    expect(() => classifySource("ftp://example.com/file.mp3")).toThrow(InvalidSourceError);
  });
});
