# #146 药师殿、观音殿上香：证据

软件渲染（SwiftShader，`q=low`），夏昼，提交 `f2247f2` 的构建。每殿六张 1280×720：

- `<hall>-brow.png`：举香至眉时刻，自动镜头的机位（rite 时钟 2 s）。
- `<hall>-brow-front.png`、`<hall>-brow-side.png`：同一时刻，从他身前、身侧看手与香。
- `<hall>-plant.png`、`-plant-front.png`、`-plant-side.png`：rite 时钟 8.9 s 处（按真实墙钟分步推进，落点与插香瞬间有几百毫秒偏差；这几张多半还是三拜之后、上前插香之前，手仍合着香；插香瞬间由 `rites-incense.test.mjs` 的位置断言覆盖，不靠图）。

三种画幅的机位图：`shot-incense-<hall>-1280x720.png`（16:9）、`-1024x768.png`（4:3）、`-390x844.png`（手机竖屏），`node tools/shots.js --size=WxH --tag=-WxH shot-incense-yaoshi shot-incense-guanyin` 出，是上香开始时自动镜头所在的机位；观音殿的机位改动原因见 HANDOFF 2026-11-20 条。

## 药师殿机位第二版（主创评审后）

`yaoshi-shot-v2-1280x720.png`、`-1024x768.png`、`-390x844.png`：药师殿上香机位改后的三种画幅。第一版沿用大殿的机位，像偏在画面最右、左半边空墙，右下角露出台座侧面一块没打光的黑面（`__pick` 查出是药师殿供台 `monolith` 的右端面，几何无误，只是从侧后方看过去是背光面）。第二版把机位挪近中线（右侧 2.2 m，原 3.2 m）、瞄向像与人之间，像居中，两座灯台入画，台座侧面不再出现。

上面 `yaoshi-brow*`、`yaoshi-plant*` 六张是第一版机位下拍的（`f2247f2`），观音殿的不受影响。
