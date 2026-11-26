# 黑话案例从哪来

这个评测集现阶段的重心是**收集真的难懂的 Codex 回复**。用例少而准，比标注细更重要。本页记录现有案例的出处，以及去哪里找新的。

## 现有案例

| 用例 | 出处 | 原文是否逐字 |
|---|---|---|
| 01 rc042-release-gate | 本机 Codex 回复（gpt-6.2-astra） | 是 |
| 02 verb-smear | [linux.do 1848592](https://linux.do/t/topic/1848592) 原句「按照你的要求收口 落代码 不做兼容兜底」+ [imkero](http://imkero.net/posts/gpt5-please-shuo-ren-hua/) 单字动词 | 拼合 |
| 03 banned-words | [kenvix](https://kenvix.com/post/codex-prompt/)、[linux.do 2923124](https://linux.do/t/topic/2923124) 禁用词表 | 拼合 |
| 04 codexisms-en | [Things Codex Likes to Say](https://alexisgallagher.com/posts/2026/codexisms/)、[HN](https://news.ycombinator.com/item?id=49233144) | 拼合 |
| 05 human-labels-in-code | [gizmo issue #69](https://github.com/0xnicholas/gizmo/issues/69) 的写法 | 拼合 |
| 06 buried-skip | linux.do 对「顺手改」的吐槽 | 拼合 |
| 07–14 | linux.do 点名 Codex 说话方式的帖子：[1489462](https://linux.do/t/topic/1489462)、[1768077](https://linux.do/t/topic/1768077)、[2397511](https://linux.do/t/topic/2397511)、[1922404](https://linux.do/t/topic/1922404)、[1827029](https://linux.do/t/topic/1827029)、[2144374](https://linux.do/t/topic/2144374)、[2923124](https://linux.do/t/topic/2923124)、[1797184](https://linux.do/t/topic/1797184) | 改编，场景为新写 |
| 15 debug-voice | [shuorenhua](https://github.com/MrGeDiao/shuorenhua/blob/main/evals/benchmark.md) SF-11 | 是 |
| 16 release-wording | shuorenhua SF-62（该项目 v2.3.1 README 原文） | 是 |
| 17 status-attribution | shuorenhua SF-25 | 是 |
| 18 wiring-choice-en | [share-codex](https://huggingface.co/datasets/nmuendler/share-codex) 会话 019ceb2f…，仓库 OpShin/opshin | 是 |
| 19 tape-contracts-en | share-codex 会话 019e0413…，仓库 nielstron/langlib | 是 |
| 20–23（对照组） | 本机价格表回复；shuorenhua SNF-15、SNF-28、SNF-19 | 是 |

几点说明：

- 07–14 的 linux.do 出处里，1768077、2144374、2397511、2923124 已经核对过；1489462、1922404、1827029、1797184 被 Cloudflare 拦住，搜索引擎也没收录，目前无法核实。1922404 本身是一篇模仿 Codex 语气的讽刺帖。
- 07、09、10、11、13、14 原来在正文里会自己把陷阱说破（比如「勾的是方案核对过」「都是待清，不是已清」），翻译器只要不删这句就不会错。这些句子已经删掉，换成 Codex 真实的含糊写法。11 号还删掉了自造词「先别替我结账」，12 号的「接半口」改成了常见说法「背一半」。
- 对照组（`type: "keep"`）本来就好懂。它测的是翻译器会不会越帮越忙：删掉数字、改写技术术语，或者把「今天会补」写成「已经补了」。

## 许可

- shuorenhua：MIT，© 2026 MrGeDiao，全文见 [licenses/shuorenhua-MIT.txt](licenses/shuorenhua-MIT.txt)。`words.json` 的硬黑话表也主要来自它的中文短语表。
- share-codex：数据集为 CC BY 4.0（nmuendler/share-codex）。两条会话所在的仓库分别是 MIT 和 BSD-2-Clause；我们只用了助手的说明文字，没有用代码。

## 去哪找新案例

1. **本机会话。** `~/.codex/sessions/**/*.jsonl` 里 `role: assistant` 的消息。按 `words.json` 的 hard 表统计命中密度，再人工挑。注意：本机现在用的 gpt-6.2-astra 已经比较规整，120 条回复里真正难懂的很少，大部分本地候选看下来并不晦涩，所以只留了 RC-042 和一条对照组。
2. **linux.do 吐槽帖。** [口癖收集帖](https://linux.do/t/topic/1768077) 按「庸医问诊类」「暴力倾向类」「不说人话类」分类，适合找线索，但大多只有词，没有完整上下文。需要自己补一个场景。
3. **shuorenhua。** 主集 120 条加 20 条场景样本，大部分是泛 AI 腔（营销、谄媚、接住体），和 Codex 有关的集中在「工程师腔 / 调试腔」以及 status 场景。它的 SNF 系列是很好的对照组来源。
4. **share-codex。** 约 4,000 条真实 Codex 会话，主要是 Lean 和 Python 项目。我们扫了全部 4,019 条会话里约 1 万条长度适中（250–3,500 字）、不带工具调用的助手回复：一条中文回复都没有；英文里的 Codex 腔（wired、gated、shape、honest、contract）确实存在，但密度不高，大多数回复对工程师来说是清楚的。只挑了 2 条。

## 加一条案例

复制任意一个 `cases/*.md`，改 JSON 头和正文即可：

- 正文尽量用**原话**。如果是改编的，在 `source` 里写清楚哪部分是原话、哪部分是新写的。
- `checks` 写 2–4 个「读完必须能答对」的问题，优先问：现在是什么状态、谁做了什么、我要不要做什么。
- `traps` 只写真的见过或很容易犯的错，没有就不写。
- 不要在正文里替读者把答案说出来。那是翻译器该做的事。
