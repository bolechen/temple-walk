# 关卡框架抽离计划（#138 的施工图，为 T05 开路）

核对日期：2026-11-20。基线：`origin/main` `a5901b2`（`docs(handoff): next level after wrap-up (#359)…`）。issue：#359 验收第 2 条；施工 issue 仍是 #138（它的八条验收照旧有效，本页把它拆成能单独合并、单独回退的 PR，并按今天的代码重核清单，#138「开工时先由主创按当时的代码重核本 issue 的清单」）。

**一句话：** 引擎本身大多已经是「吃数据」的（树、竹、香炉、铺地、建筑生成器、烘焙器都从参数拿东西）；写死 T00 的地方集中在五处：`app/src/site.js`（平面本身）、`app/yard.js`（从 `site.js` 直接 import 六个 T00 常数，并按地点 id 取 `site.places.well` 之类）、`journey.js`/`game.js`/`goshuin.js`（七枚印和按 id 分派的仪式）、`interior.js`/`incense.js`/`credits.js`/`plaque.js`（殿内陈设、香、鸣谢、匾的手迹直接 import `levels/t00`）、以及构建产物和工具里写死的 `t00` 文件名。

## 一、现在写死 T00 的地方（证据）

全部在 `a5901b2` 上用 `git grep` 读出；行号随代码会动，以命令重跑为准。

### 1. 引擎文件直接 import `levels/t00`（#138 验收 1 要求为空）

```
$ git grep -n "levels/t00" app/src app/yard.js
app/src/credits.js:7:   import { WORKS } from "../levels/t00/works.js";
app/src/credits.js:8:   import { workIn } from "../levels/t00/works-local.js";
app/src/game.js:7:      import { workIn } from "../levels/t00/works-local.js";
app/src/game.js:392:    asset(`levels/t00/gallery/${slug}.webp`)
app/src/interior.js:13: import { WORKS, HANG } from "../levels/t00/works.js";
app/src/interior.js:14: import { workIn } from "../levels/t00/works-local.js";
app/src/interior.js:109: asset(`levels/t00/gallery/${slug}.webp`)
app/src/plaque.js:18:   const HANDS = { shijia: "levels/t00/boards/shijia.webp" };
```

四个引擎文件、九处。#138 写的时候也是这四个文件（`credits.js`、`game.js`、`interior.js`、`plaque.js`），没有变多。

### 2. 平面本身在引擎目录：`app/src/site.js`（744 行）

- 导出的 T00 常数：`SITE`（第 14 行，院墙、前院、竹林合拢处 `GROVE_IN`）、`SCREEN`（照壁，第 15 行）、`LEVELS`（三层台地，第 18 行）、`LOFT`（凌霄阁平坐，第 28 行）、`APPROACH`（之字形石阶，第 34 行）、`GROVE`（竹林，第 42 行）、`terrain(x, z)`（第 61 行）。
- `buildSite(M)`（第 85 行起）里每一栋建筑的 `put(...)`、`places`、`seats`、`views`、`SHOTS`、`LOG`（钟的撞木，第 596 行）、`site.closed` 的矩形。
- 同一个文件里还放着引擎该有的东西：`put`/`putStack` 的登记逻辑、`placeLift`（第 636 行）、写好的平面的行走器 `createWalker`（第 640 行，#161 第 6 步删）。拆的时候要把这两类分开。
- 文件里含数字坐标的数组字面量 80 处（`grep -c "\[-\?[0-9]..., -\?[0-9]"`），`interior.js` 27 处，`trees.js` 13 处。

### 3. 谁在 import 这些 T00 常数

```
$ git grep -n 'from "\(\./\|\.\./\)\?\(src/\)\?site.js"' app
app/src/game.js:17:    import { placeLift } from "./site.js";
app/src/opening.js:20: import { SCREEN } from "./site.js";
app/yard.js:8:         import { buildSite, createWalker, SITE, LEVELS, APPROACH, SCREEN, GROVE, terrain } from "./src/site.js";
```

| 常数 | `yard.js` 里出现 | 引擎里还用它的文件 |
|---|---|---|
| `SITE` | 7 | `score.js` |
| `LEVELS` | 5 | `score.js`（`settings.js` 里同名的 `LEVELS` 是音量，不相干，拆时顺手改名） |
| `APPROACH` | 3 | `score.js` |
| `SCREEN` | 2 | `opening.js`、`score.js` |
| `GROVE` | 4 | `opening.js` |
| `terrain` | 3 | `backdrop.js`（作参数传入，已经是数据） |

`yard.js` 里按 T00 的地点取东西的几处（`a5901b2`）：

- 第 175 行 `createBackdrop(scene, M, SITE, [LEVELS[0], LEVELS[2]], terrain)`；第 179 行 `createBamboo(scene, GROVE.areas, terrain, GROVE.keep, …)`；第 181 行 `createProps(scene, M, site.censer, (SITE.zN + SITE.zS) / 2)`。
- 第 213 行 `createWell(scene, site.places.well.pool, …)`；第 216 行 `createFlock(scene, site.cedars, site.places.bell.at)`。一关没有井、没有钟就会抛错。
- 第 342 行 `zoneBounds(SITE, LEVELS, APPROACH, SCREEN)`：配乐分区的边界按 T00 的台地算。
- 第 82 行 `fetch(asset("shared/walk/t00.bin"))`：烘好的地面文件名写死。
- 第 236 行 `prologueDay`：序章固定白昼的规则写在引擎里。
- 第 869、897、906 行：留影卡片、存图文件名、分享标题里的「云径禅寺」「云径」。
- 第 1072 行 `__up(true)` 默认 `site.lofts["lingxiao"]`。

### 4. 朱印、仪式、配乐按 T00 写死

- `app/src/journey.js` 第 7–14 行 `SEALS`：七枚印（钟、香、茶、句、水、灯、坐），各带 T00 的地名（「钟楼」「大雄宝殿」「茶寮」「凌霄阁」）和提示句；`SEAL.bell.need = 3`。存储键 `yunjing.journey.v1`。
- `app/src/game.js`：按地点 id 分派仪式，`id === "bell"`、`"tea"`、`"well"`、`"lamp"`、`"sit"`、`"sutra"`（第 90–213 行、第 552–564 行共二十余处）；第 142 行「云径禅寺 · 七印圆满」；第 420 行存图名「云径禅寺-朱印.jpg」；第 446–458 行序章标题「序章 云径禅寺」。
- `app/src/goshuin.js` 第 67 行 `temple = glyphs("云径禅寺")`，第 103 行「七印圆满」「共七印」。
- `app/src/score.js` 第 29–40 行：`ZONES = ["grove", "stair", "gate", "court", "hall", "upper", "summit"]`，`zoneBounds` 用 `APPROACH.zA1`、`SCREEN.z`、`SITE.zS`、`LEVELS[0].zS`、`LEVELS[2].zS`；`zoneOf` 按 z 坐标切区。
- `app/src/incense.js` 第 6、8 行：`INCENSE_HALLS = ["main", "yaoshi", "guanyin"]`，`SEALED_HALL = "main"`。
- `app/src/interior.js` 第 57–64 行 `GALLERY`（按殿 id 写的画框文字），第 73–76 行 `STAND`（每殿立哪件扫描），第 174 行观音殿的专用机位 `GUANYIN_CAM`。
- `app/src/opening.js` 第 172 行 `GATE = { z: 40, zS: SCREEN.z - 0.6, … }`；第 55 行注释里的路线（藏经楼屋脊 → 山门 → 竹林）。
- `app/src/mood.js` 第 39 行：冬季 `snow: 1` 写死。T05 的基准 J01「初冬晴冷」是冬天无雪，现有十六种季时表达不了（见 `PRD.md` §4）。

### 5. 构建产物与工具里的 `t00`

| 位置 | 写死的东西 |
|---|---|
| `tools/bake-walk.mjs` 第 25 行 | `export const LEVEL = "t00"` |
| `tools/walk/scene.mjs` 第 17 行 | `await import("../../app/levels/t00/hall-views.js")` |
| `tools/walk/scene.mjs` `gridsOf` 第 47 行 | 户外格子的范围用 `SITE.x`、`SITE.zN`、`APPROACH.end` |
| `tools/bake-doorways.mjs` 第 30 行 | `LEVEL = "t00"`，产物 `t00.json` |
| `app/src/doorway.js` 第 162 行 | `fetch(base + "t00.json")` |
| `tools/cameras.mjs` 第 19 行 | 写 `docs/t00/camera-manifest.json`、`scene_id: "T00"` |
| `tools/play-t00.cjs` | 文件名即关卡 |
| `tools/inside.cjs` | **已经接受关卡名**（默认 `t00`，没有表的关卡报出有表的那些）——这是现成的样板 |
| `app/src/debug.js` 第 46 行 | 选关卡时缺省退到 `"t00"`（已是「从列表里选」，样板） |

### 6. 存储键

`git grep -noh "yunjing\.[a-z]*\.v[0-9]" app` 读出 10 个键：`journey`、`place`、`settings`、`lang`、`relang`、`incense`、`ending`、`prologue`、`visit`、`debug`。前缀 `yunjing` 是 T00 的寺名，但已是全站的命名空间；**不改名**（改名要迁移，换来的只是好看）。属于「这一关」的是 `journey`、`place`、`incense`、`ending`、`prologue`、`visit`；属于「这个访客」的是 `settings`、`lang`、`relang`、`debug`。

### 7. 测试怎么依赖 T00

- `tests/unit/` 下 48 个文件 import `site.js`（`git grep -l "site.js" tests/unit | wc -l`），3 个读 `SEALS`/`journey.js`。这些测试全部默认 T00，拆的第一步要让它们**一个都不用改**（`site.js` 留一个转出口），否则第一个 PR 就是几十个文件的 diff。
- `tests/unit/plan.test.mjs` 的 `places` 列表是 T00 的命名地点；T05 要自己的一份（`t05-plan.test.mjs`），不往 T00 的里加。

## 二、业界做法（开工前查的，按 `AGENTS.md` 铁律）

查于 2026-11-20。「读了」= 打开了页面正文；「摘要」= 只看到检索摘要；「源码」= 读了本机 `node_modules/three@0.186.0`。

| 做法 | 出处与读到的程度 | 对我们的意思 |
|---|---|---|
| 一个常驻的壳（相机、灯、界面）下面换整关；关卡名在地址里（`?scene=`），可预载前后关 | Needle Engine SceneSwitcher 文档，读了 | 我们的壳 = `yard.js` 里的渲染器、行走器、镜头、界面、音频；关卡 = 数据加建造函数。`?level=` 跟它同一个意思 |
| 换关时旧关整棵释放；跨关的状态放在关卡之外的单例里 | Godot「Change scenes manually」，读了 | 存档、设置、朱印帐属于壳，不属于关卡 |
| 每关一个资源包，按需加载 | Unity Addressables 规划文、PlayCanvas `changeScene`，摘要 | 每关一个 Vite 分块 |
| `import()` 自动分块；变量路径须以 `./`/`../` 开头、带扩展名、变量只占一层目录；`import.meta.glob` 默认懒加载、参数须是字面量 | Vite 官方 Features 页，读了 | 用 `import.meta.glob("../levels/*/level.js")` 做关卡登记表：漏登的关卡在构建时就看得见，一关一个分块，序章的访客不下载 T05 |
| 存档：一个带版本号的信封，迁移函数一步一步、每步有单测 | 几篇游戏存档实践文，摘要 | 已有键不动；新增一个跨关的键，按关分节；迁移有单测 |

**没找到**：three.js 生态里没有一个「关卡框架」库可以直接拿来（pmndrs、Babylon 没细查，不引）。所以不引入新依赖，按上表的通行做法在本仓库里写几十行的登记表和加载器。

## 三、目标形状

```
app/levels/<id>/level.js     一关的入口：export default { id, name, glyphs, build(M) → site, bounds, zones, seals, moods, opening, credits, … }
app/levels/<id>/site.js      平面（T00 由 app/src/site.js 搬来）
app/levels/<id>/interior.js  殿内陈设（STAND、GALLERY、香）
app/levels/<id>/works.js …   已有的画作、匾、殿内机位、译文
app/src/level.js             登记表 import.meta.glob + loadLevel(id)；?level= 的解析
app/src/plan.js              put / putStack / 登记，引擎的「怎么做」
```

引擎读关卡对象，不读具体的关卡。缺什么（没有井、没有钟、没有平坐）就不建什么，而不是抛错。

## 四、步骤（每步一个 PR，T00 每一步都全绿）

规则（每步都适用）：

- **T00 不变**：`pnpm run verify` 全过，不放宽断言；`node tools/cameras.mjs` 重生成的 `docs/t00/camera-manifest.json` 逐字节相同；烘焙地面的指纹（`t00.bin` 的文件名）不变——指纹由几何、外廓、烘焙参数和平面的行走数据算出（`CLAUDE.md`「The floor baked…」），所以它不变就说明搬家没动任何一块地；动画面的步（S2、S3b）在同一个 T4 Job 里出 cam01–cam06 和十六个殿内机位，逐张平均像素差 < 0.5/255（#138 验收 4）。
- **能单独回退**：每步只搬不改或只加不删；回退一个 PR 不需要连带回退别的（下面写明例外）。
- **不和在跑的 PR 打架**：S1 动 `site.js` 全文，开工那天由主创看一眼开着的 PR 里谁改了 `site.js`（2026-11-20 开着的 #357 点灯、#347 除夕撞钟、#327 银杏都可能碰到它附近），排在它们合并之后或请它们先 rebase。

| 步 | PR 标题（草） | 做什么 | 验收 | 依赖 | 回退 |
|---|---|---|---|---|---|
| S1 | `refactor(level): move T00's plan into app/levels/t00/site.js` | `site.js` 拆成 `app/src/plan.js`（`put`/`putStack`/登记、`placeLift`、`createWalker`）和 `app/levels/t00/site.js`（常数、`terrain`、`buildSite` 的内容、`SHOTS`、`LOG`）。`app/src/site.js` 留成**只有转出口**的一个文件（`export * from`），所以 48 个测试和全部工具一行不改 | 上面的「T00 不变」三条（指纹、清单逐字节、verify）；`app/src/site.js` 里没有任何坐标和建筑名（`grep -c "put(" app/src/site.js` 为 0） | 无 | 独立 |
| S2 | `feat(level): load a level by name (?level=, import.meta.glob)` | 加 `app/src/level.js` 与 `app/levels/t00/level.js`；`yard.js` 改为 `const L = await loadLevel(id)`，不再 import `SITE/LEVELS/APPROACH/SCREEN/GROVE/terrain`；`backdrop`、`bamboo`、`props`、`well`、`flock`、`zoneBounds`、`opening` 改从 `L` 取，**缺了就不建**；地面文件名 `shared/walk/${L.id}.bin`；`?level=` 只认登记表里有的，不认的照 T00 走并在控制台警告一次；`__level()` 报当前关卡 | 「T00 不变」+ 画面像素差；`git grep -n "SITE\|APPROACH\|SCREEN\|GROVE" app/yard.js` 为空；新单测 `level.test.mjs`：登记表列出 `t00`，`loadLevel("nope")` 退回 T00 | S1 | 独立（回退后 S1 照常） |
| S3a | `refactor(level): seals, rites and the book come from the level` | `SEALS`（名字、地名、提示、`need`）搬进 `levels/t00/`；`game.js` 的仪式按地点上写的 `rite`（`bell`/`tea`/`incense`/`sutra`/`well`/`lamp`/`sit`/`observe`）分派，不按 id；`goshuin.js`、留影卡片、存图名、序章标题的寺名从 `L.name`/`L.glyphs` 取 | `journey.test`、`rites*.test`、`goshuin.test` 不改断言全过；e2e `rites`、`finale` 过；`git grep -n "云径" app/src app/yard.js` 只剩注释 | S2 | 独立 |
| S3b | `refactor(level): halls' furnishings come from the level` | `STAND`、`GALLERY`、`GUANYIN_CAM`、`INCENSE_HALLS`/`SEALED_HALL`、`WORKS`/`HANG`、匾的手迹 `HANDS`、鸣谢里属于这关的条目，搬进 `levels/t00/`，引擎经 `L` 读 | `git grep -n "levels/t00" app/src app/yard.js` **为空**（#138 验收 1）；`interior.test`、`incense.test`、`credits.test`、`plaques.test` 全过；殿内十六机位像素差 | S2 | 独立 |
| S3c | `refactor(level): music zones and the opening come from the level` | `ZONES`/`zoneOf`/边界和每区的乐句表从 `L.zones` 取（`score.js` 留「怎么切、怎么接」）；`opening.js` 的 `GATE`、路线从 `L.opening` 取，没有就不播开场 | `score.test`、`opening.test` 全过；`tools/music.mjs` 渲出的 T00 十分钟报告（峰值、静音段、乐句日志）与改前一致 | S2 | 独立 |
| S4 | `feat(save): a level-aware place and one book across levels` | `yunjing.place.v1` 加 `level` 字段（缺省读作 `t00`）；新键 `yunjing.levels.v1 = { v: 1, last, open: { t05: … }, book: { t05: { seal, pages, closedSeason } } }`；T00 的 `yunjing.journey.v1` 等**原样不动**，T00 的书仍从它读 | 新单测 `save-levels.test.mjs`：拿 `a5901b2` 上真实格式的存档（含旧版只有一个数字的 `incense.v1`）读出与改前相同；坏存档忽略不抛；`resume.test`、`relang.test` 全过 | S2 | 回退要连同读新键的 T05 代码（T05 第一阶段不读它，见 `PLAN.md`） |
| S5 | `build(walk): bake and ship each level's floor and doorways` | `tools/bake-walk.mjs`、`bake-doorways.mjs`、`walk-diff.mjs` 收 `--level=<id>`，不认识的名字退出码 1；两个烘焙工具不带 `--level` 时烘**所有**关卡（构建、单测、CI 不用再改）；`tools/walk/scene.mjs` 的户外范围与分段从 `levels/<id>/bake.js` 取（页面不导入，名字不进访客的包）、殿内机位从 `levels/<id>/hall-views.js` 取；`doorway.js` 读 `<level>.json`；`bake-doorways` 只清自己关卡的文件；CI 缓存键去掉 `t00`，`walk-diff` 逐关。`KEPT` 不用改（`levels/` 下的 `.js` 本来就不拷） | T00 的 `t00.bin` 指纹与字节不变；`--level=t00` 与不带参数产物相同；门洞画面逐张与 main 相同（指纹因脚本自身入哈希而变）；CI `verify` 绿 | S2 | 独立；#405 |
| S6 | `chore(tools): every picture and check tool takes a level` | `shots.js`、`cameras.mjs`（写 `docs/<level>/camera-manifest.json`）、`edges`、`nearplane`、`around.mjs`、`gpu-render.sh`、`play-t00.cjs`→`play.cjs --level`（旧名留一个转发） | 每个工具不带参数时与改前输出相同；带 `--level=_probe` 能跑 | S5 | 独立 |
| S7 | `test(level): a probe level with one pavilion proves the engine stands alone` | `app/levels/_probe/`：一块平地、一座亭子、一个命名地点、一个机位，无美术；只在工作台（dev 与 PR 预览）认 `?level=_probe`，生产与 canary 的 `dist/` 里没有它（`deploy.test` 扫） | #138 验收 6：`?level=_probe` 走得进去；`probe-plan.test.mjs` 洪水填充；e2e `probe`（BARE）零错误；`dist/` 扫不到 `_probe` | S2、S5 | 独立 |
| S8 | `feat(mood): a level may set its own seasons and its fixed hour` | `L.moods(season, time) → patch`（T05 用来做「冬天无雪」的 J01）；`prologueDay` 改成 `L.fixedHour`（T00 仍是「书满一次之前固定白昼」） | `mood.test` 每个季时每个字段齐全；T00 十六种季时的 `moodOf` 输出与改前深相等 | S2 | 独立 |
| S9 | `docs(level): CLAUDE.md and the playbook say where a level lives` | `CLAUDE.md`「Where things live」「The plan is data」；`LEVEL-PLAYBOOK.md` §一、§三（见下节） | #138 验收 8 | S3b、S6 | 独立 |

S3a、S3b、S3c、S4、S5、S8 只依赖 S2，可以并行派给不同会话（它们改的文件不重叠：S3a `journey/game/goshuin`，S3b `interior/incense/credits/plaque`，S3c `score/opening`，S4 `resume/journey 的读法`，S5 `tools/walk`、`doorway`、`vite.config`，S8 `mood/yard 的初始季时`）。S4 与 S3a 都碰 `game.js` 的一小段，谁后合谁 rebase。

**T05 第一阶段真正卡在哪几步上**：S1 → S2 → S5（T05 能装进来、能烘自己的地面）。S7 是「引擎不再依赖 T00」的证明，T05 的第一个 PR 本身也能证明这一点，所以 S7 可以和 T05 第一个 PR 合在同一周，但不并进同一个 PR（`_probe` 不进发布产物，T05 要进）。S3a/S3b/S3c/S4/S8 是第二阶段（朱印、殿内、配乐、衔接、J01）之前做完即可。

## 五、`LEVEL-PLAYBOOK.md` 与现状不一致的地方

| 手册的位置 | 手册说 | 现状（证据） | 建议怎么改（S9 做） |
|---|---|---|---|
| 状态说明 | 「第 10、11 步 T00 自己还没走完（验收结论仍在旧证据上，发版未合）」 | T00 已发 0.5.0、0.6.0（`LATEST-GOALS.md` 第 66、73 条），0.7.0 的发版 PR #339 开着；发版改为「main 上 canary、发版上生产」（#308） | 改为已走过，写 0.6.0 第一次走生产路径的教训（第 73 条：线上哈希比对误报） |
| §一 末句 | 「分出来是 #138 的事（T00 发布后做）」 | T00 已发布，#138 仍未开工（本页 §一 第 1 条：四个引擎文件九处 import `levels/t00`） | 指向本页的 S1–S9 |
| §二之二 第 2 步 | 「新关卡在 `tools/walk/scene.mjs` 的 `gridsOf` 里照样列出它的格子」 | `gridsOf` 对平坐和殿内已经是通用的（按 `site.lofts`、`rooms.rooms` 循环），但户外格子的范围写死在 `SITE`/`APPROACH` 上，文件头 import 的是 `levels/t00/hall-views.js`，`bake-walk.mjs` 的 `LEVEL = "t00"` | 新关卡**不改** `gridsOf`，在 `levels/<id>/bake.js` 里给 `outdoors` 和 `bands`；#405 已改写剧本这一步 |
| §二之二 意图表 `site.closed` | 例子用 `SITE.GROVE_IN` | `SITE` 是 T00 的常数 | 例子留着，注明是 T00 的值 |
| §三 | `app/levels/<level>/`：「平面与关卡数据（#138 之后）」 | 今天放不进去：引擎从 `app/src/site.js` 取平面 | S2 之后去掉括号 |
| §三 | 新关建 `docs/<level>/decisions.md` 等小写文件名 | `docs/t05/` 已用大写（`DECISIONS.md`、`SOURCES.md`），`docs/t00/` 两种都有 | 手册写「沿用该关已有的名字」，不为统一改名 |
| §二 第 3 步 | 机位用 `tools/cameras.mjs` 出清单（隐含） | `cameras.mjs` 只写 `docs/t00/` | S6 |
| §二 第 6 步 | 「仪式、朱印与镜头」按 T00 的七印写 | 朱印数、仪式类型写死在 `journey.js`、`game.js`；T05 的调研包主张「不做七印，用三张观察页」（`docs/t05/CHECKPOINTS.md` §0、§2） | 手册加一句：每关的印数和仪式由该关 PRD 定（T05 见 `PRD.md` §6），引擎按 S3a 读 |
| §四 | 「下一关从第 2 步起，每条线收尾都请所有者走十分钟」 | 没有变化，仍对 | — |
| 整页 | 没写跨关的存档和朱印帐 | 存档键全按 T00 写（本页 §一 第 6 条） | 加一节，指向 S4 |
| T05 自己的旧计划 | `docs/t05/PLAN.md` §3.5、`SITE.md` §6 写「台基/月台是 `decks`、踏道是 `ramps`、佛坛是 `solids`、佛像是 `posts`」 | 与手册 §二之二「新关卡不手写 `walk.*`」相反；那两页写于 #274 之前（2026-11-17） | `PLAN.md` 已在本 PR 改写；`SITE.md` §6 加一行指向手册（本 PR 做） |
| T05 自己的旧计划 | `PLAN.md` §3.1「如果 #138 还没做完，先在 `site.js` 里加一个 T05 分支」 | 这会让引擎同时写死两座寺 | 不采用；本页 S1、S2 先合 |
