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
  const processHandle = Bun.spawn([executable, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);

  if (exitCode !== 0) {
    throw new CommandExecutionError(binary, exitCode, stderrExcerpt(stderr));
  }

  return { stdout, stderr };
}
