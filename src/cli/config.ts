import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { resolveModelPath } from "../asr";
import { MissingModelError } from "../errors";
import { CliError } from "./errors";
import { MODEL_OPTIONS, type ModelOption } from "./picker";

export interface TranscriptlyConfig {
  model?: string;
}

export function configPath(homeDirectory = homedir()): string {
  return join(homeDirectory, ".config", "transcriptly", "config.json");
}

export async function readConfig(path = configPath()): Promise<TranscriptlyConfig> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new CliError(`Could not read config at "${path}".`, { cause: error });
  }

  try {
    const value = JSON.parse(contents) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const model = (value as { model?: unknown }).model;
    if (model !== undefined && (typeof model !== "string" || !model.trim())) {
      throw new Error();
    }
    return model === undefined ? {} : { model: model.trim() };
  } catch (error) {
    throw new CliError(`Config at "${path}" is not valid JSON.`, { cause: error });
  }
}

export async function writeConfig(
  config: TranscriptlyConfig,
  path = configPath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function isLocalModelInstalled(model: string): boolean {
  try {
    return existsSync(resolveModelPath(model));
  } catch (error) {
    if (error instanceof MissingModelError) return false;
    throw error;
  }
}

function firstInstalledModel(): ModelOption | undefined {
  const preferredNames = ["large-v3-turbo", "small", "large-v3"];
  return preferredNames
    .map((name) => MODEL_OPTIONS.find((model) => model.name === name))
    .find(
      (model): model is ModelOption =>
        Boolean(model && isLocalModelInstalled(model.name)),
    );
}

export async function configuredLocalModel(
  path = configPath(),
): Promise<string | undefined> {
  const configured = (await readConfig(path)).model;
  if (configured && isLocalModelInstalled(configured)) return configured;

  const installed = firstInstalledModel();
  if (!installed) return undefined;
  await writeConfig({ model: installed.name }, path);
  return installed.name;
}
