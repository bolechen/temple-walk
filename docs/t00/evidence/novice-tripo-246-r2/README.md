# Tripo 小沙弥第二轮：坐姿、红白碎块、手位、念珠（#246）

工具 `tools/novice-tripo.mjs`（分支 `claude/novice-tripo-246-round2`），软件渲染，光秃秃的台子，同一光。产物 SHA-256 `25b83d61d77eaebda85989d5a65f6caebbb3b335f92d25a2b998335e8a88e8bf`，放在私有桶 `keep/novice-b/2026-11-19/novice-tripo-r2.glb`。仓库里只留拼图 `collage.jpg`，原图在数据集里，按清单的提交号固定。

| 文件 | 内容 | 地址 |
| --- | --- | --- |
| `views-3col.png` | 代码身体｜现有 novice.glb｜第二轮新身体，五姿四面 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/ffe719217079dd5318c1d47f6317b212a0c9f762/t00/novice-tripo-246-r2/views-3col.png) |
| `seated-close.png` | 坐凳、盘坐近看，代码身体｜新身体，正、侧、斜俯 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/ffe719217079dd5318c1d47f6317b212a0c9f762/t00/novice-tripo-246-r2/seated-close.png) |
| `hands-3col.png` | 合掌、吃茶、举香：代码身体｜手只转掌心（`HAND=0`）｜转掌心并缩小（`HAND=1`，默认） | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/ffe719217079dd5318c1d47f6317b212a0c9f762/t00/novice-tripo-246-r2/hands-3col.png) |
| `hands-stand-before-after.png` | 站姿正面：手缩小前（`HAND=0`）｜缩小后 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/ffe719217079dd5318c1d47f6317b212a0c9f762/t00/novice-tripo-246-r2/hands-stand-before-after.png) |
| `hand-closeup.png` | 左手特写（绑定姿势，正、侧）：缩小前｜缩小后 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/ffe719217079dd5318c1d47f6317b212a0c9f762/t00/novice-tripo-246-r2/hand-closeup.png) |
| `collage.jpg` | 坐姿近看 + 三个手位 + 站姿缩小前后 | 仓库里 |

## 怎么重出

```sh
node tools/novice-tripo.mjs /tmp/monk2                                      # → tools/out/novice-tripo.glb
HAND=0 node tools/novice-tripo.mjs /tmp/monk2 tools/out/hand0.glb           # 手只转掌心、不缩小
node tools/novice-views.cjs --code --glb=app/shared/models/novice.glb --glb=tools/out/novice-tripo.glb --out=views-3col.png
node tools/novice-views.cjs --code --glb=tools/out/novice-tripo.glb --poses=chair,sit --sides=正,侧,斜俯 --near=1.6 --focus=0.2 --out=seated-close.png
node tools/novice-views.cjs --code --glb=tools/out/hand0.glb --glb=tools/out/novice-tripo.glb --poses=pray,tea,incense --sides=正,侧 --out=hands-3col.png
node tools/novice-views.cjs --glb=tools/out/hand0.glb --glb=tools/out/novice-tripo.glb --poses=stand --sides=正 --out=hands-stand-before-after.png
node tools/novice-views.cjs --glb=tools/out/hand0.glb --glb=tools/out/novice-tripo.glb --poses=bind --sides=正,侧 --near=6 --focus=0.5 --focusx=0.3 --out=hand-closeup.png
```
