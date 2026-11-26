<!--
{
  "id": "release-wording",
  "type": "fix",
  "kind": "report",
  "question": "v2.3.1 能发布吗？",
  "source": "shuorenhua 评测集（MIT，© 2026 MrGeDiao） SF-62，原文是该项目 v2.3.1 README 里的发布说明",
  "url": "https://github.com/MrGeDiao/shuorenhua/blob/main/evals/benchmark.md",
  "checks": [
    {
      "q": "这一版达到发布标准了吗？",
      "a": "达到了，按只用 Opus 一个正式评审的标准：硬约束失败 0、误改 0/50、应改通过 57/61。"
    },
    {
      "q": "DeepSeek V4 Pro 为什么不再做正式评审？",
      "a": "它的真实测试和同条件复跑之间结果有波动。"
    },
    {
      "q": "Grok 4.6 的结果怎么算？",
      "a": "改写和硬性判定都没问题，但评分只完成了 7 批中的 1 批，只作为辅助证据；第二个正式评审的补跑留到以后版本。"
    },
    {
      "q": "还缺什么？",
      "a": "人工样本还缺 docs 和 status 两类，所以检查脚本预计以 1 退出；照常发布，继续收集。"
    }
  ],
  "traps": [
    "说 Grok 4.6 已经是正式评审或已全部跑完",
    "说检查脚本全部通过"
  ]
}
-->

v2.3.1 以 **Opus 单席位**口径收口（维护者 2026-08-21 决定）：r4 全量 Opus 侧硬约束失败 0、SNF 误杀 0/50、SF 通过 57/61，达发布门槛。DeepSeek V4 Pro 撤出正式席位（B-74 真实 L1 + 同条件复跑存在 run-to-run 方差）；Grok 4.6 换席补跑的改写与硬判干净，判分仅闭环 1/7 批，记为辅助证据，第二正式席位补跑留给后续版本。HUMAN direct 样本仍缺 `docs` 和 `status`，`python3 automation/check_repo.py` 预期退出 1，随版如实发布、继续收集。
