# T05 第一阶段测量（白盒基线）：T4 帧耗与七个机位

`PLAN.md` 第 13 项（`docs(t05): phase one measured`）。数和量法见 `docs/t05/BASELINE.md`。

- T4 运行 `20261121-234211`，Tesla T4，Chromium 走 ANGLE/Vulkan。
- 站点：提交 `31e9ebf`（不带 `+dirty`），入口 `assets/index-DRSS-egP.js`，184 个文件，sha256 `43a8883f…0422a945`（`report.json` 的 `site`）。
- 量法：T00 首院 `court`、T05 cam03（第三人称）、cam06、cam07，高档 1920×1080、低档 960×540，各三轮。每轮先高档后低档，奇数轮四处倒过来排。每处等眼睛的层次结构建好再加 3 秒，量 6 秒帧率和 `__cost(40)`。
- 七张图：T05 cam01–cam07，夏昼高档 1920×1080，`?shot=1`。PNG 在证据库，仓库里只留 `collage.jpg`。
- `spec.json` 是交给 Job 的原样配置；`report.json` 是 Job 带回来的原样报告。
