# 牌坊生成器的三向图（#433）

2026-11-21，分支 `feat/paifang-generator`，提交 `2727231`（`app/src/paifang.js` 之后未再改）。软件渲染（SwiftShader），1200×800，真材质、一个太阳一片天，舞台是 `tools/paifang-stage/`，出图命令 `node tools/paifang-views.cjs`。颜色不代表 T05 的最终色调，看形体和比例。

- `views/paifang-front.png`、`-side.png`、`-top.png`：正、侧、俯，正射的平面图。
- `views/paifang-iso.png`（斜前）、`-gate.png`（从来路望，对照 `refs/t05-concept-2026-11-20/03-axis-from-inner-gate.webp`）、`-under.png`（檐下）、`-low.png`（近看）。
- `collage.jpg`：七张加目标图（右下），按 正、侧、俯、斜前 / 来路、檐下、近看、目标图 的顺序。
- `census.json`：三角形 13,874（按材质分项）、50 个网格、9 种材质。

原图在证据库里，不进 git；地址见 `MANIFEST.json`。
