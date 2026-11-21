# 门槛外看得清脸吗：cam03 三种画幅（#370，PRD 独立评审 #359）

2026-11-21，白盒殿（`tools/t05-hall/`），七尊都在佛坛上（第二轮修形与配色，素模上色），J01 夏日、不开佛前灯、GTAO，SwiftShader 软件渲染（画面同 GPU，只是慢）。
spec：`tools/t05-hall/specs/t05-faces-cam03.json`；`node tools/t05-hall.cjs <spec>` 每张图另报每尊脸在屏上的像素高。

- 站位：cam03（殿门中央，(0, +0.6)，殿内地面上 1.6 m，朝北，俯仰 +8°）。往里走的三张在 z = −2、−4.5、−7；转头的在 cam03 原地向东转 15°、30°、45°（西边对称）。
- FOV 取游戏里走路时的竖直视角（`yard.js` 597 行，设置里不加宽）：横屏第三人称 50°、第一人称 65°；竖屏（宽小于高）62° 和 75°。
- **脸高**：发际（锚点 `hairFront`）到下巴（嘴下方，眼到嘴距离的 0.6 倍）在屏上的像素长；同时报眼到嘴的像素长。
- **读得出**：两眼和嘴都在画面里，而且从眼睛看过去没有被别的东西挡住（`window.hall.occlusion`）。像素多少另看。

| 图 | 画幅 | FOV | 读得出几张脸 | 各尊脸高（px） |
|---|---|---|---|---|
| `cam03-16x9-third` | 1920×1080 | 50° | 5 | krakucchanda 65, sikhin 68, vipasyin 68, visvabhu 67, kanakamuni 66 |
| `cam03-16x9-first` | 1920×1080 | 65° | 7 | kasyapa 45, krakucchanda 48, sikhin 50, vipasyin 50, visvabhu 49, kanakamuni 48, sakyamuni 46 |
| `cam03-4x3-third` | 1440×1080 | 50° | 5 | krakucchanda 65, sikhin 68, vipasyin 68, visvabhu 67, kanakamuni 66 |
| `cam03-4x3-first` | 1440×1080 | 65° | 5 | krakucchanda 48, sikhin 50, vipasyin 50, visvabhu 49, kanakamuni 48 |
| `cam03-phone-third` | 1080×2340 | 62° | 1 | vipasyin 114 |
| `cam03-phone-first` | 1080×2340 | 75° | 3 | sikhin 89, vipasyin 90, visvabhu 88 |
| `in2-phone-third` | 1080×2340 | 62° | 1 | vipasyin 132 |
| `in2-phone-first` | 1080×2340 | 75° | 1 | vipasyin 103 |
| `in4.5-phone-third` | 1080×2340 | 62° | 1 | vipasyin 154 |
| `in4.5-phone-first` | 1080×2340 | 75° | 1 | vipasyin 120 |
| `in7-phone-third` | 1080×2340 | 62° | 1 | vipasyin 185 |
| `in7-phone-first` | 1080×2340 | 75° | 1 | vipasyin 145 |
| `turn15-phone-third` | 1080×2340 | 62° | 2 | sikhin 109, vipasyin 118 |
| `turn15-phone-first` | 1080×2340 | 75° | 3 | krakucchanda 77, sikhin 86, vipasyin 93 |
| `turn30-phone-third` | 1080×2340 | 62° | 3 | kasyapa 80, krakucchanda 94, sikhin 112 |
| `turn30-phone-first` | 1080×2340 | 75° | 3 | kasyapa 62, krakucchanda 74, sikhin 87 |
| `turn45-phone-third` | 1080×2340 | 62° | 2 | kasyapa 78, krakucchanda 96 |
| `turn45-phone-first` | 1080×2340 | 75° | 2 | kasyapa 61, krakucchanda 76 |

## 结论

- 横屏两种画幅：第一人称 16:9 七张脸都在，每张 45–50 px（眼到嘴 20–24 px），看得出眉眼、白毫和嘴；第三人称（50°）五张，每张 65–68 px，东西两端两尊的脸在画框外。4:3 第一人称也是五张。
- 竖屏（9:19.5）：门口只看得清中尊（第三人称）或中间三尊（第一人称），每张约 90–114 px。**沿中轴往里走，两侧的脸不会依次露出**：越走越近，视野越窄，从 z = −2 起只剩中尊（103–185 px）。两侧要靠**转头**：原地转 15° 看到三张，转 30° 是东端三尊（62–112 px），转 45° 剩东端两尊。
- 所以竖屏不用改站位，要的是让玩家在门口自然转头（拖动视角），或者门口那一眼给竖屏另设更宽的视角；这是 PRD 那条验收标准要定的。
- 修形顺带：`tools/t05-hall/stage.js` 里 `walk()` 行尾注释吞掉了 `camera.updateProjectionMatrix()`（T05 PRD 会话查出），这一轮修了。它只影响旧的 `walk()` 片子（`route-a-film.json`，路线 A 探针，以 50° 而非 55° 画出）；#370 报过的图走 `view()`、`shoot()`，片子走 `walkPath()`，都每次更新投影，不受影响。

collage.jpg：上排 16:9 第三人称、16:9 第一人称、4:3 第一人称；下排竖屏门口第三人称、第一人称、转 30° 第一人称。其余 PNG 在证据库，见 MANIFEST.json。
