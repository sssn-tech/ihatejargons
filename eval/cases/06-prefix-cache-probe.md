<!--
{
  "id": "prefix-cache-probe",
  "title": "缓存命中实测进度（commentary）",
  "origin": "local",
  "source": "本机 ~/.codex/sessions 真实回复（gpt-6.2-astra）；commentary（执行摘要）",
  "kind": "summary",
  "question": "实测一下 KV cache 命中情况",
  "patterns": [
    "P5",
    "P6",
    "P9"
  ],
  "facts": [
    {
      "id": "f1",
      "text": "三次真实请求都返回 HTTP 200"
    },
    {
      "id": "f2",
      "text": "第二次请求完整保留了前一次的消息开头，但服务端报告命中 0",
      "critical": true
    },
    {
      "id": "f3",
      "text": "第三次请求命中了 1,792 个输入 token",
      "critical": true
    },
    {
      "id": "f4",
      "text": "模型返回了 PLAN_OK"
    },
    {
      "id": "f5",
      "text": "这说明「客户端保住了开头」和「服务端实际用上缓存」是两回事"
    }
  ],
  "traps": [
    {
      "id": "t1",
      "text": "说第二次请求命中了缓存"
    }
  ],
  "jargon": [
    {
      "term": "前缀",
      "plain": "请求开头相同的部分"
    },
    {
      "term": "命中",
      "plain": "用上了缓存"
    },
    {
      "term": "PLAN_OK",
      "plain": "测试用的固定回复，表示模型看到了计划"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "q": "保留了开头就一定能用上缓存吗？",
      "a": "不一定，第二次保留了开头但服务端命中为 0"
    }
  ]
}
-->

三次真实请求均返回 HTTP 200。计划更新后的第二次请求完整保留了前一次的消息前缀，服务端报告命中 0；长工具输出触发提醒后的第三次请求命中 1,792 个输入 token，模型返回了 `PLAN_OK`。这组数据把“客户端保住了前缀”和“服务端实际命中”区分开了。
