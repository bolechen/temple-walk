# #271 眼睛不跳：两条路线逐帧

- `censer-b-v2.jpg`：从香炉正后方往北走过香炉。`gate-b-v2.jpg`：从门前斜着走进山门门洞。默认镜头 B，软件渲染（SwiftShader）、480×270、`q=low`，走路时尽快截的每一张图，按先后排。（`-v2` 是臂改成绕他的头转以后重拍的，`report.json` 是这一次的数；不带 `-v2` 的两张是平移臂那一版）这几张图在 Hugging Face 数据集里，见 `MANIFEST.json`。
- `report.json`：页面里每一帧记录的眼睛和他的位置算出来的数。`mostPerFrame` 是每帧眼睛除了跟着他走以外自己移动的最大值（软件渲染一帧约 0.1 秒），`mostAt60` 是折合每秒 60 帧的值（`follow.test` 的上限是 0.15 m）。`across` 是他在画面横向的范围，`slideMost` 是臂横移的最大值。
- 复现：`node tools/frame-film.cjs <dir> --frame=b --secs=5`。
