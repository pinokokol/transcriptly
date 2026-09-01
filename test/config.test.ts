import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configPath, readConfig, writeConfig } from "../src/cli/config";

test("config read/write creates directories and preserves the model", async () => {
  const home = await mkdtemp(join(tmpdir(), "transcriptly-config-test-"));
  const path = configPath(home);
  try {
    expect(await readConfig(path)).toEqual({});
    await writeConfig({ model: "large-v3-turbo" }, path);
    expect(await readConfig(path)).toEqual({ model: "large-v3-turbo" });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      model: "large-v3-turbo",
    });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

