# Codex 黑话的模式

这份分类来自三方面材料：网上的吐槽和社区写的禁用词提示词，本机 `~/.codex/sessions` 里 120 条真实回复，以及插件已有的 RC-042 样例。每个测试用例都在 `patterns` 字段里标了它覆盖哪些模式，报告会按模式分别统计。

## 网上在吐槽什么

- **跨版本都有。** 有人说 gpt-5.3-codex「事无巨细 + 黑话频出」，读 plan 尤其痛苦，写 AGENTS.md 也压不住（[@hylarucoder](https://x.com/hylarucoder/status/2027323238221844917)）。GPT-6.2 发布后又有一波同类帖子（[@Mileson07](https://x.com/Mileson07/status/2123221837266268507)）。OpenAI 的 Tibo 给的建议是在 custom instructions 里写「默认用 ELI5 跟我说话」，并说「team is on it」（[linux.do 转述](https://linux.do/t/topic/3198774)）。不过回帖里有人说加了以后「并无什么改善」（[linux.do](https://linux.do/t/topic/3198948)）。
- **典型原句。**「我先不猜 直接查看项目代码 按照你的要求收口 落代码 不做兼容兜底 并确保单测 冒烟通过」，发帖人的评价是「人类程序员很少说收口、落代码这种词」（[linux.do 1848592](https://linux.do/t/topic/1848592)）。还有人说它「经常说"烟测"，没见过它完整地说冒烟测试」（[linux.do 2397511](https://linux.do/t/topic/2397511)）。
- **社区的禁用词表。** kenvix 列了：落地、钉死、对齐、门禁、链路、夹具、探针、基线、收掉、追溯、冒烟、烟测、全量、验收矩阵、颗粒度、口径、证据、关键一刀、约定、合同。判断标准是：一个原本指具体事物的词，被拿去泛指审核条件、流程限制、管理动作或项目状态（[kenvix.com](https://kenvix.com/post/codex-prompt/)）。imkero 的禁用词是：跑、落、收口、顺手、接、补、收紧、写死。评论区还补充了砍一刀、落盘、闭环、压实、稳稳接住（[imkero.net](http://imkero.net/posts/gpt5-please-shuo-ren-hua/)）。另一份映射表写的是：逃生口＝兜底，投影＝映射，补强＝优化完善，接线＝联调，哨兵＝保护机制（[linux.do 2923124](https://linux.do/t/topic/2923124)）。
- **英文里也有。** Codex 的 idiolect 包括 seam、load-bearing、contract、knob、surface、shape、land、cutover、footgun、spike（[Things Codex Likes to Say](https://alexisgallagher.com/posts/2026/codexisms/)）。HN 上有人说「everything is the seam」（[HN](https://news.ycombinator.com/item?id=49233144)）。一篇评测也说它跑完给的汇报 very jargon-heavy，非科班用户需要再要一版 plain English（[somethingbig.ai](https://somethingbig.ai/gpt-5-3-codex-review)）。
- **官方提示词其实要求说人话。** 泄露的 Codex 系统提示词写着 "You prefer using plain language over jargon"，并要求 final answer 自成一体（[system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks/blob/main/OpenAI/Codex/gpt-5.6.md)）。可见问题出在模型的写作习惯上，不是指令没写。

## 模式分类

| 代码 | 模式 | 典型表现 | 来源 |
|---|---|---|---|
| P1 | **隐喻黑话**：用具体名词借指抽象流程 | 门禁、链路、探针、夹具、基线、口径、闭环、契约、形状、seam、load-bearing、surface、knob | kenvix、codexisms、RC-042 |
| P2 | **单字动词、口语化动作** | 跑、落、起、补、接、挂、收、砍一刀、钉死、顺手、续上、转绿 | imkero、linux.do |
| P3 | **硬译的英文工程术语** | 冒烟/烟测（smoke）、探针（probe）、夹具（fixture）、制品（artifact）、金丝雀（canary）、回放（replay）、晋级/放量（promote） | linux.do、RC-042 |
| P4 | **名词堆叠、自造标签** | 「构建与制品晋级」「依赖三态」「真链路冒烟」「人肉前置」「旧版消费者 × 历史事件 × 重复投递」 | gizmo issue、RC-042 |
| P5 | **用标识符代替结论**：状态码、字段名、枚举值承担了主要意思 | `PROMOTION_BLOCKED`、`PLAN_OK`、`CrashLoopBackOff`、退出码 `137`、`GEOSITE,cn` | 本机样本 |
| P6 | **证据腔、过程叙述**：先讲怎么验证的，结论散在过程里 | 「已核对」「实测」「这组数据把……区分开了」「我先不猜」 | 本机样本、linux.do |
| P7 | **认识论对冲**：精确但绕的限定句 | 「X 确实说明……但不能推广成……」「既不能排除……也不足以认定……」「不能简单画等号」 | kenvix、本机样本 |
| P8 | **指代和归属依赖上下文** | 「按你的要求」「样例里的修复步骤」；读者分不清是谁做了什么，还是例子里的事 | 本机样本（插件实测时出过错） |
| P9 | **高密度缩写和指标** | P99、5xx、SYN-ACK、KV cache、RSS、N+1 | 本机样本 |
| P10 | **埋在句子里的待办和越权改动** | 「顺手」改了别的地方，打了 skip，需要用户拍板的事藏在列表中间 | linux.do「顺手」吐槽、kenvix |
| P11 | **英文输出** | seam、load-bearing、cut over、land、footgun | codexisms、HN |
| C0 | **对照组**：本身已经比较好读 | 价格表、清楚的说明文 | 本机样本 |

## 对翻译器的启示

1. **P1–P3 是逐词问题。** 词库和逐词替换能处理一部分，但同一个词在不同语境里意思不同，比如「收口」可以指收尾，也可以指收拢范围。所以要结合上下文来解释。
2. **P4–P8 是结构问题。** 只替换词解决不了，需要重组句子：先给结论，再交代谁做了什么、还剩什么没确认。插件现在的「简明改写」被要求保持原文的信息密度，对这几类几乎不起作用。
3. **P7、P8、P10 改写时最容易出事。** 简化时会把对冲压成肯定，把例子里的步骤写成读者的待办，或者删掉「顺手改了 X」。所以测试集给这几类配了专门的陷阱条目（traps）。
4. **C0 测的是不要越帮越忙。** 原文已经好读时，好的翻译器应该基本不改，数字一个都不能丢。
