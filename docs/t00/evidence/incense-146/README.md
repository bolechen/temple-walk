# #146 药师殿、观音殿上香：证据

软件渲染（SwiftShader，`q=low`），夏昼，提交 `f2247f2` 的构建。每殿六张 1280×720：

- `<hall>-brow.png`：举香至眉时刻，自动镜头的机位（rite 时钟 2 s）。
- `<hall>-brow-front.png`、`<hall>-brow-side.png`：同一时刻，从他身前、身侧看手与香。
- `<hall>-plant.png`、`-plant-front.png`、`-plant-side.png`：rite 时钟 8.9 s 处（按真实墙钟分步推进，落点与插香瞬间有几百毫秒偏差；这几张多半还是三拜之后、上前插香之前，手仍合着香；插香瞬间由 `rites-incense.test.mjs` 的位置断言覆盖，不靠图）。

三种画幅的机位图：`shot-incense-<hall>-1280x720.png`（16:9）、`-1024x768.png`（4:3）、`-390x844.png`（手机竖屏），`node tools/shots.js --size=WxH --tag=-WxH shot-incense-yaoshi shot-incense-guanyin` 出，是上香开始时自动镜头所在的机位；观音殿的机位改动原因见 HANDOFF 2026-11-20 条。
