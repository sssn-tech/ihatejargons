import { createHash } from "node:crypto";
import { builtInLevels } from "./levels.js";

// Built-in level texts this plugin shipped before, as SHA-256 of [id, prompt, format, layout].
// settings.json keeps a copy of every level, so without this an install would keep the old
// built-in prompts forever. A saved level that still matches one of these was never edited,
// and moves to the current built-in text. When the built-ins change again, add the hashes of
// the version being replaced here.
const retired = new Set([
  "2d33767490cb19e43005f7f17a4f4be7d1126f918a9c5f9a21fe986a2f9aaebe", // light, f1e9556
  "6220ba8458f25a74d82f67a637b062fde41d1f4f250cccc2729108b1f76ecc99"  // deep, f1e9556
]);

export function fingerprint(level) {
  const text = value => typeof value === "string" ? value.trim() : value;
  return createHash("sha256").update(JSON.stringify([level.id, text(level.prompt), text(level.format), level.layout])).digest("hex");
}

// Edited levels, custom levels and the user's own level names are left alone.
export function upgradeLevels(levels) {
  if (!Array.isArray(levels)) return levels;
  return levels.map(level => {
    const current = level && builtInLevels.find(item => item.id === level.id);
    if (!current || !retired.has(fingerprint(level))) return level;
    return { ...level, prompt: current.prompt, format: current.format, layout: current.layout };
  });
}
