import { emitKeypressEvents } from "node:readline";

import { CliError } from "./errors";

export interface ModelOption {
  name: string;
  size: string;
  description: string;
  recommended?: boolean;
  approximateBytes: number;
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    name: "small",
    size: "466 MB",
    description: "fast, good accuracy on clear speech",
    approximateBytes: 466 * 1024 * 1024,
  },
  {
    name: "large-v3-turbo",
    size: "1.6 GB",
    description: "best quality/speed balance",
    recommended: true,
    approximateBytes: 1.6 * 1024 * 1024 * 1024,
  },
  {
    name: "large-v3",
    size: "2.9 GB",
    description: "maximum accuracy, slowest",
    approximateBytes: 2.9 * 1024 * 1024 * 1024,
  },
];

export const DEFAULT_MODEL_INDEX = MODEL_OPTIONS.findIndex(
  (model) => model.recommended,
);

export function moveSelection(
  index: number,
  direction: -1 | 1,
  length = MODEL_OPTIONS.length,
): number {
  return (index + direction + length) % length;
}

function modelLine(model: ModelOption, selected: boolean): string {
  const marker = selected ? "›" : " ";
  const recommended = model.recommended ? " (recommended)" : "";
  return `${marker} ${model.name.padEnd(18)} ${model.size.padEnd(7)} ${model.description}${recommended}`;
}

export async function pickModel(
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stderr,
  initialIndex = DEFAULT_MODEL_INDEX,
): Promise<ModelOption> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new CliError("Model selection needs an interactive terminal.");
  }

  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  const wasPaused = input.isPaused();
  let selectedIndex = initialIndex;
  let rendered = false;

  const render = (): void => {
    if (rendered) output.write(`\u001B[${MODEL_OPTIONS.length}A`);
    for (const [index, model] of MODEL_OPTIONS.entries()) {
      output.write(`\u001B[2K\r${modelLine(model, index === selectedIndex)}\n`);
    }
    rendered = true;
  };

  output.write("Choose a local Whisper model (↑/↓, enter):\n\u001B[?25l");
  input.setRawMode(true);
  input.resume();
  render();

  return new Promise<ModelOption>((resolve, reject) => {
    const cleanup = (): void => {
      input.off("keypress", onKeypress);
      input.setRawMode(Boolean(wasRaw));
      if (wasPaused) input.pause();
      output.write("\u001B[?25h");
    };

    const onKeypress = (
      _text: string,
      key: { name?: string; ctrl?: boolean },
    ): void => {
      if (key.name === "up" || key.name === "down") {
        selectedIndex = moveSelection(selectedIndex, key.name === "up" ? -1 : 1);
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(MODEL_OPTIONS[selectedIndex]!);
        return;
      }
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new CliError("Model selection cancelled."));
      }
    };

    input.on("keypress", onKeypress);
  });
}
