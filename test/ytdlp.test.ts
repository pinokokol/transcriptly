import { describe, expect, test } from "bun:test";

import { needsProxy, ytDlpProxyArgs } from "../src/ytdlp";

describe("needsProxy", () => {
  test("matches platforms that block datacenter IPs, including subdomains", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      "https://youtu.be/jNQXAC9IVRw",
      "https://m.youtube.com/watch?v=jNQXAC9IVRw",
      "https://www.youtube-nocookie.com/embed/abc",
      "https://www.instagram.com/reel/Chunk8-jurw/",
      "https://www.facebook.com/WatchESLOne/videos/359649331226507/",
      "https://fb.watch/abc/",
      "https://x.com/historyinmemes/status/1790637656616943991",
      "https://twitter.com/starwars/status/665052190608723968",
      "https://www.reddit.com/r/videos/comments/6rrwyj/that_small_heart_attack/",
    ]) {
      expect(needsProxy(url)).toBe(true);
    }
  });

  test("leaves everything else direct", () => {
    for (const url of [
      "https://www.tiktok.com/@tiktok/video/7231338487075638570",
      "https://clips.twitch.tv/FaintLightGullWholeWheat",
      "https://soundcloud.com/ethmusic/lostin-powers-she-so-heavy",
      "https://www.dailymotion.com/video/x5kesuj",
      "https://example.com/youtube.com/video.mp4",
      "https://notyoutube.com/watch?v=abc",
      "https://cdn.example.com/talk.mp4",
      "./local-file.mp4",
    ]) {
      expect(needsProxy(url)).toBe(false);
    }
  });
});

describe("ytDlpProxyArgs", () => {
  const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

  test("adds --proxy for proxied platforms when YTDLP_PROXY_URL is set", () => {
    const env = { YTDLP_PROXY_URL: "http://user:pass@proxy.example:8080" };
    expect(ytDlpProxyArgs(url, env)).toEqual(["--proxy", "http://user:pass@proxy.example:8080"]);
    expect(ytDlpProxyArgs("https://www.reddit.com/r/videos/comments/abc/", env)).toEqual([
      "--proxy",
      "http://user:pass@proxy.example:8080",
    ]);
  });

  test("does nothing without the env var or for direct platforms", () => {
    expect(ytDlpProxyArgs(url, {})).toEqual([]);
    expect(ytDlpProxyArgs(url, { YTDLP_PROXY_URL: "  " })).toEqual([]);
    expect(
      ytDlpProxyArgs("https://www.tiktok.com/@tiktok/video/1", {
        YTDLP_PROXY_URL: "http://proxy.example:8080",
      }),
    ).toEqual([]);
  });
});
