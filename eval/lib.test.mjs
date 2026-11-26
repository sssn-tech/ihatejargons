import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCase, loadCases, snapshot, restore, tokensOk, jargonIn, jargonDelta, similarity,
  parseAccuracy, parseClarity, settle, readRate, mistakes, words
} from "./lib.mjs";

const header = meta => "<!--\n" + JSON.stringify({ id: "x", type: "fix", kind: "report", question: "q", source: "s",
  checks: [{ q: "a?", a: "b" }], ...meta }) + "\n-->\n\n";

test("a case keeps its body verbatim and defaults traps to an empty list", () => {
  const item = parseCase("x.md", header({}) + "正文 `x`\n");
  assert.equal(item.body, "正文 `x`");
  assert.deepEqual(item.meta.traps, []);
});

test("a case needs a type, 1–4 checks and string traps", () => {
  assert.throws(() => parseCase("x.md", header({ type: "maybe" }) + "正文"), /type/);
  assert.throws(() => parseCase("x.md", header({ checks: [] }) + "正文"), /checks/);
  assert.throws(() => parseCase("x.md", header({ traps: [{ id: "t1" }] }) + "正文"), /traps/);
});

test("every shipped case loads", async () => {
  const cases = await loadCases();
  assert.ok(cases.length >= 20);
  assert.ok(cases.some(item => item.meta.type === "keep"));
});

test("snapshot labels only snake_case values and ranges, and restore puts every label back", () => {
  const { text, terms, labels } = snapshot("状态 `PROMOTION_BLOCKED`，范围 `1% → 10%`，节点 `AWS-Tokyo`，人话 `依赖三态`");
  // Chinese labels stay in the text for the model to rewrite, as in src/content.js.
  assert.equal(text, "状态 ⟦T0⟧，范围 ⟦T1⟧，节点 ⟦T2⟧，人话 `依赖三态`");
  assert.deepEqual(labels.map(item => item.label), ["PROMOTION_BLOCKED", "1% → 10%"]);
  assert.equal(restore(text, terms), "状态 PROMOTION_BLOCKED，范围 1% → 10%，节点 AWS-Tokyo，人话 `依赖三态`");
  assert.equal(tokensOk("⟦T2⟧ ⟦T0⟧ ⟦T1⟧", terms), true);
  assert.equal(tokensOk("⟦T0⟧ ⟦T0⟧ ⟦T1⟧", terms), false);
});

test("jargon is matched longest first, and the delta separates kept from introduced words", () => {
  assert.deepEqual([...jargonIn("稳稳兜住之后收口", ["兜住", "稳稳", "收口"])].sort(), ["兜住", "收口", "稳稳"]);
  assert.deepEqual([...jargonIn("砍一刀", ["一刀", "砍一刀"])], ["砍一刀"]);
  const delta = jargonDelta("根因坐实，落盘之后就能收口了。", "原因确认了，第一刀算是落地了，之后收口。");
  assert.deepEqual(delta.source.sort(), ["坐实", "收口"].sort());
  assert.deepEqual(delta.kept, ["收口"]);
  assert.deepEqual(delta.added.sort(), ["一刀", "落地"].sort());
  assert.ok(!words.hard.includes("根因"), "根因 is legitimate in postmortems and stays on the soft list");
});

test("similarity is 1 for unchanged text and ignores placeholders and markup", () => {
  assert.equal(similarity("把代码落下去", "**把代码落下去**"), 1);
  assert.ok(similarity("把代码落下去", "数据库连接池被打满了") < 0.2);
});

test("the accuracy verdict must match the case, and is scored by reads and mistakes", () => {
  const item = { meta: { checks: [{ q: "1" }, { q: "2" }], traps: ["t"] } };
  const accuracy = parseAccuracy('```json\n{"checks":["yes","partial"],"traps":[true],"added":[{"quote":"已上线","why":"原文只说计划"},{"quote":"不存在的句子"}]}\n```', item, "改完了，已上线。");
  assert.deepEqual(accuracy.added.map(entry => entry.quote), ["已上线"], "a quote that is not in the translation is dropped");
  assert.equal(readRate(accuracy), 0.75);
  assert.equal(mistakes(accuracy), 2);
  assert.throws(() => parseAccuracy('{"checks":["yes"],"traps":[false]}', item), /checks/);
  assert.throws(() => parseAccuracy('{"checks":["yes","fine"],"traps":[false]}', item), /checks/);
});

test("a clarity win must survive swapping the order", () => {
  assert.equal(parseClarity('{"winner":"B","reason":"r"}').winner, "B");
  assert.throws(() => parseClarity('{"winner":"both"}'), /A \/ B/);
  // baseline first then candidate first: candidate is B, then A
  assert.equal(settle({ winner: "B" }, { winner: "A" }), "win");
  assert.equal(settle({ winner: "A" }, { winner: "B" }), "loss");
  assert.equal(settle({ winner: "B" }, { winner: "B" }), "tie");
  assert.equal(settle({ winner: "same" }, { winner: "A" }), "tie");
});
