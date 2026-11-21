# #467 首院铺地：小石板、树冠遮光、积水去直边，art3 站到枫树下

对照 `docs/ART-REVIEW.md` A4。T4（Tesla T4，ANGLE/Vulkan）上画的，1920×1080，高档。

- `collage.jpg`（在仓库里）：原型 03；art3 秋暮改前（旧机位，即 `court`/`cam06` 的位置）和改后；cam06 夏昼改前改后。
- 原图（在 Hugging Face 数据集，见 `MANIFEST.json`）：`before-*.png` 是 main（`dabfc33`，PR 的父提交）、`after-*.png` 是本分支；`art3`、`cam06` 之外还有七个季节时辰的 `court` 第三人称，看没有变差的地方（雪、湿石、春晨、夜）。
  - `after-art3-autumn-dusk.png`：`?show=art3&season=autumn&time=dusk&view=third`
  - `after-cam06-summer-day.png`：`?show=cam06&season=summer&time=day&view=first`
  - `before-art3-old-pose-autumn-dusk.png`、`before-court-*`：main 上的 `?show=court&…&view=third`
- `metrics.json`：`node tools/ground-metrics.cjs` 量的画面下三分之一（亮度方差、边缘密度）和 cam06 整幅的 L05/L50/L95；缝的屏幕宽度是 `node tools/joint-rows.cjs` 从页面里取的（`joint-rows.json` 有逐行数据）。
- `bench.json`：T4 同一个 Job 里 main 和本分支交替三次的 `__cost`（画一帧的毫秒）。
- 提交：画图和量帧耗的 T4 运行号 `20261121-080207`（帧耗，本分支 `4c57335`）、`20261121-081044`（最终图，本分支 `8fb2f3d`，缝半宽 4.5 毫米）。帧耗在缝宽改动之前量，缝宽只是一个常数，不影响耗时。
- 复现：`BASE_SITE=<main 的 dist> tools/gpu-render.sh t4-small '<spec>'`，spec 里 `shots` 用 `{ file, query, path: "base/index.html" }` 画 main 的页面（`tools/gpu/job.cjs` 这次加了 free shot 的 `path`）。
