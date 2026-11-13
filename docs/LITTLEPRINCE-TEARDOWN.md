# 《小王子：星辰之旅》源码对照

线上地址：<https://littleprince.dev>，正式标题「小王子：星辰之旅 / The Little Prince Among the Stars」。
本文只记录 2026-11-13 从**线上静态文件**能直接核对的事实：首页 `index.html`、加载脚本 `loading.<hash>.js`、
Unity loader、`Build/` 里的 `.data.br` / `.wasm.br`，以及 `StreamingAssets/aa/` 的 Addressables 目录
（`settings.json`、`catalog.bin`）和包文件名。没有玩过游戏，也没有拿到 Unity 工程源码或作者文档；注释里提到的
`tools/`、`scenes/shared/design/` 路径来自产物自身的注释，只能证明存在这些构建工具和设计文档，不能证明其内容。
文中「章节」是按包命名推断的说法，不是官方称呼。

## 它是什么

一个 **Unity 6000.3.25f1** 的 **WebGPU / WebGL 构建**，不是 three.js 网页。wasm 里带版本串和 `WebGPU` 字样；
`settings.json` 写 `m_buildTarget: "WebGL"`、Addressables 4.1.1、`catalog.bin`、`m_maxConcurrentWebRequests: 3`。
首页用 `createUnityInstance()` 启动，构建三件套都是 Brotli 压缩：

| 文件 | 传输大小 |
|---|---:|
| `.data.br` | 39.6 MB |
| `.framework.js.br` | 0.48 MB |
| `.wasm.br` | 51.8 MB |
| 首页 HTML | 0.13 MB |
| 封面 `keyart.jpg` | 0.72 MB |

`catalog.bin` 里能读到九个 `.unity` 场景：`B612_Main`、`Bar_Main`、`Desert_Dunes`、`Desert_Valley`、
`MapLibrary`、`RoyalCourt_Walkthrough`、`Lighter_Planet`、`StarObservatory`、`Theater_Main`。
九首同名章节音乐（`B612_Music.mp3` … `Theater_Music.mp3`）与之对应。此外还有 `shared/`、`b612/`、`bar/`、
`earth/`、`geo/`、`king/`、`lamp/`、`counting/`、`theater/` 九组资源包，按章节拆成
`*_scenes_all_*.bundle`、`*_hires_assets_*.bundle` 和少量共享贴图/材质/音频包。
目录里约 800 张 `.png`、146 个 `.wav`、62 个 `.mat`、28 个 `.shader`，还有 `Player.prefab`、
`CameraRig.prefab`、`B612_RenderingSystems.prefab` 和天空、HDRI、水、蒸汽、植被材质。

首页把每个包的**解压后字节数**内联为 `LPWebDecodedSizes`，合计约 2.11 GB，分布在 115 个条目里。
按前缀粗分（单位 MB，含场景与高清贴图包）：

| 组 | 解码后 | 组 | 解码后 |
|---|---:|---|---:|
| earth | 431.6 | bar | 253.9 |
| counting | 301.9 | b612 | 235.9 |
| geo | 288.5 | king | 136.1 |
| theater | 273.6 | shared | 90.8 |
| lamp | 59.2 | | |

单包最大的是 `geo_scenes_all`（171 MB）和 `theater_scenes_all`（153 MB）。`loading.js` 注释明确提到
「B-612 单独 1.34 GB，maximumMemorySize 4096 MB」，以及 Firefox 2 GB ArrayBuffer 上限需要专门绕过。
这是一款**桌面独显、按章节下载的重资产叙事游戏**，不是给手机准备的。

## 加载与容错做得很重

首页不是简单贴个 Unity 模板，而是一整套面向真实网络环境的加载器：

- **启动前体检**：`navigator.gpu`、适配器 `texture-compression-bc` 特性、`matchMedia("(pointer: fine)")`。
  手机/平板、缺 BC 纹理压缩、无 WebGPU、显卡被禁用，分别给不同的中文提示，且在用户点击前就判断，不白下载。
  注释解释了原因：所有贴图是 DXT/BC，缺 BC 时 CPU 解压会让堆翻倍。
- **标题页**：1920×1080 固定舞台按窗口缩放，封面缓慢 Ken Burns、星尘、金色呼吸字、八语言切换。
  文案由 `tools/shared/web/make_page_i18n.py` 从语言 JSON 生成，字体按拉丁/日文/韩文裁剪成小号 woff2，
  每种语言各有自己的 logo 图。语言选择存 `localStorage`，通过 `window.__lpLang` 传给 Unity。
- **进度与失败页面**：`LPWebDecodedSizes` 把字节数换算成百分比，加载失败区分「文件缺失」「网络被拦截」
  「内存不足」「显卡加速没开」，并显示错误堆栈。`showBanner` 和 `errorHandler` 接管 Unity 的默认报错，
  连扩展注入的 `window.ethereum` 冲突、Pointer Lock 手势异常、OOM 都单独处理，避免白屏或停在 0%。
- **缓存治理**：带内容哈希的章节包用 `immutable`，目录和未哈希文件用 `no-store`。
  下载流里在 Web Worker 中算 SHA-256，与页面注入的 `LPWebBundleContent` 标记核对后才写入 UnityCache；
  注释记录了 2026-10-12 的「王庭 CRC 事故」：同名不同字节的坏包被永久缓存，玩家再也进不去。
  现在还有存前校验、缓存条目内容标记、CRC 报错自动逐包清除三层自愈。
- **存档**：`autoSyncPersistentDataPath: true`，把 `journey.json` 存进 IndexedDB；`productVersion` 固定为一个
  旧提交号，注释说明这是为了不让老玩家因版本号变化而重新下载所有章节包。

## 和我们项目的对照

`app/` 整个目录 6.1 MB，自写 JS 约 124 KB，无构建、无 package、无引擎二进制；除了殿内佛像模型和
背景图，场景全部由 `site.js` / `building.js` 的参数和着色器生成。反过来，小王子是 Unity 构建产物加工过的
美术资产。两者的差别不是「谁更先进」，而是两种做法的取舍。

| 维度 | 小王子 | 我们 | 值得拿走的 |
|---|---|---|---|
| 引擎 | Unity 6000.3 WebGPU，wasm + .data | three.js r186，源码内置 `app/v/` | 不换引擎。手机浏览器和 GitHub Pages 静态托管是硬约束 |
| 资产 | 约 2.11 GB 解码后、115 包、按章节下载 | 6.1 MB，一次加载，匾额用 canvas 生成 | 保持零构建；若将来加贴图，学它的按内容哈希分包和 `immutable` 缓存 |
| 场景组织 | 九个 `.unity` 场景，每章独立包 | 一处连续山地，`site.js` 一次 `buildSite` 建完 | 学它的「章节机位」思路：我们的 `views` 已经是这个，只是没有叙事顺序 |
| 材质 | 大量烘焙贴图、专用材质、HDRI 天空、水与蒸汽 | `procMat` 片元里算程序噪声，顶点烘焙 AO | 我们的短板仍是远处噪点闪烁，Saltline 的启动烘焙方案更合适；不要照搬它的重资产 |
| 平台 | 桌面独显、WebGPU、BC 纹理压缩，明说不支持手机 | 手机优先，三档画质 + 帧时自动降级 | 方向相反。别把 WebGPU 专属效果列为目标 |
| 加载 | 封面、进度字节、八语言、分级错误提示、缓存自愈 | 一个静态页面，殿内延迟导入失败时只改一行提示 | **最值得学**：可解释的失败态、进度反馈、缓存版本策略；成本主要是工程而非美术 |
| 音频 | 每章音乐 + 大量 wav 环境音 | 钟、鼓、风、檐铃全用 Web Audio 合成 | 保持合成，但可学它「一地一声景」的编排，而不只是随位置淡入淡出 |
| 叙事 | 标题、旅程存档 `journey.json`、九个章节场景 | 一条可以来回走的路，无进度 | 可加极轻量的「到过哪儿」，但 README 明确要的是安静、无事件也耐看，别做成任务系统 |
| 多语言 | 八语言页面与游戏内设置、各自 logo 和字体子集 | 界面中文，字体从 Google Fonts 取 | 若给外国游客看，先把 `index.html` 的提示语抽成小字典，别引入整套 i18n 构建链 |
| 测试 | 从注释看有 `loading.test.cjs` 和 A/B 帧时间实测 | `tools/shots.js` 每个命名机位截图、`walkthrough-test.js` 走全程验声 | 我们的确定性截图测试其实更贴合这个项目的迭代方式，继续保持；补一个加载失败态测试即可 |

## 结论

小王子的厉害之处有两层。画面那层来自 Unity 美术管线和大量定制资产，我们搬不动，也不该搬。
工程那层反而完全可借鉴：**把「打不开」这件事当成一个要设计的界面**，把缓存、断网、显卡、内存、
浏览器扩展都变成有名字、有建议、有退路的状态；再用字节数驱动进度条，用内容校验保护长期缓存。
它同样是「先有场景清单，再有每章资产」的做法，和我们 `views` + `shots.js` 的机位清单是同一种开发纪律，
只是规模大得多。

下一步若要动手，优先做三件不违背手机约束的小事：给 `index.html` 加 WebGL/上下文创建失败的明确提示，
给殿内模型和背景图的加载加可见进度与可重试，以及在 `shots.js` 里加一条「资源缺失时不白屏」的用例。
