import { readRate, mistakes } from "./lib.mjs";

const pct = value => (value === null || Number.isNaN(value) ? "—" : Math.round(value * 100) + "%");
const mean = list => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : NaN);

function table(header, body) {
  return ["| " + header.join(" | ") + " |", "|" + header.map(() => "---").join("|") + "|",
    ...body.map(line => "| " + line.join(" | ") + " |")].join("\n");
}

function tally(results) {
  const count = name => results.filter(value => value === name).length;
  return `${count("win")} 胜 / ${count("tie")} 平 / ${count("loss")} 负`;
}

// Headline: is it easier to read (fix cases), is it still right (all cases), and did the
// controls survive untouched (keep cases).
export function renderRun(run, cases) {
  const lines = [`# 评测结果 ${run.stamp}`, "",
    `被测：\`${run.pluginModel}\`；评审：\`${run.judgeModel}\`；用例 ${cases.length} 条` +
      `（需要改 ${cases.filter(item => item.meta.type === "fix").length}，对照 ${cases.filter(item => item.meta.type === "keep").length}）`, "",
    "## 总览", ""];
  const header = ["等级", "比原文好懂", "读得对", "说错", "黑话残留", "新增黑话", "对照组读得对", "对照组说错", "对照组改动"];
  const body = run.modes.map(mode => {
    const fix = run.rows.filter(row => row.mode === mode && row.type === "fix" && !row.error);
    const keep = run.rows.filter(row => row.mode === mode && row.type === "keep" && !row.error);
    const judged = list => list.filter(row => row.accuracy);
    return [mode,
      tally(fix.filter(row => row.clarity).map(row => row.clarity.result)),
      pct(mean(judged(fix).map(row => readRate(row.accuracy)))),
      String(judged(fix).reduce((sum, row) => sum + mistakes(row.accuracy), 0)),
      String(fix.reduce((sum, row) => sum + row.jargon.kept.length, 0)) + " / " +
        String(fix.reduce((sum, row) => sum + row.jargon.source.length, 0)),
      String([...fix, ...keep].reduce((sum, row) => sum + row.jargon.added.length, 0)),
      pct(mean(judged(keep).map(row => readRate(row.accuracy)))),
      String(judged(keep).reduce((sum, row) => sum + mistakes(row.accuracy), 0)),
      keep.length ? mean(keep.filter(row => row.similarity !== null).map(row => row.similarity)).toFixed(2) : "—"];
  });
  lines.push(table(header, body), "");
  lines.push("- **比原文好懂**：评审把原文和译文前后对调各比一次，两次都选译文才算胜。英文原文的用例，译成中文天然占优。");
  lines.push("- **读得对**：只读译文，能答对每条用例里 2–4 个关键问题的比例（部分答对算一半）。");
  lines.push("- **说错**：答出错误结论、踩中已知陷阱、或写了原文没有的内容，三者合计的次数。");
  lines.push("- **黑话残留**：原文里的硬黑话（`words.json` 的 hard 表），译文还留着几个 / 原文共几个。");
  lines.push("- **对照组改动**：对照组原文本来就清楚，1.00 表示一字未改；越低改得越多。", "");

  const failed = run.rows.filter(row => row.error || row.judgeError);
  if (failed.length) {
    lines.push("## 没有跑完的", "");
    for (const row of failed) lines.push(`- ${row.id} / ${row.mode}：${row.error || row.judgeError}`);
    lines.push("");
  }

  lines.push("## 逐条", "");
  const caseById = new Map(cases.map(item => [item.meta.id, item]));
  lines.push(table(["用例", "等级", "好懂", "读得对", "说错", "残留 / 新增黑话", "改动"], run.rows.map(row => [
    row.id + (row.type === "keep" ? "（对照）" : ""), row.mode,
    row.clarity ? { win: "胜", tie: "平", loss: "负" }[row.clarity.result] : "—",
    row.accuracy ? pct(readRate(row.accuracy)) : "—",
    row.accuracy ? String(mistakes(row.accuracy)) : "—",
    row.jargon ? (row.jargon.kept.join("、") || "无") + " / " + (row.jargon.added.join("、") || "无") : "—",
    row.similarity === null || row.similarity === undefined ? "—" : row.similarity.toFixed(2)])));
  lines.push("", "## 译文全文", "");
  for (const row of run.rows) {
    const item = caseById.get(row.id);
    lines.push(`### ${row.id} / ${row.mode}`, "");
    if (row.accuracy) {
      item.meta.checks.forEach((check, index) => {
        const verdict = row.accuracy.checks[index];
        if (verdict !== "yes") lines.push(`- ${{ partial: "答对一半", no: "答不出", wrong: "答错" }[verdict]}：${check.q}`);
      });
      item.meta.traps.forEach((trap, index) => { if (row.accuracy.traps[index]) lines.push(`- 踩陷阱：${trap}`); });
      for (const claim of row.accuracy.added) lines.push(`- 多写了：「${claim.quote}」${claim.why ? "（" + claim.why + "）" : ""}`);
    }
    if (row.clarity) lines.push(`- 好懂评审：${row.clarity.reasons.join(" ／ ")}`);
    lines.push("", "```text", row.output || row.error || "（无输出）", "```", "");
  }
  return lines.join("\n");
}

export function renderCompare(compare) {
  const lines = [`# 对比 ${compare.stamp}`, "",
    `A：\`${compare.a}\`；B：\`${compare.b}\`；评审：\`${compare.judgeModel}\``, "",
    "两份译文前后对调各比一次，两次都选 B 才算 B 胜。", ""];
  for (const mode of compare.modes) {
    const rows = compare.rows.filter(row => row.mode === mode && row.result);
    lines.push(`- **${mode}**：B 对 A ${tally(rows.map(row => row.result))}`);
  }
  lines.push("", table(["用例", "等级", "B 对 A", "理由"], compare.rows.map(row => [row.id, row.mode,
    row.result ? { win: "B 胜", tie: "平", loss: "A 胜" }[row.result] : "失败：" + row.error,
    (row.reasons || []).join(" ／ ").replaceAll("|", "\\|")])));
  return lines.join("\n");
}
