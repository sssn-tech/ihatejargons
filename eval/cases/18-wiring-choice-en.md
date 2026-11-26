<!--
{
  "id": "wiring-choice-en",
  "type": "fix",
  "kind": "report",
  "lang": "en",
  "question": "why is that? this rewrite should only be legal in o3",
  "source": "share-codex 数据集（CC BY 4.0），会话 019ceb2f-cae5-7802-8284-e6dac13266c0 第 371 条消息，仓库 OpShin/opshin（MIT）",
  "url": "https://huggingface.co/datasets/nmuendler/share-codex",
  "checks": [
    {
      "q": "这个改写现在在哪些优化级别生效？",
      "a": "O1、O2、O3 三个级别都生效，不只是 O3。"
    },
    {
      "q": "为什么？",
      "a": "它挂在 remove_dead_code 开关下面，而这个开关在 O1、O2、O3 都是开的。"
    },
    {
      "q": "O1/O2 测到的体积收益说明什么？",
      "a": "数字是真的，但只是这种挂法造成的，不能说明这个优化适合 O1/O2。"
    },
    {
      "q": "建议怎么改？",
      "a": "新加一个只在 O3 打开的专用开关，或者只在 O3 级别插入；可以改完再重跑体积对比。"
    }
  ],
  "traps": [
    "说已经改成只在 O3 生效",
    "说 O1/O2 的收益是测错了"
  ]
}
-->

Because I wired it under `config.remove_dead_code`, and in this repo that is enabled for `O1`, `O2`, and `O3`, not just `O3`.

In [compiler_config.py]($HOME/git/opshin2/opshin/compiler_config.py):
- `OPT_O1_CONFIG` sets `remove_dead_code=True`
- `OPT_O2_CONFIG` inherits that
- `OPT_O3_CONFIG` inherits that too

And in [compiler.py]($HOME/git/opshin2/opshin/compiler.py) I inserted:
- `RewriteAdjacentInline() if config.remove_dead_code else NoOp()`

So the rewrite currently runs at all three optimized levels.

If your intent is “this relies on O3-only reordering assumptions”, then it should not be keyed off `remove_dead_code`. It should either:
- be gated on a new dedicated config flag enabled only in `OPT_O3_CONFIG`, or
- be inserted only when the config is specifically O3-level

The measured `O1`/`O2` wins are real, but they’re an artifact of that wiring choice, not evidence that the pass is conceptually an O1/O2 optimization. If you want, I can fix that now by making it O3-only and rerun the size comparison.
