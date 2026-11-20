# #275 举相机默认不虚化（PHOTO-02）证据

提交 8ef36c9（站点由 `tools/site.cjs` 从该提交构建）、软件渲染（SwiftShader）、夏·昼、`q=high`。

- `collage.jpg`：茶寮（tea）、第一进院（court）、山门前（cam04）各一行；左：举相机前；中：举起、虚化关；右：举起、虚化开。图含取景器与按钮（界面），所以逐像素比的是下面的 `probe` 亮度而非截图。640×360 下虚化半径按分辨率缩小，差别很浅；成片见下。
- `court-capture-off.jpg` / `court-capture-on.jpg`（不进 git，按 `MANIFEST.json` 用 `node tools/evidence.mjs pull docs/t00/evidence/photo-blur-275` 取）：快门拍出的大图（`__capture()`），关着不虚、开着虚（横向相邻像素差均值 3.14 → 1.85）。
- `report.json`：三处 `post.dof` = [举起前 false, 举起关 false, 开关打开 true]；`shot` 为 `?shot` 六个锁定机位高档的 `post.dof`（全 false）。
- `probe.cjs` 输出（三档 × 茶寮/首院，`__probe().lum` 举起前 → 举起后，开关关）：high 57.833→57.825、84.786→84.786；medium 61.085→61.084、85.939→85.940；low 59.503→59.505、92.209→92.218；`post.dof` 全为 false。差在 0.01 以内（噪声：飘叶与雾逐帧在动，同一画面连续两次取 `__probe` 也差这个量级）。
- 重出：`node run.cjs`、`node probe.cjs`（从 tools/out 起）。

## 补充（主创评审后，提交 429d5fc 的代码）

- `shot-main-vs-branch.jpg`（不进 git，`pull` 取）：高档 `?shot=1` 的 cam06（第一个院落）与 cam04（山门正面），左 main、右本分支，960×540。`post` 状态：main `dof:true focus:18`，分支 `dof:false`。整帧绝对差均值 2.04 / 0.94（含飘叶与雾逐帧在动的噪声，以及虚化本身）。差别只在虚化；受影响的高档 `?shot` 基线/证据本 PR 不重拍。
- `cam06-capture-off.jpg`（不进 git）：高档、举相机、虚化关的快门成片（3058×2033）：近处石板、香炉，远处大殿与山都清晰（横向相邻像素差均值 3.13，与上面 court 关着时 3.14 同量级；开着为 1.85）。成片脚注里的 `127.0.0.1:端口` 是工具本地服务器的地址，不是本 PR 引入的，见 PR 评论。
- `cmp.cjs`：生成上面各图（`TEMPLE_SITE=<main 的 dist> node cmp.cjs main` / `node cmp.cjs branch`）。
