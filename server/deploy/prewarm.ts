/**
 * Pre-warm the demo cache for the sample chips on the landing page.
 *
 * Run this locally, from a residential IP (YouTube blocks the box):
 *   bun run server/deploy/prewarm.ts
 *
 * Needs GROQ_API_KEY (Bun loads .env automatically), yt-dlp, and ffmpeg.
 * Entries land in server/deploy/prewarm-out/ keyed exactly like the server
 * cache. Ship them during deploy; see README.md in this directory.
 */

import { TranscriptCache } from "../cache";
import { transcribe } from "../../src/index";

/** Must match the SAMPLES urls in web/components/demo.tsx verbatim: the cache key hashes the raw source string. */
const SOURCES = [
  "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  "https://www.tiktok.com/@tiktok/video/7231338487075638570",
];

const outDir = process.argv[2] ?? "server/deploy/prewarm-out";
const cache = new TranscriptCache(outDir);

for (const source of SOURCES) {
  const key = cache.key(source, "asr");
  if (cache.get(key)) {
    console.log(`already cached: ${source}`);
    continue;
  }
  console.log(`transcribing: ${source}`);
  const transcript = await transcribe(source, { engine: "groq" });
  cache.put(key, transcript);
  console.log(`wrote ${outDir}/${key}.json (${transcript.segments.length} segments)`);
}
