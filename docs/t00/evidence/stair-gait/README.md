# 上下台阶步态（#270）

`stair-strip-collage.jpg`：上、下各自从正面、侧面、背后，每行 8 帧（一个完整步幅），每组上为 main，下为本分支。
`stair-strip-full.png`：同一张的无损版，放证据库。`gait-after.txt`：`node tools/gait-stairs.mjs --speed=1.25,0.714,0.952` 的输出（1.25 为旧速度，作对照）。
重做：`node tools/stair-strip.cjs`、`node tools/gait-stairs.mjs`。

第二版（`*-2.*`，骨盆跟脚阻尼 30→12、守卫测试改量真实步速）取代上一版的数与图；上一版文件按规矩不删。

> 其余图片（本目录 `MANIFEST.json` 列着的）在证据库，不在 git：`node tools/evidence.mjs pull <本目录>` 取回到 `tools/out/evidence/`，每张的地址是 `base + rev + 路径`（见 `MANIFEST.json`、`tools/evidence.config.json`）。每个证据目录在 git 里只留一张拼图。
