# refs/：所有者认可的参考图

## 小沙弥的设定图

- **`monk-sheet-v5-2026-11-18.webp`：现行的设定图。** 所有者 2026-11-18 给的第五版四视图（正、左、背、右；睁眼，不带斗笠和念珠，腰带结在他自己的左前）。Tripo 第二轮就是从它生成的，Tripo 身体（#163 / #469，#469 合入后页面默认穿它）由此而来。文件按私有桶 `temple-walk-render/keep/tripo-2026-11-18/input/novice-fourview-v5-larger.webp` 原样拷来，没有重新编码（原件就是有损 WebP，再转成无损只会变大，不会多出东西）。SHA-256 记在 `docs/t00/asset-register.csv` 的 `REF-monk-sheet-v5` 一行。
- **`monk-apose-sheet-v1-eyes-closed.png`、`monk-apose-front-v1-eyes-closed.png`：第一版，闭眼。** 所有者最早用 GPT Image 出的 A-pose 三视图和正面图，带斗笠和念珠。代码身体（`monk.js`）和 Meshy 身体（`?body=sculpt`）是照它做的。2026-11-21 前它们叫 `monk-apose-sheet.png`、`monk-apose-front.png`，是 `refs/` 里唯一的设定图。#469 的美术审图拿它对照睁眼的 Tripo 身体，差点把睁眼判成走样，所以改了名，并放进第五版（T00 主创 2026-11-21 派）。

斗笠和念珠只在第一版里有；不带它们的第五版是为生成模型画的，游戏里两种身体都照旧背斗笠、挂念珠。
