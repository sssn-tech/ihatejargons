<!--
{
  "id": "web-codexisms-en",
  "title": "英文 idiolect：seam / load-bearing / cut over（对照原文语境）",
  "origin": "web",
  "source": "alexisgallagher.com 的 Codex 词汇表（seam、load-bearing、gates、surface、knob、contract、shape、to land、cutover、footgun、spike、runbook）与 HN 上『everything is the seam』的抱怨。按 Codex 英文汇报风格写成一段，用来测试英文黑话能否译成中文、原样保留的术语算不算失败。",
  "kind": "report",
  "question": "把 auth adapter 换成新的实现，别破坏现有接口",
  "lang": "en",
  "patterns": ["P11", "P1", "P6"],
  "facts": [
    { "id": "f1", "text": "新的认证适配器已经接入（原文 landed，指合并进主干）", "critical": true },
    { "id": "f2", "text": "改动集中在模块边界（auth adapter 的接口），没有动调用方", "critical": true },
    { "id": "f3", "text": "旧的 token 刷新路径保留了一个开关，可以切回旧实现", "critical": true },
    { "id": "f4", "text": "发现一个容易误用的配置：把 refresh_interval 设为 0 会每 200ms 刷新一次，已加注释说明", "critical": true },
    { "id": "f5", "text": "测试：12 个通过 11 个，失败的是一条模拟并发刷新的用例", "critical": true },
    { "id": "f6", "text": "全量切换（cutover）定在周四，之前需要先在测试环境跑一遍", "critical": true }
  ],
  "traps": [
    { "id": "t1", "text": "把「保留开关可以切回旧实现」说成旧实现已删除" },
    { "id": "t2", "text": "说全部测试通过" },
    { "id": "t3", "text": "说已经完成全量切换" }
  ],
  "jargon": [
    { "term": "seam", "plain": "模块之间的接缝/接口" },
    { "term": "load-bearing", "plain": "关键的、承担主要功能的" },
    { "term": "surface", "plain": "对外接口" },
    { "term": "knob", "plain": "可调参数" },
    { "term": "to land", "plain": "合并进主干" },
    { "term": "cutover", "plain": "全量切换" },
    { "term": "footgun", "plain": "容易误用的设计" },
    { "term": "shape", "plain": "数据结构、接口形态" }
  ],
  "questions": [
    { "id": "q1", "q": "能不能切回去？", "a": "能，旧刷新路径留了开关" },
    { "id": "q2", "q": "什么时候全量切？", "a": "定在周四，之前要先在测试环境跑一遍" }
  ]
}
-->

The key structural point first: the only load-bearing seam here is the auth adapter's interface. I kept the caller code untouched and landed the new implementation behind the existing contract, so the shape of every call site stays the same.

One footgun I found and documented: setting `refresh_interval` to 0 makes the adapter refresh every 200ms. I added a comment instead of a guard, since a guard would hide a real config mistake from the surface.

The old token refresh path is still there behind a knob, so we can cut back without a redeploy. Tests: 11 of 12 pass; the failing one simulates concurrent refresh and looks like a pre-existing race, not something this change introduced.

Cutover is pencilled in for Thursday. Before that I want one run in staging with the knob flipped both ways — I'd rather not find out the answer in production.
