# #271 第三人称构图：改前 / A / B 对照

- `sheet-16x9.jpg`、`sheet-4x3.jpg`、`sheet-phone.jpg`（在 Hugging Face 数据集，见 `MANIFEST.json`；`collage.jpg` 是三张并排的缩小版，在仓库里）：每张一种画幅，每行一条路线（院心直走、绕香炉、贴柱列、贴白墙、半山亭台阶上行、下行），每列一套镜头：改前（main `11496b1` 的检出里画的）、A（`?frame=a`，只出贴柱列和台阶）、B（默认）。取每条路线六个点里的第三个；红十字是他的中心，左下角是它在画面宽、高里的百分比，白线是三分线。软件渲染（SwiftShader）、`q=low`、夏日白天，960×540 / 720×540 / 300×650 缩小拼版。
- `routes-main.json`、`routes-branch.json`：`node tools/frame-routes.mjs` 在 main 和本分支各跑一次的全表（六条路线 × 三种画幅；横向、纵向、脚和膝入框、被藏的帧）。
- 复现：`node tools/frame-views.cjs <dir> --frame=b,a --at=2`（改前在 main 的检出里跑 `--frame=old`），`python3 tools/frame-sheet.py <main 的图> <本分支的图> --out <dir>`。
- 说明和分析：`docs/t00/frame-271.md`。
