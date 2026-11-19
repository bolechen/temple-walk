# 七佛造像试验的证据（#280）

报告：`docs/t05/STATUE-SPIKE.md`。拼图 `collage.jpg` 在仓库里；其余图片和录像在证据库（`node tools/evidence.mjs pull docs/t05/evidence/statue-spike`），清单和 SHA-256 在 `MANIFEST.json`。

## 里面有什么

| 路径 | 是什么 |
| --- | --- |
| `route-a-one/` | 路 A（Tripo）毗婆尸一尊。`door`：月台上中轴，离像约 24 m。`front`：佛前 6 m 仰视。`front10`：佛前 10 m。`side`：侧廊约 12 m。每处一张夏昼、一张初冬晴冷，1600×900。`report.json` 记三角形数、绘制次数和渲染器 |
| `route-b-one/` | 路 B：Mia 明代漆佛（CC0），同样八张 |
| `route-a-three/` | 路 A 三尊：迦叶（东）、毗婆尸、释迦（西），在 x = 0、±5.80。`door3`：殿门内；`side3`：侧廊；`front` / `front10`。两季。另有 `walk-winter.mp4`：第一人称，眼高 1.6 m，从月台按 2.1 m/s 走进殿门，到佛前 6 m 停下抬头，约 15 秒，1280×720 |
| `tex-vs-clay.png` | 毗婆尸：左是 Tripo 自己的贴图，右是统一的素泥材质，殿门内和侧廊各一张 |
| `scans-in-hall.png` | 路 B 的三件候选扫描并排放进殿里：Freer 唐坐佛、雷峰塔像、Mia 漆佛 |
| `tripo/` | 每尊的请求（提示词、种子、版本），以及 Tripo 内部从文字生成的那张图 |
| `tripo-ledger.json` | 每个 Tripo 任务的任务号、花的点数、产物文件的字节数和 SHA-256 |
| `gpu/` | T4 上 0、1、3、7 尊的帧耗（`report.json`）和三尊、七尊的截图（七尊是三尊的文件重复摆满七个座位，只为量开销）。`report.json` 里的三角形和绘制次数含阴影贴图那一遍，见报告「性能」 |

**全部是软件渲染**（SwiftShader，见 `report.json` 的 `renderer`），只有 `gpu/` 是 T4。

## 模型在哪里

Tripo 的四个原件（每个约 42–46 MB）和减到 6 万面的四个文件放在私有桶 `hf://buckets/bolechen/temple-walk-render/keep/t05-statue-spike/`，不进 git，也不进公开的证据库（是项目付费生成的资产）。SHA-256 见 `docs/t05/statue-spike-assets.csv` 和 `tripo-ledger.json`。

## 怎么重出

```sh
pnpm install
# 取模型（私有桶，要 hf 登录）
hf buckets sync hf://buckets/bolechen/temple-walk-render/keep/t05-statue-spike tools/out/t05/tripo
# 减面（可重出：同一原件两次 SHA-256 相同）
node tools/t05-statue.mjs tools/out/t05/tripo/vipasyin-a.base_model.glb tools/out/t05/tripo/vipasyin-a.60k.glb --tris=60000
# 出图和录像
node tools/t05-hall.cjs tools/t05-hall/specs/route-a-one.json
node tools/t05-hall.cjs tools/t05-hall/specs/route-b-one.json
node tools/t05-hall.cjs tools/t05-hall/specs/route-a-three.json
node tools/t05-hall.cjs tools/t05-hall/specs/route-a-film.json       # 录像，软件渲染约 25 分钟
# T4（先跑过上面任一条，白盒页就建好了）
tools/t05-gpu.sh tools/out/t05/tripo/vipasyin-a.60k.glb tools/out/t05/tripo/kasyapa-a.60k.glb tools/out/t05/tripo/sakyamuni-a.60k.glb
# 重新生成（花点数！）：NODE_USE_ENV_PROXY=1 node tools/t05-tripo.mjs submit docs/t05/evidence/statue-spike/tripo/req-vipasyin.json vipasyin-b
```

同一份请求在同一版本下重出，按 Tripo 文档应得到同一个网格，但这次没有花点数去验证。
