# litter-267 证据（#267，PR #269）

## 原图在哪里（#223）

本目录的图和录像不在仓库里（只留这份说明、文本和一张不超过 1 MB 的拼图 `collage.jpg`）：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/litter-267/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/litter-267/<path>`。整目录取回：`node tools/evidence.mjs pull docs/t00/evidence/litter-267`。

## 各文件

| 文件 | 是什么 | 怎么重出 |
|---|---|---|
| `collage.jpg` | 三种画幅（16:9、4:3、手机竖屏）改前改后并排：秋昼第一进院枫树下，改前（main `cfb9f01`）、改后站 180 秒（软件渲染） | `node tools/litter-views.cjs --cam=-7.5,33,-0.38,-0.42 --at=180 --size=960x540`（改前在 `cfb9f01` 的构建上 `--at=0`） |
| `film-autumn-day-90-150s.mp4` | 秋昼枫树下一分钟（页面时钟 90–150 秒：静 → 一阵风 → 稀下来），T4 上逐帧画，12 帧/秒 | `EXTRA_FILES=tools/gpu/litter-film-job.cjs tools/gpu-render.sh t4-small '{"script":"litter-film-job.cjs","args":{"from":90,"secs":60,"fps":12}}'`；运行 `20261119-112414`，站点 `e77ddde` |
| `film-calm-gust-after.jpg` | 录像里三帧：静（95 秒）、阵风中（125 秒）、阵后（148 秒） | 同上 |
| `densities-three.jpg` | 三档疏密同一机位：原来稳定落叶（`__fall(-1)`）、现在（`__fall(1)`）、再减半（`__fall(0.5)`），各取静、阵风、阵后三刻（软件渲染，`6fbd357` 时的版本：静时 6.6%；现在静时 1.7%） | `node tools/litter-views.cjs --cam=-7.5,33,-0.38,-0.32 --at=46,128,213 --size=640x360 --fall=<k>` |
| `t4/*.jpg` | T4 上秋昼、秋暮、秋夜、春昼的院景与枫树下近景，各先跑 300 秒落叶；另有低档枫树下一张 | 运行 `20261119-112302`，站点 `e77ddde` |
| `t4/report-*.json` | 各次 T4 的完整报告（帧耗、指纹、错误） | 见 PR 正文 |
| `after-180s.json` | 改后 180 秒时地面记录的数（记着的叶、堆、落下的总数） | `litter-views.cjs` 写出 |

## 帧耗怎么量

同一个 Job 里，把 main 的构建放在 `base/` 下（`BASE_SITE=… tools/gpu-render.sh`），与本分支交替，每种各量 5–7 次，报配对差的中位数；本分支先 `__litter(300)` 让地上积满五分钟的叶。`?off=litter` 是同一构建关掉地面记录。早先几次的「旧」用的是 `?off=litter`，那时整数纹理采样器没有绑纹理、WebGL 拒画整块铺地，差值被夸大，见 PR 正文。
