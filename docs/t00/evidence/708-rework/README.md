# 708-rework：改前（main f3caf01）与改后（本 PR）对照

手机尺寸 390×844，低档（`?q=low`），`tools/shots.js --level=<id> --size=390x844 --query=q=low`，SwiftShader 软件渲染，夏日白天。

- T00：forecourt、court、eavecorner、loft（`*-before.png` / `*-after.png`）
- T05：arrive、a、b、terrace

改动都在 3–6 mm 以内，画面上本来就看不出区别；逐像素对比差异超过 8 级的点：a 64、arrive 2、b 403、court 12、eavecorner 66、forecourt 229、loft 3、terrace 889（均在整幅的 0.3% 以内，是原来闪烁的那几处面）。
这是软件渲染，不是 T4 实拍；T4 实拍待定。
