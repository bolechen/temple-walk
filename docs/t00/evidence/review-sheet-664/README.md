# 审图拼图（review-sheet）校准：盘坐 #664

`node tools/review-sheet.cjs shot-sit` 和 `sit:main`（殿里佛前第一个蒲团），在两个提交上各跑一遍：

- `-main`：main `cdc3bb4`（0.8.0 的盘坐，美术总监判不通过的那版）
- `-9ad0b8b`：PR #666 的 `9ad0b8bc`（美术总监判过「美术通过」的那版）

两边都只多了本 PR 的审图钩子（`app/src/review.js` 和 yard.js 两行），小沙弥的形没动。软件渲染（SwiftShader）960×540，`q=medium`，夏昼。

`collage.jpg` 从上到下：shot-sit main、shot-sit 9ad0b8b、殿里蒲团 main、殿里蒲团 9ad0b8b；每张三列（原机位、侧面、俯视 60°），上排正常画面加标尺，下排按部位平涂色加场景边线（品红皮肤、黄手、青袍、绿裤、蓝鞋、红其他）。各张 PNG 在证据库，见 MANIFEST.json。

| 机位 | 提交 | 手可见占比（最好的机位） | 袍摆前沿比膝头高 | 判 |
|---|---|---|---|---|
| shot-sit | main | 3.1% | +9.8 cm | 手被埋、袍摆高 |
| shot-sit | 9ad0b8b | 42.0% | −3.6 cm | 过 |
| 殿里蒲团 | main | 6.7% | +9.8 cm | 手被埋、袍摆高 |
| 殿里蒲团 | 9ad0b8b | 42.4% | −3.6 cm | 过 |
