# #185 标题页改前改后

「七处小事 · 七枚朱印」由 13 px、`--on-2` 改为 14 px、`--on` 并加一层字影（`ui.css` 的 `#title .how`）。

- 改前：`main` 上 `f22b9ab`（#179 合入后）构建的 `dist/`
- 改后：本 PR `f7d4bb9` 构建的 `dist/`
- 三种画幅：1280×720（16:9）、1024×768（4:3）、390×844 手机竖屏（触屏）
- `?q=low&season=summer&time=day`，SwiftShader 软件渲染，标题页未入山

`title-before-*.jpg` / `title-after-*.jpg`，由 85% JPEG 压缩。

## 原图在哪里（#223）

本目录的图和录像（6 个文件：6 jpg，共 0.4 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/ux-185/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/ux-185/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/ux-185`。
