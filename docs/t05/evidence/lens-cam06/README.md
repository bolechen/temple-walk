# 每个命名机位可以有自己的镜头：cam06 第一人称 65°、第三人称 50°

`site.lens[name] = { first, third }`（`app/yard.js` 在 `?show=<name>` 时读它，`tools/cameras.mjs` 写进 camera-manifest）；T05 用它给 cam06 一个自己的镜头（`app/levels/t05/site.js` 的 `LENS`）。T00 没有 `lens`，一切照旧。

## 图

T4 运行号 `20261121-230459`（`gpu-report.json`），Tesla T4，高档，1280×720，夏昼。「前」是 main（`BASE_SITE`），「后」是本提交；`collage.jpg`：上排第一人称（52° → 65°），下排第三人称（44° → 50°），左前右后。四张原图在证据库（`MANIFEST.json`）。

## T00 不变（共用代码的守条件）

- `docs/t00/camera-manifest.json` 与 main 的逐字节相同（`git show origin/main:… | cmp`），`node tools/cameras.mjs` 跑后工作区无改动。
- `node tools/shots.js cam01 … cam06 court@autumn-dusk@third`（软件渲染，1280×720）在 main 和本分支各跑一遍，三角形和绘制调用数七处全部相同：cam01 964,845/230，cam02 643,481/99，cam03 1,929,112/418，cam04 1,926,620/392，cam05 964,628/147，cam06 1,919,384/350，court 1,997,064/394。
- 平均像素差（0–255）：cam01 0.272，cam02 0.231，cam03 0.104，cam04 0.142，cam05 0.083，cam06 0.129，court 0.167，全部 < 0.5。偏差最大的像素差 53–197，只占画面的 0.001%–0.06%；我没有量过 main 对 main 的底噪，所以不说这是底噪，只说是这个量。
- 两边的基线不是同一个提交：main 那一遍在 `54c1773d` 上起、跑的中途我又把它的 dist 在更新的 main 上重建过一次；本分支那一遍在合并更晚的 main 之前的提交上画（后来又变基过一次）。这几个提交之间动过的只有 T05 的文件、`app/src/walkgate.js` 和测试（`git diff --stat`），T00 的代码一行没变，所以我把两遍当作同一基线的比较；变基之后没有重画整套。

## 其它

`tests/unit/view-lens.test.mjs`（`lens` 只有 T05 有，cam06 的两个数；manifest 的 `fov_degrees` 是它的），e2e 场景 `view-lens`（`?show=cam06` 第一、第三人称各取一帧的镜头）。
