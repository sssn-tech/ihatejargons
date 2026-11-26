// Re-scores a stored run without calling the translator or the judge.
// Deterministic checks (placeholders, numbers, jargon, similarity) are recomputed from
// the saved outputs, so a metric fix or a new annotation costs nothing to apply.
// Usage: node eval/replay.mjs eval/results/<stamp>.json
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCases, snapshot, deterministicChecks, score } from "./lib.mjs";
import { renderReport } from "./report.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = process.argv[2];
if (!source) throw Error("用法：node eval/replay.mjs eval/results/<stamp>.json");

const stored = JSON.parse(await readFile(source, "utf8"));
const items = new Map((await loadCases()).map(item => [item.meta.id, item]));
const note = [];
for (const row of stored.rows) {
  const item = items.get(row.id);
  if (!item) { note.push(`跳过 ${row.id}：用例已被删除`); continue; }
  if (!row.output) continue;
  const { terms } = snapshot(item.body, { labelAll: false });
  row.checks = deterministicChecks(item, row.output, terms);
  if (row.judge && !(row.judge.grade >= 1 && row.judge.grade <= 5)) {
    row.judgeError = "这一条的评审没给出有效分数，需要重跑";
    delete row.score;
  } else if (row.judge) {
    try { row.score = score(row.judge, row.checks); }
    catch (error) { row.judgeError = error.message; note.push(`${row.id}/${row.mode}：${error.message}`); }
  }
}
stored.rows.sort((a, b) => a.id.localeCompare(b.id) || a.mode.localeCompare(b.mode));
const stamp = stored.stamp + "-replay";
const modes = stored.modes || [...new Set(stored.rows.map(row => row.mode))];
const cases = stored.cases || new Set(stored.rows.map(row => row.id)).size;
const markdown = renderReport({ ...stored, stamp, modes, cases, rows: stored.rows });
await writeFile(join(root, `eval/results/${stamp}.md`), markdown);
await writeFile(join(root, `eval/results/${stamp}.json`), JSON.stringify({ ...stored, stamp }, null, 1));
if (note.length) console.log(note.join("\n"));
console.log(markdown.split("\n").slice(0, 16).join("\n"));
console.log("\n结果：eval/results/" + stamp + ".md");
