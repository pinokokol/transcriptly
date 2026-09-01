import { expect, test } from "bun:test";

import { CommandExecutionError } from "../src/errors";
import { runCommand } from "../src/process";

test("runCommand captures piped stdout and stderr", async () => {
  const result = await runCommand("node", [
    "-e",
    "process.stdout.write('out'); process.stderr.write('err')",
  ]);
  expect(result).toEqual({ stdout: "out", stderr: "err" });
});

test("runCommand preserves typed nonzero errors and excerpts stderr", async () => {
  try {
    await runCommand("node", [
      "-e",
      "process.stderr.write('prefix ' + 'x'.repeat(1700)); process.exit(7)",
    ]);
    throw new Error("expected runCommand to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(CommandExecutionError);
    const commandError = error as CommandExecutionError;
    expect(commandError.exitCode).toBe(7);
    expect(commandError.stderr.length).toBe(1501);
    expect(commandError.stderr.startsWith("…")).toBe(true);
  }
});

