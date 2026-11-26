<!--
{
  "id": "tape-contracts-en",
  "type": "fix",
  "kind": "summary",
  "lang": "en",
  "question": "tackle the remaining sorries on the route to prove TM = RE. keep going for at least 2 hours",
  "source": "share-codex 数据集（CC BY 4.0），会话 019e0413-3ebf-7301-a22d-a1d3d95a8ba7 第 279 条消息（执行中途的进度说明），仓库 nielstron/langlib（BSD-2-Clause）",
  "url": "https://huggingface.co/datasets/nmuendler/share-codex",
  "checks": [
    {
      "q": "接下来先做什么？",
      "a": "先为两个组合步骤写抽象接口，并写清它们对纸带内容的精确要求。"
    },
    {
      "q": "然后呢？",
      "a": "把剩下要证明的部分通过这些接口连起来。"
    },
    {
      "q": "为什么要这样做？",
      "a": "让整个证明路线不留漏洞，并把剩下的机器证明工作限制在局部。"
    }
  ],
  "traps": [
    "说接口已经写好或证明已经完成"
  ]
}
-->

The shape is now clearer: the het-fold step needs a finite-state “pop one typed tag, scan over a typed prefix, and run a block machine on the accumulator suffix” combinator. The paired multiplication step needs the same kind of separator-local rewrite, but with two `chainConsBottom` boundaries. I’m going to add the abstract interfaces for those combinators first, with precise tape contracts, then wire the final obligations through those interfaces; that keeps the route honest and localizes the remaining machine proof work.
