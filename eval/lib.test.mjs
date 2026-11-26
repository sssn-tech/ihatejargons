import assert from "node:assert/strict";
import test from "node:test";
import { parseCase, snapshot, restore, tokenReport, deterministicChecks, parseJudge, score, similarity } from "./lib.mjs";

test("a case file yields its JSON header and verbatim body", () => {
  const item = parseCase("x.md", '<!--\n{"id":"x","title":"t","kind":"report","facts":[{"id":"f1","text":"a"}],"traps":[]}\n-->\n\n正文 `x`\n');
  assert.equal(item.meta.id, "x");
  assert.equal(item.body, "正文 `x`");
});

test("a case without traps or facts is rejected", () => {
  assert.throws(() => parseCase("x.md", '<!--\n{"id":"x","title":"t","kind":"report"}\n-->\n\n正文'), /缺少字段/);
});

test("snapshot turns inline code into placeholders and labels only field-like values", () => {
  const { text, terms, labels } = snapshot("状态 `PROMOTION_BLOCKED`，范围 `1% → 10%`，人话 `依赖三态`，节点 `AWS-Tokyo`");
  assert.equal(text, "状态 ⟦T0⟧，范围 ⟦T1⟧，人话 ⟦T2⟧，节点 ⟦T3⟧");
  // Snake-case enums and value ranges get a label; hyphenated names and Chinese prose labels do not.
  assert.deepEqual(labels.map(item => item.label), ["PROMOTION_BLOCKED", "1% → 10%"]);
  assert.equal(terms.length, 4);
  assert.equal(restore(text, terms), "状态 PROMOTION_BLOCKED，范围 1% → 10%，人话 依赖三态，节点 AWS-Tokyo");
  assert.deepEqual(snapshot("`AWS-Tokyo`", { labelAll: true }).labels.map(item => item.label), ["AWS-Tokyo"]);
});

test("tokenReport finds missing, repeated and invented placeholders", () => {
  const terms = [{ token: "⟦T0⟧" }, { token: "⟦T1⟧" }];
  assert.equal(tokenReport("⟦T0⟧ 和 ⟦T1⟧", terms).ok, true);
  assert.deepEqual(tokenReport("⟦T0⟧ 和 ⟦T0⟧", terms).duplicated, ["⟦T0⟧"]);
  assert.deepEqual(tokenReport("⟦T0⟧ ⟦T7⟧", terms).unknown, ["⟦T7⟧"]);
  assert.equal(tokenReport("什么都没有", terms).ok, false);
});

test("checks catch a dropped number, a left-in jargon word and a shrunken reply", () => {
  const item = { body: "延迟从 480ms 降到 160ms，验收矩阵通过，`AWS-Tokyo` 直连。", meta: { jargon: [{ term: "验收矩阵" }] } };
  const terms = [{ token: "⟦T0⟧", label: "AWS-Tokyo" }];
  const checks = deterministicChecks(item, "延迟降低了，⟦T0⟧ 直连。", terms);
  assert.deepEqual(checks.numbersMissing, ["480", "160"]);
  assert.equal(checks.jargonLeft.includes("验收矩阵"), false);
  const still = deterministicChecks(item, "验收矩阵通过，延迟从 480ms 降到 160ms。", terms);
  assert.deepEqual(still.jargonLeft, ["验收矩阵"]);
  assert.ok(still.similarity > 0.7);
});

test("judge JSON is parsed and a bad verdict is refused", () => {
  const good = parseJudge('```json\n{"facts":[{"id":"f1","verdict":"kept"}],"traps":[{"id":"t1","violated":false}],"grade":4}\n```');
  assert.equal(good.grade, 4);
  assert.throws(() => parseJudge('{"facts":[{"id":"f1","verdict":"fine"}],"traps":[]}'), /未知 verdict/);
});

test("score counts kept facts and violated traps", () => {
  const judge = { facts: [{ id: "f1", verdict: "kept" }, { id: "f2", verdict: "contradicted" }, { id: "f3", verdict: "missing" }],
    traps: [{ id: "t1", violated: true }, { id: "t2", violated: false }], grade: 2 };
  const result = score(judge, { tokens: { ok: true }, similarity: 0.9 });
  assert.equal(result.factKept, 0.33);
  assert.equal(result.contradicted, 1);
  assert.equal(result.trapsViolated, 1);
});

test("similarity is 1 for the same text and low for an unrelated one", () => {
  assert.equal(similarity("把代码落下去", "把代码落下去"), 1);
  assert.ok(similarity("把代码落下去", "数据库连接池被打满了") < 0.2);
});
