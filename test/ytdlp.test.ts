import { describe, expect, test } from "bun:test";

import { isYouTubeUrl, ytDlpProxyArgs } from "../src/ytdlp";

describe("isYouTubeUrl", () => {
  test("matches YouTube hosts", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw")).toBe(true);
    expect(isYouTubeUrl("https://youtube.com/watch?v=jNQXAC9IVRw")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/jNQXAC9IVRw")).toBe(true);
    expect(isYouTubeUrl("https://m.youtube.com/watch?v=jNQXAC9IVRw")).toBe(true);
    expect(isYouTubeUrl("https://music.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeUrl("https://www.youtube-nocookie.com/embed/abc")).toBe(true);
  });

  test("rejects everything else", () => {
    expect(isYouTubeUrl("https://www.tiktok.com/@tiktok/video/7231338487075638570")).toBe(false);
    expect(isYouTubeUrl("https://example.com/youtube.com/video.mp4")).toBe(false);
    expect(isYouTubeUrl("https://notyoutube.com/watch?v=abc")).toBe(false);
    expect(isYouTubeUrl("./local-file.mp4")).toBe(false);
  });
});

describe("ytDlpProxyArgs", () => {
  const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

  test("adds --proxy for YouTube when YOUTUBE_PROXY_URL is set", () => {
    const env = { YOUTUBE_PROXY_URL: "http://user:pass@proxy.example:8080" };
    expect(ytDlpProxyArgs(url, env)).toEqual(["--proxy", "http://user:pass@proxy.example:8080"]);
  });

  test("does nothing without the env var or for non-YouTube sources", () => {
    expect(ytDlpProxyArgs(url, {})).toEqual([]);
    expect(ytDlpProxyArgs(url, { YOUTUBE_PROXY_URL: "  " })).toEqual([]);
    expect(
      ytDlpProxyArgs("https://www.tiktok.com/@tiktok/video/1", {
        YOUTUBE_PROXY_URL: "http://proxy.example:8080",
      }),
    ).toEqual([]);
  });
});
