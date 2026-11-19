# #275 举相机默认不虚化（PHOTO-02）证据

提交 8ef36c9（站点由 `tools/site.cjs` 从该提交构建）、软件渲染（SwiftShader）、夏·昼、`q=high`。

- `collage.jpg`：茶寮（tea）、第一进院（court）、山门前（cam04）各一行；左：举相机前；中：举起、虚化关；右：举起、虚化开。图含取景器与按钮（界面），所以逐像素比的是下面的 `probe` 亮度而非截图。640×360 下虚化半径按分辨率缩小，差别很浅；成片见下。
- `court-capture-off.jpg` / `court-capture-on.jpg`（不进 git，按 `MANIFEST.json` 用 `node tools/evidence.mjs pull docs/t00/evidence/photo-blur-275` 取）：快门拍出的大图（`__capture()`），关着不虚、开着虚（横向相邻像素差均值 3.14 → 1.85）。
- `report.json`：三处 `post.dof` = [举起前 false, 举起关 false, 开关打开 true]；`shot` 为 `?shot` 六个锁定机位高档的 `post.dof`（全 false）。
- `probe.cjs` 输出（三档 × 茶寮/首院，`__probe().lum` 举起前 → 举起后，开关关）：high 57.833→57.825、84.786→84.786；medium 61.085→61.084、85.939→85.940；low 59.503→59.505、92.209→92.218；`post.dof` 全为 false。差在 0.01 以内（噪声：飘叶与雾逐帧在动，同一画面连续两次取 `__probe` 也差这个量级）。
- 重出：`node run.cjs`、`node probe.cjs`（从 tools/out 起）。
