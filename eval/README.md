# 评测集：Codex 汇报到底有没有被讲明白

插件改提示词、换模型、调阅读等级时，用这套用例回答一个问题：**改写之后，读者能不能只读译文就做对决定，而且没被带偏。** 它衡量的是翻译质量，不是界面或缓存。

## 用例从哪来

共 24 条，10 条来自本机，14 条取材于社区。每条都标了 `origin`。

- **`local`（10 条）**：本机 `~/.codex/sessions` 里 gpt-6.2-astra 的真实回复，只去掉了本机路径。包括 RC-042 发布记录、插件自己的 0.3.0 汇报、IPv4 被墙排查、Clash 规则说明、KV cache issue 草稿、执行摘要、研究方案、源码分析、价格表。
- **`web`（11–16）**：社区吐槽里被反复引用的原句和写法。比如 linux.do 上那句「按照你的要求收口 落代码 不做兼容兜底 并确保单测 冒烟通过」，kenvix 点名的坏句式模板，gizmo issue 里「真实形状钉在纸上」这种写法，以及英文的 seam / load-bearing / cutover。这些是为了让用例覆盖真实用户会遇到的写法，而不是只覆盖本机模型某一天的风格。
- **`web`（17–24）** 从八篇点名评论、吐槽或讽刺 Codex 说话方式的帖子取材。`source_url` 和 `source_excerpt` 给出原帖和短摘，`source` 标明说话者及上下文。用于评分的对话与技术细节是改编，见 `adaptation`。

来源和模式分析见 [PATTERNS.md](PATTERNS.md)。

| 用例与原文 | 改编场景 | 表达方式的出处 |
|---|---|---|
| [17 审核计划要反复转述](cases/17-web-speech-plan-tense.md) | 大模型后训练 | [社区原帖](https://linux.do/t/topic/1489462) |
| [18 “我不猜”后面跟着一个没证实的猜想](cases/18-web-speech-root-cause-voice.md) | 模型评测 | [社区原帖](https://linux.do/t/topic/1768077) |
| [19 “烟测过了”到底测了什么](cases/19-web-speech-smoke-scope.md) | 自动化测试 | [社区原帖](https://linux.do/t/topic/2397511) |
| [20 “起飞”“滚下一轮”遮住了究竟收到几份结果](cases/20-web-speech-reviewer-takeoff.md) | AI 基础设施 | [社区原帖](https://linux.do/t/topic/1922404) |
| [21 同一句“再来一刀”先指排查，后指真改代码](cases/21-web-speech-one-more-cut.md) | C++ 开发 | [社区原帖](https://linux.do/t/topic/1827029) |
| [22 浏览器插件排查忽然切换方言和主语](cases/22-web-speech-dialect-actor.md) | 前端开发 | [社区原帖](https://linux.do/t/topic/2144374) |
| [23 抽象的“接线”和真接上的接口](cases/23-web-speech-wire-vs-wire.md) | 前后端联调 | [社区原帖](https://linux.do/t/topic/2923124) |
| [24 “收口落盘”落下去的究竟是什么](cases/24-web-speech-close-to-disk.md) | 后端运维 | [社区原帖](https://linux.do/t/topic/1797184) |

## 一条用例由什么组成

`cases/*.md` 开头是一段 JSON 注释，后面的 Markdown 是送入翻译器的正文。本机样本保留原回复；社区用例按文件中的来源说明取材和改编。

```markdown
<!--
{
  "id": "rc042-release-gate",
  "kind": "report",              // report 对应整篇汇报，summary 对应执行摘要
  "question": "RC-042 能继续扩大发布吗？",
  "patterns": ["P1", "P3"],      // 这条覆盖哪些黑话模式
  "facts": [                      // 读者必须能学到的事实，critical 表示做决定离不开它
    { "id": "f1", "text": "当前状态是发布被阻断，不能继续扩大", "critical": true }
  ],
  "traps": [                      // 改写时最容易犯的错
    { "id": "t1", "text": "说已经扩大到 10%" }
  ],
  "jargon": [                     // 应当被讲明白的词
    { "term": "门禁", "plain": "必须满足才能继续的检查条件" }
  ],
  "questions": [                  // 读者只读译文时应该能答上的问题
    { "id": "q1", "q": "会扩大吗？", "a": "不会，已被系统自动暂停" }
  ]
}
-->

**模拟发布记录｜RC-042｜当前状态 `PROMOTION_BLOCKED`**
...
```

`facts` 和 `traps` 是手写的，依据是原文，不是模型生成。`traps` 是从实测错误里来的，例如：把样例里的修复步骤写成用户的待办、把 1% 说成 10%、把「既不能排除也不能认定」压成「就是 GFW」、把另一个模型自己的加密流量当成「用户的请求」。

## 怎么跑

```bash
node eval/run.mjs                                   # 全部用例，简明改写 + 讲给外行
node eval/run.mjs --case rc042 --modes deep         # 单条
node eval/run.mjs --judge zai-org/GLM-5.3 --second deepseek-ai/DeepSeek-V4-Pro
node eval/run.mjs --label-all                       # 所有反引号内容都带上标签
node --test eval/lib.test.mjs                       # 评测脚本自己的单元测试
```

- 被测对象就是 `src/backend.js` 的 `translate()`，和插件运行时走同一条路径（同样的提示词、同样的一次修订、同样的配置校验）。密钥读 `~/.config/minicode/siliconflow.env`，也可用 `SILICONFLOW_API_KEY` 覆盖。
- 结果写到 `eval/results/<时间>.md` 和 `.json`，md 里有总览、逐条评分、模式汇总和译文全文。
- 默认评审是 `zai-org/GLM-5.3`，与被测模型不同家。加 `--second` 会再跑一个评审，并给出两份评审在每条事实和每个陷阱上的一致率，用来看评分是否稳定。

## 怎么评分

两层，确定性的部分不花模型调用：

1. **脚本检查**（`lib.mjs`）：排版标记是否各出现一次、与原文的相似度、篇幅比例、数字有没有丢、行话有没有原样留着、表格行数是否保住。
2. **模型评审**（`judgeMessages`）：逐条判断每个 fact 是 `kept / partial / missing / contradicted`，每个 trap 是否踩中，并给出 1–5 分和一句评价。

关键指标是 **事实保留率** 和 **踩陷阱数**，不是分数本身。一个把 90% 事实留下、但把「不能确定」写成「确定」的译文，比少写两句的译文危害大得多。

## 首轮基线（2026-11-26）

被测：插件默认的 `deepseek-ai/DeepSeek-V4.1-Flash`，评审 `deepseek-ai/DeepSeek-V4-Pro`，16 条 × 2 档。完整结果见 [results/2026-11-26-baseline.md](results/2026-11-26-baseline.md)。

| 等级 | 事实保留 | 与原文相悖 | 踩陷阱 | 字面相似度 | 篇幅 | 仍留行话 |
|---|---|---|---|---|---|---|
| 简明改写 `light` | 97% | 0 | 1 | 0.77 | 1.05× | 61 |
| 讲给外行 `deep` | 64% | 3 | 2 | 0.51 | 0.72× | 60 |

读法：

- **`light` 的问题是不改。** 事实几乎全在，但字面相似度 0.77、61 个行话原样留着，RC-042 那条的相似度只有 0.58——它是靠「几乎照抄」换来的高事实率，不是靠讲清楚。
- **`deep` 的问题是改太多。** 事实掉到 64%，价格表丢掉锐驰型和全部规格对比（篇幅只剩 0.25×），RC-042 丢掉「12 格全绿才恢复」的验收条件，`GEOSITE`/`TUN` 那种规则表被压成一句半通不通的话。
- **占位符管线是稳的。** 32 条输出里标记 0 条出错。
- **最容易踩的还是 P7/P8：** 把「不能排除也不能认定」写成倾向性结论、把样例里的验证步骤写成用户待办。

## 怎么看待这些分数

- 评审是一个模型，会抖。首轮里有一条 8 个事实全 judged kept，模型却给了 0 分且评语为空（已在汇总里作废，需要重跑）。要更稳的结论就加 `--second`，看两份评审在事实和陷阱上的一致率，别只看平均分。
- 「字面相似度」只说明改动幅度，不说明对错；英文用例（`lang: "en"`）没有共有字词，这一列不适用，显示为「—」。
- 「丢数字」是提示，不是结论：链接里的版本号和哈希已经被排除，但像「12 种组合」这种写在标识符旁的数仍可能误报，以评审的 fact 判断为准。
- 用例集是回归工具：改提示词前后跑同一套，比较上面两行数字。加用例优先加你实际踩过的坑，别加模型随手能赢的。

## 和插件构建的关系

插件计算缓存哈希时只算 `package.json` 和 `src/`（见 `src/translation-cache.js` 的 `buildIdentity`），所以增删 `eval/` 下的文件不会让用户的译文缓存失效，也不会让已安装版本要求重新授权。
