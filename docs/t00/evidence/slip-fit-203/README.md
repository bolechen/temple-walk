# 藏经楼纸条放得进屏（#203）证据

画法：`node tools/slip-views.cjs <outdir> --prefix=before|after`。韩文，`?seed=8`（藏经楼的长句：「春有百花秋有月……」），夏昼，`q=low`（软件渲染），经 `fast=1` 走完取纸条。竖屏 390×844、横屏 844×390（触屏模拟）、宽屏 1280×720。

- `before-ko-side.jpg`：main `3261063`，页面被撑到 891 px，纸出屏（竖排列数太多）。
- `after-ko-side.jpg`：本分支，字缩到 24 px，竖排不变，纸在屏内。
- `*-upright.jpg`、`*-wide.jpg`：没有变（竖屏、宽屏上原样放得下）。
- 没有上 T4。

## 原图在哪里（#223）

本目录的图和录像（6 个文件：6 jpg，共 0.4 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/slip-fit-203/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/slip-fit-203/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/slip-fit-203`。
