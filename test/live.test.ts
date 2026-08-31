import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { transcribe } from "../src/transcribe";

const liveTest = process.env.LIVE === "1" ? test : test.skip;
const VIDEO_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const LIVE_TIMEOUT = 300_000;

async function run(binary: string, args: string[]): Promise<void> {
  const subprocess = Bun.spawn([binary, ...args], { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`${binary} failed: ${stderr}`);
}

liveTest(
  "transcribes the first YouTube video with local Whisper",
  async () => {
    const transcript = await transcribe(VIDEO_URL, {
      mode: "asr",
      engine: "local",
      model: "small",
      lang: "en",
    });
    console.log(`LIVE YouTube ASR: ${transcript.text}`);
    expect(transcript.segments.length).toBeGreaterThan(0);
    expect(transcript.text.toLocaleLowerCase()).toContain("elephant");
  },
  LIVE_TIMEOUT,
);

liveTest(
  "downloads captions for the first YouTube video",
  async () => {
    const transcript = await transcribe(VIDEO_URL, { mode: "captions", lang: "en" });
    console.log(`LIVE YouTube captions: ${transcript.text}`);
    expect(transcript.segments.length).toBeGreaterThan(0);
    expect(transcript.text.toLocaleLowerCase()).toContain("elephant");
  },
  LIVE_TIMEOUT,
);

liveTest(
  "transcribes a synthesized local speech file",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "transcriptly-live-local-"));
    const aiffPath = join(directory, "speech.aiff");
    const wavPath = join(directory, "speech.wav");
    try {
      await run("/usr/bin/say", [
        "-o",
        aiffPath,
        "the quick brown fox jumps over the lazy dog",
      ]);
      await run("/opt/homebrew/bin/ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        aiffPath,
        wavPath,
      ]);

      const transcript = await transcribe(wavPath, {
        mode: "asr",
        engine: "local",
        model: "small",
        lang: "en",
      });
      console.log(`LIVE local ASR: ${transcript.text}`);
      const text = transcript.text.toLocaleLowerCase();
      expect(text).toContain("quick");
      expect(text).toContain("brown");
      expect(text).toContain("fox");
      expect(text).toContain("lazy");
      expect(text).toContain("dog");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  LIVE_TIMEOUT,
);
