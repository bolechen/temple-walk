# 静坐呼吸圈（#156）证据

提交：见 PR。画法：`node tools/breath-views.cjs <outdir> --prefix=before|after`，夏昼，`q=low`（软件渲染），观察者时钟被按住（`__riteClock`）以便同一时刻可重拍；「full」是吸满时，「empty」是呼尽时。16:9 为 1600×900，4:3 为 1200×900，手机竖屏为 390×844（2×）。

- `before-*`：main `9410413`。呼吸圈是屏幕上固定的圆，「吸」字叠在脸上。
- `after-*`：本分支。圆相画在地上，字在底部；`-behind` 是自动镜头关闭、身后跟拍。
- 只拍了中文；英文、日文、韩文的手机图没有拍全（软件渲染一张十几分钟），字的不裁由 `tools/mobile-audit.cjs` 的 `sit`/`sitsay` 面和 `--lang=` 审计负责。T4 图见 PR。

## 原图在哪里（#223）

本目录的图和录像（16 个文件：16 jpg，共 1.7 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/breath-ring-156/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/breath-ring-156/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/breath-ring-156`。
