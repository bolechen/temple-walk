# #185 / #195 歇脚菜单分段：改前改后

歇脚菜单打开、时节已开（`body.seasons`），夏 · 昼，中文。

- **改后**（手机一张、宽屏一张，主创要求）：小标题为「眼 / 身 / 耳 / 意」，「分开调」在「耳」一行的右端，手机上四个语言按钮一行、都在底栏之上。T4 上画，`tools/gpu-render.sh t4-small`，运行 `20261118-084456`，Job 内页面约 47 秒（08:45:29 → 08:46:15 UTC）。站点指纹：提交 `459f8cc`，入口 `assets/index-D-FZwEKt.js`，111 个文件，SHA-256 `942be69cd43b78c7990aef21a3db6a2b65da69c59bb347f178b79d268e8c4983`。
  `menu-after-16x9.jpg`（1920×1080）。
- **改后手机**（重拍，邀请从窄屏菜单移除之后）：T4 运行 `20261118-091142`，约 29 秒（09:11:57 → 09:12:26 UTC）。站点指纹：提交 `638a599`，入口 `assets/index-B6XBdN9L.js`，111 个文件，SHA-256 `cbb193d0a07eb8ed013f4ed9237ac4895c1cee27ebf037a235ad6b06c31b91c8`。底栏之上没有任何露半截的字。`menu-after-phone.jpg`（390×844）
- **改前**（一张）：main `61d1b54` 构建的 `dist/`，1920×1080，本机 SwiftShader（菜单是纸面，与场景渲染无关；T4 的 Job 只能带当前分支的站点）。`menu-before-16x9.jpg`
- 此前两次 T4 运行未采用：`20261118-050538`（`ce6ddab`，浏览器语言成了英文，并发现宽屏两栏小标题没对齐）、`20261118-052240`（`6a9a44e`，小标题还是「看 / 手 / 声」，手机上 English、한국어 被底栏盖住）。四次合计约 3.5 分钟页面时间。

85% JPEG 压缩。

## 原图在哪里（#223）

本目录的图和录像（3 个文件：3 jpg，共 0.5 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/menu-185/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/menu-185/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/menu-185`。
