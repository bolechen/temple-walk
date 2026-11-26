# 735-merge：#735 合上 main 后的近景对比

证据库提交 `b9b2fec0fdce`。头 `d163727`（分支）对 `1d2ecd4`（main），`node tools/shots.js cam04 cam06 court@autumn-dusk@third`，软件渲染 1280×720，每图 `-branch` 与 `-main` 各一张（JPEG q88，原 PNG 超 1 MB）。

差异（逐像素，三通道和）：cam04 平均 0.44、cam06 平均 0.71、court 平均 0.71；差大于 30 的像素分别占 0%、0%、0.04%（只在远处屋面）。近处无变化。
