# 牌坊生成器的三向图（#433）

2026-11-21，分支 `feat/paifang-generator`，提交 `2727231`（`app/src/paifang.js` 之后未再改）。软件渲染（SwiftShader），1200×800，真材质、一个太阳一片天，舞台是 `tools/paifang-stage/`，出图命令 `node tools/paifang-views.cjs`。颜色不代表 T05 的最终色调，看形体和比例。

- `views/paifang-front.png`、`-side.png`、`-top.png`：正、侧、俯，正射的平面图。
- `views/paifang-iso.png`（斜前）、`-gate.png`（从来路望，对照 `refs/t05-concept-2026-11-20/03-axis-from-inner-gate.webp`）、`-under.png`（檐下）、`-low.png`（近看）。
- `collage.jpg`：七张加目标图（右下），按 正、侧、俯、斜前 / 来路、檐下、近看、目标图 的顺序。
- `census.json`：三角形 13,874（按材质分项）、50 个网格、9 种材质。

原图在证据库里，不进 git；地址见 `MANIFEST.json`。

## 第二版（r2，提交 `0c9caf6`）

主创对 #438 的评审：夹杆石太小太白、檐薄而浅、次楼与明楼相接像两块板。改后重出，文件名带 `r2-`：`views/r2-paifang-*.png`、`collage-r2.jpg`（版式同上）、`census-r2.json`（三角形 16,796、56 个网格、9 种材质）。第一版的文件原样留着，作改前对照。

## 第三版（r3，提交 `462a6ba`）

美术总监对第二版的评审（#438 评论）：上半截太高太空、柱显矮。改五个数并修四处，只出两张：`views/r3-paifang-front.png`（正）、`views/r3-paifang-gate.png`（从来路望），加 `compare-r3.jpg`（左：目标图里的牌坊裁出来，右：这一版的正面图，同样高度对齐）、`census-r3.json`（三角形 16,892、60 个网格、10 种材质）。舞台的光改成偏阴天（太阳 1.1、天光 1.25），贴近 J01，减少平面被晒白。
