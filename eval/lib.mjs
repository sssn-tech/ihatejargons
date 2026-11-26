import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const caseDirectory = fileURLToPath(new URL("./cases/", import.meta.url));

// A case is one Codex reply, with the facts, traps and jargon annotated by hand.
// The file is markdown: a JSON comment header, then the reply body exactly as Codex wrote it.
export function parseCase(name, source) {
  const match = /^<!--\n([\s\S]*?)\n-->\n+([\s\S]*)$/u.exec(source.trimStart());
  if (!match) throw Error(name + ": 缺少 JSON 头或正文");
  const meta = JSON.parse(match[1]);
  const body = match[2].trim();
  for (const key of ["id", "title", "kind", "facts", "traps"]) {
    if (!(key in meta)) throw Error(name + ": 缺少字段 " + key);
  }
  if (!["report", "summary"].includes(meta.kind)) throw Error(name + ": kind 必须是 report 或 summary");
  for (const fact of meta.facts) if (!fact.id || !fact.text) throw Error(name + ": fact 缺少 id 或 text");
  for (const trap of meta.traps) if (!trap.id || !trap.text) throw Error(name + ": trap 缺少 id 或 text");
  return { file: name, meta, body };
}

export async function loadCases(directory = caseDirectory) {
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
    .map(entry => entry.name)
    .sort();
  const cases = [];
  for (const name of names) cases.push(parseCase(name, await readFile(join(directory, name), "utf8")));
  const ids = new Set();
  for (const item of cases) {
    if (ids.has(item.meta.id)) throw Error("重复的用例 id: " + item.meta.id);
    ids.add(item.meta.id);
  }
  return cases;
}

// Mirrors src/content.js snapshot(): every inline code element is replaced by a ⟦Tn⟧
// placeholder, and only a narrow subset of them also gets a label for the model.
const labelable = /^(?:[A-Za-z]{1,20}(?:_[A-Za-z]{1,20})+|[\d.]+%?(?:\s*[→–-]\s*[\d.]+%?)?)$/u;
const inlineCode = /`([^`\n]+)`/gu;

export function snapshot(body, { labelAll = false } = {}) {
  const terms = [];
  const text = body.replace(inlineCode, (whole, inner) => {
    const label = inner.trim();
    const token = "⟦T" + terms.length + "⟧";
    terms.push({ token, label, labelled: labelAll || (label.length <= 48 && labelable.test(label)) });
    return token;
  });
  // The plugin only sends labels for the subset above; unlabelled placeholders still exist.
  return { text, terms, labels: terms.filter(term => term.labelled).map(({token, label}) => ({ token, label })) };
}

export function restore(text, terms) {
  let output = text;
  for (const { token, label } of terms) output = output.replaceAll(token, label);
  return output;
}

export function tokenReport(text, terms) {
  const counts = new Map();
  for (const token of text.match(/⟦T\d+⟧/g) || []) counts.set(token, (counts.get(token) || 0) + 1);
  const missing = [], duplicated = [], unknown = [];
  for (const { token } of terms) {
    const n = counts.get(token) || 0;
    if (n === 0) missing.push(token);
    else if (n > 1) duplicated.push(token);
  }
  const known = new Set(terms.map(term => term.token));
  for (const token of counts.keys()) if (!known.has(token)) unknown.push(token);
  return { ok: !missing.length && !duplicated.length && !unknown.length, missing, duplicated, unknown };
}

export function normalize(text) {
  return text
    .replace(/⟦T\d+⟧/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`|:~—–\-]/g, " ")
    .replace(/[（(][^（）()\n]{0,40}[）)]/g, (whole) => (/[A-Za-z]/.test(whole) ? "" : whole))
    .replace(/\s+/g, "")
    .trim();
}

function bigrams(text) {
  const set = new Set();
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
  return set;
}

// Sorensen-Dice over distinct character bigrams: 1 means the same wording, 0 means nothing shared.
// Rewriting that keeps meaning but changes words scores low by design; use fact checks for meaning.
export function similarity(a, b) {
  const left = bigrams(a), right = bigrams(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const pair of left) if (right.has(pair)) shared++;
  return (2 * shared) / (left.size + right.size);
}

// Numbers that carry meaning. URLs, file paths, hashes and version/enum names are
// checked by the fact list instead, so they are stripped here to keep the signal clean.
export function numbersIn(text) {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/[A-Za-z_][\w.-]*\d[\w.-]*/g, " ")
    .replace(/[\w.-]*\/[\w./-]+/g, " ");
  return (cleaned.match(/(?<![\w.])\d+(?:[.,]\d+)*(?:\s*%)?/g) || [])
    .map(value => value.replace(/\s/g, ""));
}

export function deterministicChecks(item, output, terms) {
  const source = restore(item.body, terms);
  const translated = restore(output, terms);
  const sourceNumbers = new Set(numbersIn(source));
  const keptNumbers = new Set(numbersIn(translated));
  const numbersMissing = [...sourceNumbers].filter(value => !keptNumbers.has(value));
  const prose = translated.replace(/`[^`\n]*`|（[^（）\n]*）|\([^()\n]*\)/gu, "");
  const jargon = item.meta.jargon || [];
  const jargonLeft = jargon.filter(entry => entry.term.split(" / ").some(form => prose.includes(form))).map(entry => entry.term);
  const sourceProse = normalize(source);
  const outputProse = normalize(translated);
  // Translating English into Chinese has no shared wording to measure; leave the ratio out.
  const comparable = item.meta.lang !== "en";
  return {
    tokens: tokenReport(output, terms),
    lengthRatio: Number((outputProse.length / Math.max(1, sourceProse.length)).toFixed(2)),
    similarity: comparable ? Number(similarity(sourceProse, outputProse).toFixed(3)) : null,
    numbersMissing,
    jargonLeft,
    tableRows: { source: countTableRows(source), output: countTableRows(translated) }
  };
}

function countTableRows(text) {
  return text.split("\n").filter(line => line.trim().startsWith("|")).length;
}

const verdicts = new Set(["kept", "partial", "missing", "contradicted"]);

export function judgeMessages(item, output, terms) {
  const source = restore(item.body, terms);
  const translated = restore(output, terms);
  const system = [
    "你是给翻译结果打分的评审。给你一段原始汇报（source）和一段改写后的译文（translated），物品是 facts（必须保留的事实）、traps（改写时常见的错误）、jargon（需要被讲明白的行话）。",
    "对每个 fact 判断译文单独读起来是否包含它：kept＝完整并且正确；partial＝提了但丢了关键限定、数字或说反了程度（例如把「冻结扩大」说成「缩小流量」）；missing＝没有；contradicted＝与原文相反或把示例内容写成了事实。措辞不同但意思相同算 kept。",
    "对每个 trap 判断译文是否犯了：violated 为 true 表示犯了，note 写译文里对应的原话片段。",
    "jargon 里列出译文仍然直接使用、没有解释的词；explained 里列出译文用大白话解释过的词。",
    "只按 source 判断，不要用你自己的领域知识补充。译文里的数字、实体和因果关系要与 source 一致才算 kept。",
    "只输出 JSON，不要代码围栏。格式：{\"facts\":[{\"id\":\"f1\",\"verdict\":\"kept|partial|missing|contradicted\",\"note\":\"\"}],\"traps\":[{\"id\":\"t1\",\"violated\":false,\"note\":\"\"}],\"jargonLeft\":[\"词\"],\"explained\":[\"词\"],\"grade\":1到5的整数,\"summary\":\"一句话评价\"}"
  ].join("\n");
  const user = JSON.stringify({
    source,
    translated,
    facts: item.meta.facts,
    traps: item.meta.traps,
    jargon: (item.meta.jargon || []).map(entry => entry.term)
  });
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

function parseGrade(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d)(?:\s*\/\s*\d+)?$/u.exec(text) || /(\d)\s*分/u.exec(text);
  const grade = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(grade) || grade < 1 || grade > 5) throw Error("评审没有给出 1–5 的分数: " + text.slice(0, 40));
  return grade;
}

export function parseJudge(raw) {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*|```\s*$/g, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw Error("评审没有返回 JSON");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed.facts) || !Array.isArray(parsed.traps)) throw Error("评审 JSON 缺字段");
  for (const fact of parsed.facts) {
    if (!verdicts.has(fact.verdict)) throw Error("未知 verdict: " + fact.verdict);
  }
  return {
    facts: parsed.facts,
    traps: parsed.traps.map(trap => ({ ...trap, violated: Boolean(trap.violated) })),
    jargonLeft: Array.isArray(parsed.jargonLeft) ? parsed.jargonLeft : [],
    explained: Array.isArray(parsed.explained) ? parsed.explained : [],
    grade: parseGrade(parsed.grade),
    summary: String(parsed.summary || "")
  };
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

export async function askModel(model, messages, { retries = 2, temperature = 0 } = {}) {
  const key = apiKey();
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ model, messages, stream: false, temperature, enable_thinking: false })
      });
      if (!response.ok) throw Error("HTTP " + response.status + " " + (await response.text()).slice(0, 200));
      const body = await response.json();
      const choice = body.choices?.[0];
      if (choice?.finish_reason === "length") throw Error("输出被截断");
      const content = choice?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw Error("空回复");
      return content.trim();
    } catch (error) {
      last = error;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw last;
}

export function score(judge, checks) {
  const facts = judge.facts;
  const kept = facts.filter(fact => fact.verdict === "kept").length;
  const contradicted = facts.filter(fact => fact.verdict === "contradicted").length;
  const traps = judge.traps.filter(trap => trap.violated).length;
  return {
    factKept: facts.length ? Number((kept / facts.length).toFixed(2)) : null,
    contradicted,
    trapsViolated: traps,
    grade: judge.grade,
    tokensOk: checks.tokens.ok,
    similarity: checks.similarity
  };
}

export function worst(report) {
  const ranked = report.filter(row => row.judge);
  ranked.sort((a, b) => (a.score.contradicted * 3 + a.score.trapsViolated * 2 + (1 - a.score.factKept)) -
    (b.score.contradicted * 3 + b.score.trapsViolated * 2 + (1 - b.score.factKept)));
  return ranked;
}
