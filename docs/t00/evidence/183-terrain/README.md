# #183 远景地形试验：对照图与 T4 帧耗

- 提交：`49c061d`（`report.json` 的 `site.commit`，没有 `+dirty`），T4 Job `20261121-064630`，ANGLE on Vulkan，Tesla T4。
- 每个机位三张：`-rings` 是现在的山环（默认页面），`-made` 是 `?terrain=made`（按五峰做出来的高度图），`-dem` 是 `?terrain=dem`（真实高程裁出来的高度图，只在本地和这次 Job 里画过，不进 git，原因见报告）。
- J01 夏昼，高档 1920×1080；`art1` 为 1920×804。`opening0-*` 是开场第一格（入山后 `__openingAt(0)`）。
- `sheet.jpg`：六行（opening0、cam01、cam04、cam06、art1、loft）三列（rings、made、dem）的拼图。
- `bench.json`：首院 cam06 和山顶 loft，rings → made → dem 交替三轮，每次 `__cost(40)`。
- 报告：`docs/t00/refactor/terrain-spike.md`。
