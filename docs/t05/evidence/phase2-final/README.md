# T05 第二阶段出口：七机位加到达点的冬昼 J01 图，与累计帧耗（8f231c9）

数和读法在 `docs/t05/PHASE2-COST.md`「出口重量」一节。

- T4 Job `20261125-102727`，Tesla T4，ANGLE/Vulkan，站点提交 `8f231c9d`（不带 `+dirty`），入口 `assets/index-CWpOYl09.js`，388 个文件，sha256 `c7e31816…e4b0`（`report.json` 的 `site`）。
- 图：T05 cam01–cam07 与到达点，冬昼 J01，高档 1920×1080，`?shot=1`。PNG 在证据库，仓库里只留 `collage.jpg`（八张缩到 640×360，左到右、上到下：arrive、cam01 … cam07）。
- 帧耗：同一个 Job 里 `8f231c9d`（head）与 `29fd055`（#685 时的 main，`base/`）交替量，夏昼与冬昼的 cam02、到达点各三轮，冬昼 cam03、cam07 各两轮。
- `spec.json` 是交给 Job 的原样配置，`report.json` 是带回来的原样报告，`count.mjs` 数合批（用法见其首行与 `evidence/phase2-cost/count.mjs`）。
