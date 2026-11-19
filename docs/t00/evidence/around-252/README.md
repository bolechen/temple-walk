# 绕一圈普查（#252）的证据

- 运行：Hugging Face Job `6afea1e2e41aae15936d29f0` 之后的第二次完整运行，**运行号 `20261119-072233`**，一张 T4（`ANGLE (NVIDIA, Vulkan 1.4.357 (NVIDIA Tesla T4))`），作业内 07:23:20–07:27:48 UTC，**出图 2000 张用时 254 秒，作业共约 4.5 分钟，整条命令（含上传、取回）6 分 08 秒**；此前一次试跑 1.5 分钟、一次完整运行（无佛像，已作废）6.7 分钟；T4 合计约 19 分钟，约 0.13 美元。
- 站点指纹（`t4-report.json` 的 `site`）：提交 `3004217614bc1ddcf87095ed2e021b99cfd8b5b7`，入口 `assets/index-CF4lCeyp.js`，152 个文件，SHA-256 `ba6682fb8e52dd0a90557101e20c114e365805a5b83a946cdc760a25978319da`（带着佛像与台座：`KEEP_MODELS=1`）。
- `shots.json`：2000 张的清单（类、件、方向、站位、`?cam=` 地址）；400 张是各件各方向，1600 张是 200 个游客眼 × 四向 × 平视/仰 20°。原图 39 MB 留在渲染桶 `runs/20261119-072233` 的输出里，不进仓库。
- `collage.jpg`（进仓库，256 KB）：每件东西的背面（或北面）一格，70 件。`sheets/` 是接触表（29 张，只在数据集里；`node tools/evidence.mjs pull docs/t00/evidence/around-252` 取回）：`items-<类的英文名>.jpg`（plaque、building、hall-door、places、seat-*、bell-drum、censer、frame、offering-box、altar、rail、cedar、tree、post） 每行一件、每列一个方向（正、右、背、左、斜俯视；无正面的东西用南东北西）；`visitors-NN.jpg` 每张 20 个游客眼，每行八格（平视四向，仰 20° 四向）。
- `screen-wall-3views.jpg`：照壁的正面、背面、斜看，软件渲染，640×360，对应报告里的第一条。
- 重出：`tools/around-gpu.sh`（写明的命令见 `CLAUDE.md`）；接触表 `python3 tools/around-sheet.py <shots dir> <out> --collage collage.jpg`。
