import { resolveBinary } from "../process";

export interface DoctorResult {
  binary: "yt-dlp" | "ffmpeg" | "whisper-cli";
  path?: string;
  hint: string;
}

type BinaryResolver = (binary: string) => string;

const TOOLS: readonly DoctorResult["binary"][] = [
  "yt-dlp",
  "ffmpeg",
  "whisper-cli",
];

function installHint(binary: DoctorResult["binary"], platform: NodeJS.Platform): string {
  if (platform === "darwin") {
    return `brew install ${binary === "whisper-cli" ? "whisper-cpp" : binary}`;
  }
  if (binary === "yt-dlp") {
    return "pipx install yt-dlp (or: python3 -m pip install -U yt-dlp)";
  }
  if (binary === "ffmpeg") return "sudo apt install ffmpeg";
  return "sudo apt install build-essential cmake, then build whisper.cpp and add whisper-cli to PATH";
}

export function checkTools(
  resolver: BinaryResolver = resolveBinary,
  platform: NodeJS.Platform = process.platform,
): DoctorResult[] {
  return TOOLS.map((binary) => {
    try {
      return { binary, path: resolver(binary), hint: installHint(binary, platform) };
    } catch {
      return { binary, hint: installHint(binary, platform) };
    }
  });
}

export function printDoctor(
  results: readonly DoctorResult[],
  output: NodeJS.WritableStream = process.stderr,
): void {
  output.write("Checking dependencies:\n");
  for (const result of results) {
    if (result.path) {
      output.write(`  ✓ ${result.binary} (${result.path})\n`);
    } else {
      output.write(`  ✗ ${result.binary} not found\n    Install: ${result.hint}\n`);
    }
  }
}
