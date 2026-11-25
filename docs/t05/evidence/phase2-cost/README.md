# T05 第二阶段出口：T4 帧耗（只量 `__cost`，不拍图）

数和读法在 `docs/t05/PHASE2-COST.md`。

- `report-winter.json` / `spec-winter-and-first-attempt.json`：Job `20261125-063345`，站点 `29fd055`，冬昼 J01，arrive 与 cam01–cam07 各一次。这个 Job 里夏昼拆分那 36 行因基线站点没送进去而全部报错（脚本补丁没插上，已修），只有 head 的 6 行有效，只在 `PHASE2-COST.md` 第四节拿来说明 Job 与 Job 之间的差。
- `report-split.json` / `spec-split.json`：Job `20261125-063910`，夏昼，六个提交各一份站点在同一个 Job 里交替量（arrive、cam03、cam07，各两轮，第二轮倒序），站点提交 `9cc3b7f`（与 `29fd055` 的 `app/` 相同，多的只是 `tools/`）。
- 两个 Job 都是 t4-small（Tesla T4），ANGLE/Vulkan，高档 1920×1080，没有页面错误。
