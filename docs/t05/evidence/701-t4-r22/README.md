# #701：七尊的最后一次 T4（2026-11-26，冬昼，t4-small）

- 运行：`t05-20261126-001740`，Hugging Face Job `6b077aa8d91f621b9309481f`；`gpu-report.json` 里 `site.commit` = **48a10c952bddff9a1debaa6d1531bbb35985069d**（没有 `+dirty`），入口 `assets/index-DuTbt-wY.js`，39 个文件，sha256 c213a389…e48057；渲染器 ANGLE（NVIDIA Tesla T4，Vulkan）。只拍图，没测帧时间。
- 七个文件（东到西）：kasyapa-B4H10b、krakucchanda-B4H10b、**sikhin-M40vb（新下巴，sha256 b28819eb…e299）**、vipasyin-B4H10b、visvabhu-V3b、kanakamuni-K1Lb、sakyamuni-V14b。
- 设置与 `701-t4-r19` 相同：D0 光（主光 260 烛光、瞄准 x ±12、半角 0.7、penumbra 0.6）、曝光 3.2、环境光 0.6、AO 强度 0.4、aisle55 在 [X+3.0, 5.6, −7.4]。
- 图：`collage.jpg`：cam03，七尊的 mid10、mid10 灰模、join、aisle55；1920×1080 原图在数据集（`png/`）。

## 这一轮改了什么（对总监 00:07 判的）
1. 指尖：拘那含举手食指与拇指指尖，拘留孙举手一指指尖和腿上手指末端，毗舍浮举手弯指的指节：掩码加种子或小胶囊（用 `pixelPoint` 读出位置）；
2. 毗舍浮腿上的手：原来手背大半是袈裟色，把 `handL2` 的胶囊放低、加粗（半径 0.26→0.32）；
3. 毗婆尸举手下方袈裟上的绿三角：从掩码里挖掉（`exclude`）；
4. 迦叶颈窝的暗蓝斑与毗婆尸颏下的橙短横：颏区的下界下移到颈前点（`chinMin` 七尊统一），斑和横是颏区的下沿太高，没盖到颈上；
5. 尸弃用 `sikhin-M40vb`，平色图已在 `701-flat-r21`；
6. 不追：折痕细绿线（fold wear）、孤立像素、唇照上轮。

## 已知
- 拘那含 V 领两边的黄边（衣缘描金，设计）；
- 拘留孙领口的胸皮肤区（设计）；
- 颏两侧嘴角下两小团是上一轮 mouthlift；
- 没拍 cam06，内衣色相仍是软件里的数。
