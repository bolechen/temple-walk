# #114 地平线下不露天：改前改后（T4）

**现行证据在 `retake-213127-213147/`**（带 `site` 指纹，见其中 `report-*.json`）。本目录下原有的 `before-*.jpg`、`after-*.jpg`、`compare/`、`report-*.json` 是早先几次运行的图：与别的会话共用桶里的 `in/`、没有站点指纹，**不作证据，以 retake 为准**（按 AGENTS.md，证据只增不改，原件保留）。

- retake 里的改前 `before-*.jpg`：`origin/main` a5ed417，Job 20261116-213127，站点指纹 sha256 47640699…（入口 index-C_qXz-p1.js）。
- retake 里的改后 `after-*.jpg`：本分支 df821cc（已合入当时的 main），Job 20261116-213147，站点指纹 sha256 92e99780…（入口 index-DWpnq3qw.js）。
- 两次运行在同一块 T4 机型、高档、1600×900（入库缩成 1280×720），分别在 `runs/<run>/` 下各自暂存，互不覆盖；起止时间错开 20 秒。
- `compare/<视角>_<季节-时辰>.jpg`：左改前、右改后。视角：`bamboo-s/e/w/n` 竹林起点（21.3, 91.6）南东西北；`lx-e`、`lx-w` 凌霄阁前向东、西；`stair-out` 石阶转折处向外；`lookback` 山顶回望；四种季节时辰 summer-day、autumn-dusk、winter-day、spring-dawn。
- 竹林起点向南左侧林坡平均明度（灰度，行 250–600、列 0–600）：夏昼 40.8→40.5，秋暮 49.7→49.5，冬昼 79.4→79.1，春晨 86.7→86.4（差 −0.3～−0.6%）。
- 重现：`node tools/horizon-spec.cjs before|after > spec.json`，再 `tools/gpu-render.sh t4-small "$(cat spec.json)"`。`spec-*.json` 是当时用的。
