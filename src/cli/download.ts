import { existsSync } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { CliError } from "./errors";
import { MODEL_OPTIONS } from "./picker";

const MODEL_BASE_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

export function modelPath(model: string, homeDirectory = homedir()): string {
  return join(homeDirectory, ".cache", "transcriptly", "models", `ggml-${model}.bin`);
}

export function isDownloadableModelName(model: string): boolean {
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(model) &&
    model !== ".." &&
    !model.endsWith(".bin")
  );
}

function expectedSize(model: string, response: Response): number | undefined {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 0) return contentLength;
  return MODEL_OPTIONS.find((candidate) => candidate.name === model)?.approximateBytes;
}

function progressLine(model: string, downloaded: number, total?: number): string {
  const megabytes = downloaded / 1024 / 1024;
  const percent = total ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
  return `\rDownloading ${model}: ${percent}% (${megabytes.toFixed(1)} MB)`;
}

export async function downloadModel(
  model: string,
  options: {
    homeDirectory?: string;
    fetchImplementation?: typeof fetch;
    output?: NodeJS.WritableStream;
  } = {},
): Promise<string> {
  if (!isDownloadableModelName(model)) {
    throw new CliError(`Model name "${model}" cannot be downloaded.`);
  }

  const destination = modelPath(model, options.homeDirectory);
  if (existsSync(destination)) return destination;

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const output = options.output ?? process.stderr;
  const url = `${MODEL_BASE_URL}/ggml-${encodeURIComponent(model)}.bin`;
  let response: Response;
  try {
    response = await fetchImplementation(url);
  } catch (error) {
    throw new CliError(`Could not download model "${model}".`, { cause: error });
  }
  if (!response.ok || !response.body) {
    throw new CliError(
      `Could not download model "${model}" (HTTP ${response.status}).`,
    );
  }

  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.download-${process.pid}`;
  const file = await open(temporary, "w");
  const reader = response.body.getReader();
  const total = expectedSize(model, response);
  let downloaded = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await file.write(value);
      downloaded += value.byteLength;
      output.write(progressLine(model, downloaded, total));
    }
    await file.close();
    await rename(temporary, destination);
    output.write("\n");
    return destination;
  } catch (error) {
    await file.close().catch(() => undefined);
    await rm(temporary, { force: true });
    throw new CliError(`Could not save model "${model}".`, { cause: error });
  }
}
