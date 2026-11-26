// Which of two runs reads better? Use after changing a prompt or a model.
//   node eval/compare.mjs eval/results/<old>.json eval/results/<new>.json
// Only the clarity judge runs here; accuracy numbers are already in each run's report.
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCases, clarityMessages, parseClarity, settle, judge } from "./lib.mjs";
import { renderCompare } from "./report.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [aFile, bFile, judgeArg] = process.argv.slice(2);
if (!aFile || !bFile) throw Error("用法：node eval/compare.mjs <A.json> <B.json> [评审模型]");
const judgeModel = judgeArg || "deepseek-ai/DeepSeek-V4-Pro";
const [a, b] = await Promise.all([aFile, bFile].map(async file => JSON.parse(await readFile(file, "utf8"))));
const cases = new Map((await loadCases()).map(item => [item.meta.id, item]));

const pairs = a.rows.flatMap(left => {
  const right = b.rows.find(row => row.id === left.id && row.mode === left.mode);
  return right?.output && left.output && cases.has(left.id) ? [{ left, right }] : [];
});
const rows = [];
const queue = [...pairs];
async function worker() {
  for (let pair = queue.shift(); pair; pair = queue.shift()) {
    const question = cases.get(pair.left.id).meta.question;
    const row = { id: pair.left.id, mode: pair.left.mode };
    try {
      const [first, second] = await Promise.all([
        judge(judgeModel, clarityMessages(question, pair.left.output, pair.right.output), parseClarity),
        judge(judgeModel, clarityMessages(question, pair.right.output, pair.left.output), parseClarity)
      ]);
      row.result = settle(first, second);
      row.reasons = [first.reason, second.reason];
    } catch (error) {
      row.error = error.message;
    }
    rows.push(row);
  }
}
await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
rows.sort((x, y) => x.id.localeCompare(y.id) || x.mode.localeCompare(y.mode));

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const compare = { stamp, a: basename(aFile), b: basename(bFile), judgeModel,
  modes: [...new Set(rows.map(row => row.mode))], rows };
const markdown = renderCompare(compare);
const out = join(root, `eval/results/compare-${stamp}.md`);
await writeFile(out, markdown);
console.log(markdown.split("\n").slice(0, 10).join("\n") + "\n\n完整结果：" + out);
