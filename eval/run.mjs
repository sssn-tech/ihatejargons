// Runs the shipped translator over the annotated cases and scores the result.
// Usage:
//   node eval/run.mjs                          # all cases, light + deep, default judge
//   node eval/run.mjs --case rc042 --modes deep
//   node eval/run.mjs --second deepseek-ai/DeepSeek-V3.2
// Results land in eval/results/<stamp>.md and .json.
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { builtInLevels } from "../src/levels.js";
import { translate } from "../src/backend.js";
import { loadCases, snapshot, deterministicChecks, judgeMessages, parseJudge, askModel, score } from "./lib.mjs";
import { renderReport } from "./report.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!key.startsWith("--")) continue;
  const next = process.argv[i + 1];
  args.set(key.slice(2), next && !next.startsWith("--") ? (i++, next) : "true");
}

const modes = (args.get("modes") || "light,deep").split(",").map(mode => mode.trim()).filter(Boolean);
for (const mode of modes) {
  if (!builtInLevels.some(level => level.id === mode)) throw Error("未知阅读等级: " + mode);
}
const judgeModel = args.get("judge") || "deepseek-ai/DeepSeek-V4-Pro";
const secondModel = args.get("second") || "";
const pluginModel = args.get("model") || "deepseek-ai/DeepSeek-V4.1-Flash";
const filter = args.get("case") || "";
const labelAll = args.has("label-all");
const concurrency = Number(args.get("concurrency") || 3);

const cases = (await loadCases()).filter(item => !filter || item.meta.id.includes(filter) || item.file.includes(filter));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

async function runCase(item, mode) {
  const { text, terms, labels } = snapshot(item.body, { labelAll });
  const started = Date.now();
  const row = { id: item.meta.id, title: item.meta.title, file: item.file, mode, kind: item.meta.kind,
    patterns: item.meta.patterns || [], origin: item.meta.origin };
  try {
    const output = await translate(
      { mode, kind: item.meta.kind, question: item.meta.question || "", history: [], target: text, terms: labels },
      { provider: "siliconflow", cloudModel: pluginModel, localModel: "", levels: builtInLevels }
    );
    row.output = output;
    row.ms = Date.now() - started;
    row.checks = deterministicChecks(item, output, terms);
    try {
      row.judge = parseJudge(await askModel(judgeModel, judgeMessages(item, output, terms)));
      row.score = score(row.judge, row.checks);
    } catch (error) {
      row.judgeError = error.message;
    }
    if (secondModel) {
      try {
        const second = parseJudge(await askModel(secondModel, judgeMessages(item, output, terms)));
        row.second = {
          contradicted: second.facts.filter(fact => fact.verdict === "contradicted").length,
          missing: second.facts.filter(fact => fact.verdict === "missing").length,
          trapsViolated: second.traps.filter(trap => trap.violated).length,
          grade: second.grade
        };
        row.agreement = {
          facts: second.facts.filter(fact => row.judge?.facts.find(other => other.id === fact.id)?.verdict === fact.verdict).length /
            Math.max(1, second.facts.length),
          traps: second.traps.filter(trap => row.judge?.traps.find(other => other.id === trap.id)?.violated === trap.violated).length /
            Math.max(1, second.traps.length)
        };
      } catch (error) {
        row.secondError = error.message;
      }
    }
  } catch (error) {
    row.error = error.message;
    row.ms = Date.now() - started;
  }
  process.stdout.write(`${item.meta.id} ${mode}: ${row.error ? "错误 " + row.error : "评分 " + (row.score?.grade ?? "无")}\n`);
  return row;
}

const rows = [];
const queue = [];
for (const item of cases) for (const mode of modes) queue.push({ item, mode });
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) rows.push(await runCase(job.item, job.mode));
}
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
rows.sort((a, b) => a.id.localeCompare(b.id) || a.mode.localeCompare(b.mode));

const markdown = renderReport({ stamp, modes, pluginModel, judgeModel, secondModel, cases: cases.length, rows });
await mkdir(join(root, "eval/results"), { recursive: true });
await writeFile(join(root, `eval/results/${stamp}.md`), markdown);
await writeFile(join(root, `eval/results/${stamp}.json`),
  JSON.stringify({ stamp, pluginModel, judgeModel, secondModel, modes, cases: cases.length, rows }, null, 1));
console.log("\n" + markdown.split("\n").slice(0, 14).join("\n"));
console.log("\n完整结果：eval/results/" + stamp + ".md");
