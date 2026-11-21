# #463 第一轮：进殿前六条（2026-11-21）

图由 `node tools/t05-hall.cjs tools/t05-hall/specs/t05-art-review.json` 用 SwiftShader 画；代码是本 PR 的提交（`report.json` 里有每张图）。毗婆尸用 `vipasyin-r4b.60000.glb`（修过的原件减面后烘了法线，SHA-256 开头 `7f65b760cec6fbbb`），其余六尊仍是 r3 / 释迦 r1。模型在本地 `tools/out/t05/tripo-six/`，不进 git。

- `collage.jpg`：上排原型（六尊；释迦的原型不在这一套），下面依次是正投影上色、10 m 仰看（`face10-*`）、10 m 平视（`level10-*`，新加），最下是 cam03、cam06（冬，不开灯）。
- `zones-on-screen.txt`：每张图里每尊每个分区的屏上平均色，亮度和对脸的比、色相、饱和（`zones: true`，`stage.js` 的 `zoneIds`）。「面与手」这一区包括手和颈，唇对它的比不是唇对脸颊的比。
- `vipasyin-face-measures.jsonl`：在修过的原件上量的三个数（`tools/t05-statue/face-measure.py`，点在 `vipasyin-r*-points.json`），第一行 r3，第二行 r4：唇前凸 0.031 → 0.021 w（要求 ≤ 0.03）；眉心褶深 0.002 → 约 0 脸宽（≤ 0.01）；嘴角高出嘴缝 −0.028/−0.020 → +0.026/+0.022 w（0–0.06）。眉的斜度没量（锚点未补）。
- `vipasyin-profile-r3-r4.png`：x = 0 的剖面线，鼻底到下巴最前点的连线和上唇最前点。
- `vipasyin-bake-before-after.png`：上未烘、下烘了法线；左仰看、右平视。

看图时注意：
- 七尊在平视里也有不同程度的撅嘴，所以不只是仰角；毗婆尸改过以后嘴仍小而紧，要美术总监看。
- 毗婆尸仰看时鼻孔下有一圈暗的，是烘焙把鼻孔的深凹带上来了，下一轮调笼子或射线距离。
- 两端两尊（迦叶、释迦）的座和背光对脸的比偏低（0.43–0.45、0.34–0.36），因为殿内光到两端暗，脸也暗。
