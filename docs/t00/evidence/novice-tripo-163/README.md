# 小沙弥默认穿 Tripo 分层身体：接入第一个 PR（#163）

提交 `feat/novice-tripo-163` 上（PR #469）。身体文件 `app/shared/models/novice-tripo.glb`，SHA-256 `6a8fcca163d6d6644647485ff44e4d524870556485b0a78efd69bc8e89b87bb8`，是第六轮 r6 加收臂展 0.8 cm 重出的（`NOVICE_BPY=<装了 bpy 5.3.0 的 python> node tools/novice-tripo.mjs <seg-model.glb 和 comp-model.glb 所在目录>`，两次一样；`ARMS_IN=0` 出 r6 原样）。

图在公开数据集里，按提交钉住：`https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0e1347f7f615b43997ebf059219b1fc1cf93e45f/t00/novice-tripo-163/<文件名>`（`node tools/evidence.mjs pull docs/t00/evidence/novice-tripo-163` 取回）。

| 文件 | 内容 |
| --- | --- |
| `five-poses.png` | 站、合掌、走、坐凳、盘坐，正、侧、背、斜俯：代码身体｜Meshy｜Tripo（舞台，按页面的方式穿：修正骨、念珠和背带推到布外） |
| `straps-vs-sheet.png` | 上：所有者的设定图；下：绑定姿势正、侧、背，代码身体｜Tripo，背带改成设定图的米白（第 8 条） |
| `director-tea.png` | 吃茶导演机位（`SHOTS.tea`），坐凳、碗倾 0.78：r6｜新文件。碗是 `rites.js` 的那只（以前舞台用开口圆筒，碗底看着是空的） |
| `director-incense.png` | 举香导演机位：r6｜新文件 |
| `front-close.png` | 合掌、举香、坐着吃茶正面近景：r6｜新文件 |
| `page-tea.png`、`page-incense.png` | 页面里（`shots.js shot-tea shot-incense`，夏昼）：左 `?body=code`，右默认（Tripo） |
| `portrait-winter-night.png` | 冬夜（`node tools/portrait.js winter-night`），正、侧、背、合掌：背带是暗处的布色，不亮过雪、不发光（钉在数据集提交 `4ff21efe`） |
| `winter-night-code-vs-tripo.png` | 冬夜同一帧同一光，上：`?body=code`，下：Tripo 加皮肤自发光（`SKIN_GLOW` 0.03，`novice.js` 的 `skinMaterial`）。脸部平均亮度（两张正面，线性亮度）Tripo／代码：加光前 0.66、0.59，加光后 1.17、1.05（3D 评审要 ≥ 0.7）（钉在 `3d678cb8`） |
| `portrait-summer-day.png` | 夏昼，Tripo 加皮肤自发光后：白天的肤色没有发亮（钉在 `3d678cb8`） |
| `pixels.txt` | `--sleeve` 的逐像素数 |
| `collage.jpg` | 五姿、背带、吃茶机位、页面吃茶 |

`--sleeve`（袖子比袍身亮 25% 以上的像素；前臂和手上的污迹）r6 → 新文件：举香导演机位 292 → 273 px，占他轮廓 0.96% → 0.90%（阈值 2%）；正面近景举香 19 → 20 px（都是 0.01%），合掌 0 → 2 px；污迹各机位都是 0。正面近景多出的 1–2 px 照实记在这里。

重出命令：

```sh
node tools/novice-views.cjs --code --glb=app/shared/models/novice.glb --glb=app/shared/models/novice-tripo.glb
node tools/novice-views.cjs --code --glb=app/shared/models/novice-tripo.glb --poses=bind --sides=正,侧,背 --near=1.6 --focus=0.8 --size=500,600
node tools/novice-views.cjs --glb=<r6> --glb=app/shared/models/novice-tripo.glb --poses=teaSeat --sides=正 --cam=-0.45,0.98,2.05:0,0.85,0.8:42 --size=1280,720 --sleeve
node tools/shots.js shot-tea shot-incense; node tools/shots.js --body=code --tag=-code shot-tea shot-incense
```

![拼图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0e1347f7f615b43997ebf059219b1fc1cf93e45f/t00/novice-tripo-163/collage.jpg)
