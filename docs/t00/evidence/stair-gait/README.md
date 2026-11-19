# 上下台阶步态（#270）

`stair-strip-collage.jpg`：上、下各自从正面、侧面、背后，每行 8 帧（一个完整步幅），每组上为 main，下为本分支。
`stair-strip-full.png`：同一张的无损版，放证据库。`gait-after.txt`：`node tools/gait-stairs.mjs --speed=1.25,0.714,0.952` 的输出（1.25 为旧速度，作对照）。
重做：`node tools/stair-strip.cjs`、`node tools/gait-stairs.mjs`。
