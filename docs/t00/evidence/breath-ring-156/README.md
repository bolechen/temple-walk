# 静坐呼吸圈（#156）证据

提交：见 PR。画法：`node tools/breath-views.cjs <outdir> --prefix=before|after`，夏昼，`q=low`（软件渲染），观察者时钟被按住（`__riteClock`）以便同一时刻可重拍；「full」是吸满时，「empty」是呼尽时。16:9 为 1600×900，4:3 为 1200×900，手机竖屏为 390×844（2×）。

- `before-*`：main `9410413`。呼吸圈是屏幕上固定的圆，「吸」字叠在脸上。
- `after-*`：本分支。圆相画在地上，字在底部；`-behind` 是自动镜头关闭、身后跟拍。
- 只拍了中文；英文、日文、韩文的手机图没有拍全（软件渲染一张十几分钟），字的不裁由 `tools/mobile-audit.cjs` 的 `sit`/`sitsay` 面和 `--lang=` 审计负责。T4 图见 PR。
