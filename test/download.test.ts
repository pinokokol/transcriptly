import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";

import {
  downloadModel,
  isDownloadableModelName,
  modelPath,
} from "../src/cli/download";

test("downloadModel streams a model into the configured home", async () => {
  const home = await mkdtemp(join(tmpdir(), "transcriptly-download-test-"));
  let progress = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      progress += chunk.toString();
      callback();
    },
  });
  const mockFetch = (async (
    _input: string | URL | Request,
    _init?: RequestInit,
  ) =>
    new Response("model bytes", {
      headers: { "content-length": "11" },
    })) as typeof fetch;

  try {
    const path = await downloadModel("small", {
      homeDirectory: home,
      fetchImplementation: mockFetch,
      output,
    });
    expect(path).toBe(modelPath("small", home));
    expect(await readFile(path, "utf8")).toBe("model bytes");
    expect(progress).toContain("100% (0.0 MB)");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("downloadable model names cannot be paths or bin filenames", () => {
  expect(isDownloadableModelName("large-v3-turbo")).toBe(true);
  expect(isDownloadableModelName("./model.bin")).toBe(false);
  expect(isDownloadableModelName("missing.bin")).toBe(false);
});
