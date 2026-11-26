import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readSettings } from "../src/backend.js";
import { builtInLevels } from "../src/levels.js";
import { fingerprint, upgradeLevels } from "../src/level-migration.js";

// The built-in levels exactly as commit f1e9556 shipped and saved them into settings.json.
const shipped = JSON.parse(readFileSync(new URL("./fixtures/levels-f1e9556.json", import.meta.url), "utf8"));

async function saved(settings) {
  const path = join(await mkdtemp(join(tmpdir(), "ihj-settings-")), "settings.json");
  await writeFile(path, JSON.stringify(settings));
  return path;
}
const base = { provider: "siliconflow", cloudModel: "deepseek-ai/DeepSeek-V4.1-Flash", localModel: "", cacheMB: 32,
  includeHistory: true, recentChats: 3, recentBlocks: 4, defaultMode: "light", warmModes: ["light", "deep"] };

test("the previous built-in prompts are recognised and replaced, keeping the user's level names", async () => {
  const levels = shipped.map(level => ({ ...level, name: level.id === "deep" ? "讲给我妈" : level.name }));
  const settings = await readSettings(await saved({ ...base, levels }));
  for (const level of settings.levels) {
    const current = builtInLevels.find(item => item.id === level.id);
    assert.equal(level.prompt, current.prompt);
    assert.equal(level.format, current.format);
  }
  assert.equal(settings.levels.find(level => level.id === "deep").name, "讲给我妈");
  assert.deepEqual(settings.warmModes, ["light", "deep"], "other settings are untouched");
});

test("an edited built-in level and a custom level are left as they are", async () => {
  const edited = { ...shipped[0], prompt: shipped[0].prompt + "多用比喻。" };
  const custom = { id: "level-detail", name: "补点背景", prompt: "多讲背景。", format: "", layout: "free" };
  const settings = await readSettings(await saved({ ...base, levels: [edited, shipped[1], custom] }));
  assert.equal(settings.levels[0].prompt, edited.prompt);
  assert.equal(settings.levels[1].prompt, builtInLevels[1].prompt);
  assert.deepEqual(settings.levels[2], custom);
});

test("the current built-ins are not treated as retired, and missing settings fall back to defaults", async () => {
  assert.deepEqual(upgradeLevels(builtInLevels), builtInLevels);
  for (const level of builtInLevels) assert.notEqual(fingerprint(level), fingerprint(shipped.find(old => old.id === level.id)));
  const settings = await readSettings(join(await mkdtemp(join(tmpdir(), "ihj-settings-")), "missing.json"));
  assert.equal(settings.levels, builtInLevels);
});
