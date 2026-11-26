<!--
{
  "id": "web-speech-reviewer-takeoff",
  "title": "“起飞”“滚下一轮”遮住了究竟收到几份结果",
  "origin": "web",
  "source_url": "https://linux.do/t/topic/1922404",
  "source_excerpt": "第7轮已经起飞了",
  "source": "发帖人用仿写提示词讽刺 Codex 语气，用多轮 reviewer 和 tracker 做例子。短摘来自帖子里的风格示例。",
  "adaptation": "以下AI 基础设施场景为评测改编。",
  "kind": "report",
  "question": "推理服务的新调度器过评审了吗？",
  "patterns": [
    "P1",
    "P6",
    "P8"
  ],
  "facts": [
    { "id": "f1", "text": "三份压测记录均已交给评审。", "critical": true },
    { "id": "f2", "text": "只收到一位确认能打开图表，该评审还没看数据；没有评审结论。", "critical": true },
    { "id": "f3", "text": "下一轮仅占位，需三份意见到齐才开始；线上仍用旧调度器。", "critical": true }
  ],
  "traps": [
    { "id": "t1", "text": "把 reviewing 或已读翻译成评审通过。" },
    { "id": "t2", "text": "把下一轮占位或分派任务翻译成线上已切换。" }
  ],
  "jargon": [
    { "term": "回包", "plain": "评审人员的回复" },
    { "term": "才滚", "plain": "届时才开始下一轮" }
  ],
  "questions": [
    { "id": "q1", "q": "有人审完了吗？线上跑的是哪个？", "a": "尚无人提交评审结论，线上仍是旧调度器。" }
  ]
}
-->

这轮我已经给它推起来了：新调度器的三份压测记录各挂一位 reviewer，任务板上三格都进了 reviewing。回包这头只落一格，对方写的是“图能打开，数据明早看”。所以我先把已读收了，结论还没得收。

下一轮在板上已经占位，等三份意见到齐才滚。老调度器还在接线上请求。
