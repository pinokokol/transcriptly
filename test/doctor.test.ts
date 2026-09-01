import { describe, expect, test } from "bun:test";

import { checkTools } from "../src/cli/doctor";

describe("checkTools", () => {
  test("reports resolved and missing tools with macOS hints", () => {
    const results = checkTools((binary) => {
      if (binary === "ffmpeg") throw new Error("missing");
      return `/tools/${binary}`;
    }, "darwin");

    expect(results).toEqual([
      { binary: "yt-dlp", path: "/tools/yt-dlp", hint: "brew install yt-dlp" },
      { binary: "ffmpeg", hint: "brew install ffmpeg" },
      {
        binary: "whisper-cli",
        path: "/tools/whisper-cli",
        hint: "brew install whisper-cpp",
      },
    ]);
  });

  test("provides apt, pip, and build hints on Linux", () => {
    const results = checkTools(() => {
      throw new Error("missing");
    }, "linux");
    expect(results[0]!.hint).toContain("pip");
    expect(results[1]!.hint).toContain("apt install ffmpeg");
    expect(results[2]!.hint).toContain("build whisper.cpp");
  });
});

