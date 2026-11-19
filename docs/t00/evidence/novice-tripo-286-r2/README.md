# Tripo 小沙弥第六轮离线修整：袖口、袖底、吃茶整段（#286 第二个 PR）

产物 `novice-tripo-r6.glb`，SHA-256 `609ed44fdfd5056ab48e9b2420a9078d174605e2163a229c56261cf2419cfa6e`（1,430,044 字节，两次运行相同），放在私有桶 `keep/novice-b/2026-11-19/`。重出：`NOVICE_BPY=<装了 bpy 的 python> node tools/novice-tripo.mjs <seg-model.glb 和 comp-model.glb 所在目录>`。

| 文件 | 内容 | 地址 |
| --- | --- | --- |
| `front-cuffs.png` | 合掌、举香、坐着吃茶，正面：第五轮｜第六轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/4c2e9e4807a4a53fe268d9e63b13881fde8e5217/t00/novice-tripo-286-r2/front-cuffs.png) |
| `front-unlit.png` | 同上，只画贴图不打光（看袖口的颜色本身）：第五轮｜第六轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/4c2e9e4807a4a53fe268d9e63b13881fde8e5217/t00/novice-tripo-286-r2/front-unlit.png) |
| `director-incense.png` | 举香的导演机位（`interior.js` 的 shot：at [-3.2, 0.8, -2.4]，look [0, 1.69, 1.98]，fov 44），1280×720：第五轮｜第六轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/4c2e9e4807a4a53fe268d9e63b13881fde8e5217/t00/novice-tripo-286-r2/director-incense.png) |
| `director-tea.png` | 吃茶的导演机位（`site.js` SHOTS.tea），坐凳、碗倾到 0.78：第五轮｜第六轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/4c2e9e4807a4a53fe268d9e63b13881fde8e5217/t00/novice-tripo-286-r2/director-tea.png) |
| `sleeve-light.png` | 举香侧面袖底：只画贴图｜关掉天光｜关掉环境贴图 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/4c2e9e4807a4a53fe268d9e63b13881fde8e5217/t00/novice-tripo-286-r2/sleeve-light.png) |
| `tea-grip.png` | 坐着吃茶、碗倾 0.78，正、侧：上一行是 rites.js 现在的握法，下一行是换低的握法（只试） | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/4c2e9e4807a4a53fe268d9e63b13881fde8e5217/t00/novice-tripo-286-r2/tea-grip.png) |
| `collage.jpg` | front-unlit + sleeve-light + tea-grip | 仓库里 |
| `arms.md` | 每个姿势的上臂转角和拉过 3 倍的边（第四、五、六轮） | 仓库里 |
| `pixels.txt` | 导演机位和正面的像素数，吃茶整段的最小余量 | 仓库里 |

![拼图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/aeec1d1d2b5faa0d1c07705632d06fbd5ed5bafe/t00/novice-tripo-286-r2/collage.jpg)

命令：

```sh
node tools/novice-measure-arms.mjs <glb> --md                       # 上臂转角、拉过 3 倍的边（新）
node tools/novice-measure-tea.mjs --sequence [<glb> ...]            # 吃茶整段（新选项；HOLD=x,y,z 试别的握法）
node tools/novice-views.cjs --glb=<glb> --poses=incense --sides=正 --cam=-3.2,0.8,-2.4:0,1.69,1.98:44 --size=1280,720 --sleeve
node tools/novice-views.cjs --glb=<glb> --poses=teaSeat --sides=正 --cam=-0.45,0.98,2.05:0,0.85,0.8:42 --size=1280,720 --sleeve
node tools/novice-views.cjs --glb=<glb> --poses=pray,incense,teaSeat --sides=正 --near=2.2 --focus=0.8 --size=600,600 --sleeve
```

`--sleeve` 另画一张平涂图（袖子红、袍身绿、前臂和手黄、其余蓝），逐像素数：袖子上比袍身中位亮度亮 25% 以上的像素占他轮廓多少；前臂和手上棕色或发白的像素（污迹、碎屑）有多少。
