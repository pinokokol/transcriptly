import { describe, expect, test } from "bun:test";

import { HELP_TEXT, parseCliArgs } from "../src/cli";

function transcribeArgs(...args: string[]) {
  const command = parseCliArgs(["input.mp4", ...args]);
  if (command.command !== "transcribe") throw new Error("expected transcribe command");
  return command;
}

describe("parseCliArgs", () => {
  test("uses the documented transcription defaults", () => {
    expect(transcribeArgs()).toEqual({
      command: "transcribe",
      source: "input.mp4",
      format: "md",
      mode: "asr",
      engine: "local",
      yes: false,
    });
  });

  test.each(["md", "txt", "json", "srt"])("parses --format %s", (format) => {
    expect(transcribeArgs("--format", format).format).toBe(format);
  });

  test("parses -f", () => {
    expect(transcribeArgs("-f", "txt").format).toBe("txt");
  });

  test("parses --output and -o", () => {
    expect(transcribeArgs("--output", "one.txt").output).toBe("one.txt");
    expect(transcribeArgs("-o", "two.txt").output).toBe("two.txt");
  });

  test("parses --mode", () => {
    expect(transcribeArgs("--mode", "captions").mode).toBe("captions");
  });

  test("parses --model", () => {
    expect(transcribeArgs("--model", "large-v3").model).toBe("large-v3");
  });

  test("parses --lang", () => {
    expect(transcribeArgs("--lang", "sl").lang).toBe("sl");
  });

  test("parses --engine", () => {
    expect(transcribeArgs("--engine", "groq").engine).toBe("groq");
  });

  test("parses --yes and -y", () => {
    expect(transcribeArgs("--yes").yes).toBe(true);
    expect(transcribeArgs("-y").yes).toBe(true);
  });

  test("parses --help and -h", () => {
    expect(parseCliArgs(["--help"])).toEqual({ command: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ command: "help" });
  });

  test("parses --version", () => {
    expect(parseCliArgs(["--version"])).toEqual({ command: "version" });
  });

  test("parses setup and mcp", () => {
    expect(parseCliArgs(["setup"])).toEqual({ command: "setup" });
    expect(parseCliArgs(["mcp"])).toEqual({ command: "mcp" });
  });

  test("rejects invalid values and missing input", () => {
    expect(() => transcribeArgs("--format", "pdf")).toThrow("Invalid --format");
    expect(() => parseCliArgs([])).toThrow("Provide one URL");
  });

  test("keeps help to one screen", () => {
    expect(HELP_TEXT.split("\n").length).toBeLessThanOrEqual(24);
  });
});


describe("isMainModule", () => {
  test("recognises the entry point through a symlink, as npm and npx invoke bins", async () => {
    const { mkdtemp, symlink, writeFile: write } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const { isMainModule } = await import("../src/cli");
    const dir = await mkdtemp(join(tmpdir(), "transcriptly-main-"));
    const real = join(dir, "cli.js");
    const link = join(dir, "transcriptly");
    await write(real, "");
    await symlink(real, link);
    expect(isMainModule(link, pathToFileURL(real).href)).toBe(true);
    expect(isMainModule(real, pathToFileURL(real).href)).toBe(true);
    expect(isMainModule(join(dir, "other.js"), pathToFileURL(real).href)).toBe(false);
    expect(isMainModule(undefined, pathToFileURL(real).href)).toBe(false);
  });
});
