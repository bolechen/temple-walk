# 《小王子：星辰之旅》源码对照

线上地址：<https://littleprince.dev>，正式标题「小王子：星辰之旅 / The Little Prince Among the Stars」。
本文只记录 2026-11-13 从**线上静态文件**能直接核对的事实：首页 `index.html`、加载脚本 `loading.<hash>.js`、
Unity loader、`Build/` 里的 `.data.br` / `.wasm.br`，以及 `StreamingAssets/aa/` 的 Addressables 目录
（`settings.json`、`catalog.bin`）和包文件名。没有玩过游戏，也没有拿到 Unity 工程源码或作者文档；注释里提到的
`tools/`、`scenes/shared/design/` 路径来自产物自身的注释，只能证明存在这些构建工具和设计文档，不能证明其内容。
文中「章节」是按包命名推断的说法，不是官方称呼。

2026-11-15 补了一节「角色移动、碰撞与相机」，多核对了两样东西：把 `StreamingAssets/aa/` 里的 `*_monoscripts_*.bundle`
（UnityFS，LZ4 块）解开，读出全部脚本类名和程序集；再从 `Build/*.data.br` 里的
`Il2CppData/Metadata/global-metadata.dat` 读字符串表，那里有每个类的字段名和方法名，并大致按声明顺序排列。
**只有名字，没有代码**：一个参数做什么、默认值多少，都只能从名字推测。

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

## 踩痕与脚步声（2026-11-15 补查）

`catalog.bin` 里有 `Sand_Trail_Normal.png`、`UserDesert_Sand_CompactedNormal.png`、`Desert_Dunes_GroundMask.png`（三张）
和按地面分的脚步声：`Footstep_Sand` 14 条、`Footstep_Gravel` 12、`Grass` 14、`Carpet` 11、`Stone` 9、`FineGravel` 9、
`Wood` 8、`Dirt` 7。只看得到名字：沙漠的踩痕应是一张遮罩把沙面换成「压实」的法线，脚步声按脚下的地面换。我们的雪地脚印
（`app/src/trail.js`）是同一思路的自己实现。

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

## 角色移动、碰撞与相机（2026-11-15）

先分清两类名字。`CapsuleCast`、`ComputePenetration`、`Rigidbody`、`HingeJoint`、`Cloth`、`slopeLimit`、`skinWidth`、
`fixedTimeStep` 这些出现在元数据里，只因为构建链接了 Unity 的物理模块，**不能证明游戏代码调用了它们**。能说明游戏
自己怎么做的，只有它自己的类和成员。

**主角是 Unity 的角色胶囊加一层自写手感。** `PlayerController` 有 `get_Controller` 和 `OnControllerColliderHit`
（后者是 CharacterController 才发的消息），`PlayerCarryController` 有 `get_CC`，所以基本可以断定移动交给
CharacterController（PhysX 胶囊扫掠）。它自己的字段按声明顺序是：`jogSpeed runSpeed turnSmoothTime maxTurnSpeed
fullSpeedAngle groundedStickVelocity groundSnapDistance slopeSlowStartAngle slopeSlowAtLimit slideAngle stepSmoothTime
slideAcceleration maxSlideSpeed jumpEnabled jumpHeight jumpCooldown jumpClipAirTime`，私有状态有 `_verticalVel _airTime
_slideVel _steepNormal _stepOffset _stepVel _stepApplied`，方法有 `ProbeGround IsStepAhead ApplyStepOffset EaseStep
SetScripted SetExternal ReturnToPlayer`。按名字读：自己积分重力和跳跃；下坡时贴地不腾空；上坡到一定角度减速，太陡就
下滑；身体上台阶后，画面上的高度再用 `stepSmoothTime` 缓过去（这里的 `_stepOffset` 是它自己的台阶平滑，不是胶囊的
`stepOffset` 参数）；过场时脚本接管、结束后交还。

**相机自成一组类。** `ThirdPersonCamera` 的字段有 `collisionRadius collisionRecoverTime followSmoothTimeXZ
followSmoothTimeY maxFollowLag groundClearance hideCharacterBelow showCharacterAbove liftBelow maxLiftPitch liftStep
liftSmoothTime maxSwing swingSpeed coverMargin`，方法有 `CastClear KeepAboveGround FindLift FindSwing SolveSteady`。
旁边还有 `CameraOccluderFade`（淡化挡在中间的东西）、`InteriorCameraZone`（进屋时距离、俯仰、视角在 `blendTime` 内过渡）、
`CourtCameraSafety`（`_preferredShoulder`、`shoulderDuringSwing`）。推测的读法（未见代码）：`CastClear` 是带半径的扫掠；
被挡时先抬高（lift）或侧绕（swing），不得已才拉近；人物的藏和显用两个阈值，避免在临界处闪；王庭里被挡时换肩。

**唯一像样的「物理模拟」是围巾。** `ScarfRig`：`Simulate LinkAB PushOut CollideScene UpdateShelter MeasureBody
ClosestOnSegment`，参数 `damping bendStiffness aero flutter windSpeed shelteredWind clothRadius sceneColliders Iterations
MaxSteps SettleSteps`，结构上有 `Chain rung diagAB diagBA capsule`。推测是一条自写的 Verlet 链：链节之间和对角之间
各有约束，用胶囊把布推出身体，也碰场景，挡风处风变小，瞬移时 `ResetSimulation`。`BottleLiquid`（液面晃动的弹簧）、
`FloatingRock`（`bobAmplitude`）都是几行的小动画，不是物理。

**脚。** `FootGrounder`：`rayStartHeight footIK adjustPelvis slopePelvisShare slopePlaneMaxAngle plantBlendTime
pinHoldFraction`，状态 `_lPlant _rPlant _pinLPos _pinRPos`。射线找地、脚 IK、骨盆下沉、按坡面倾斜，落地脚钉住。
它的 QA 输出里有一项 `planted-foot slide (XZ drift through each planted run: the bone moving < 5 mm per frame within
3 cm of its standing height; whole run)`：每帧移动不到 5 mm、离站立高度不到 3 cm 的那几帧算「落地」，量的是这几帧里
脚在水平面上漂了多远。也就是说，它把滑步当成一个要测的数。

**NPC 走路。** `DesertPilotGuide`：路网 `netPoints netEdges`，`SegmentBlocked Detour Avoid`，`personalSpace
avoidPlayer sideStepBlockers strideMatch arriveYawTolerance`。是自写的路点导航加避让，不是 NavMeshAgent
（元数据里没有这个名字）。

### 和我们对照

我们没有物理引擎。`site.js` 的 `createWalker` 把平面图（`solids/decks/ramps/posts`）变成 `heightAt` 和 `blocked`；
小和尚是一个点，所有障碍按 `BODY` 0.38 m 画大；`yard.js` 每帧先试整步，挡住就分轴滑，再减半，最后转开最多约 77°
绕柱。重力只出现在两处：空格的小跳（`leap`），和从门廊跳下（`drop.js` 事先算好的抛物线）。

| | 小王子 | 我们 |
|---|---|---|
| 碰撞体 | 胶囊扫掠编辑器里摆的碰撞体 | 点加 `BODY` 余量；碰撞和建筑出自同一次 `put()`，不会错位 |
| 上台阶 | 胶囊限高，画面高度再平滑 | 楼梯就是踏面；视线走 `eyeAt` 的斜坡并平滑：同一个思路 |
| 斜坡 | 减速、陡坡下滑、贴地 | 不需要：可走处都是平台和台阶 |
| 跳跃 | 积分重力，有冷却和空中动画 | `leap` 积分；跳下台阶是事先规划的 |
| 相机 | 扫掠、抬高、侧绕、淡化遮挡、双阈值藏人、进屋过渡、换肩 | `eye.js` 的 `followEye` 每 0.25 m 取点问 `walker.eyeShut`（柱、墙体到屋脊、每一片屋顶），被挡就拉近，`createFollow` 让眼睛缓着走、不跳，侧偏只取开着的那一段，不钻地；藏人用两个阈值（近于 0.6 m 藏，退到 0.85 m 再显）；进殿时距离直接设为 0.6 |
| 衣物 | Verlet 围巾，碰身体，受风 | 腰带尾和斗笠是一维阻尼弹簧，只受速度和转身驱动；裙摆碰到台阶时缩短骨头 |
| 脚 | 射线、IK、钉脚，测滑步 | 两段式 `reach` 加骨盆下沉；单测只测「脚底贴地」 |

我们的走法**本身不限台阶高度**：哪里不被挡，他就站在哪里的高度上，能不能一步走上一米高的台子全靠平面图画对。
`plan.test.mjs` 原来只证明「存在一条好走的路」，现在加了一条「nowhere he can walk is there a step taller than a
child's」：从起点按 0.2 m 网格（不粗于他加速时一帧走的距离）不限高差泛洪，检查任意两个相邻可走点的高差都不超过
`STEP_UP`（0.45 m，与原有的可达性测试共用）。目前最大的一级是 0.3 m，在竹林起点旁的平台。把一块平台临时抬高
0.6 m，这条测试就会失败。

### 值得拿走的，按性价比

1. ~~平面图不留越级的台阶~~：已有单测。
2. 相机被挡时先抬高再拉近（只动相机那一段，不加几何）。~~藏人改用两个阈值~~：#32 已做，同时让眼睛不再跳。
3. 进殿和出殿时，相机距离、俯仰、视角做过渡。
4. 腰带尾改成三四个点的 Verlet 链，加身体胶囊推开，接上 mood 的风。
5. 单测里量滑步：落地脚在水平面上漂了多少。

不搬：通用刚体、PhysX 式碰撞体、陡坡下滑。我们是台阶和平台，手机优先，这些只会多花时间、多出错。

## 结论

小王子的厉害之处有两层。画面那层来自 Unity 美术管线和大量定制资产，我们搬不动，也不该搬。
工程那层反而完全可借鉴：**把「打不开」这件事当成一个要设计的界面**，把缓存、断网、显卡、内存、
浏览器扩展都变成有名字、有建议、有退路的状态；再用字节数驱动进度条，用内容校验保护长期缓存。
它同样是「先有场景清单，再有每章资产」的做法，和我们 `views` + `shots.js` 的机位清单是同一种开发纪律，
只是规模大得多。

下一步若要动手，优先做三件不违背手机约束的小事：给 `index.html` 加 WebGL/上下文创建失败的明确提示，
给殿内模型和背景图的加载加可见进度与可重试，以及在 `shots.js` 里加一条「资源缺失时不白屏」的用例。

## 镜头与行走（2026-11-15 补读）

朋友试玩说容易头晕，于是回头读它的镜头。读法：下载线上的 `…_monoscripts_….bundle`（脚本清单）和
`shared_assets_assets_shared_core_prefabs_….bundle`（角色与镜头预制件），用 UnityPy 读出各 MonoBehaviour 的
序列化字段。字段名和数值都是原样；**没有玩过，也看不到 C# 代码**，下面的「做法」是从字段名推断的。

它是**第三人称**，镜头是 `B612.ThirdPersonCamera`，角色是 `B612.PlayerController`：

| 字段 | 值 | 我们（改之前 → 改之后） |
|---|---|---|
| `fieldOfView`（Unity 是垂直视角） | 50° | 横屏 44° → **50°**（竖屏 58° → 62°），可在「歇脚」里加减 |
| `defaultDistance` / `minDistance` / `maxDistance` | 3.2 / 1.8 / 5 米 | 6.2 / 2.6 / 11 米，没改（构图要他小小地站在左下） |
| `pivotHeight` / `defaultPitch` | 1.0 米 / 俯 12° | 眼高 +1.18 米 / 2°，没改 |
| `followSmoothTimeXZ` / `followSmoothTimeY` / `maxFollowLag` | 0.06 / **0.14** 秒 / 0.5 米 | 原来上下与水平都约 0.08 秒 → 第三人称上下 **0.14 秒** |
| `zoomSmoothTime` | 0.15 秒 | 原来拉近**一帧到位** → 拉近 0.15 秒、退回 0.4 秒，都用 SmoothDamp |
| `collisionRadius` / `collisionMask` / `collisionRecoverTime` | 0.2 米的球 / 只有两个图层 / 0.35 秒 | 一个点、凡是建的都算 → 柱子和树干挡一下先不躲（0.25 秒），大的才躲 |
| `liftSmoothTime` / `liftHold` / `liftReleaseTime` | 0.22 / 0.35 / 0.5 秒 | 越过台基边缘的抬升原来**一帧到位** → 照搬这三个数 |
| `hideCharacterBelow` / `showCharacterAbove` | 0.58 / 0.79 米 | 原来只有 0.95 米一道 → 0.6 / 0.85 米两道，不在边界上闪 |
| `acceleration` / `deceleration` | 7 / 8 m/s² | 原来一下到速、松手立停 → 照搬 |
| `walkSpeed` / `jogSpeed` / `runSpeed` | 1.5 / 2.4 / 3.5 m/s | 2.1 / 4.2 m/s，没改 |
| `turnSmoothTime` / `stepSmoothTime` | 0.085 / 0.09 秒 | 台阶上的眼高本来就有约 0.08 秒的平滑 |
| 键鼠 `yawSensitivity` / `pitchSensitivity` | 每像素 0.11° / 0.09° | 每像素 0.15° / 0.13° → 2026-11-16 降为 **0.09° / 0.08°**（0.0016 / 0.0014 弧度）；拖动按视野算，约为光标的 1.6 倍；默认不再锁定鼠标 |

脚本清单里还有一串**按场景写的镜头组件**，说明它在舒适度上下了很多功夫：`CameraOccluder`、`CameraOccluderFade`
（挡住镜头的东西淡出，镜头不躲）、`VanityCameraComfort`、`BarCameraSafety`、`CourtCameraSafety`、
`DesertCameraWallGuard`、`DesertCameraZone`、`GeoCameraSoftLimit`、`GeoCameraPitchAssist`、`InteriorCameraZone`、
`CameraStartFraming`。这些组件的参数在各章自己的包里（几十到上百 MB），没有下载，只知道名字。

**拿来的**（`app/src/eye.js` 的 `createFollow`）：
- 所有镜头运动用 SmoothDamp（临界阻尼的弹簧：慢慢起速、慢慢收住），不再按每帧固定比例逼近（那种逼近第一帧最快，就是那一下抖）。
- 拉近、退回、侧移、抬升各有自己的时间；抬升起来后至少保持 0.35 秒，沿台基边走时不会一上一下。
- 眼睛自己的移动（侧移、后退）只往空处走；只有在它会落进东西里时才直接挪出来，挪最短的路。
- 选择往右偏多少时，不只看肩头那一点是否空，还看从那里往后能退多远：在钟鼓楼旁边，偏右的视线会穿过楼身，正后方却是通的，就让眼睛回到正后方，不去拉近。

**没有拿的**：把挡住的柱子做淡出。我们的静态几何按材质合并成了少数几个大网格（`mergeStatic`），单根柱子没法单独淡出；
现在的做法是让一根柱子横穿视线时先挡一下（0.25 秒内不躲），比镜头猛地扑到身后好受。

量化（`tests/unit/follow.test.mjs`，每秒 60 帧沿四条路线走，镜头跟着行进方向转，量眼睛「在跟随之外自己动了多少」）：

| 路线 | 改前：最大单帧水平 / 竖直，跳动帧数 | 改后 |
|---|---|---|
| 测量路线（竹林到第一进院子） | 2.0 / 0.43 米，8 帧 | 0.05 / 0.03 米，0 帧 |
| 第一进院子绕一圈，贴着钟鼓楼 | 5.5 / 0.58 米，27 帧 | 0.07 / 0.03 米；8 帧必须从东墙里挪出来（在墙边急转），最多 0.55 米 |
| 中轴到大殿台阶、上二层台到观音殿台阶 | 没有跳动 | 没有跳动 |

「改前」是用旧的跟随逻辑在同一份场景上跑的，但场景里方柱（桌子、台阶挡墙）现在只在眼睛低到离地 1.1 米以内时才挡，所以与线上旧版不完全相同。
