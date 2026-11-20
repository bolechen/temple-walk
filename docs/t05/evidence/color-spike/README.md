# 彩塑上色试验的证据（#287）

报告：`docs/t05/COLOR-SPIKE.md`。拼图 `collage.jpg` 在仓库里；其余图片在证据库（`node tools/evidence.mjs pull docs/t05/evidence/color-spike`），清单和 SHA-256 在 `MANIFEST.json`。

## 里面有什么

| 路径 | 是什么 |
| --- | --- |
| `one/` | 毗婆尸一尊（`tools/t05-hall/specs/color-one.json`）。初冬晴冷：`door`（殿门，约 24 m）、`front10`（佛前 10 m）、`side`（侧廊约 12 m）各一张素泥（`-clay`）、一张上色（`-paint`）；`front`（佛前 6 m 仰视）两张；`face-from10`（佛前 10 m 处的眼睛用长焦看脸，等于把 10 m 那张放大）上色、素泥各一；`face-close`（离脸 3.2 m，诊断用，不是玩家站得到的地方）；`hands`（手和胸）；`-noprobe`：上色但不给光照探针，看贴金没有东西可反射时的样子；夏昼 `door`、`front10` 各一张上色。1600×900 |
| `three/` | 三尊（`color-three.json`）：迦叶（东）、毗婆尸、释迦（西）。`door`（殿门 24 m）、`door3`（殿门内）、`front10`、`side3`（侧廊）各一张素泥、一张上色，夏昼 `door3` 一张上色 |
| `ortho/` | 三尊各自的正投影正面、侧面（上色，1 m 红格、0.5 m 白格、0.1 m 灰格），用来对锚点 |
| `gpu/` | T4 上量三尊上色前后的 `__cost`（`report.json`；`site.commit` = `9e5c09306f7bfc633322828356a57d2c2a211dbb`，干净）和第二轮的六张截图 |
| `*/report.json` | 软件渲染每张图的三角形数、绘制次数、渲染器（SwiftShader） |

**除 `gpu/` 外全部是软件渲染**（SwiftShader）。

## 怎么重出

模型取法同 `docs/t05/evidence/statue-spike/README.md`（私有桶，只要三个 `*.60k.glb`）。然后：

```sh
node tools/t05-hall.cjs tools/t05-hall/specs/color-one.json
node tools/t05-hall.cjs tools/t05-hall/specs/color-three.json
SETS=paint tools/t05-gpu.sh tools/out/t05/tripo/vipasyin-a.60k.glb tools/out/t05/tripo/kasyapa-a.60k.glb tools/out/t05/tripo/sakyamuni-a.60k.glb
```

正投影对锚点的图：spec 里的一张写 `{ "name": "v-front", "ortho": { "i": 0, "side": "front" } }`（加 `"lit": true` 和 `"paint": true` 看上色；加 `"cx", "cy", "half": 0.7` 放大到脸，格子变成 2 cm）。
