import { describe, expect, test } from "bun:test";

import { EventEmitter } from "node:events";

import {
  DEFAULT_MODEL_INDEX,
  MODEL_OPTIONS,
  moveSelection,
  pickModel,
} from "../src/cli/picker";

describe("model picker", () => {
  test("exposes the confirmed model table in display order", () => {
    expect(
      MODEL_OPTIONS.map(({ name, size, description, recommended }) => ({
        name,
        size,
        description,
        recommended: recommended ?? false,
      })),
    ).toEqual([
      {
        name: "small",
        size: "466 MB",
        description: "fast, good accuracy on clear speech",
        recommended: false,
      },
      {
        name: "large-v3-turbo",
        size: "1.6 GB",
        description: "best quality/speed balance",
        recommended: true,
      },
      {
        name: "large-v3",
        size: "2.9 GB",
        description: "maximum accuracy, slowest",
        recommended: false,
      },
    ]);
    expect(DEFAULT_MODEL_INDEX).toBe(1);
  });

  test("moves and wraps the selection", () => {
    expect(moveSelection(1, -1)).toBe(0);
    expect(moveSelection(1, 1)).toBe(2);
    expect(moveSelection(0, -1)).toBe(2);
    expect(moveSelection(2, 1)).toBe(0);
  });
});


describe("pickModel", () => {
  test("parks stdin again after a selection so the process can exit", async () => {
    const calls: string[] = [];
    const input = Object.assign(new EventEmitter(), {
      isTTY: true,
      isRaw: false,
      readableFlowing: null as boolean | null,
      isPaused: () => false,
      setRawMode(raw: boolean) {
        calls.push(`raw:${raw}`);
        this.isRaw = raw;
        return this;
      },
      resume() {
        calls.push("resume");
        this.readableFlowing = true;
        return this;
      },
      pause() {
        calls.push("pause");
        this.readableFlowing = false;
        return this;
      },
    }) as unknown as NodeJS.ReadStream;
    const output = { write: () => true } as unknown as NodeJS.WriteStream;

    const picked = pickModel(input, output, 0);
    input.emit("keypress", "", { name: "down" });
    input.emit("keypress", "", { name: "return" });
    expect((await picked).name).toBe("large-v3-turbo");
    expect(calls).toEqual(["raw:true", "resume", "raw:false", "pause"]);
  });
});
