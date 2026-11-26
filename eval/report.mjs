// Renders the markdown report. Kept separate from run.mjs so a stored result can be
// re-scored and re-rendered without paying for the model calls again.
import { worst } from "./lib.mjs";

const pct = value => (value === null || value === undefined ? "—" : Math.round(value * 100) + "%");
const mean = (list, pick) => list.reduce((sum, row) => sum + (pick(row) ?? 0), 0) / Math.max(1, list.length);

function table(header, body) {
  return ["| " + header.join(" | ") + " |", "|" + header.map(() => "---").join("|") + "|",
    ...body.map(line => "| " + line.join(" | ") + " |")].join("\n");
}

const similarityText = row => (row.checks.similarity === null ? "—（原文为英文）" : row.checks.similarity.toFixed(2));

export function renderReport({ stamp, modes, pluginModel, judgeModel, secondModel, cases, rows }) {
  const lines = [];
  const judged = rows.filter(row => row.score);
  lines.push(`# 评测结果 ${stamp}`);
  lines.push("");
  lines.push(`- 被测：\`${pluginModel}\`（插件默认模型），等级 ${modes.map(mode => "`" + mode + "`").join("、")}`);
  lines.push(`- 评审：\`${judgeModel}\`${secondModel ? "，第二评审 `" + secondModel + "`" : ""}`);
  lines.push(`- 用例：${cases} 条，事实和陷阱为手写标注（cases/*.md）`);
  lines.push("");
  lines.push("## 总览");
  lines.push("");
  for (const mode of modes) {
    const group = judged.filter(row => row.mode === mode);
    if (!group.length) continue;
    const comparable = group.filter(row => row.checks.similarity !== null);
    lines.push(`- **${mode}**：事实保留 ${pct(mean(group, row => row.score.factKept))}，与原文相悖 ` +
      `${group.reduce((n, row) => n + row.score.contradicted, 0)} 处，踩陷阱 ${group.reduce((n, row) => n + row.score.trapsViolated, 0)} 处，` +
      `平均分 ${mean(group, row => row.score.grade).toFixed(1)}，与原文字面相似度 ${comparable.length ? mean(comparable, row => row.checks.similarity).toFixed(2) : "—"}，` +
      `篇幅 ${mean(group, row => row.checks.lengthRatio).toFixed(2)}×，标记出错 ${group.filter(row => !row.score.tokensOk).length} 条，` +
      `仍留行话 ${group.reduce((n, row) => n + row.checks.jargonLeft.length, 0)} 个`);
  }
  lines.push("");
  lines.push("## 逐条结果");
  lines.push("");
  lines.push(table(
    ["用例", "等级", "模式", "事实保留", "相悖", "陷阱", "分", "字面相似度", "篇幅", "标记", "仍留行话"],
    judged.map(row => [row.id, row.kind, row.mode, pct(row.score.factKept), String(row.score.contradicted),
      String(row.score.trapsViolated), String(row.score.grade), similarityText(row),
      row.checks.lengthRatio.toFixed(2), row.score.tokensOk ? "OK" : "×", String(row.checks.jargonLeft.length)])
  ));
  const failed = rows.filter(row => row.error || row.judgeError);
  if (failed.length) {
    lines.push("");
    lines.push("## 没有跑成的");
    lines.push("");
    for (const row of failed) lines.push(`- ${row.id} / ${row.mode}：${row.error || row.judgeError}`);
  }
  const bad = worst(judged).filter(row => row.score.contradicted || row.score.trapsViolated ||
    row.score.factKept < 0.8 || !row.score.tokensOk).slice(0, 12);
  if (bad.length) {
    lines.push("");
    lines.push("## 最该修的几条");
    lines.push("");
    for (const row of bad) {
      const problems = [];
      for (const fact of row.judge.facts.filter(item => item.verdict === "contradicted")) problems.push(`相悖 ${fact.id}`);
      for (const fact of row.judge.facts.filter(item => item.verdict === "missing")) problems.push(`漏掉 ${fact.id}`);
      for (const trap of row.judge.traps.filter(item => item.violated)) problems.push(`踩陷阱 ${trap.id}`);
      if (!row.score.tokensOk) problems.push("标记缺失或重复");
      if (row.checks.numbersMissing.length) problems.push("丢数字 " + row.checks.numbersMissing.join("/"));
      lines.push(`- **${row.id} / ${row.mode}**：${problems.join("，")}。评审：${row.judge.summary}`);
    }
  }
  const ids = [...new Set(judged.flatMap(row => row.patterns))].sort();
  if (ids.length) {
    lines.push("");
    lines.push("## 按黑话模式汇总");
    lines.push("");
    lines.push(table(["模式", "条数", "事实保留", "陷阱", "字面相似度"], ids.map(pattern => {
      const group = judged.filter(row => row.patterns.includes(pattern));
      const comparable = group.filter(row => row.checks.similarity !== null);
      return [pattern, String(group.length), pct(mean(group, row => row.score.factKept)),
        String(group.reduce((n, row) => n + row.score.trapsViolated, 0)),
        comparable.length ? mean(comparable, row => row.checks.similarity).toFixed(2) : "—"];
    })));
    lines.push("");
    lines.push("模式含义见 [PATTERNS.md](PATTERNS.md)。");
  }
  lines.push("");
  lines.push("## 译文全文");
  lines.push("");
  for (const row of rows) {
    lines.push(`### ${row.id} / ${row.mode}${row.score ? " · 分 " + row.score.grade : ""}`);
    lines.push("");
    lines.push(`> ${row.title}（${row.origin === "local" ? "本机真实回复" : "网上素材改写"}）`);
    lines.push("");
    if (row.checks) {
      const bits = [`字面相似度 ${similarityText(row)}`, `篇幅 ${row.checks.lengthRatio}×`];
      if (row.checks.numbersMissing.length) bits.push(`丢数字 ${row.checks.numbersMissing.join("、")}`);
      if (row.checks.jargonLeft.length) bits.push(`仍留行话 ${row.checks.jargonLeft.join("、")}`);
      if (!row.checks.tokens.ok) bits.push("标记异常");
      lines.push(bits.join(" · "));
      lines.push("");
    }
    if (row.judge) {
      const line = verdict => row.judge.facts.filter(fact => fact.verdict === verdict).map(fact => fact.id);
      for (const [label, verdict] of [["漏掉", "missing"], ["不完整", "partial"], ["相悖", "contradicted"]]) {
        const list = line(verdict);
        if (list.length) lines.push(`${label}：${list.join(" ")}`);
      }
      for (const fact of row.judge.facts.filter(item => item.verdict !== "kept" && item.note)) {
        lines.push(`- ${fact.id}：${fact.note}`);
      }
      const traps = row.judge.traps.filter(trap => trap.violated);
      if (traps.length) {
        lines.push(`踩陷阱：${traps.map(trap => trap.id).join(" ")}`);
        for (const trap of traps) if (trap.note) lines.push(`- ${trap.id}：${trap.note}`);
      }
      lines.push("");
    }
    lines.push("```text");
    lines.push(row.output || row.error || "（无输出）");
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}
