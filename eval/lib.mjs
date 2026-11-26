import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const caseDirectory = fileURLToPath(new URL("./cases/", import.meta.url));
export const words = JSON.parse(readFileSync(new URL("./words.json", import.meta.url), "utf8"));

// A case is one Codex reply: a JSON comment header, then the reply exactly as written.
// Header: id, type (fix | keep), kind (report | summary), question, source, checks[{q,a}], traps[] (optional).
export function parseCase(name, source) {
  const match = /^<!--\n([\s\S]*?)\n-->\n+([\s\S]*)$/u.exec(source.trimStart());
  if (!match) throw Error(name + ": 缺少 JSON 头或正文");
  const meta = JSON.parse(match[1]);
  const body = match[2].trim();
  for (const key of ["id", "type", "kind", "question", "source", "checks"]) {
    if (!(key in meta)) throw Error(name + ": 缺少字段 " + key);
  }
  if (!["fix", "keep"].includes(meta.type)) throw Error(name + ": type 必须是 fix 或 keep");
  if (!["report", "summary"].includes(meta.kind)) throw Error(name + ": kind 必须是 report 或 summary");
  if (!Array.isArray(meta.checks) || meta.checks.length < 1 || meta.checks.length > 4) throw Error(name + ": checks 需要 1–4 条");
  for (const check of meta.checks) if (!check.q || !check.a) throw Error(name + ": check 缺少 q 或 a");
  meta.traps = meta.traps || [];
  if (!meta.traps.every(trap => typeof trap === "string" && trap)) throw Error(name + ": traps 必须是字符串列表");
  if (!body) throw Error(name + ": 正文为空");
  return { file: name, meta, body };
}

export async function loadCases(directory = caseDirectory) {
  const names = (await readdir(directory)).filter(name => name.endsWith(".md")).sort();
  const cases = [];
  for (const name of names) cases.push(parseCase(name, await readFile(join(directory, name), "utf8")));
  const ids = new Set();
  for (const item of cases) {
    if (ids.has(item.meta.id)) throw Error("重复的用例 id: " + item.meta.id);
    ids.add(item.meta.id);
  }
  return cases;
}

// Mirrors src/content.js snapshot(): inline code becomes a ⟦Tn⟧ placeholder, and only
// snake_case values and numeric ranges also get a label for the model. Chinese labels in
// backticks (`旧版消费者 × 历史事件`) stay as text, exactly as the plugin sends them.
const labelable = /^(?:[A-Za-z]{1,20}(?:_[A-Za-z]{1,20})+|[\d.]+%?(?:\s*[→–-]\s*[\d.]+%?)?)$/u;
const humanLabel = /^[\p{Script=Han}A-Za-z0-9 ×→，、（）%.-]{2,96}$/u;

export function snapshot(body) {
  const terms = [];
  const text = body.replace(/`([^`\n]+)`/gu, (whole, inner) => {
    if (/\p{Script=Han}/u.test(inner.trim()) && humanLabel.test(inner.trim())) return "`" + inner.trim() + "`";
    const token = "⟦T" + terms.length + "⟧";
    terms.push({ token, label: inner.trim() });
    return token;
  });
  return { text, terms, labels: terms.filter(term => term.label.length <= 48 && labelable.test(term.label)) };
}

export function restore(text, terms) {
  let output = text;
  for (const { token, label } of terms) output = output.replaceAll(token, label);
  return output;
}

// Same rule as src/backend.js: every placeholder survives, none is invented, repeats are fine.
export function tokensOk(text, terms) {
  const found = new Set(text.match(/⟦T\d+⟧/g) || []);
  return found.size === terms.length && terms.every(({ token }) => found.has(token));
}

// Longest words first, and each matched span is blanked so 稳稳兜住 is not also counted as 兜住.
export function jargonIn(text, list) {
  let rest = text.toLowerCase();
  for (const phrase of words.not || []) rest = rest.replaceAll(phrase.toLowerCase(), " ");
  const found = new Set();
  for (const word of [...list].sort((a, b) => b.length - a.length)) {
    const needle = word.toLowerCase();
    if (!rest.includes(needle)) continue;
    found.add(word);
    rest = rest.replaceAll(needle, " ");
  }
  return found;
}

// Hard jargon still in the translation, split into what the source already had and what the
// translator brought in on its own.
export function jargonDelta(source, output) {
  const before = jargonIn(source, words.hard);
  const after = jargonIn(output, words.hard);
  return {
    source: [...before],
    kept: [...after].filter(word => before.has(word)),
    added: [...after].filter(word => !before.has(word))
  };
}

function bigrams(text) {
  const set = new Set();
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
  return set;
}

// How much of the wording survived: 1 means unchanged, 0 means nothing shared.
export function similarity(a, b) {
  const clean = value => value.replace(/⟦T\d+⟧|[\s*#>|`_\-]/g, "");
  const left = bigrams(clean(a)), right = bigrams(clean(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const pair of left) if (right.has(pair)) shared++;
  return Number(((2 * shared) / (left.size + right.size)).toFixed(2));
}

// One call: can a reader get each answer from the translation alone, did it fall into a known
// trap, and does it say anything the original does not.
export function accuracyMessages(item, source, translated) {
  const system = [
    "你在检查一段改写是否忠实。source 是 AI 编程助手的原话，translated 是给不写代码的人看的改写。",
    "对 checks 里每个问题：只读 translated，读者能否得出 a 给的答案？yes＝能；partial＝只能得出一部分；no＝得不出；wrong＝会得出错误或相反的结论。措辞不同但意思一致算 yes。",
    "对 traps 里每一条：translated 是否犯了这个错？",
    "added：列出 translated 里会误导读者的新内容（source 没有的事实、改了的数字、把计划写成已完成等），最多 3 条；换一种说法、加一句解释都不算。每条的 quote 必须逐字摘自 translated。没有就给空数组。",
    "只按 source 判断，不要用自己的领域知识补充。只输出 JSON，不要代码围栏：",
    '{"checks":["yes|partial|no|wrong",...],"traps":[true|false,...],"added":[{"quote":"译文原句","why":"原文怎么说"}],"note":"一句话"}'
  ].join("\n");
  const user = JSON.stringify({ source, translated, checks: item.meta.checks, traps: item.meta.traps });
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function parseAccuracy(raw, item, translated) {
  const parsed = parseJson(raw);
  const verdicts = new Set(["yes", "partial", "no", "wrong"]);
  if (!Array.isArray(parsed.checks) || parsed.checks.length !== item.meta.checks.length ||
      !parsed.checks.every(value => verdicts.has(value))) throw Error("评审给的 checks 数量或取值不对");
  const traps = Array.isArray(parsed.traps) ? parsed.traps.map(Boolean) : [];
  if (traps.length !== item.meta.traps.length) throw Error("评审给的 traps 数量不对");
  return {
    checks: parsed.checks,
    traps,
    // A claim only counts when its quote is really in the translation; judges sometimes invent one.
    added: (Array.isArray(parsed.added) ? parsed.added : [])
      .filter(entry => entry && typeof entry.quote === "string" && entry.quote.trim() &&
        (translated === undefined || translated.includes(entry.quote.trim())))
      .slice(0, 3).map(entry => ({ quote: entry.quote.trim(), why: String(entry.why || "") })),
    note: String(parsed.note || "")
  };
}

// Pairwise: which of two texts lets a non-programmer understand and act. Completeness is
// judged elsewhere, so the judge is told to ignore it.
export function clarityMessages(question, first, second) {
  const system = [
    "读者知道自己让 AI 编程助手做了什么，但不写代码，也不熟悉工程行话。",
    "A 和 B 是同一条回复的两种写法。只比较：哪一份让这位读者更容易看懂现在的状态、以及自己要不要做什么。",
    "不要比较哪份更完整或更准确，那由别的检查负责。两份差不多就选 same。",
    '只输出 JSON，不要代码围栏：{"winner":"A|B|same","reason":"一句话"}'
  ].join("\n");
  const user = JSON.stringify({ question, A: first, B: second });
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function parseClarity(raw) {
  const parsed = parseJson(raw);
  const winner = String(parsed.winner || "").trim();
  if (!["A", "B", "same"].includes(winner)) throw Error("评审没有给出 A / B / same");
  return { winner, reason: String(parsed.reason || "") };
}

// Ask twice with the order swapped (baseline as A, then as B); only a verdict that survives
// the swap counts.
export function settle(baselineFirst, candidateFirst) {
  if (baselineFirst.winner === "B" && candidateFirst.winner === "A") return "win";
  if (baselineFirst.winner === "A" && candidateFirst.winner === "B") return "loss";
  return "tie";
}

function parseJson(raw) {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*|```\s*$/g, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw Error("评审没有返回 JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Same key file and endpoint the plugin uses, so the eval measures what ships.
export function apiKey() {
  if (process.env.SILICONFLOW_API_KEY) return process.env.SILICONFLOW_API_KEY;
  const file = join(homedir(), ".config/minicode/siliconflow.env");
  if (!existsSync(file)) throw Error("找不到 SILICONFLOW_API_KEY");
  const match = /^\s*(?:export\s+)?SILICONFLOW_API_KEY\s*=\s*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s#]+))/m
    .exec(readFileSync(file, "utf8"));
  const key = match && (match[1] || match[2] || match[3]);
  if (!key) throw Error("SILICONFLOW_API_KEY 为空");
  return key;
}

export async function askModel(model, messages, { retries = 2 } = {}) {
  const key = apiKey();
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ model, messages, stream: false, temperature: 0, enable_thinking: false })
      });
      if (!response.ok) throw Error("HTTP " + response.status + " " + (await response.text()).slice(0, 200));
      const choice = (await response.json()).choices?.[0];
      if (choice?.finish_reason === "length") throw Error("输出被截断");
      const content = choice?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw Error("空回复");
      return content.trim();
    } catch (error) {
      last = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw last;
}

// Retry once when the judge answers in the wrong shape; a second failure is reported, not hidden.
export async function judge(model, messages, parse) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return parse(await askModel(model, messages)); }
    catch (error) { last = error; }
  }
  throw last;
}

export function readRate(accuracy) {
  const points = { yes: 1, partial: 0.5, no: 0, wrong: 0 };
  return accuracy.checks.reduce((sum, verdict) => sum + points[verdict], 0) / accuracy.checks.length;
}

export function mistakes(accuracy) {
  return accuracy.checks.filter(verdict => verdict === "wrong").length +
    accuracy.traps.filter(Boolean).length + accuracy.added.length;
}
