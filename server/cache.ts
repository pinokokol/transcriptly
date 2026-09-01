import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Transcript } from "../src/index";

/**
 * Disk cache keyed by the raw source string + mode (not the resolved canonical
 * URL: canonicalizing would cost a yt-dlp call, defeating cheap cache hits).
 * Transcripts are immutable, so entries never expire.
 */
export class TranscriptCache {
  constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true });
  }

  key(source: string, mode: string): string {
    return createHash("sha256").update(`${source.trim()}\n${mode}`).digest("hex");
  }

  get(key: string): Transcript | undefined {
    try {
      return JSON.parse(readFileSync(join(this.directory, `${key}.json`), "utf8")) as Transcript;
    } catch {
      return undefined;
    }
  }

  put(key: string, transcript: Transcript): void {
    writeFileSync(join(this.directory, `${key}.json`), JSON.stringify(transcript));
  }
}
