# T01 开工前的引擎评估（案头）

核对日期：2026-11-17。基线是本仓库 `cf9b549`（标签 `v0.3.0`，提交说明 `chore(main): release 0.3.0 (#84)`，作者时间 2026-11-17 15:07 +0800）。查阅时 `origin/main` 还多三个未计入的提交：`2334da1`、`47f60da`、`995e772`。

**结论：T00 不换引擎。T01 的白盒仍用现在的 three.js 网页工程。** 这是所有者 2026-11-17 已经记下的决定，见 `docs/handoff/LATEST-GOALS.md` 第 42 条。本文只补当时写明「未经实测」的公开资料，并对照 T00 的提交记录说明换引擎要丢掉什么。本仓库没有导出过 Godot 或 Unity 工程，包体、手机帧耗、代理改一处场景要多久，都还没有本项目的数字。

## 1. T00 的提交记录里已经有什么

`git rev-list --count HEAD` 在 `cf9b549` 上是 242。最早一笔是 `89439a7`（2026-11-11 15:04 +0000），说明是「用代码搭的径山院落接上殿内」。作者日期从 2026-11-11 到 2026-11-17。

提交说明的前缀（按第一段类型词统计，早期没有约定格式的算「其他」）：

| 类型 | 笔数 |
| --- | --- |
| docs | 65 |
| feat | 60 |
| fix | 51 |
| 其他（早期自由标题） | 40 |
| test | 8 |
| ci | 5 |
| build | 5 |
| refactor | 3 |
| chore | 3 |
| perf | 2 |

主创 2026-11-17 的自审写在 `AGENTS.md`「先找轮子，再动手」。那次读的是当时的 147 笔提交，结论是 35 个修复里约四成来自同一处：画出来的几何是一份，走路、挡路、镜头用的是另一份手写数据。本文没有把那「约四成」按 242 笔重算。自审点名的试验 #161、#162、#163，在 `cf9b549` 上用 `git log --grep` 找不到对应合并。

`app/` 下 `.js` 与 `.mjs` 在这一提交合计 12956 行（`wc -l`）。和换引擎直接相关的是这些自己写的系统，行数是文件长度，不是工作量：

| 文件 | 行数 | T00 里它负责的事 | 出处 |
| --- | --- | --- | --- |
| `app/yard.js` | 1064 | 行走、镜头、点地 | 现行代码 |
| `app/src/monk.js` | 712 | 小沙弥 | 现行代码 |
| `app/src/site.js` | 700 | 寺院平面 | 现行代码 |
| `app/src/building.js` | 555 | 按营造法式长出来的建筑 | 现行代码；结构评审见 `docs/t00/` |
| `app/src/game.js` | 461 | 一趟拜访怎么串起来 | 现行代码 |
| `app/src/audio.js` | 417 | 环境声 | 现行代码 |
| `app/src/director.js` | 343 | 仪式镜头，不硬切 | #87，提交 `7e681b6` |
| `app/src/rites.js` | 339 | 茶、钟、香、朱印 | 现行代码 |
| `app/src/interior.js` | 339 | 殿内 | 现行代码 |
| `app/src/materials.js` | 302 | 材质 | 现行代码 |
| `app/src/score.js` | 299 | 配乐 | #136、#145、#153 |
| `app/src/trees.js` | 293 | 树 | #91 起，自审点名要换生成器 |
| `app/src/post.js` | 136 | 画面后期 | 现行代码；渲染器见下 |

渲染器在 `app/yard.js` 第 66 行：`THREE.WebGLRenderer`。没有使用 `WebGPURenderer`。

`docs/LEVEL-PLAYBOOK.md` 把「每关重做」和「拿来就用」分开。拿来就用的包括建筑与台阶的生成器、小沙弥、四季四时、配乐引擎、界面和四种语言、测试与出图。手册同时写明：引擎里还写着 T00 的平面，拆开是 #138，T00 发布后做。这些就是换引擎时要重写或重接的清单，不是另一份产品规划。

## 2. 现在用的 three.js

`package.json` 锁定 `three@0.186.0`。安装包的 `package.json` 写明版本 `0.186.0`、许可 MIT、描述 “JavaScript 3D library”。安装包 README 的原话是：目标是做一个易用、轻量、跨浏览器的通用三维库；当前构建包含 WebGL 和 WebGPU 渲染器。[E01]

它不带编辑器、物理、关卡导出或桌面安装包。行走、碰撞、仪式、配乐、验收机位都在本仓库里。好处是代理改的是文本，`pnpm test` 和预览按现有工作流跑。代价是自审已经指出的那些轮子，要在 three.js 的生态里接，而不是换一整台引擎。这是第 42 条把 #161、#162、#163 放在「先不换」前面的原因。

`WebGPURenderer` 会先试 WebGPU，没有就退回 WebGL 2。那是库的能力，不是本项目现在的渲染路径。[E02]

## 3. Godot 是什么

Godot 是带编辑器的二维和三维游戏引擎，MIT 许可，可以用它做商业游戏，游戏本身不必用 MIT。官方支持的脚本语言是 GDScript、C# 和 C++。编辑器可在 Windows、macOS、Linux 上用，游戏可导出到桌面、Android、iOS 和网页。查阅当日版本库的最新稳定标签是 4.7.2（2026-08-18）；4.7 稳定版于 2026-06-18 发布。4.8 在下载档案里仍是 beta3。[E03、E04、E05、E06]

场景的文本格式是 `.tscn`。官方格式说明写明：它表示一棵场景树，相对二进制的 `.scn`，便于人读，也便于版本管理。用编辑器保存时，注释和多余空白会被去掉。[E07]

网页导出官方文档写明这些限制，都是稳定版文档，不是第三方测量：

- 需要浏览器支持 WebAssembly 和 WebGL 2.0。
- 只能用 Compatibility 渲染方法。Forward+ 和 Mobile 不能用于网页，因为那两条路径要更底层的图形接口，而 Godot 目前没有 WebGPU。
- Godot 4 的 C# 工程不能导出到网页。C# 平台说明同样写了这一点，并建议要上网页就用 Godot 3 的 C#。GDScript 工程可以导出。
- 自 4.3 起可以单线程导出，这是默认、也是文档推荐的方式。单线程不能用线程，性能不如多线程导出。多线程依赖 `SharedArrayBuffer`，要服务器送跨域隔离头，页面上不能放广告和第三方集成。
- 网页音频默认用采样播放。音效、混响、多普勒和程序化声音在这条路径上不可用。改回引擎自己的流播放可以用全套音频，延迟会增加，单线程时更明显。文档还提醒 Safari 的 WebGL 2.0 问题比其他浏览器多。[E08、E09]

官方文档没有给出「空工程网页包是多少字节」。第三方对 4.7.2 空导出的测量（约 40 MB、gzip 后引擎约 10 MB）本轮不收进结论。

和代理的关系要分开两件事。2026-06-30 Godot Foundation 宣布：向引擎仓库提交时，禁止自主代理和所谓 vibe coding，禁止用 AI 生成大段代码，禁止在人和人的沟通里用 AI 生成的文字。这条管的是引擎本身的拉取请求，不管用 Godot 做的游戏。[E10] 本轮没有找到 Godot 官方发布的代理插件或官方 MCP。社区有多套 MCP，本轮没有逐个安装，所以不比较它们的工具数量。

相对本仓库，Godot 对得上的是文本场景和开源许可。对不上的是：网页只能走 Compatibility，C# 上不了网页，现有的建筑、仪式、镜头和配乐都要重写，而且网页包体没有本项目的实测。

## 4. Unity 是什么

Unity 是另一套完整引擎，脚本用 C#。网页目标的官方手册把 WebGL 2 当作默认图形接口。Unity 6.6 的手册单列了 WebGPU，用来提供 WebGL 2 没有的功能。手册要求在 Player 设置里自己打开 WebGPU，不会自动启用。Unity 网页图形组 2026-08-24 在官方论坛写明：从 6000.6 起 WebGPU 不再是实验功能，但默认仍是 WebGL 2，不支持时要能退回。[E11、E12]

官方手册强调网页包要小，并说明如何裁剪引擎代码、压缩和做移动端设置。手册没有给一个空工程的字节数。本轮同样不采用第三方对比表里的「空包约 8 MB」。[E13]

代理接口有官方公告，日期就是今天。Unity Technologies 2026-11-17 写明：CLI 1.0 和 Pipeline 包（`com.unity.pipeline`）结束测试。代理用 CLI 打开工程、在正在运行的编辑器里下命令、进入 Play 模式、再读回结果。官方插件覆盖 Claude Code、Codex、Grok Build 和 Google Antigravity，技能在公开仓库。同一则公告给出 Unity 自己的用量：自 7 月 20 日以来，超过 35 万登录用户跑了超过 6 亿条命令，约 98% 来自编程代理和其他自动化。无头编辑器跑代理算在 Build Server 许可里，每个实例一张。Linux 容器版还没到。[E14]

这些数字是 Unity 的自述，不是本仓库复测。场景和预制体不是本仓库这种整文件可读的源码。CLI 1.0 用 `unity vcs` 指出场景或预制体里改的是哪个资源，说明差异要经过这层工具，而不是直接看文本 diff。[E14]

## 5. 和 T01 现在的提案对一下

`docs/T01-BAOTONG.md` 把第一轮收成五个节点、三处可跳过的观察，并写明茶、钟、香留作可复用能力，第一版先验证观察和路线，不同时扩大仪式、人物对话和城市场景。这不触发第 42 条的第三条「大量 NPC、大地图流式加载」。

第 42 条的另外两条也还没有新证据：

1. #161、#162、#163 还没有并入 `cf9b549`，手机帧耗和包体没有「接了现成库之后」的数字。
2. #106 仍是可行性问题。手册写的是网页点开即玩。上 Steam 可以给网页版套桌面外壳，这是第 42 条已记下的意见，不是本轮新做的打包试验。

因此 T01 白盒不换引擎。白盒要验证的是同一场景里的路线、塔的三次露出、键盘和触摸，这些都落在现有的行走和镜头上。换到 Godot 或 Unity，等于把这条验证推迟到整套重写之后。

以后若三条里有一条成立，再做的比较应当是同一段路、同一台手机：现在的网页、Godot 的网页导出、套了桌面外壳的网页版。比首屏时间、下载大小、六个机位的画面，以及代理改一处场景后到预览出来的时间。在这组数字出现之前，公开资料不足以推翻第 42 条。

## 6. 来源账本

仓库内的数字来自 `cf9b549` 的 `git` 与 `wc`，不重复编号。下表只登记仓库以外的页面，以及本轮实际读到的范围。

| 编号 | 来源与读取范围 | 能支持什么，不能支持什么 |
| --- | --- | --- |
| E01 | 本机 `node_modules/three/package.json` 与 `README.md`，版本 0.186.0 | 它自称 JavaScript 三维库，MIT，构建含 WebGL 与 WebGPU 渲染器。不能推出本项目已启用 WebGPU。 |
| E02 | 本机 `node_modules/three/src/renderers/webgpu/WebGPURenderer.js` 第 24 行，随 `three@0.186.0` 安装 | 文件头写明：浏览器支持 WebGPU 就用它，否则退回 WebGL 2。未在本项目运行。 |
| E03 | [Godot 常见问题，稳定版文档](https://docs.godotengine.org/en/stable/about/faq.html) | MIT；脚本语言；可导出的平台。价格表不适用，因为没有席位费条款要摘。 |
| E04 | [遵守许可，稳定版文档](https://docs.godotengine.org/en/stable/about/complying_with_licenses.html) | 游戏可以用别的许可，可以商用；发行时要带上 Godot 的 MIT 文本。 |
| E05 | [Godot 下载档案](https://godotengine.org/download/archive/)；[4.7 发布说明](https://godotengine.org/releases/4.7/) | 查阅当日 4.7.2 为稳定版，4.8 为 beta3。4.7 的日期是 2026-06-18。 |
| E06 | [GitHub `godotengine/godot` 发布页，4.7.2-stable](https://github.com/godotengine/godot/releases) | 4.7.2-stable 标为 2026-08-18。未逐条读补丁说明。 |
| E07 | [TSCN 文件格式，4.x 简体中文文档](https://docs.godotengine.org/zh-cn/latest/engine_details/file_formats/tscn.html) | 文本场景便于人读和版本管理。该页是 latest，文首提示可能新于稳定版。同一句也在 [4.2 英文文档](https://docs.godotengine.org/en/4.2/contributing/development/file_formats/tscn.html)。 |
| E08 | [导出到网页，稳定版文档](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) | WebGL 2、Compatibility、单线程默认、音频限制、Safari 提示。没有空工程字节数。 |
| E09 | [C# 平台支持，稳定版文档](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/index.html) | Godot 4 的 C# 不能导出到网页。 |
| E10 | [Godot Foundation，贡献政策变更，2026-06-30](https://godotengine.org/article/contribution-policy-2026/) | 约束引擎仓库的贡献，不约束用引擎做的游戏。 |
| E11 | [Unity 6.6 手册：WebGPU](https://docs.unity3d.com/6000.6/Documentation/Manual/WebGPU.html)；[启用 WebGPU](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/develop/graphics/web-gpu/enable) | WebGL 2 是默认网页接口；WebGPU 要手动打开。 |
| E12 | [Unity Discussions，网页图形组，2026-08-24](https://discussions.unity.com/t/webgpu-out-of-experimental-in-unity-6-6/1734694) | 工作人员称 6000.6 起 WebGPU 不再实验，默认仍关闭。这是论坛帖，不是手册正文。 |
| E13 | [Unity 6.4 手册：构建和分发网页应用](https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-building-distribution.html)；[分发体积与代码裁剪（6.1）](https://docs.unity3d.com/6000.1/Documentation/Manual/webgl-distributionsize-codestripping.html) | 网页包要小，以及裁剪、压缩的做法。没有空工程字节数。 |
| E14 | [Unity Technologies，Unity CLI 1.0，2026-11-17](https://unity.com/the-unity-cli-1.0-is-here) | 官方代理工作流、技能覆盖的产品、35 万用户与 6 亿条命令的自述、Build Server 许可、Linux 容器尚未交付。用量未经本仓库复核。 |

未采用：各家对比文里的空包体积、加载秒数和星标。那些页面没有在本项目里复测，也不替代上表的手册。

## 7. 下一关开工前复评（T05，2026-11-20）

核对日期：2026-11-20。基线：`origin/main` `a5901b2`。issue：#359 验收第 3 条。第 42 条约定「T00 发布后、T01（即下一关）开工前，结合试验的数据和 #106 的决定专门评估一次」；下一关已定为 T05（第 63、65 条），本节就是那一次。**只引已有测量，没有测量的写「未测」。**

### 7.1 三个条件逐条

**(1) 重构试验后，手机上的帧耗或包体仍撑不住吗？——没有证据说撑不住。**

| 项 | 数 | 出处 |
|---|---|---|
| 三个重构试验的状态 | #161 碰撞迁移：第 3 步 #265、第 4 步 #274（PR #276）、第 5 步镜头 #295（PR #354）已在 main，第 6 步（删旧数据）等「14 天无回退」；#162 柳杉与枫已合，银杏 PR #327 开着；#163 小沙弥离线六轮做完，所有者 11-20 同意接入（第 70 条），未合 | `LATEST-GOALS.md` 第 60、70 条；`git log` |
| 手机帧耗（Pixel 8a，Mali-G715，Chrome 157，线上站） | 低档 `?tour=120x3`：59.6 / 59.9 / 59.9 帧，95 分位 16.8 ms，调速器没触发；第二天连跑两轮 59.16 / 59.58 帧，无热衰减 | #188 第 1、3 条评论（2026-11-18、11-19） |
| 同一台手机的中档 | 28.6–30.1 帧，95 分位约 117 ms，三轮递减；主创结论：中档在这台手机上不可用，手机一律从低档起 | #188 第 1、2 条评论 |
| 加载 | 冷启动到 ready 中位数 10185 ms，热启动 9723 ms（各三次） | #188 第 3 条评论；脚本 `tools/device.cjs`（PR #262） |
| 内存（PSS） | 进首院 221621 KB，进殿 208055 KB，登阁 202914 KB | 同上 |
| #354 之后的手机数 | **未测**。镜头改问网格后多出约 30 MB 常驻（顶点约 28 MB 加树，估算未实测），收集 82 万三角形与建树在手机上的耗时未测 | #188 第 8 条评论（2026-11-20） |
| T4 上 #354 前后 | 高档 1080p `__cost` 10.92 对 10.94 ms；低档 960×540 4.03 对 4.12 ms，在波动内 | `docs/HANDOFF.md` 2026-11-20 条（运行 `20261120-052805`） |
| 包体（`dist/` 总字节、首屏下载量） | **未测**。本节没有构建 `dist/` 量；仓库里能说的只有佛像与台座两件模型约 3.9 MB（`CLAUDE.md`） | — |
| 低端安卓、iPhone、Safari | **未测**。#188 主创评审：Pixel 8a 是 2024 年中高端机，不能代表低端机与 iPhone | #188 第 2 条评论 |
| Mac 真显卡 | 中档的数不可用，另开 #264 | `LATEST-GOALS.md` 第 60 条 |

在测过的那台手机上，低档有约一倍的余量（16.8 ms 对参考线 50 ms 的 95 分位）。T05 的体量估计是 80–140 万三角形、180–300 次绘制（`docs/t05/PLAN.md` 旧版 §4，估计未测），比 T00 首院高，所以「撑得住」要等 T05 白盒在同一台手机上量过才算数；那是 `docs/t05/PRD.md` §9 第 7 条。

**(2) 产品重心改成 Steam 桌面版为主了吗？——没有。**

- #106（Steam 上架总清单）仍开着，九项一项没勾；第 3 项「所有者定三件事」（收费与否、以谁的名义开账号、是否往有 NPC 的宋代世界发展）没有记进 `LATEST-GOALS.md`（检索「Steam」只命中第 18、35、42、54 条，都不是这三件事的决定）。
- 桌面外壳已有一条现成的路：`pnpm run app` 用 MyGo 把站点包成桌面应用（`tools/app/README.md`），渠道构建 `VITE_CHANNEL=steam`（#202，`src/channel.js`）。这正是第 42 条说的「上 Steam 可以给网页版套桌面外壳」，不要求换引擎。
- 发布刚改成「main 上 canary、发版上生产」（#308），0.6.0 已经走过一次（第 73 条），重心仍是网页。

**(3) T05 需要大量 NPC、大地图流式加载吗？——不需要。**

- T05 是「院落短段加一间殿」，单程约 105 米（`docs/t05/SITE.md` §5）；不做 NPC、多人、对话（`docs/t05/DECISIONS.md` §4，`docs/t05/PRD.md` §5 第 9 条）。
- 新增的「同修留痕」（#340，PR #346 已合）是匿名计数和香炉里的冷香脚，由一个 Worker 计数，不是 NPC 的行为与动画。
- T05 真正要的新东西都在 three.js 生态里有现成的：暗殿的间接光有 r186 自带的 `LightProbeGrid`／`LightProbeGridWebGL`（本机 `node_modules/three/examples/jsm/lighting/`，2026-11-20 核过文件在，效果未验）和 #287 用过的 `PMREMGenerator.fromScene`；减面与分档有已在依赖里的 `meshoptimizer`、`@gltf-transform/functions`；碰撞与镜头已经是烘焙地面加 three-mesh-bvh（#274、#354）。走进殿门的曝光渐变 three 没有现成的（#280 风险表），但它是后期里几十行的事，不是换引擎能省的。

### 7.2 结论

**不换。T05 用现在的 three.js 网页工程开工。** 三个条件没有一个成立；第 1 个条件的证据比 11-17 那次多了一组真手机的数，方向是「低档有余量」。换到 Godot 或 Unity 仍然要重写按法式长出来的建筑、仪式、配乐和烘焙地面（§1、§5 的理由不变），并把 T05 推迟到重写之后。

本节没有新做 Godot 或 Unity 的导出与实测；§3、§4 的公开资料没有重读，日期仍是 2026-11-17。

### 7.3 什么时候再评估（触发条件）

任一条出现，就照 §5 末段的办法做一次「同一段路、同一台手机」的比较，而不是凭资料：

1. **T05 白盒在 Pixel 8a 低档上过不了参考线**（平均 < 30 帧或 95 分位 > 50 ms），且砍完 `docs/t05/PLAN.md` 里能砍的（胁侍档、院子细节、彩画分辨率）仍过不了。
2. **镜头的网格在手机上失败**：#188 待量的 `__eyeSpace()` 在低端机上常报 `failed`，或常驻内存让页面被系统杀掉，且「只收臂够得着的三角形」的办法也不够。
3. **所有者在 #106 第 3 项定了「以 Steam 桌面版为主」或「做有 NPC 的世界」。**
4. **后续某一关（不是 T05）的 PRD 写进了大量 NPC、大地图流式加载**，例如 T02 甘露寺的岩洞或城市场景。
5. **three.js 的 WebGL 路径被上游弃用**，或某个 T05 必需的能力（探针格子等）只在 `WebGPURenderer` 上有、而我们在手机上测出 WebGPU 路径不可用。

下一次复评的默认时间：T05 第一阶段结束、第一次在手机上量过 T05 白盒之后。
