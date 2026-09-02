#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  CaptionsUnavailableError,
  CommandExecutionError,
  ConfigurationError,
  InvalidOptionError,
  InvalidSourceError,
  MissingBinaryError,
  MissingModelError,
  SourceNotFoundError,
  TranscriptionError,
  UnsupportedUrlError,
  formatTranscript,
  transcribe,
  type AsrEngineName,
  type TranscriptFormat,
  type TranscriptionMode,
} from "./index";
import {
  configPath,
  configuredLocalModel,
  isLocalModelInstalled,
  readConfig,
  writeConfig,
} from "./cli/config";
import { checkTools, printDoctor } from "./cli/doctor";
import { downloadModel, isDownloadableModelName } from "./cli/download";
import { CliError } from "./cli/errors";
import {
  DEFAULT_MODEL_INDEX,
  MODEL_OPTIONS,
  pickModel,
} from "./cli/picker";
import { runMcpServer } from "./mcp";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };

export const HELP_TEXT = `Usage: transcriptly <url-or-file> [options]
       transcriptly setup
       transcriptly mcp

Transcribe video and audio from a URL or local file. Quote URLs: ? and & are special to the shell.

Options:
  -f, --format <md|txt|json|srt>  Output format (default: md)
  -o, --output <file>             Write transcript to a file
      --mode <asr|captions>       Transcription mode (default: asr)
      --model <name>              Local Whisper model name or path
      --lang <code>               Spoken or caption language
      --engine <local|groq>       ASR engine (default: local)
  -y, --yes                       Download --model without prompting
      --version                   Print version
  -h, --help                      Show help

Commands:
  setup  Check dependencies and choose a local model
  mcp    Start the stdio MCP server`;

interface TranscribeCommand {
  command: "transcribe";
  source: string;
  format: TranscriptFormat;
  output?: string;
  mode: TranscriptionMode;
  model?: string;
  lang?: string;
  engine: AsrEngineName;
  yes: boolean;
}

type CliCommand =
  | TranscribeCommand
  | { command: "setup" }
  | { command: "mcp" }
  | { command: "help" }
  | { command: "version" };

const CLI_OPTIONS = {
  format: { type: "string", short: "f" },
  output: { type: "string", short: "o" },
  mode: { type: "string" },
  model: { type: "string" },
  lang: { type: "string" },
  engine: { type: "string" },
  yes: { type: "boolean", short: "y" },
  version: { type: "boolean" },
  help: { type: "boolean", short: "h" },
} as const;

interface CliValues {
  format?: string;
  output?: string;
  mode?: string;
  model?: string;
  lang?: string;
  engine?: string;
  yes?: boolean;
  version?: boolean;
  help?: boolean;
}

function oneOf<T extends string>(
  option: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const result = value ?? fallback;
  if (!allowed.includes(result as T)) {
    throw new CliError(`Invalid --${option} value "${result}".`);
  }
  return result as T;
}

export function parseCliArgs(args: readonly string[]): CliCommand {
  let values: CliValues;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: [...args],
      options: CLI_OPTIONS,
      allowPositionals: true,
      strict: true,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid arguments.";
    throw new CliError(message.replace(/^TypeError:\s*/, ""), { cause: error });
  }

  if (values.help) return { command: "help" };
  if (values.version) return { command: "version" };

  const subcommand = positionals[0];
  if (subcommand === "setup" || subcommand === "mcp") {
    if (positionals.length > 1) {
      throw new CliError(`${subcommand} does not accept positional arguments.`);
    }
    const commandOptions = Object.keys(values).filter(
      (option) => option !== "help" && option !== "version",
    );
    if (commandOptions.length > 0) {
      throw new CliError(`${subcommand} does not accept transcription options.`);
    }
    return { command: subcommand };
  }

  if (positionals.length !== 1) {
    throw new CliError("Provide one URL or local media file. Run with --help for usage.");
  }

  return {
    command: "transcribe",
    source: positionals[0]!,
    format: oneOf("format", values.format, ["md", "txt", "json", "srt"], "md"),
    output: values.output,
    mode: oneOf("mode", values.mode, ["asr", "captions"], "asr"),
    model: values.model,
    lang: values.lang,
    engine: oneOf("engine", values.engine, ["local", "groq"], "local"),
    yes: values.yes ?? false,
  };
}

const MODEL_EXPLANATION =
  "Transcriptly runs transcription locally on your computer, so it needs a one-time Whisper model download. Models are stored in ~/.cache/transcriptly/models.";

async function downloadWithExplanation(model: string): Promise<void> {
  process.stderr.write(`${MODEL_EXPLANATION}\n\n`);
  await downloadModel(model);
}

async function localModelFor(command: TranscribeCommand): Promise<string> {
  if (command.model) {
    if (isLocalModelInstalled(command.model)) return command.model;
    if (!isDownloadableModelName(command.model)) {
      throw new CliError(
        `Local model file "${command.model}" was not found. Run \`transcriptly setup\` or pass an existing model path.`,
      );
    }
    if (command.yes) {
      await downloadWithExplanation(command.model);
      return command.model;
    }
    if (!process.stdin.isTTY) {
      throw new CliError(
        `Model "${command.model}" is not installed. Run \`transcriptly setup\`, or use --yes --model ${command.model} to download it.`,
      );
    }
    await downloadWithExplanation(command.model);
    return command.model;
  }

  const path = configPath();
  const configured = await configuredLocalModel(path);
  if (configured) return configured;

  if (command.yes || !process.stdin.isTTY) {
    throw new CliError(
      "No local model is installed. Run `transcriptly setup` in an interactive terminal, or pass --yes --model <name>.",
    );
  }

  // First run in a terminal: walk through setup, then carry on with the transcription.
  process.stderr.write("No Whisper model is set up yet, running setup first.\n\n");
  await runSetup();
  const chosen = await configuredLocalModel(path);
  if (!chosen) throw new CliError("Setup finished without a usable model. Run `transcriptly setup` again.");
  process.stderr.write("\n");
  return chosen;
}

async function runSetup(): Promise<void> {
  printDoctor(checkTools());
  process.stderr.write("\n");

  if (!process.stdin.isTTY) {
    throw new CliError("Model selection needs an interactive terminal.");
  }

  const path = configPath();
  const configured = (await readConfig(path)).model;
  const configuredIndex = MODEL_OPTIONS.findIndex(
    (model) => model.name === configured,
  );
  const initialIndex = configuredIndex >= 0 ? configuredIndex : DEFAULT_MODEL_INDEX;
  const selected = await pickModel(process.stdin, process.stderr, initialIndex);
  if (!isLocalModelInstalled(selected.name)) await downloadWithExplanation(selected.name);
  await writeConfig({ model: selected.name }, path);
  process.stderr.write(`Using local model: ${selected.name}\n`);
}

function friendlyError(error: unknown): string {
  if (error instanceof CliError) return error.message;
  if (error instanceof MissingBinaryError) {
    return `Missing required tool: ${error.binary}. Run \`transcriptly setup\` for install help.`;
  }
  if (error instanceof MissingModelError) {
    return `Local model "${error.model}" is not installed. Run \`transcriptly setup\`.`;
  }
  if (error instanceof SourceNotFoundError) return `File not found: ${error.path}`;
  if (error instanceof UnsupportedUrlError) {
    return "Could not read that URL. Check that it is valid and supported by yt-dlp.";
  }
  if (error instanceof CommandExecutionError) {
    if (error.binary === "yt-dlp") {
      return "yt-dlp could not process the source. Check the URL and try again.";
    }
    if (error.binary === "ffmpeg" || error.binary === "ffprobe") {
      return `${error.binary} could not read the media.`;
    }
    if (error.binary === "whisper-cli") return "whisper-cli could not transcribe the audio.";
    return `${error.binary} failed with exit code ${error.exitCode}.`;
  }
  if (
    error instanceof CaptionsUnavailableError ||
    error instanceof ConfigurationError ||
    error instanceof InvalidOptionError ||
    error instanceof InvalidSourceError ||
    error instanceof TranscriptionError
  ) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Unexpected error.";
}

export async function runCli(args = process.argv.slice(2)): Promise<number> {
  try {
    const command = parseCliArgs(args);
    if (command.command === "help") {
      process.stdout.write(`${HELP_TEXT}\n`);
      return 0;
    }
    if (command.command === "version") {
      process.stdout.write(`transcriptly ${VERSION}\n`);
      return 0;
    }
    if (command.command === "mcp") {
      await runMcpServer();
      return 0;
    }
    if (command.command === "setup") {
      await runSetup();
      return 0;
    }

    const model =
      command.mode === "asr" && command.engine === "local"
        ? await localModelFor(command)
        : command.model;
    const status =
      command.mode === "captions"
        ? "Fetching captions"
        : command.engine === "groq"
          ? "Transcribing with Groq"
          : `Transcribing locally with ${basename(model ?? "model")}`;
    process.stderr.write("Resolving source…\n");

    const transcript = await transcribe(
      command.source,
      {
        format: command.format,
        mode: command.mode,
        model,
        lang: command.lang,
        engine: command.engine,
      },
      { onSourceResolved: () => process.stderr.write(`${status}…\n`) },
    );
    const formatted = `${formatTranscript(transcript, command.format)}\n`;
    if (command.output) {
      await writeFile(command.output, formatted, "utf8");
      process.stderr.write(`Wrote transcript to ${command.output}\n`);
    } else {
      process.stdout.write(formatted);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${friendlyError(error).replace(/\s+/g, " ").trim()}\n`);
    return 1;
  }
}

/**
 * True when this file is the process entry point. npm and npx invoke the bin
 * through a symlink, so both sides are resolved to real paths before comparing.
 */
export function isMainModule(entry: string | undefined, moduleUrl: string): boolean {
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isMainModule(process.argv[1], import.meta.url)) process.exitCode = await runCli();
