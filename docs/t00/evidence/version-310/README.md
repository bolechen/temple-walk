# #310 歇脚菜单底部、鸣谢页末尾的版本行：改前改后

- `collage.jpg`：上排桌面 1280×800，改前、改后样式一（`云径禅寺 v0.5.0`）、改后样式二（`v0.5.0 · 163c224`）；中排手机竖持 390×844，改前、样式一、样式二、canary、预览；下排把四种版本行放大。
- `menu-before-*.jpg`：本分支分出时的 `main`（`d756748`）构建的站点。
- `menu-prod-name-*.jpg` / `menu-prod-commit-*.jpg`：本 PR `163c224` 用 `VITE_DEPLOY=production` 构建，样式二由 `__version("commit")` 当场重写。
- `menu-canary-*.jpg`、`menu-preview-*.jpg`：同一提交，用 `VITE_DEPLOY=canary` 和 `VITE_DEPLOY=preview VITE_PR=311` 构建。
- `credits-prod-desk.jpg`：鸣谢页滚到底的样子。
- 都是 `?q=low&cam=0,30,0,0&view=first&season=summer&time=day&lang=zh`，打开菜单并滚到底；SwiftShader 软件渲染，deviceScaleFactor 2。

## 原图在哪里（#223）

本目录的图（12 个文件，共 3.6 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/version-310/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号。整目录取回：`node tools/evidence.mjs pull docs/t00/evidence/version-310`。
