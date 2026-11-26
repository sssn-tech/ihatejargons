<!--
{
  "id": "codexisms-en",
  "type": "fix",
  "kind": "report",
  "lang": "en",
  "question": "把 auth adapter 换成新的实现，别破坏现有接口",
  "source": "英文社区吐槽：alexisgallagher.com「Things Codex Likes to Say」词表与 HN「everything is the seam」讨论，按 Codex 英文汇报风格写成",
  "url": "https://alexisgallagher.com/posts/2026/codexisms/",
  "checks": [
    {
      "q": "还能切回旧实现吗？",
      "a": "能。旧的 token 刷新路径还在，由一个配置开关控制，切回不需要重新部署。"
    },
    {
      "q": "测试结果？",
      "a": "12 个过了 11 个，失败的是模拟并发刷新的用例，看起来是改动前就存在的问题。"
    },
    {
      "q": "什么时候全面切换？",
      "a": "暂定周四，之前要先在预发布环境把开关两种状态各跑一遍。"
    },
    {
      "q": "发现了什么容易踩的坑？",
      "a": "refresh_interval 设为 0 会每 200 毫秒刷新一次；只加了注释说明，没有加拦截。"
    }
  ],
  "traps": [
    "说旧实现已经删掉",
    "说已经完成全面切换"
  ]
}
-->

The key structural point first: the only load-bearing seam here is the auth adapter's interface. I kept the caller code untouched and landed the new implementation behind the existing contract, so the shape of every call site stays the same.

One footgun I found and documented: setting `refresh_interval` to 0 makes the adapter refresh every 200ms. I added a comment instead of a guard, since a guard would hide a real config mistake from the surface.

The old token refresh path is still there behind a knob, so we can cut back without a redeploy. Tests: 11 of 12 pass; the failing one simulates concurrent refresh and looks like a pre-existing race, not something this change introduced.

Cutover is pencilled in for Thursday. Before that I want one run in staging with the knob flipped both ways — I'd rather not find out the answer in production.
