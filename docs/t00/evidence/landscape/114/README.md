# #114 地平线下不露天：改前改后（T4）

- `before-*.jpg`：`main`（67f1d27）上的原样；`after-*.jpg`：本分支。同一条命令、同一块 T4、高档、1600×900（这里缩成 1280×720 入库）。
- `compare/<视角>_<季节-时辰>.jpg`：左改前、右改后。
- 视角：`bamboo-s/e/w/n` 竹林起点（21.3, 91.6）南东西北；`lx-e`、`lx-w` 凌霄阁前向东、西；`stair-out` 石阶转折处向外；`lookback` 山顶回望。四种季节时辰：summer-day、autumn-dusk、winter-day、spring-dawn。
- 重现：`node tools/horizon-spec.cjs before|after > spec.json`，再 `tools/gpu-render.sh t4-small "$(cat spec.json)"`。`spec-*.json` 是当时用的。`report-*.json` 含三角面、绘制次数和 `cost`。
- 改后图是最后一次运行（Job 20261116-190632）；前两次改后运行（成因排查中间版本）没有入库。
