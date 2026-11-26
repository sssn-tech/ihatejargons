<!--
{
  "id": "keep-vps-prices",
  "type": "keep",
  "kind": "report",
  "question": "推荐一个便宜的东京 VPS",
  "source": "本机 Codex 回复（gpt-6.2-astra），节选",
  "checks": [
    {
      "q": "首选哪款、多少钱？",
      "a": "腾讯云 Lighthouse 东京入门型，33 元/月。"
    },
    {
      "q": "它比 30 元那档好在哪？",
      "a": "同为 2 核 2 GB，SSD 从 40 GB 到 50 GB，月流量从 512 GB 到 1,024 GB，峰值带宽从 20 Mbps 到 30 Mbps。"
    },
    {
      "q": "如果每月流量要超过 1 TB 选哪个？",
      "a": "锐驰型，40 元/月，不限流量，峰值 200 Mbps。"
    },
    {
      "q": "线路质量测过吗？",
      "a": "没有，建议先月付，在晚高峰自己测延迟和丢包。"
    }
  ],
  "traps": [
    "改动任何价格或规格数字",
    "说线路质量已经实测过"
  ]
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
