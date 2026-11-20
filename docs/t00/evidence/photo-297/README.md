# #297 举起相机后的三样按钮：改前改后

「设置」「快门」「收起」由左下、正中、右上三处，并成画面下方正中的一组（`index.html` 的 `#photoBar`、`ui.css`）。

- `collage.jpg`：改前（左）与改后（右），三种画幅：1280×720（16:9）、1024×768（4:3）、390×844 手机竖屏（触屏）。
- `swiftshader-before-*.jpg` / `swiftshader-after-*.jpg`：拼图的原图，另有 1920×1080。改前是本分支分出时的 `main`（`b56b380`）构建的 `dist/`，改后是 `306ddfe` 构建的 `dist/`（这一组按钮之后没有再动）。`?q=low&cam=0,30,0,0&view=first&season=summer&time=day&shot=1&lang=zh`，开三分线，SwiftShader 软件渲染。
- `t4-after-16x9.jpg`、`t4-after-4x3.jpg`、`t4-after-phone.jpg`：交活提交 `9a00b1b` 在 Tesla T4（Vulkan）上的高档画面，1920×1080、1440×1080、390×844，同一机位，开三分线；`tools/gpu-render.sh` 运行 `20261119-223332`，`report.json` 的 `site.commit` 为 `9a00b1b2baa56c0c2f86ef52e9038df462f45557`。

## 原图在哪里（#223）

本目录的图（12 个文件：12 jpg，共 2.2 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/photo-297/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/photo-297/<path>`。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/photo-297`。
