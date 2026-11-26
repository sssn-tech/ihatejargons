// Side-by-side page for a human to accept or reject a prompt change.
//   node eval/review.mjs eval/results/<old>.json eval/results/<new>.json
// Writes eval/results/review-<stamp>.html: for each case, the original reply, then the old and
// new rewrite of every level next to each other, with hard jargon highlighted and the judge's
// findings listed under each rewrite.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCases, words, readRate, mistakes } from "./lib.mjs";

const require = createRequire(import.meta.url);
const MarkdownIt = require("../src/vendor/markdown-it.cjs");
const markdown = new MarkdownIt({ html: false, linkify: false });
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [oldFile, newFile] = process.argv.slice(2);
if (!oldFile || !newFile) throw Error("用法：node eval/review.mjs <旧.json> <新.json>");
const [before, after] = await Promise.all([oldFile, newFile].map(async file => JSON.parse(await readFile(file, "utf8"))));
const cases = await loadCases();

const escape = text => String(text).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hard = [...words.hard].sort((a, b) => b.length - a.length).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const jargonPattern = new RegExp("(" + hard.join("|") + ")", "gi");
// Highlight inside text nodes only, so tags and attributes are never touched.
const highlight = html => html.replace(/>([^<]+)</g, (whole, text) => ">" + text.replace(jargonPattern, "<mark>$1</mark>") + "<");
const render = text => highlight(markdown.render(text || ""));

function findings(item, row) {
  if (!row) return '<p class="muted">没有这一档的结果</p>';
  if (row.error) return `<p class="bad">翻译失败：${escape(row.error)}</p>`;
  const notes = [];
  if (row.clarity) notes.push(`<li>比原文好懂：<b>${{ win: "胜", tie: "平", loss: "负" }[row.clarity.result]}</b></li>`);
  if (row.accuracy) {
    notes.push(`<li>读得对 ${Math.round(readRate(row.accuracy) * 100)}%，说错 ${mistakes(row.accuracy)}</li>`);
    item.meta.checks.forEach((check, index) => {
      const verdict = row.accuracy.checks[index];
      if (verdict !== "yes") notes.push(`<li class="${verdict === "partial" ? "warn" : "bad"}">${{ partial: "答对一半", no: "答不出", wrong: "答错" }[verdict]}：${escape(check.q)}</li>`);
    });
    item.meta.traps.forEach((trap, index) => { if (row.accuracy.traps[index]) notes.push(`<li class="bad">踩陷阱：${escape(trap)}</li>`); });
    for (const claim of row.accuracy.added) notes.push(`<li class="bad">多写了：「${escape(claim.quote)}」${claim.why ? "（" + escape(claim.why) + "）" : ""}</li>`);
  }
  if (Number.isFinite(row.ms)) notes.push(`<li class="muted">${(row.ms / 1000).toFixed(1)} 秒</li>`);
  return `<ul class="notes">${notes.join("")}</ul>`;
}

const modes = [...new Set([...before.rows, ...after.rows].map(row => row.mode))];
const names = { light: "简明改写", deep: "讲给外行" };
const sections = cases.map((item, index) => {
  const pick = (run, mode) => run.rows.find(row => row.id === item.meta.id && row.mode === mode);
  const levels = modes.map(mode => `
    <h3>${names[mode] || mode}</h3>
    <div class="pair">
      <div class="col"><div class="label">旧</div><div class="text">${render(pick(before, mode)?.output)}</div>${findings(item, pick(before, mode))}</div>
      <div class="col"><div class="label">新</div><div class="text">${render(pick(after, mode)?.output)}</div>${findings(item, pick(after, mode))}</div>
    </div>`).join("");
  const checks = item.meta.checks.map(check => `<li>${escape(check.q)}<span class="muted"> → ${escape(check.a)}</span></li>`).join("");
  return `<section id="${escape(item.meta.id)}">
    <h2>${index + 1}. ${escape(item.meta.id)}${item.meta.type === "keep" ? ' <span class="tag">对照组</span>' : ""}</h2>
    <p class="muted">用户问：${escape(item.meta.question)}</p>
    <details open><summary>Codex 原文</summary><div class="text source">${render(item.body)}</div></details>
    <details><summary>读完应该能答对</summary><ul>${checks}</ul></details>
    ${levels}
  </section>`;
}).join("\n");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>提示词验收</title>
<style>
body{font:15px/1.65 -apple-system,"PingFang SC",sans-serif;max-width:1180px;margin:0 auto;padding:24px;color:#1d1d1f}
h1{font-size:22px}h2{font-size:18px;margin-top:40px;border-top:1px solid #ddd;padding-top:20px}h3{font-size:15px;margin:18px 0 6px}
.muted{color:#777}.tag{font-size:12px;background:#eef;border-radius:4px;padding:1px 6px;color:#446}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.col{border:1px solid #e3e3e3;border-radius:8px;padding:10px 14px;min-width:0}
.label{font-size:12px;font-weight:600;color:#888}
.text{overflow-wrap:anywhere}.text table{border-collapse:collapse;font-size:13px}.text td,.text th{border:1px solid #ddd;padding:3px 6px}
.source{background:#fafafa;border-radius:8px;padding:6px 14px}
mark{background:#ffe08a;border-radius:3px;padding:0 1px}
.notes{font-size:13px;margin:8px 0 0;padding-left:18px}.bad{color:#b3261e}.warn{color:#8a5a00}
pre,code{font-size:13px;white-space:pre-wrap}
</style>
<h1>提示词验收：旧 ${escape(basename(oldFile))} 对 新 ${escape(basename(newFile))}</h1>
<p class="muted">黄色标出的是 words.json 里的硬黑话。每段改写下方是评审的发现：没列出的问题，评审认为没有。</p>
${sections}
</html>`;
const out = join(root, `eval/results/review-${stamp}.html`);
await writeFile(out, html);
console.log(out);
