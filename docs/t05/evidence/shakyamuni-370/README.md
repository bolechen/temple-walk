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

`review-collage.jpg` 是这八张拼成的一张（仓库里）。

怎么重出：`SETS=lod370 tools/t05-gpu.sh <近> <中> <远>`（模型取法见下），review 一套在同一个 Job 里先出；软件渲染同样的图：`node tools/t05-hall.cjs tools/t05-hall/specs/sakyamuni-370-review.json`。

## 模型在哪里

Tripo 原件、修过的、三档 LOD、两张输入图、账本放在私有桶 `hf://buckets/bolechen/temple-walk-render/keep/t05-shakyamuni-370/`，不进 git，也不进公开证据库（项目付费生成的资产）。SHA-256 见 `docs/t05/asset-register.csv` 和 `tripo-ledger.json`。
