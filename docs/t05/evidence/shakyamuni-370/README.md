# 释迦样件的证据（#370）

报告：`docs/t05/SHAKYAMUNI-SAMPLE.md`。仓库里只有拼图和文本；图在证据库（`node tools/evidence.mjs pull docs/t05/evidence/shakyamuni-370`），清单和 SHA-256 在 `MANIFEST.json`。

## review/：给所有者看的一组（T4 上渲染）

T4 Job `6b00defe4fdc5ab3c55c269d`（运行号 `t05-20261120-235953`），`ANGLE (NVIDIA, Vulkan 1.4.357 (NVIDIA Tesla T4))`，开 GTAO；站点 `site.commit` = `393dd59c7c02e9c18a4347283b05e0d662a97db6`（干净），`site.sha256` = `1beb0a54766489d3729e0783fd1ad9bf97a163589f7239711e2fd18d876b08a8`。网格是近档 6 万面（`sakyamuni-r1.60000.glb`），上色是 `tools/t05-hall/paint/`（同一份 `recipe.json` 加这尊的锚点）。

| 文件 | 是什么 |
| --- | --- |
| `turn-front/right/back/left.png` | 四面：正面、像的右侧、背面、像的左侧，离像 14.5 m，仰 6°；殿藏起来，一盏暖主光、一盏冷补光、一盏轮廓光，贴金反射一张室内环境图（three 的 `RoomEnvironment`）；光跟着像，四面打法一样 |
| `hand-front.png`、`hand-side.png` | 右手（触地）近照，正面和像的右侧，离手 4.4 m（诊断用，玩家站不到） |
| `hand-left.png` | 左手（掌心向上）近照，斜上方 |
| `half-warm.png` | 半身，在白盒殿里：初冬晴冷的门光，加佛坛前一盏暖灯，佛前约 7.5 m 仰看 |

`review-collage.jpg` 是这八张拼成的一张（证据库）。仓库里只放总拼图 `collage.jpg`（AGENTS.md：每个证据目录最多一张拼图）。

怎么重出：`SETS=lod370 tools/t05-gpu.sh <近> <中> <远>`（模型取法见下），review 一套在同一个 Job 里先出；软件渲染同样的图：`node tools/t05-hall.cjs tools/t05-hall/specs/sakyamuni-370-review.json`。

## review-v2/：定稿后的同一组（T4）

主创 2026-11-21 看图提了五条，改完重出，机位、光和文件名同 `review/`：Job `6b00e5614fdc5ab3c55c3034`（运行号 `t05-20261121-002709`），`site.commit` = `7d2d4b3ebcad2fee6b476096a3254afd06c72616`（干净）。`review-v2-collage.jpg` 是拼图（证据库），`gpu-report-v2.json` 是这次 Job 的完整报告（仓库里）。

## review-v3/：改色后的同一组（T4）

按 `ART.md` §3.1 把肤色从金身改为温哑的浅赭、贴金只点在衣缘以后重出：Job `6b00f388efaf5e14f4b43f90`（运行号 `t05-20261121-012732`），`site.commit` = `057f6c69cd6f0d63b303fce22d1b8723c8f280cc`（干净）。棚拍的四面曝光从 1.0 降到 0.8。`review-v3-collage.jpg`（证据库），`gpu-report-v3.json`（仓库里）。

## 其余

| 路径 | 是什么 |
| --- | --- |
| `collage.jpg` | 总拼图（仓库里） |
| `compare/`、`compare-collage.jpg`（证据库） | 三次生成的素模对比（Blender workbench，同一套机位）：mv1 主线、mv2 槽位放错（两张脸）、mv3 放对；各七张：四面、右手正侧、左手 |
| `one/` | 样件居中的软件渲染：正投影（素/彩）、侧面、手部、佛前 10 m、长焦看脸、殿门；`report.json` |
| `group/` | 样件在本位（最西），另六位素泥：殿门 24 m 两季、cam03、殿门内、全素泥 |
| `group-centre/` | 样件在中位：殿门 24 m 两季、cam03 |
| `walk/` | 礼佛带、侧廊实走各取六帧的拼条，和带逐点遮挡统计的 `*-report.json`；录像和逐帧遮挡在私有桶 `films/` |
| `views/forearm-*.png` | 右前臂修前、修后（Blender，同一机位） |
| `gpu-report.json` | T4 Job `6b00defe4fdc5ab3c55c269d` 的完整报告 |
| `tripo-ledger.json`、`tripo-balance.json`、`tripo/` | Tripo 账本：任务号、点数、文件 SHA-256；每次前后的余额；上传和请求 |

除 `review/` 外的场景图是软件渲染（SwiftShader）；`compare/`、`views/` 是 Blender workbench。

## 模型在哪里

Tripo 原件（三次）、修过的、三档 LOD、输入图（`input-*.png`、`inputs-v2/`）、录像（`films/`）、账本放在私有桶 `hf://buckets/bolechen/temple-walk-render/keep/t05-shakyamuni-370/`，不进 git，也不进公开证据库（项目付费生成的资产）。SHA-256 见 `docs/t05/asset-register.csv` 和 `tripo-ledger.json`。
