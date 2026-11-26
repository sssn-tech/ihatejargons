<!--
{
  "id": "openteams-gaps",
  "title": "OpenTeams 两个缺口（源码分析）",
  "origin": "local",
  "source": "本机 ~/.codex/sessions 真实回复（gpt-6.2-astra）；长 final_answer 节选",
  "kind": "report",
  "question": "OpenTeams 的上下文管理有什么不足？",
  "patterns": [
    "P5",
    "P6",
    "P9",
    "P1"
  ],
  "facts": [
    {
      "id": "f1",
      "text": "缺口一：很难精确还原 Agent 当时读到的群聊历史",
      "critical": true
    },
    {
      "id": "f2",
      "text": "input.md 能还原交给 CLI 的提示词，但其中的群历史通常只是文件路径"
    },
    {
      "id": "f3",
      "text": "messages.jsonl 每轮执行前会重建，后台压缩后也可能改写；历史过长时优先保留最近消息"
    },
    {
      "id": "f4",
      "text": "因此事后无法证明 Codex 当时读到了哪版历史；这对排查「改过需求却用了旧要求」很关键"
    },
    {
      "id": "f5",
      "text": "缺口二：原始执行记录有保留期限和容量上限",
      "critical": true
    },
    {
      "id": "f6",
      "text": "成功运行的日志最多留最后 256 KiB，失败运行最多 1 MiB",
      "critical": true
    },
    {
      "id": "f7",
      "text": "工作流完成或失败超过 5 天后，会清理事件和部分过程记录，保留评审、错误、审批请求等",
      "critical": true
    },
    {
      "id": "f8",
      "text": "所以一周后能查到谁审过，但不一定能逐条还原所有中间动作"
    }
  ],
  "traps": [
    {
      "id": "t1",
      "text": "说所有记录都永久保存或可以完整还原"
    },
    {
      "id": "t2",
      "text": "把 256 KiB/1 MiB 的成功失败对应关系说反"
    }
  ],
  "jargon": [
    {
      "term": "CLI",
      "plain": "命令行程序"
    },
    {
      "term": "后台压缩",
      "plain": "自动把旧聊天缩写成摘要"
    },
    {
      "term": "口径",
      "plain": "要求/标准"
    },
    {
      "term": "run_id",
      "plain": "每次执行的编号"
    },
    {
      "term": "KiB/MiB",
      "plain": "文件大小单位"
    },
    {
      "term": "工作流",
      "plain": "预先编排好的多步任务"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "q": "事后能查清 Codex 当时看到的是哪版需求吗？",
      "a": "很难，历史文件会被重建或改写，提示词里只有路径"
    },
    {
      "id": "q2",
      "q": "日志能保留多久、多少？",
      "a": "成功最多 256 KiB、失败最多 1 MiB；工作流 5 天后清理大部分过程记录"
    }
  ]
}
-->

### 我认为它还有两个实质性的缺口

**第一，保存了本轮提示词，仍然很难精确还原 Agent 当时读到的共享历史。** `input.md` 能还原 OpenTeams 交给 CLI 的文本，但其中的群历史通常是文件路径。`messages.jsonl` 会在新一轮执行前重建，后台压缩完成后也可能改写同一路径；群历史过长时，主流程优先保留最近消息。由此推断，即使你事后找到了那一轮的 `input.md`，只凭提示词和今天的 `messages.jsonl`，也无法证明 Codex 当时读到了哪一版历史、哪几条旧需求。这对排查“用户明明改过需求，为什么执行者还用了旧口径”很关键。[上下文文件生成与后台改写](https://github.com/openteams-lab/openteams/blob/502740c0dfe930dfd58990170bf83f2d11af1258/crates/services/src/services/chat_runner/prompting.rs#L535-L635) · [超长历史截断](https://github.com/openteams-lab/openteams/blob/502740c0dfe930dfd58990170bf83f2d11af1258/crates/services/src/services/chat/context.rs#L35-L138)

**第二，能追到某次运行，但原始证据有保留期限和容量上限。** 普通聊天运行正常收尾时，成功运行的原始日志最多留最后 **256 KiB**，失败运行最多留 **1 MiB**。工作流还有清理逻辑：完成或失败超过 **5 天**后，符合条件的执行会清理事件和部分过程记录，保留评审、错误、审批请求等类别。于是“一周后还能查到谁审过”与“一周后还能逐条还原所有中间动作”，保障程度不同。[日志上限](https://github.com/openteams-lab/openteams/blob/502740c0dfe930dfd58990170bf83f2d11af1258/crates/services/src/services/chat_runner/dependencies.rs#L32-L40) · [工作流清理流程](https://github.com/openteams-lab/openteams/blob/502740c0dfe930dfd58990170bf83f2d11af1258/crates/services/src/services/workflow/runtime/runner.rs#L2026-L2077) · [保留的记录类别](https://github.com/openteams-lab/openteams/blob/502740c0dfe930dfd58990170bf83f2d11af1258/crates/db/src/models/workflow_transcript.rs#L430-L443)

**如果你准备在它的基础上做，我会优先补“每次交接的证据清单”。** 比如 Gemini 收到“请验收 CSV 导出”时，交接记录同时固定四样东西：用户确认字段的那条消息及版本、Codex 的实现 `run_id`、待审查的确切 diff、测试结果所在的日志条目。群里仍然只显示一句简明汇报，但你点开“为什么说已完成”，就能直接核对证据。对你平时只想和 Claude 或 Gemini 对话、又希望随时查清 Codex 做了什么的用法，这比把更多中间输出搬进群聊更有价值。
