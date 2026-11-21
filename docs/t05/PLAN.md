# T05 分阶段计划与第一阶段 PR 清单

核对日期：2026-11-20（改写 2026-11-17 版）。基线：`origin/main` `a5901b2`。issue：#359 验收第 5 条。要做什么、怎么判，在 `PRD.md`；引擎怎么分关，在 `LEVEL-SPLIT.md`；造像，在 `STATUE-PIPELINE.md`。2026-11-17 版里仍然有用的体量估计和光比放在文末附录；它的技术路线（手写 `walk.*`、在 `site.js` 里加 T05 分支、重新标定 `eyeShut`）已作废，理由见 `PRD.md` §12。

## 一、阶段

| 阶段 | 产出 | 判据（`PRD.md` §9 的条目） | 等什么 |
|---|---|---|---|
| **一 白盒可走** | 院落、台基与月台、踏道、大雄殿外壳与殿内地面、佛坛与七尊体块、六站、烘焙地面；从 T00 走进来或 `?level=t05` 直达 | 第 1、2、3 条；第 4 条的机位先站得住 | `LEVEL-SPLIT.md` S1、S2、S5；§11 第 1 项已定；范围档位（`SCOPE-OPTIONS.md`）定下后补第一阶段的前奏 PR。**不等顾问** |
| 二 光与殿内 | 「在殿内的程度」连续过渡；持灯（`SCOPE-OPTIONS.md` (b)）；光照探针（PMREM 与 `LightProbeGridWebGL` 比一次）；曝光渐变；J01 季时；Z1/Z3 声场与大殿混响。**光照与曝光的目标图**：`refs/t05-concept-2026-11-20/02-hall-from-door.webp`（#372），取门光在地上铺成一道、往里渐弱、浮尘、梁架褪色；按主创意见，门光要照亮中间三尊的脸（图里像身亮度偏平均）、彩画要更温哑、像要更压人，图上的手印和比例不作参考 | 第 4 条出图；第 6 条光比；T4 第一次量；cam03 与目标图并排出图 | S8（关卡自己的季时）；第 4 项（基线季时） |
| 三 七佛与群像 | 正式七尊（Tripo 生成、LOD、法线、上色）；认七佛（(c)，按位置认，不等手印；2026-11-20 改写）；胁侍与天王体块到中模；梁架与彩画色带 | 第 5 条；第 7 条 T4 部分；认七佛的独立验收（`PRD.md` §1.3） | 释迦样件 #370 先过；**`PRD.md` §9.1 的门槛外画面在批量造像之前验完**（2026-11-21 已用七尊白盒从 cam03 实拍过三种画幅，横屏两档照实拍锁、竖屏改给「初见」镜头；换上正式七尊再出一次）；所有者 2026-11-21 批七尊共 200 点（含当时已花的 60），以 `docs/t05/SHAKYAMUNI-SAMPLE.md`「点数台账」为准（随 #407 进仓库；2026-11-21 已花 180），扩产条件见 `STATUE-PIPELINE.md` §四；`STATUE-PIPELINE.md` 的工具 |
| 四 印、书、声音、语言 | 一枚印与三张观察页；抄碑（(a)，抄一句进书）；书上 T05 页；标题页「第一章」；配乐两小段；四种语言；鸣谢与登记表 | 第 8 条；`mobile-audit` | S3a、S3c、S4；§11 第 2、3、5、6 项 |
| 五 验收 | 七机位 T4 重拍、独立评审、礼仪评审（`PRD.md` §9 第 9 条）、手机按 `PRD.md` §9.2 的四段路线实测、所有者走十分钟 | 第 7 条手机部分；全部九条在同一提交上有证据；第 8 条（正式候选的跨章）在这一阶段之前的第四阶段先过 | #188 的 `tools/device.cjs` |

每一阶段收尾请所有者用手机走十分钟（`LEVEL-PLAYBOOK.md` §四）。

## 二、第一阶段 PR 清单

「目标」一行；「依赖」是必须先合的；「与 T00 收尾并行」指能不能和 T00 那边开着的工作（#357 点灯、#347 除夕撞钟、#350 拍一段、#327 银杏、#163 小沙弥接入、#183 远景、#315 史实表）同时做而不互相阻塞。

| # | PR（标题草稿） | 目标 | 依赖 | 与 T00 收尾并行 |
|---|---|---|---|---|
| 1 | `refactor(level): move T00's plan into app/levels/t00/site.js`（`LEVEL-SPLIT.md` S1） | 平面搬出引擎，`app/src/site.js` 只剩转出口，T00 一字节不变 | 无 | **部分**：动 `site.js` 全文，排在当时改 `site.js` 的 PR 合并之后（开工那天主创看一眼） |
| 2 | `feat(level): load a level by name (?level=, import.meta.glob)`（S2） | `yard.js` 从关卡对象取一切；缺什么不建什么；`__level()` | 1 | 可以：只动 `yard.js` 的装配段与几个 `create*` 的入参 |
| 2a | `fix(level): a level other than the prologue leaves T00's place, opening, title and music alone` | **2026-11-20 核过代码，第一阶段一进 `?level=t05` 就会带上 T00 的东西**（`LEVEL-PLAYBOOK.md` §四缺口 5）：①`game.js` 第 478 行的 `free` 不认 `?level=`，所以 T05 的页面会**读** T00 存的 `yunjing.place.v1`（标题页按 T00 的坐标给「接着走」），又每两秒把 T05 的坐标**写**进同一个键，T00 的老访客下次「接着走」就站到错处；②`opening.js` 的 `openingFor` 不认 `?level=`（`SILENT` 里没有），第一次来的访客在 T05 里会飞 T00 开场的那条路；③序章标题的 `atGate` 看的是 T00 山门前的坐标，在 T05 里走到同一坐标就会升起「序章 云径禅寺」；④配乐分区（`score.js` 的 `zoneOf`）只认 T00 的七个区名。本项让关卡对象说这一关有没有开场、序章标题、存不存位置（S3a、S3c、S4 之前的最小一步）：非 `t00` 的关卡不读不写 `yunjing.place.v1`、不播开场、不升标题；T05 的 `zones` 先全部落在 `court`（只有单音和留白），并在 `level.js` 里写明是占位。验收：e2e 在 `?level=t05`（或 S7 的 `?level=_probe`）里走一段、关掉、不带参数重开，`localStorage` 里 T00 的 `yunjing.place.v1` 与走之前逐字节相同，`__opening()` 与 `__prologue()` 都没起 | 2；与 4 一起验（`_probe` 上就能测） | 可以 |
| 3 | `build(walk): bake and ship each level's floor and doorways`（S5） | `bake-walk --level`、`gridsOf` 读 `levels/<id>/bake.js`、`shared/walk/<id>.bin`、CI 缓存键不再写死 `t00`（#405） | 2 | 可以 |
| 3a | `chore(tools): every picture and check tool takes a level`（`LEVEL-SPLIT.md` S6，**单列，关键路径**） | `shots.js`、`cameras.mjs`、`edges`、`nearplane`、`around.mjs`、`gpu-render.sh`、`play-t00.cjs` 认 `--level`，默认 `t00` 时输出与改前相同；**`horizon.test` 认关卡**（「地平线以下不露天」能对 T05 跑，缺口 2）；`follow.test`、`spring-arm.test` 的路线表按关卡取（缺口 4 的前提）。PR 9 的 `nearplane:grid --level=t05`、PR 12 的 `edges:grid --level=t05`、PRD 第 2 条都靠它 | 3 | 可以 |
| 4 | `test(level): a probe level with one pavilion`（S7） | `_probe` 关证明引擎不靠 T00；不进发布产物；**建立「只在工作台认」的关卡登记**（dev 与 PR 预览认，canary 与生产退回序章；2026-11-21 起 canary 也认，见下「已定」），T05 白盒照用（所有者 2026-11-20 定，见下文「已定」一节）；`level` 场景在 canary 构建上断言 `?level=_probe` 回落到 `t00` | 2、3 | 可以 |
| 5 | `feat(t05): the courtyard, the platform and the stair, walked from arrival`（T05-1） | `app/levels/t05/` 骨架：`level.js`、平地院子与围墙、3 米台基、月台、18 级踏道（`stairGeo`）、栏杆；**`site.start` 一开始就放在最终的到达点，外山门外 (0, +215)**，中轴未建之前用一段平地接到院子（缺口 8：洪水填充的种子、`views.arrive`、e2e 起点、`?fast=1` 的时长都建在它上面，中途搬家要全部重算）；烘出 `t05.bin`；`t05-plan.test.mjs` 洪水填充到 A、B；**`t05` 登记为只在工作台认**，`level` 场景在 canary 构建上断言 `?level=t05` 回落到 `t00`、在预览构建上是 `t05`，构建扫描断言 canary 与生产的 `dist/` 里没有 T05 的关卡模块；**向外看一圈**：从到达点、院子 A 站、月台 B 站各朝四个方向、朝墙顶出图（`horizon.test` 认关卡之前用 `shots.js`），地平线以下不露天 | 2a、3、3a | 可以：全是新文件 |
| 6 | `feat(t05): the nine-bay hall, its shell and its floor`（T05-2） | 大雄殿外壳：九间开间按 `ARCHITECTURE.md` §2.1、单檐庑殿（`buildHall` 的 `G` 取进深一半，按参数推断能出庑殿，**未出图验证**；出不来就在 `building.js` 加一个屋顶式样，单独一个 PR）、三门四窗、门槛按 `PRD.md` §2；殿内地面与外面同一张烘焙地面（不换场，`PRD.md` §2.1）。**若改了 `building.js`（缺口 7）**，验收加「T00 不变」三条：`t00.bin` 指纹不变、`docs/t00/camera-manifest.json` 逐字节相同、`shots.js` 改前改后 cam01–cam06 与 `court@autumn-dusk@third` 平均像素差 < 0.5/255、三角形与绘制次数相同（S2 #382 的做法），殿内十六个机位用 `inside.cjs` 同样比 | 5；§11 第 1 项已定（殿院连成一个空间，所有者 2026-11-20「1-10 都同意」） | 可以；若要改 `building.js`，与 #315、结构评审的改动对一下 |
| 7 | `feat(t05): the altar, seven blocks and the aisles`（T05-3） | 佛坛 37.5×4.8×0.87 m、七个座位 x = 0、±5.80、±11.33、±16.45（`DECISIONS.md` §3）；七尊体块按白盒高度、释迦西偏 7°；十四胁侍与二天王的占位体块；内柱（减柱，柱位【提案】）；东西通道 ≥ 3 m；洪水填充到 C、D、E、F | 6 | 可以 |
| 8 | `feat(t05): the axis from the outer gate, its terraces and walls`（T05-A1，范围 C 第一批） | 前奏：外山门外到院子北口的地形，无量殿一组的第二层高台（高差按 `SITE.md` §4.2 提案 +1.0 m）、甬道、围墙；到达点改到外山门外 (0, +215)；在月台西留碑亭的体块、殿内门侧留灯案的位置（只占位，不做互动，`SCOPE-OPTIONS.md` S-1）；`t05-plan.test.mjs` 洪水填充加外山门、内山门、牌坊、无量殿穿堂、院子北口 | 5 | 可以：全是新文件 |
| 9 | `feat(t05): the outer gate, the inner gate and the Wuliang hall, as shells`（T05-A2） | 外山门、内山门（三间带两侧便门）、无量殿（五间、单檐歇山，前后开门可穿过）用 `buildHall` 的参数出外壳；位置照 `SCOPE-OPTIONS.md` §二 B 的图（顺序照真寺，位置是提案）；穿堂过 `edges:grid`、`nearplane:grid`；**三座外壳的正、侧、俯三向图先给结构评审**（缺口 9：位置和高差都是提案，T00 的结构评审拖到做完之后，返工四个阶段） | 8、3a | 可以 |
| 10 | `feat(building): a four-post, three-bay archway (paifang)`（T05-A3） | `building.js` 没有牌坊：新写四柱三间三楼木牌坊的生成器（或单独一个模块），先出正、侧、俯三向图给结构评审，再放到中轴上。改 `building.js` 的话，验收加「T00 不变」三条（同第 6 项：指纹、相机清单、`shots.js` 前后像素差 < 0.5/255） | 生成器不依赖别的；放上中轴依赖 8 | 可以：生成器从第一天就能做；若改 `building.js`，与 #315、结构评审的改动对一下 |
| 11 | `feat(t05): seven named views and their manifest`（T05-4） | `views.cam01…cam07`（cam01–cam06 照 `PRD.md` §3，新加 cam07「内山门望殿」，所有者 2026-11-20 定七个，`SCOPE-OPTIONS.md` S-4；**cam07 的构图目标**是 `refs/t05-concept-2026-11-20/03-axis-from-inner-gate.webp`（#372：门洞框住柏树甬道、牌坊、高台上的无量殿和远处大殿的庑殿顶），白盒出图与它并排看）、`views.arrive`；`tools/cameras.mjs --level=t05` 写 `docs/t05/camera-manifest.json`；`shots.js --level=t05` 出七张；单测每个机位站在可走格子上；**向外看一圈**（缺口 2）：六站和中轴三处（外山门、内山门、无量殿穿堂）各朝四个方向、朝墙顶、朝背面出图，`horizon.test --level=t05` 绿；发现逐条开 issue | 7、9、10、3a | 可以 |
| 12 | `test(e2e): t05-walk, from the prologue's book or straight in`（T05-5） | e2e `t05-walk`：`?level=t05` 直达，从外山门外走到 F，**正常步速**（2.1 m/s，BARE；至少跨门槛和上下踏道两段不用 `?fast`，缺口 11：T00 的门只在加速时过得去，见 `docs/t00/PITFALLS.md` A3）；**镜头路线**（缺口 4）：踏道上下、跨门槛进殿、殿内绕佛坛走东西通道三条进 `follow.test`、`spring-arm.test`；判的是 `PRD.md` §9 第 3 条（白盒）：工作台直达、真实输入（键盘与点地，踏道和门槛两段不瞬移）、发布渠道隔离（canary 与生产回落到 `t00`，构建扫描见 #414 的 `level-bench.test`）；断言 T00 的 `yunjing.journey.v1`、`yunjing.place.v1` 不动。**正式的跨章**（旧 T00 存档、帐页翻到 T05、链接直达、续玩、返回 T00）是 §9 第 8 条，第四阶段的 e2e `t05-chapter` 判，不在这一项；`edges:grid`、`nearplane:grid` 带 `--level=t05` 跑通 | 11 | 可以 |
| 13 | `docs(t05): phase one measured`（T05-6） | T4 一个 Job 里 T00 首院与 T05 cam03、cam06、cam07 交替量 `__cost`；**手机低档量一次**（`tools/device.cjs`，Pixel 8a，按 `PRD.md` §9.2 的四段路线与取数口径；白盒只收基线，不判预算），**所有者用自己的手机按一张不超过十项的清单走十分钟**，两样都是阶段 3 的退出条件（`LEVEL-PLAYBOOK.md` 阶段 3，缺口 12）；做不了就由所有者明说，记「未经真机」；数写进 `docs/HANDOFF.md` 与 `docs/t05/`；七张图推证据库 | 12 | 可以 |

**依赖图**：1 → 2 → 2a → 3 → 3a → 5 → 6 → 7 → 11 → 12 → 13；中轴一支 5 → 8 → 9 → 11；牌坊 10 的生成器随时可做，放上中轴在 8 之后，也汇进 11；4 挂在 2、3 后面，与 2a、5 同时做（2a 的验收可以先在 4 上跑）。

**分片预算不再是依赖**：#376 已合（`d775239`，整套的机器数按场景表算，加一个场景就多一台），PR 12 加 `t05-walk` 不会再撞上 16 分钟的上限（`LEVEL-PLAYBOOK.md` §四缺口 10）。

**每个第一阶段的 PR 都要的**（`LEVEL-PLAYBOOK.md` 阶段 3 与 §四末段）：

- **改了地面的 PR**（5、7、8、9）附一张 `node tools/walk-diff.mjs … --png=` 的可走图，**主创看过写一句**（缺口 1：新关卡没有基准，`walk-diff` 只查命名地点，报不出「哪里多出一块不该走的地」；T00 的龙井池子、山门侧间就是这样后来才补进 `site.closed`）。
- 白盒尺寸的出处（哪些按文献、哪些是提案）随 PR 5–10 各在 `docs/t05/SOURCES.md` 补一行。
- 新增的界面文字四种语言齐（`i18n.test`）。
- 白盒图用 `node tools/evidence.mjs push` 推证据库，不进 git。

**范围**：所有者 2026-11-20 选了 `SCOPE-OPTIONS.md` 的 C 档、分两批（「都按你的推荐，选 C 分两批」）。第一阶段做 B 的中轴白盒（第 8–10 项），碑亭与灯案只留位置；持灯、抄碑、认七佛在后面的阶段依次加，各自的 PR 见 `SCOPE-OPTIONS.md` §三。

**能并行派的**：

- 1、2、2a、3、3a 是一条线，同一个会话做最省（每步都要跑 T00 的全套）。
- 4 与 5 可以两个会话同时做。
- 中轴（8、9）在 5 之后可以和大殿（6、7）两个会话同时做；牌坊的生成器（10）第一天就能另派。
- `STATUE-PIPELINE.md` §五「不用等」的那几件（`tools/statue/` 搬家、LOD、法线烘焙、取点工具、探针对比）不在第一阶段的关键路径上，可以另一个会话从第一天起做；`tools/statue/` 的建法等 #163 合并（`STATUE-PIPELINE.md` §三）。
- `LEVEL-SPLIT.md` 的 S3a、S3b、S3c、S4、S8 只依赖 2，第一阶段期间就可以派，第二、四阶段之前合完即可。
- #315 的史实表不花钱，可以和这一切并行。

**第一个开发 PR 在 PRD 合并当天就能开工的**：第 1 项。它不等所有者的任何答复；§11 第 1 项已于 2026-11-20 定下，第 6 项也不再被卡。

### 已定：白盒阶段的 T05 在工作台和 canary 开放，生产不开（2026-11-21 改）

所有者 2026-11-21（主创转达）：「t05 改成 canary 可以测」。这推翻了下面 11-20 的「只在工作台开放」：

- `?level=t05` 在 dev server、PR 预览和 canary 都认（`app/src/level.js` 的 `TESTING`，`app/src/bench.js` 的 `benchBuild`）。生产仍不认，照 S2 的规则退回序章并说明问的是什么。
- 生产构建里没有 T05 的关卡模块、烘焙地面和门内清单。`tests/unit/level-bench.test.mjs` 构建三种目标分别断言：预览和 canary 有，生产没有。
- e2e `level-targets` 按发布的方式构建 canary 和生产两份，各打开 `?level=t05`：canary 走的是 T05、用 T05 自己的地面；生产回落 `t00`，`known: false`。
- **存档再核一遍**：第 2a 项（#389）只管了「记住走到哪」、开场和序章标题。核下来，T05 还会读序章的朱印帐，还会把走的步数记进序章的 `yunjing.visit.v1`。本 PR 一并改了：非序章的关卡朱印帐只放在内存里，不记步数，「从头走起」也不清序章的东西。`level-targets` 先在浏览器里放好序章的朱印帐、步数和停留处，再在 canary 上走 T05，断言三样都原样不动，T05 也不显示序章的印。
- **统计**：canary 构建本来就没有访客计数（`deploy.test.mjs`）。生产不认 T05，所以 T05 不会进统计。
- 阶段 8 验收通过后对所有人开放的做法不变：改一行登记，另开 PR。

### 原定（已被上面推翻）：白盒阶段的 T05 只在工作台开放（2026-11-20）

所有者 2026-11-20（主创转达）：「同意，白盒只在工作台开放」，即当时推荐的方案 A（`LEVEL-PLAYBOOK.md` §四缺口 6）。

- `?level=t05` 只在工作台认：dev server 和 PR 预览，做法照 S7 的 `_probe`。canary 和生产都不认，不认识的名字照 S2 的规则退回序章。
- 阶段 8 验收通过后再对所有人开放，届时改一行登记，并另开 PR。
- **要有测试守住**，落在第 4 项（S7，工作台的认法由它建立）和第 5 项（T05 第一次登记）的验收里：
  - `level` 场景在 **canary 构建**（`VITE_DEPLOY=canary`）上打开 `?level=t05`，断言 `__level()` 为 `{ id: "t00", asked: "t05", known: false }`、页面零错误；在预览构建上打开同一个地址，断言是 `t05`。
  - `tests/unit/deploy.test.mjs` 一类构建扫描：canary 与生产的 `dist/` 里，入口和分块都不含 T05 的关卡模块（`_probe` 同样）。

当时的理由：canary 与生产都是给玩家看的地址，分享出去的链接会让人看到体块；第 2a 项之前，白盒会读写真实玩家的存档；S3a、S4 之前，朱印帐和印仍按 T00 写；代价只是一个常量。PRD §11 第 3 项的「不设门槛」说的是做完的关卡。

## 三、第一阶段做完是什么样

- `node tools/shots.js --level=t05 cam01 … cam07` 出七张白盒图：内山门望殿、九间、台基、门洞、七尊体块、梁架体块都在，不好看没关系。
- `https://<预览>/?level=t05` 能从外山门外沿中轴走进院子、走进殿、走完六站；`?level=t05&fast=1` 一分钟内走完（约 262 m，14 m/s）。
- `pnpm run verify` 全绿，T00 的六机位与十六殿内机位像素不变（S1、S2 的验收）。
- T4 上有第一组 T05 的数。

## 四、风险（第一阶段）

| 风险 | 应对 |
|---|---|
| S1 动 `site.js` 全文，和在跑的 PR 冲突 | 只搬不改；开工那天看开着的 PR；必要时请对方先合 |
| `buildHall` 出不了庑殿顶或九间的开间 | 第 6 项先出一张正、侧、俯三向图给结构评审，出不来就单开 PR 改 `building.js`，不在 T05 的 PR 里夹带 |
| 殿内与院子连成一个空间后，三角形一次全进视锥 | 第 10 项量；殿内体块阶段三角形很少，真正的压力在第三阶段，预算见附录 |
| 48×25×16 米的室内对镜头的弹簧臂与近裁剪面是新情况 | 镜头已问画出来的网格（#354），`nearplane:grid --level=t05` 第 9 项就跑 |
| 门槛高过一步 | `PRD.md` §2：第一版压到 0.24 m，记进 `SOURCES.md` |

## 附录：2026-11-17 版的体量估计与光比（估计，未测）

**体量**（T00 对照：T4 1080p 首院高档 9.3 ms、低档 4.7 ms；`?tour=120x3` 高档平均 61 帧、95 分位 21 ms）：

| 项 | 估计 | 依据 |
|---|---|---|
| 大雄殿建筑 | 25–40 万三角 | 九间、屋面、斗栱、梁架 |
| 七佛 | 7 × 4–6 万 = 28–42 万 | 8–9 米，近景可看；3 档 LOD（#280 实际减到每尊 6 万面停住） |
| 十四胁侍 | 14 × 8–12 千 = 11–17 万 | 2 档 LOD |
| 二天王 | 2 × 10–15 千 | — |
| 佛坛、座、背光 | 5–10 万 | — |
| 彩画壁画 | 2–5 万（几何）加纹理 | — |
| 无量殿、月台、钟亭碑亭 | 5–10 万 | 背景 |
| 院子、围墙、地面 | 2–5 万 | — |
| **合计** | **80–140 万；绘制 180–300 次** | 需合批 |

**目标**：高档 1080p ≤ 12 ms，低档手机尺寸 ≤ 6 ms（写进 `PRD.md` §9 第 7 条）。达不到就砍：先砍院子细节、无量殿、胁侍的 LOD、彩画纹样分辨率；**不先砍七佛的脸和手印**。

**光比**：殿内 8:1–16:1（门亮、佛坛暗、梁架更暗），佛脸可读；可加一盏极弱的设计补光并标明（写进 `PRD.md` §9 第 6 条）。#287 的结论：贴金在暗殿里要光照探针，殿门 24 米处只读得出下半张脸。

**#287 的实测帧耗**（T4，三尊，`COLOR-SPIKE.md` §5）：上色前后差 0.24–0.37 ms，三角形与绘制次数不变；七尊估计差 0.5–1 ms（未量）。
