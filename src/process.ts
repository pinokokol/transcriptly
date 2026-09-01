import { spawn } from "node:child_process";
import { constants, accessSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

import { CommandExecutionError, MissingBinaryError } from "./errors";

const STDERR_LIMIT = 1_500;

export interface CommandResult {
  stdout: string;
  stderr: string;
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveBinary(binary: string): string {
  if (isAbsolute(binary)) {
    if (isExecutable(binary)) return binary;
    throw new MissingBinaryError(binary);
  }

  const searchPaths = [
    ...(process.env.PATH ?? "").split(delimiter),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];

  for (const directory of searchPaths) {
    if (!directory) continue;
    const candidate = join(directory, binary);
    if (isExecutable(candidate)) return candidate;
  }

  throw new MissingBinaryError(binary);
}

function stderrExcerpt(stderr: string): string {
  const normalized = stderr.replace(/\s+/g, " ").trim();
  return normalized.length <= STDERR_LIMIT
    ? normalized
    : `…${normalized.slice(-STDERR_LIMIT)}`;
}

export async function runCommand(
  binary: string,
  args: readonly string[],
  cwd?: string,
): Promise<CommandResult> {
  const executable = resolveBinary(binary);
  const processHandle = spawn(executable, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  processHandle.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
  processHandle.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  const exitCode = await new Promise<number>((resolve, reject) => {
    processHandle.once("error", reject);
    processHandle.once("close", (code) => resolve(code ?? 1));
  });
  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  const stderr = Buffer.concat(stderrChunks).toString("utf8");

  if (exitCode !== 0) {
    throw new CommandExecutionError(binary, exitCode, stderrExcerpt(stderr));
  }

  return { stdout, stderr };
}
