# T02 素材与授权计划

核对日期：2026-11-17。这份文件回答：哪些可以直接用 T00/T01 的，哪些必须新做，哪些只能当参考，哪些权利不清不能用。
逐件登记在 `asset-register.csv`（草案，不是最终交付表）。

---

## 1. 可以直接复用的 T00/T01 资产

### 1.1 扫描贴图（Poly Haven，CC0）

| 现有资产 | T02 用途 | 备注 |
|---|---|---|
| `TEX-wood` 木纹 | 柱、梁、枋、栈道、栏杆 | 需要调成「老杉木」的灰黄，不要红木 |
| `TEX-stone` 石面 | 石阶、洞底、码头 | 需要调成丹霞红/湿灰 |
| `TEX-blocks` 砌块 | 岩口券洞、砖砌挡墙 | 洞口砖券是「砖砌券洞」，见 S01 |
| `TEX-plaster` 抹灰 | 白灰墙、岩面白灰 | 不是 T01 的黄墙 |
| `TEX-bark` 树皮 | 杉、松、樟 | 林间窄路 |
| `TEX-leaves` 叶 | 杉针、阔叶、苔 | 需要两种：杉针与阔叶 |
| `TEX-weave` 织物 | 蒲团、幡、帘 | 少量 |
| `TEX-snow` 雪 | 不用（泰宁少雪） | 可留作备选 |

### 1.2 字体（SIL OFL）

T00 的六套中文字 + 日/英/韩共 16 个文件都能复用：
「Yunjing Brush」标题/印章、「Yunjing Kai」标签/对白/匾额、「Yunjing Xing」手写/诗/草图、「Yunjing Bang」重笔匾额、「Yunjing Serif」「Yunjing Seal」。

**T02 新增文字后必须重跑 `python3 tools/fonts.py <dir>`**，否则 `pnpm run check` 会因缺字失败。
T02 的新字（部分）：岩、隐、栖、露、甘、露、丹、霞、穴、腹、栈、柱、插、拱、穿、斗、杉、草、灰、泥、蜃、阁、南、安、观、音、弥、陀、题、记、壁、画、状、元、还、愿、重、源、佛、样、悬、空、滴、水、苔、湿、雾、湖、船、码、头、台、阶。

### 1.3 程序与工具

- `buildHall` / `stairGeo` / `walk` 体系 / `mergeStatic` / `materials.js` / `glsl.js` / `geo.js`
- `monk.js`、`eye.js`、`director.js`、`rites.js`、`audio.js`、`score.js`
- `ui.js` / `ui.css` / `paper.js` / `settings.js` / `i18n.js` / `goshuin.js`
- `tools/`：`shots.js`、`inside.cjs`、`portrait.js`、`mobile-audit.cjs`、`gpu-render.sh`、`textures.py`、`fonts.py`、`gallery.py`、`boards.py`
- 测试：`tests/unit/*`、`tests/e2e/run.cjs`、`edges`、`nearplane`

### 1.4 模型与馆藏图

- `MODEL-buddha` / `MODEL-pedestal`：可作为「上层小殿」的占位主尊；但 T02 的像设是华严三圣/观音，单尊佛不够，需说明是占位。
- 7 件博物馆 CC0 扫描像：可作观音/弟子/罗汉占位；要重新配殿。
- 馆藏画：T02 只用 4 幅（见 `GALLERY.md`），全部来自克利夫兰 CC0；不与 T00/T01 重复。

---

## 2. 必须新做的资产

### 2.1 建筑与构筑

| 资产 | 做法 | 优先级 |
|---|---|---|
| `CAVE-ganlu` 主岩体 | 程序化洞穴外壳：洞口 37×32 m、深 27 m、内腹 10×12 m；洞顶、左右钟鼓石、滴水位 | P0 |
| `BLDG-rock-temple` 原创架空木楼 | 穿斗 + 插拱 + 草灰泥屋面；五座体块（蜃阁、上殿、观音阁、南安阁、库房） | P0 |
| `BLDG-platform` 木栈平台 | 主平台、状元柱、短柱、大引、横材 | P0 |
| `BLDG-walkway` 栈道/石阶 | 101 级石阶、侧向栈道、栏杆、平台短梯 | P0 |
| `BLDG-gate` 岩口券洞 | 砖砌券洞 + 石阶；不是大山门 | P1 |
| `INT-upper-hall` 一间室内 | 上层小殿：佛坛、像设占位、梁架、残彩 | P0 |
| `PROP-incense` 香炉/供桌 | 小尺度，不做大香火 | P1 |
| `PROP-boat` 游船（远景） | 低模，只在 Z0 | P2 |
| `PROP-railing` 栏杆 | 木栏，间距 ≤0.12 m | P0 |

### 2.2 自然与地面

| 资产 | 做法 | 优先级 |
|---|---|---|
| `TEX-danxia` 丹霞红岩 | 新扫描或程序化：红褐、层理、湿痕、苔、水痕 | P0 |
| `TEX-fir` 老杉木 | 新扫描或 `TEX-wood` 调色：灰黄、裂纹、节疤 | P0 |
| `TEX-grassash` 草灰泥屋面 | 程序化：灰褐、颗粒、雨渍 | P0 |
| `TEX-lime` 白灰墙 | `TEX-plaster` 调色：白灰、剥落、岩面 | P1 |
| `VEG-fir` 杉木 | 程序化针叶树，林间窄路 | P0 |
| `VEG-moss` 苔 | 程序化/贴图，岩面与石阶 | P1 |
| `VEG-broadleaf` 阔叶树 | 樟/楠/杂木，洞口外 | P1 |
| `WATER-lake` 湖面 | 远景，低模 + 轻反射；不做全镜面 | P1 |
| `FX-drip` 滴水 | 粒子/线条 + 水面涟漪 | P0 |
| `FX-mist` 洞口薄雾 | 低透明度 sprite，只在洞口外 | P1 |
| `FX-lightshaft` 洞口光 | 体积光/贴片，只在上午 | P1 |

### 2.3 声音（全部合成）

| 资产 | 做法 | 优先级 |
|---|---|---|
| `SFX-cave-reverb` 洞穴混响 | 长混响（3–5 s）、暗、少高频 | P0 |
| `SFX-drip` 滴水 | 单个水滴 + 水面回声；位置化 | P0 |
| `SFX-water` 湖水 | 轻拍岸、船过后的尾波 | P1 |
| `SFX-boat` 游船 | 低频引擎 + 水声；只在 Z0 | P2 |
| `SFX-wood-step` 木脚步 | 木板空腔、轻吱呀 | P0 |
| `SFX-stone-step` 石脚步 | 复用 `steps.js`，加湿石 | P0 |
| `SFX-forest` 林声 | 风过杉针、鸟、虫 | P0 |
| `SFX-rain` 雨 | 洞外雨、洞内滴水；洞内不直接淋雨 | P1 |
| `SFX-creak` 木构吱呀 | 极稀疏，不循环 | P1 |
| `MUSIC-t02` 配乐 | 单音、稀疏；见 `SOUND.md` | P1 |

---

## 3. 只能当参考、不能进游戏的素材

### 3.1 Wikimedia Commons 照片

本包查到 5 个相关文件（S13）：

| 文件 | 作者 | 许可 | 日期 | 用途 |
|---|---|---|---|---|
| `Ganlu Temple.jpg` | Atlaslin | CC BY-SA 3.0 | 2008-10-03 | 外观/崖壁参考 |
| `Looking out through Ganlu Temple's rounded window.jpg` | Liedward390 | CC BY-SA 4.0 | 2025-07-13 | 洞内圆窗/框景参考 |
| `大金湖甘露寺 - panoramio.jpg` | 江上清风1961 | CC BY 3.0 | 2014-05-01 | 湖上远望 |
| `仰望大金湖甘露寺 - panoramio.jpg` | 江上清风1961 | CC BY 3.0 | 2014-05-01 | 洞口仰视 |
| `甘露寺景区的状元桥 - panoramio.jpg` | 江上清风1961 | CC BY 3.0 | 2014-05-01 | 到达路径/状元桥 |

**建议**：全部只作研究与配色/构图参考，不进 `dist/`。若所有者接受 CC BY-SA/CC BY，再逐张选，并在鸣谢页列出作者、许可、链接。

### 3.2 1959 年测绘图与 1960 年模型

- 张步骞/福建省文物管理委员会的测绘图、杜仙洲的模型：版权未清，不能描图、不能当贴图。
- 只能用来核对比例与节点；若引用，注明「据 1959 年测绘成果转述」。

### 3.3 寺方/景区照片与文字

- 未取得再分发权；只作研究，不直接搬运。

### 3.4 馆藏画

- 只用克利夫兰 CC0 的 4 幅；不把中文博物馆的网页图、日本寺院的官方照片、西藏密教图像混入。

---

## 4. 馆藏开放素材（T02 画廊候选）

T00/T01 已证明 ColBase / Met Open Access / Cleveland Open Access 三条管线可用。T02 的墙面小，只需 4 幅：

| 墙面 | 主题 | 候选 |
|---|---|---|
| 蜃阁/主殿 | 华严三圣 | Cleveland 2009.342.1（福州，元，释迦+文殊+普贤） |
| 上殿 | 西方三圣 | Cleveland 1974.35（南宋，阿弥陀+二胁侍） |
| 观音阁 | 白衣观音 | Cleveland 1972.160（南宋，白衣观音） |
| 南安阁 | 白衣观音（辅） | Cleveland 1978.47.2（元，白衣观音，绢本描金） |

**原则**：不冒充本寺旧藏；每件卡片写「同题材的公开馆藏图像，非本寺旧藏」；来源行原样保留；说明文字里不写「旧藏」「本寺所有」。

---

## 5. 授权与署名

### 5.1 必须保留的署名

- Poly Haven：CC0，不强制署名，但 T00 已在鸣谢页列；T02 保持。
- 字体：SIL OFL；`shared/fonts/OFL.txt`；保留版权行与保留字体名。
- three.js / meshopt / Basis / lil-gui / stats：MIT/Apache；`THIRD-PARTY-NOTICES.txt`。
- Cleveland：CC0；保留馆方来源行与条目链接。
- OSM：若用其数据做地形/布局，鸣谢「© OpenStreetMap contributors, ODbL」。
- Commons（若采用）：作者 + 许可 + 链接 + 是否修改。
- 鸟取环境大学纪要、福建日报/福建省文物局：引用要短，注明作者、刊名、日期/页码；不整段搬运。

### 5.2 不能用

- 1959 年测绘图的原样描摹。
- 寺方/景区照片与整段文字。
- 现代书法家的匾联原迹。
- 任何「甘露寺独家」的仪式/秘方（无来源）。
- AI 生成的「甘露寺实景」冒充现场照片。
- 把「一柱撑起整座寺」的旅游图直接当结构示意。

### 5.3 需要所有者决定

1. 是否接受 CC BY-SA/CC BY 的「署名 + 相同方式共享」义务，用 Commons 照片进游戏。
2. T02 最终用「岩隐寺」还是「栖露岩寺」，或另拟。
3. 是否做一次合规的现场采集（许可、预算、时间）。
4. 是否请结构/古建顾问核对「一柱插地」的图示与文案。
5. 馆藏 4 幅是否上墙，还是只做空殿/剪影。

### 5.4 交付命名（照资料库）

- `T02_ENV_Cave_B01_v001`
- `T02_LGT_CaveInterior_G01_v001`
- `T02_CAM_UpperHall_16x9_v001`
- `T02_SRC_Architecture_001`

每个版本记录：关卡 ID、场景、季节天气、来源图 ID、相机、太阳方位、材质版本、作者、日期、权利状态、变更说明。

---

## 6. 资产登记表怎么读

`asset-register.csv` 的 `status` 列：

- `reuse`：直接复用 T00/T01，已随项目分发。
- `planned`：T02 新做，尚未存在。
- `reference`：只作研究/参考，不进 `dist/`。
- `candidate`：候选，许可/内容未定。
- `blocked`：权利不清或没有来源，不用。

`commercial_use` 列只写「yes / conditional / no / unknown」，不写推断。
