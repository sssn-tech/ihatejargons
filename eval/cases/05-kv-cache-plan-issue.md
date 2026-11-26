<!--
{
  "id": "kv-cache-plan-issue",
  "title": "/plan 与 KV cache 的 issue 草稿",
  "origin": "local",
  "source": "本机 ~/.codex/sessions 真实回复（gpt-6.2-astra）",
  "kind": "report",
  "question": "/plan 更新会不会影响 KV cache？帮我写个 issue",
  "patterns": [
    "P9",
    "P5"
  ],
  "facts": [
    {
      "id": "f1",
      "text": "/plan 命令只是查看计划；问题出在模型请求组装时",
      "critical": true
    },
    {
      "id": "f2",
      "text": "withPlanContext 把完整计划拼到第一条 system 消息末尾，后面才是历史对话"
    },
    {
      "id": "f3",
      "text": "即使只把一个 Todo 从进行中改成完成，system 消息也变了，而后面的历史没变"
    },
    {
      "id": "f4",
      "text": "按相同前缀复用缓存时，只能复用到计划里第一个变化的位置为止，后面的历史都要重新计算",
      "critical": true
    },
    {
      "id": "f5",
      "text": "会话越长、更新越频繁，重复计算越多，输入成本和首字延迟越高"
    },
    {
      "id": "f6",
      "text": "建议：system 消息只放固定规则，动态计划放到对话末尾",
      "critical": true
    },
    {
      "id": "f7",
      "text": "update_plan 的成功回包已含完整清单，可直接当最新快照"
    },
    {
      "id": "f8",
      "text": "可在距上次快照超过一定 token 距离时再追加一次提醒"
    }
  ],
  "traps": [
    {
      "id": "t1",
      "text": "说 /plan 命令本身导致缓存失效"
    },
    {
      "id": "t2",
      "text": "说缓存完全无法命中（原文说变化点之前仍可能命中）"
    }
  ],
  "jargon": [
    {
      "term": "KV cache",
      "plain": "模型对已处理过文字的计算结果缓存"
    },
    {
      "term": "system 消息",
      "plain": "放在对话最前面的固定指令"
    },
    {
      "term": "前缀",
      "plain": "两次请求开头完全相同的那一段"
    },
    {
      "term": "token",
      "plain": "模型处理文字的最小单位"
    },
    {
      "term": "首 token 延迟",
      "plain": "开始输出第一个字前的等待时间"
    },
    {
      "term": "快照",
      "plain": "某一时刻的完整状态"
    },
    {
      "term": "回包",
      "plain": "工具返回的结果"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "q": "问题会造成什么后果？",
      "a": "每次改计划后，后面的对话历史都要重新计算，更贵更慢，越长越明显"
    },
    {
      "id": "q2",
      "q": "建议怎么改？",
      "a": "固定规则留在开头，变化的计划放到对话末尾"
    }
  ]
}
-->

**标题：`/plan` 将动态计划写入 system 消息，更新 Todo 状态会缩短 KV cache 的可复用前缀**

### 问题描述

`/plan` 命令用于查看当前计划。影响缓存的环节发生在模型请求组装时：`withPlanContext` 会将完整的计划快照拼接到第一条 system 消息末尾，再把此前的用户消息、助手回复和工具结果放在其后。[相关代码](https://github.com/LiuMengxuan04/MiniCode/blob/e1e9389/src/plan/context.ts)

例如，会话已经积累了多轮文件读取和测试输出，此时 `update_plan` 仅将某个 Todo 从 `in_progress` 改为 `completed`。下一次请求中，这些历史消息的内容和顺序都没有变化，但它们前面的 system 消息已经不同。

对于按相同 token 前缀复用 KV cache 的服务，两次请求能共享的连续前缀到计划中首个变化的 token 为止。变化点之前的部分仍有机会命中，后面的对话历史则无法复用上一次请求对应的 KV。随着会话变长，频繁更新 Todo 进度可能带来越来越多的重复计算，增加输入成本和首 token 延迟。

### 建议

system 消息只保留固定的计划使用规则，将动态计划放到对话末尾。成功的 `update_plan` 回包已经包含完整清单，可直接作为最新快照。若担心长工具输出让计划离当前位置太远，可在距上次快照超过一定 token 距离时再追加一次提醒。这样既能保留此前的请求前缀，也能让模型在长任务中及时看到当前计划。
