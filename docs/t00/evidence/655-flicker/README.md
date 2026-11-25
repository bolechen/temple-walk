# #655 闪面归因准备（0.8.0，ac28f32）

只做归因，不改游戏。

- `node tools/zfight-scan.mjs`：在 Node 里按页面的真材质建出场景（site、ground、backdrop、props、trees、各殿内景），列出
  同一平面、同法线、间距 < 2 mm 且面积 ≥ 1 cm² 的重合面（`coplanar.json`），以及 `transparent && depthWrite` 的贴片
  （`transparent.json`）；每处有世界坐标、`part`、`material`（`__pick` 的口径）、离常走路线的距离、从路线哪些眼位能看见它
  （从路线每 3 m 一个眼位射线到重合处，对着全部已画三角形），并按 24 位 / 16 位深度算出多远以外分不开。
- `node tools/zfight-views.cjs [--touch]`：把自由镜头摆到扫描找到的“路线上看得见它”的眼位，拍 1、1/2、1/4 距离的近景，
  再以 1 mm 步长横移镜头读回一格点的颜色，数有多少点跳色（静止场景里只有深度测试会改变像素）。
- `collage.jpg`：五处（桌面 800×500）加三处（触屏 390×844）的中距离近景。`views-desktop.json`、`views-touch.json`：每处三种距离的跳色比例。
  `stats.json`：扫描的总数。完整 `coplanar.json`（约 3,400 条）不进库，重跑一遍 30 秒。

软件渲染（SwiftShader）的深度缓冲比手机的深，所以这里不闪不等于手机上不闪；16 位的结论来自公式，不是实测。
