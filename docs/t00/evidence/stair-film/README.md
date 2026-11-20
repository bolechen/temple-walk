# 页面里的台阶逐帧（#270）

三处各上、下一段，改前（main 的构建）与改后（head `ee6790c` 之上）并排：山路长阶（进山第一段，z 75→64）、大殿前（八级，z −0.9→−3.6）、凌霄阁前（14.8 m 长阶，z −90.5→−118.4）。
页面的时钟和 `requestAnimationFrame` 被换成手动步进（`tools/stair-film.cjs`，每帧 1/30 s，按住 W，每 4 帧取一张，7.5 张/秒），所以软件渲染慢也不丢帧；跟拍是玩家平时的第三人称，侧面是从他右侧 1.5 m 的 `__look`。画面 400×260、`?q=low`。
`<处>-<up|down>.webm`：2×2，上排跟拍（左改前、右改后），下排侧面。三处合计 27 s。`stair-film-collage.jpg`：每段每行 6 帧。`*-trace.json`：每 0.133 s 的位置、地面高度。
改前的构建没有门洞烘焙（只构建了 Vite 部分），一处 404 来自那里，与台阶无关。
重做：`TEMPLE_SITE=<main 的 dist> node tools/stair-film.cjs --label=before`、`node tools/stair-film.cjs --label=after`、`python3 tools/stair-film-sheet.py`。
