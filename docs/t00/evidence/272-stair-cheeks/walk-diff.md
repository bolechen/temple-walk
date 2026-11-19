### 可走的地面（#194）：本提交对比 .main/app/shared/walk/t00.bin

命名地点（打卡点、座位、殿门站位、命名机位）从入口都走得到。

可走面积变化超过 1 m² 的部分：

| 层 | 格子 | 部分 | 多出 m² | 少了 m² |
|---|---|---|---|---|
| 旧数据 | outdoors | 首院 | 0.00 | 11.61 |
| 画的 | outdoors | 大雄宝殿 | 8.78 | 2.30 |
| 旧数据 | outdoors | 大雄宝殿 | 7.75 | 2.70 |
| 画的 | outdoors | 首院 | 0.00 | 10.08 |

画的地面能站、旧数据走不到的（超过 1 m² 的部分；页面默认处处走画的地面，#274；每处都要在 PR 里说一句是旧数据漏了还是该关）：

| 格子 | 部分 | m² |
|---|---|---|
| outdoors | 大雄宝殿 | 83.62 |
| outdoors | 观音殿 | 60.31 |
| outdoors | 藏经楼 | 54.71 |
| outdoors | 茶寮 | 44.49 |
| outdoors | 万年正续 | 39.46 |
| outdoors | 首院 | 31.22 |
| outdoors | 大慧院 | 22.25 |
| outdoors | 禅堂 | 22.19 |
| outdoors | 药师殿 | 20.33 |
| outdoors | 藏经楼院 | 14.83 |
| outdoors | 观音殿院 | 6.91 |
| outdoors | 凌霄阁 | 4.51 |
| loft:lingxiao | lingxiao 顶层 | 3.84 |
| outdoors | 山门前 | 3.78 |
| room:lingxiao | lingxiao 殿内 | 2.58 |
| outdoors | 无名 | 1.57 |
| outdoors | 山顶 | 1.53 |
| outdoors | 望江亭 | 1.24 |
| outdoors | 山路 | 1.23 |
| outdoors | 鼓楼 | 1.12 |
| outdoors | 钟楼 | 1.12 |
| outdoors | 半山亭 | 1.11 |

本提交可走面积合计：画的 6216.1 m²，旧数据 6091.6 m²（10 张格子）。
