# #726 T4 实拍：合书、墨叶、夜景

一次 t4-small（NVIDIA Tesla T4，ANGLE/Vulkan），运行 `20261125-160615`，Job `6b07085ed91f621b93085d92`；`report.json` 的 `site.commit` 是 `953849f1e98a7108242cf0cf2b85e7474658a883`（不带 `+dirty`），页面错误 0。
脚本 `tools/gpu/hour-after-book.cjs`：时钟设在 22:30，六印已有，坐山顶得第七印、走完收尾，打开书再合上；390×844、触屏、`q=high`、DPR 2。拍摄时页面的时钟（`performance.now`）定住，墨叶停在已知的点上：
- `this-1-book-open.png` 书打开（时辰仍是昼）；`this-2-first-frame-after-book.png` 合上后的第一帧（墨叶盖满，`scaleY(1)`，墨后面已是夜）；`this-3-ink-half.png` 墨开一半（`scaleY(0.5)`）；`this-4-night.png` 墨开尽后的夜景和提示行。
- `base-*.png`：对照，main `9cdfb5d`（没有这项改动）同一流程；合上书后时辰不变，这里用 `__mood` 手动设成夜，同一机位。
- `rows.json`：每一步的 `time`、`follow`、`lamp`；本次的合书后 221 帧里没有一帧是旧时辰（`framesWithOldHour: 0`）。
