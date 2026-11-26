<!--
{
  "id": "vps-price-control",
  "title": "东京 VPS 价格对比（对照组）",
  "origin": "local",
  "source": "本机 ~/.codex/sessions 真实回复（gpt-6.2-astra）；节选，表格保留前三行",
  "kind": "report",
  "question": "推荐一个便宜的东京 VPS",
  "patterns": [
    "C0",
    "P9"
  ],
  "facts": [
    {
      "id": "f1",
      "text": "首选腾讯云 Lighthouse 东京入门型，33 元/月",
      "critical": true
    },
    {
      "id": "f2",
      "text": "比 30 元最低档贵 3 元，同为 2 核 2 GB，SSD 40→50 GB，月流量 512→1,024 GB，峰值带宽 20→30 Mbps",
      "critical": true
    },
    {
      "id": "f3",
      "text": "这是公开月价，不需要首购券或年付"
    },
    {
      "id": "f4",
      "text": "只跑很小的常驻服务可选 Evoxt 东京，2.99 美元/月"
    },
    {
      "id": "f5",
      "text": "锐驰型 40 元：2 核 2 GB 40 GB，无限流量，峰值 200 Mbps，适合每月出站接近或超过 1 TB"
    },
    {
      "id": "f6",
      "text": "Evoxt VM-0.5：1 核 512 MB 5 GB，500 GB 流量，含每周备份，限制是 5 GB 系统盘；下单选 Japan (Tokyo) / Standard，日本 Premium 在大阪"
    },
    {
      "id": "f7",
      "text": "价格截至 2026 年 11 月 23 日"
    },
    {
      "id": "f8",
      "text": "从中国内地连接时建议先月付并在晚高峰测延迟和丢包；线路质量未经实测",
      "critical": true
    }
  ],
  "traps": [
    {
      "id": "t1",
      "text": "改动任何价格或规格数字"
    },
    {
      "id": "t2",
      "text": "说线路质量已实测"
    }
  ],
  "jargon": [
    {
      "term": "峰值带宽",
      "plain": "最高网速"
    },
    {
      "term": "常驻服务",
      "plain": "一直开着运行的小程序"
    },
    {
      "term": "丢包",
      "plain": "数据在传输中丢失"
    },
    {
      "term": "首购券",
      "plain": "新用户首单优惠"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "q": "推荐哪款、多少钱？",
      "a": "腾讯云 Lighthouse 东京入门型，33 元/月"
    },
    {
      "id": "q2",
      "q": "线路好不好？",
      "a": "没实测，建议先月付自己在晚高峰测"
    }
  ],
  "notes": "对照组：原文本身就好读。期望「简明改写」几乎不改动，所有数字原样保留。"
}
-->

**对标 Lightsail，我会首选腾讯云 Lighthouse 东京入门型，33 元/月。** 它比 30 元的最低档每月只贵 3 元，配置同为 2 核 2 GB，但 SSD 从 40 GB 增至 50 GB，月流量从 512 GB 翻到 1,024 GB，峰值带宽也从 20 Mbps 提到 30 Mbps。这个价格是公开月价，无需首购券或年付。只跑一个很小的常驻服务，则可以看 **Evoxt 东京，2.99 美元/月**。[腾讯云官方价格](https://cloud.tencent.com/document/product/1207/73452/) · [Evoxt 官方价格](https://evoxt.com/pricing/)

截至 **2026 年 11 月 23 日**，以下几款都能在官网核对到东京节点和月付价格。

| 东京 VPS 套餐 | 月费 | CPU / 内存 / 磁盘 | 月流量 | 适合什么情况 |
|---|---:|---|---|---|
| 腾讯云 Lighthouse 入门型 | **33 元** | 2 核 / 2 GB / 50 GB SSD | 1,024 GB，峰值 30 Mbps | 小网站、API、轻量容器。默认分配独立公网 IP。[套餐价格](https://cloud.tencent.com/document/product/1207/73452/) · [公网 IP 说明](https://cloud.tencent.com/document/product/1207/79254) |
| 腾讯云 Lighthouse 锐驰型 | **40 元** | 2 核 / 2 GB / 40 GB SSD | 无限流量，峰值 200 Mbps | 如果每月出站接近或超过 1 TB，这档比上面的入门型多 7 元。200 Mbps 是峰值。[官方价格与规格](https://cloud.tencent.com/document/product/1207/73452/) |
| Evoxt Standard VM-0.5 | **2.99 美元** | 1 核 / 512 MB / 5 GB | 500 GB | 适合小脚本、探针，含每周备份。主要限制是 5 GB 系统盘。下单选 **Japan (Tokyo) / Standard**，日本 Premium 节点在大阪。[官方价格与机房](https://evoxt.com/pricing/) |

如果主要从**中国内地**连接，我会先月付，用自己的宽带在晚高峰测一下延迟和丢包，再决定是否长期用。东京机房的位置已核实，表中套餐到你所在地的线路质量未经实测。腾讯云也明确提示，跨境访问会受运营商线路影响。[腾讯云地域与网络说明](https://cloud.tencent.com/document/product/1207/50103/)
