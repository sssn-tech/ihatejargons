// Runs the shipped translator over every case and scores it.
//   node eval/run.mjs                       # all cases, light + deep
//   node eval/run.mjs --case rc042 --modes deep
// Writes eval/results/<stamp>.md and .json. Compare two runs with eval/compare.mjs.
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { builtInLevels } from "../src/levels.js";
import { translate } from "../src/backend.js";
import {
  loadCases, snapshot, restore, tokensOk, jargonDelta, similarity,
  accuracyMessages, parseAccuracy, clarityMessages, parseClarity, settle, judge
} from "./lib.mjs";
import { renderRun } from "./report.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith("--")) continue;
  const next = process.argv[i + 1];
  args.set(process.argv[i].slice(2), next && !next.startsWith("--") ? (i++, next) : "true");
}
const modes = (args.get("modes") || "light,deep").split(",").map(mode => mode.trim()).filter(Boolean);
for (const mode of modes) if (!builtInLevels.some(level => level.id === mode)) throw Error("未知阅读等级: " + mode);
const judgeModel = args.get("judge") || "deepseek-ai/DeepSeek-V4-Pro";
const pluginModel = args.get("model") || "deepseek-ai/DeepSeek-V4.1-Flash";
const filter = args.get("case") || "";
const concurrency = Number(args.get("concurrency") || 4);

const cases = (await loadCases()).filter(item => !filter || item.meta.id.includes(filter) || item.file.includes(filter));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

async function runCase(item, mode) {
  const { text, terms, labels } = snapshot(item.body);
  const source = restore(text, terms);
  const row = { id: item.meta.id, type: item.meta.type, mode, lang: item.meta.lang || "zh" };
  try {
    const output = await translate(
      { mode, kind: item.meta.kind, question: item.meta.question, history: [], target: text, terms: labels },
      { provider: "siliconflow", cloudModel: pluginModel, localModel: "", levels: builtInLevels }
    );
    const translated = restore(output, terms);
    row.output = translated;
    row.tokensOk = tokensOk(output, terms);
    row.jargon = jargonDelta(source, translated);
    row.similarity = row.lang === "en" ? null : similarity(source, translated);
    const tasks = [judge(judgeModel, accuracyMessages(item, source, translated), raw => parseAccuracy(raw, item, translated))];
    // Only replies that need fixing are compared against the original for clarity.
    if (item.meta.type === "fix") {
      tasks.push(judge(judgeModel, clarityMessages(item.meta.question, source, translated), parseClarity));
      tasks.push(judge(judgeModel, clarityMessages(item.meta.question, translated, source), parseClarity));
    }
    const [accuracy, first, second] = await Promise.allSettled(tasks);
    if (accuracy.status === "fulfilled") row.accuracy = accuracy.value;
    else row.judgeError = accuracy.reason.message;
    if (first && second) {
      if (first.status === "fulfilled" && second.status === "fulfilled") {
        row.clarity = { result: settle(first.value, second.value), reasons: [first.value.reason, second.value.reason] };
      } else row.judgeError = (row.judgeError ? row.judgeError + "；" : "") + "清晰度评审失败";
    }
  } catch (error) {
    row.error = error.message;
  }
  process.stdout.write(`${item.meta.id} ${mode}: ${row.error ? "错误 " + row.error : row.clarity?.result || "完成"}\n`);
  return row;
}

const rows = [];
const queue = cases.flatMap(item => modes.map(mode => ({ item, mode })));
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) rows.push(await runCase(job.item, job.mode));
}
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
const order = new Map(cases.map((item, index) => [item.meta.id, index]));
rows.sort((a, b) => order.get(a.id) - order.get(b.id) || a.mode.localeCompare(b.mode));

const run = { stamp, pluginModel, judgeModel, modes, rows };
const markdown = renderRun(run, cases);
await mkdir(join(root, "eval/results"), { recursive: true });
await writeFile(join(root, `eval/results/${stamp}.md`), markdown);
await writeFile(join(root, `eval/results/${stamp}.json`), JSON.stringify(run, null, 1));
console.log("\n" + markdown.split("\n").slice(0, 16).join("\n"));
console.log("\n完整结果：eval/results/" + stamp + ".md");
