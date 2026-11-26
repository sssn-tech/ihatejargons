<!--
{
  "id": "keep-postmortem",
  "type": "keep",
  "kind": "report",
  "question": "3 月 20 日的事故复盘结论是什么？",
  "source": "shuorenhua 评测集（MIT，© 2026 MrGeDiao） SNF-15「长段技术复盘中的工程术语」",
  "url": "https://github.com/MrGeDiao/shuorenhua/blob/main/evals/benchmark.md",
  "checks": [
    {
      "q": "原因是什么？",
      "a": "连接池配置太小，max_connections=20 在高峰流量下被占满。"
    },
    {
      "q": "做了哪些修复？",
      "a": "上限调到 100，给 users 表补复合索引，把慢查询指标接进告警。"
    },
    {
      "q": "效果如何？",
      "a": "上线后观察 6 小时，错误率从 3.2% 降到 0.4%，没再出现连接超时。"
    }
  ],
  "traps": [
    "改动任何数字"
  ]
}
-->

在 2026-03-20 的事故复盘里，我们确认 root cause 是连接池配置过小：`max_connections=20` 在峰值流量下被打满。修复动作包括把上限调到 100、给 `users` 表补复合索引、把慢查询指标接进告警。上线后观察 6 小时，错误率从 3.2% 降到 0.4%，没有再出现连接超时。
