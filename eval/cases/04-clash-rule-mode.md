<!--
{
  "id": "clash-rule-mode",
  "title": "Clash 规则模式说明（标识符密集）",
  "origin": "local",
  "source": "本机 ~/.codex/sessions 真实回复（gpt-6.2-astra）",
  "kind": "report",
  "question": "现在 Clash 是什么模式？流量怎么走？",
  "patterns": [
    "P5",
    "P9",
    "P1"
  ],
  "facts": [
    {
      "id": "f1",
      "text": "当前是规则模式"
    },
    {
      "id": "f2",
      "text": "去往东京 VPS 自身、局域网和中国大陆的流量直连，其余走东京出口组里的 AWS-Tokyo 节点",
      "critical": true
    },
    {
      "id": "f3",
      "text": "运行中的内核实际加载了 7 条规则"
    },
    {
      "id": "f4",
      "text": "规则 1–2：目标是 VPS 自身的 IPv6/IPv4 地址时直连，避免代理绕回自己"
    },
    {
      "id": "f5",
      "text": "规则 3–4：本地域名或私有地址直连；规则 5：中国大陆域名库直连；规则 6：中国大陆 IP 库直连"
    },
    {
      "id": "f6",
      "text": "规则 7：其余全部走东京出口组的 AWS-Tokyo"
    },
    {
      "id": "f7",
      "text": "按顺序匹配，第一条命中就生效；域名未收录但 IP 属于国内也会直连",
      "critical": true
    },
    {
      "id": "f8",
      "text": "DNS 也分流：本地域名用系统 DNS，国内域名用直连的阿里 DoH 223.5.5.5，其余经东京节点用 Cloudflare DoH 1.1.1.1"
    },
    {
      "id": "f9",
      "text": "macOS 系统代理已开启，HTTP/HTTPS/SOCKS 端口都是 7891；TUN 关闭",
      "critical": true
    },
    {
      "id": "f10",
      "text": "遵循系统代理或手动设置 127.0.0.1:7891 的应用会走这些规则，自行直连的应用不经过 Clash",
      "critical": true
    }
  ],
  "traps": [
    {
      "id": "t1",
      "text": "说 TUN 已开启或所有应用都会经过 Clash"
    },
    {
      "id": "t2",
      "text": "把 AWS-Tokyo（节点）和东京出口（分组）混为一谈或说反"
    },
    {
      "id": "t3",
      "text": "添加原文没有的操作建议"
    }
  ],
  "jargon": [
    {
      "term": "GEOSITE",
      "plain": "按域名归类的数据库"
    },
    {
      "term": "GEOIP",
      "plain": "按 IP 地址归类的数据库"
    },
    {
      "term": "直连",
      "plain": "不走代理"
    },
    {
      "term": "Mihomo 内核",
      "plain": "Clash Verge 实际干活的程序"
    },
    {
      "term": "DoH",
      "plain": "加密的 DNS 查询"
    },
    {
      "term": "TUN",
      "plain": "接管全部网络流量的虚拟网卡模式"
    },
    {
      "term": "命中",
      "plain": "符合某条规则"
    },
    {
      "term": "系统代理",
      "plain": "macOS 里设置的全局代理"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "q": "哪些流量会走东京？",
      "a": "不属于 VPS 自身、本地/局域网、大陆域名或大陆 IP 的流量"
    },
    {
      "id": "q2",
      "q": "所有 App 都会走这些规则吗？",
      "a": "不会，只有遵循系统代理或手动设 7891 的应用；TUN 没开"
    }
  ]
}
-->

当前是**规则模式**。进入 Clash Verge 的流量按顺序匹配：**东京 VPS 自身地址、局域网和中国大陆流量直连，其余走 `AWS-Tokyo`**。我已核对正在运行的 Mihomo 内核，实际加载了以下 7 条规则。

| 顺序 | 匹配条件 | 去向 |
|---|---|---|
| 1–2 | 目标是东京 VPS 自身的 IPv6 或 IPv4 地址 | 直连，避免代理绕回自身 |
| 3–4 | 命中 `GEOSITE,private` 的本地域名，或 `GEOIP,private` 的私有地址 | 直连 |
| 5 | 域名命中 `GEOSITE,cn` 中国大陆域名库 | 直连 |
| 6 | 目标 IP 命中 `GEOIP,CN` 中国大陆 IP 库 | 直连 |
| 7 | 以上都未命中 | 走「东京出口」组中的 `AWS-Tokyo` |

规则**首次命中即生效**。例如，一个 `.com` 域名只要命中国内域名库，就会直连；即使域名未收录，目标 IP 命中国内 IP 库也会直连。

**DNS 也做了分流。** 本地域名使用系统 DNS，国内域名通过直连的阿里 DNS（`223.5.5.5`，DoH）解析，其余域名默认经东京节点访问 Cloudflare DNS（`1.1.1.1`，DoH）。

**当前 macOS 系统代理已开启**，HTTP、HTTPS 和 SOCKS 代理端口均为 `7891`；TUN 已关闭。因此，遵循系统代理或手动指定 `127.0.0.1:7891` 的应用会使用上述规则，自行直连的应用不会经过 Clash。
