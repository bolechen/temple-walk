# Tripo 小沙弥第三轮：骨热自动权重（#246）

工具 `NOVICE_BPY=<装了 bpy 的 python> node tools/novice-tripo.mjs <目录>`。它调用 `tools/novice-heat.py`（Blender 5.3.0 的 Python 模块，无界面），裤子和袍摆各自用 Blender 的骨热自动权重来算。软件渲染，光秃秃的台子，同一光。

产物 SHA-256 `d05c983ae3d021928fb256dbd69afbb0cfc073d38e6e10907008c91ec5fd46da`，两次运行相同，放在私有桶 `keep/novice-b/2026-11-19/novice-tripo-r3.glb`。

| 文件 | 内容 | 地址 |
| --- | --- | --- |
| `seated-4sides.png` | 坐凳、盘坐四面：第二轮权重｜第三轮（骨热，袍摆再叠上第二轮膝上那一层） | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0536b75c1646c11864e5c3c5a904d4af7e9deaba/t00/novice-tripo-246-r3/seated-4sides.png) |
| `trousers-alone.png` | 只看裤子（袍隐藏、背面洋红、背景绿），盘坐和坐凳：第二轮｜第三轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0536b75c1646c11864e5c3c5a904d4af7e9deaba/t00/novice-tripo-246-r3/trousers-alone.png) |
| `pure-heat.png` | 纯骨热（`HEAT_LAP=0`，袍摆不叠那一层）：盘坐最好，坐凳成平板 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0536b75c1646c11864e5c3c5a904d4af7e9deaba/t00/novice-tripo-246-r3/pure-heat.png) |
| `stand-pray-walk.png` | 站、合掌、走，正侧背：第二轮｜第三轮 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0536b75c1646c11864e5c3c5a904d4af7e9deaba/t00/novice-tripo-246-r3/stand-pray-walk.png) |
| `hands.png` | 手只转掌心、不缩小，手指微屈 18°：代码身体｜第三轮，合掌、吃茶、举香 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0536b75c1646c11864e5c3c5a904d4af7e9deaba/t00/novice-tripo-246-r3/hands.png) |
| `hand-curl-before-after.png` | 左手特写（绑定姿势，正、侧）：并指微屈前（`CURL=0`）｜后（18°） | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/cd1e8b2c5abbe2e160fdf0582f28e7e2539089ea/t00/novice-tripo-246-r3/hand-curl-before-after.png) |
| `tea-curl-before-after.png` | 吃茶：代码身体｜微屈前｜微屈后。手不缩以后，手指又伸到眼睛上了；微屈 18° 几乎看不出差别 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/cd1e8b2c5abbe2e160fdf0582f28e7e2539089ea/t00/novice-tripo-246-r3/tea-curl-before-after.png) |
| `collage.jpg` | 坐姿四面 + 只看裤子 + 手 | 仓库里 |
