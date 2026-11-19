# Tripo 小沙弥第五轮离线修整（#286）

产物（私有桶 `keep/novice-b/2026-11-19/`，同样输入跑两次字节相同）：

| 文件 | 内容 | SHA-256 | 字节 |
| --- | --- | --- | --- |
| `novice-tripo-r5.glb` | 默认：手指并拢、腋下修正骨、袍身不带手臂权重 | `dbcecbd79037b4d904f0c500e6fe1b04b81f174e02bc8a4c659aaa03e49a2e15` | 1,422,588 |
| `novice-tripo-r5-armsin15.glb` | 同上，加 `ARMS_IN=0.015`（A 姿臂展每侧收 1.5 cm），只为外廓那条路 | `c3619dd8baded3cd74d69640a4c0f750fe5346a8c8ad17b982a5644bc2433ba3` | 1,422,532 |

重出：`NOVICE_BPY=<装了 bpy 5.3.0 的 python> node tools/novice-tripo.mjs <seg-model.glb 和 comp-model.glb 所在目录> [out.glb]`（输入在 `keep/tripo-2026-11-19/monk2/`，SHA-256 见 `docs/t00/refactor/novice-spike.md`）；加 `ARMS_IN=0.015` 出第二个。

| 文件 | 内容 | 地址 |
| --- | --- | --- |
| `tea.png` | 吃茶正、侧：代码身体｜第四轮｜第五轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/58cf197de0a262bbc6c36cbab52d1de5de87c750/t00/novice-tripo-286/tea.png) |
| `incense.png` | 举香正、侧：第四轮｜第五轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/58cf197de0a262bbc6c36cbab52d1de5de87c750/t00/novice-tripo-286/incense.png) |
| `beads.png` | 站立正、侧、背：第四轮（念珠照代码排）｜第五轮（念珠按新身体重排，`--beads`） | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/58cf197de0a262bbc6c36cbab52d1de5de87c750/t00/novice-tripo-286/beads.png) |
| `hand-bind.png` | 绑定姿势的左手近看：代码身体｜第四轮｜第五轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/58cf197de0a262bbc6c36cbab52d1de5de87c750/t00/novice-tripo-286/hand-bind.png) |
| `armsin-hands.png` | 合掌、吃茶、举香正、侧：第五轮｜收臂展 1.5 cm | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/58cf197de0a262bbc6c36cbab52d1de5de87c750/t00/novice-tripo-286/armsin-hands.png) |
| `views-3col.png` | 五姿四面：代码身体｜第四轮｜第五轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/58cf197de0a262bbc6c36cbab52d1de5de87c750/t00/novice-tripo-286/views-3col.png) |
| `collage.jpg` | 吃茶 + 举香 + 念珠 | 仓库里 |
| `measures.txt` | 手指、手宽、吃茶遮眼、念珠、举香拉伸的量（命令见下） | 仓库里 |
| `outline.md` | 逐档外廓表 | 仓库里 |

![拼图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/58cf197de0a262bbc6c36cbab52d1de5de87c750/t00/novice-tripo-286/collage.jpg)

量的命令（都在本提交的 tools/ 里）：

```sh
node tools/novice-measure-fingers.mjs <glb>            # 指尖张开
node tools/novice-measure-hands.mjs <glb>              # 手宽
node tools/novice-measure-tea.mjs <glb>                # 吃茶时手的最高点比眼睛下沿低多少（新）
node tools/novice-measure-beads.mjs <glb> [--relay]    # 念珠进布（--relay：先按新身体重排，新）
node tools/novice-outline.mjs <glb> ... [--md]         # 逐档外廓，和 tools/walk/outline.json 并排（新）
NOVICE_TRIPO=<glb> node --test tests/unit/novice-tripo.test.mjs   # 含「拉过 3 倍的边」
node tools/novice-views.cjs --glb=<glb> --poses=tea,incense --sides=正,侧 [--beads]
```

图都在软件渲染的空舞台（`tools/novice-stage/`）上，同一提交、同一姿势帧。
