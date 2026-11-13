# Watercolour 源码对照

项目页：<https://patch.gg/blendi/watercolour>，作者 @blendi，v1.0.0，head commit `7139086`（2026-11-13）。
本文记录 2026-11-13 能公开核对到的 README、仓库元数据、`src/` 主要源码、授权说明和三张官方静帧。
**它是调查记录，不是已批准的方案**；和用户要求的关系、该不该动手，仍以 `docs/HANDOFF.md` 与
`docs/VISION-AND-RESEARCH.md` 为准。下面「怎么看」是判断，「怎么实现」是源码核对。

## 资料与核对程度

| 资料 | 状态 |
|---|---|
| 项目 README、仓库元数据 | 已读。元数据写 `visibility: open`、`can_read_source: true`，clone 地址 `https://git.patch.gg/blendi/watercolour.git` |
| `src/wash.js` `page.js` `pencil.js` `shape.js` `hood.js` `main.js` `glade/world.js`、`package.json`、`LICENCE-NOTES.md` | 已读源码。下面的实现结论都出自这里 |
| 官方静帧 `shots/readme.jpg` `meadow.jpg` `wood.jpg` | 已看。三张分别是「铅笔→水彩」的过渡、草地、林地 |
| 实时 demo | **没有跑起来**。页面内嵌 iframe 一直停在 “Sharpening a pencil”，所以手感、帧率、动画都没有独立观察过 |
| 性能数字 | 只有作者自测，未复现，也没有笔记本和手机数据 |

## 它是什么

一个 **three.js 0.186.1 + Vite 8.3.5** 的网页 demo（`package.json`）。林边草地先是铅笔线稿，
一个红斗篷小女孩走到哪里，水彩就染到哪里：颜料从脚下铺开、沿树根往上爬、顺溪流走，到开花的树下时
最后一波把整张纸画完。README 里那句话是理解它的钥匙：**「It is a starting point, not a filter.」**
作者明说不能把它盖在一个做好的游戏上，因为每个物体都知道自己从哪里取颜料。

官方静帧里的效果：奶油色纸白留作天光，远近用湿画法分层，树冠内部融成软团而对着天空的轮廓仍清楚，
近处草叶花瓣是一笔一笔的，五层远山沿脊线最深、往下淡进雾里。配色是明亮粉绿、玫红、天蓝的童话气质。

## 怎么搭的（源码核对）

### 一张「颜料何时到达」的地图

`src/wash.js` 的 `createWash()` 默认覆盖 92 米见方，用 **256×256 的 `RedFormat` / `FloatType`
`DataTexture`** 存每个地面格子的到达时刻；没染到的地方填 `1e5`。CPU 侧只有四个操作：
`touch(x, z, now)` 在脚下按距离写入波前、`flood()` 铺满全图、`sync()` 才上传纹理、`all()/none()`
用于 `?painted`。`world.js` 每帧调一次 `touch()`。

关键不是这张图，而是**每个顶点带一个 `root` vec4**：前三个分量是取色的世界坐标，第四个数是颜料爬一米要几秒。
地面的 root 是自己，树的 root 在树脚，花丛的 root 在中心，远山的 root 是最近的可走地面。
GLSL 里 `wcAge = uNow - T - distance(at, root.xyz) * root.w - rag`，`rag` 是三层世界噪声让波前毛糙。
所以同一张二维图能驱动三维物体按各自的次序变色，树从根往上、山一层层向外。
`uFinale` 再叠一次从花树出发的波，且明确取「谁先到」，避免半路的波被加速时跳一下。

### 深度感知的纸面

`src/page.js` 先把整个场景渲进一个 **`samples: 4` 的 HalfFloat render target，带 `DepthTexture`
和 mipmap**，再用一个 GLSL3 全屏 quad 把这张图「印」到纸上：

- 湿区由**世界坐标的三维噪声**决定（不是屏幕坐标），所以它钉在场景里、不会随镜头滑动；
  近处 9–17 米起有湿斑，20–85 米渐变为全湿，正对镜头的一小片是干的。
  是否「已经上色」从 mip 5 的颜色饱和度判断，铅笔线稿永远不参与湿画。
- 湿区里做 14 次按黄金角散开的 `textureLod` 采样，权重是
  `1 - smoothstep(k*.6, k, abs(log(deep(at+o)/dc)))`：**只让视深相近的颜色互融**。
  这是树冠内部变软而边缘不糊的原因，比普通模糊高出一截。
- 轮廓线不是 Sobel 描边：由深度反投影出视空间坐标，取相邻点的叉积法线与深度差，
  再乘上 alpha 通道（笔触不描边）、纸纹和湿区衰减。
- 最后 `pow(..., 1/2.2)` 加奶油纸色。`uScale = size.y / 1080` 把纸纹和笔画宽度归一到 1080p 基准，
  换分辨率不会把颗粒放大。`?wet=0` 可整关。

### 铅笔排线跟着物体走

`src/pencil.js` 给每个几何体加 `hatch` vec2 顶点属性：两组平面场的等值线就是排线的方向，
笔画因此长在物体上，不会随视角在表面滑动。片元里 `pcStrokes()` 用 `dFdx/dFdy` 算出场的屏幕梯度，
`k = -log2(g * uPx)` 决定这一处画第几级笔画，近处细笔渐入，始终保持约 `uPx` 像素的间距；
`pcTooth()` 用 `fwidth` 在远处把纸纹抹平，避免比像素还细的噪点闪烁。
材质是 `MeshLambertMaterial.onBeforeCompile` 注入的，和我们的 `procMat` 是同一族做法。

`src/shape.js` 是另一种克制：`smooth()` 先 `mergeVertices` 再重算法线，让拼起来的部件像一整块；
`knead()` 沿法线用噪声把顶点推离标准形，再按几处「拇指压痕」压回去。球、旋转体、圆角块、
沿曲线滚出的绳，都从这里来。

### 65 万笔触，一次画完

`createDabs()` 把叶、草、花瓣、落花、蝴蝶、浮尘、茎全部收进**一个 `InstancedBufferGeometry`**：
底几何只有一个四边形、6 个索引，实例属性是 `offset / normal / color / dabS / dabB / root`。
形状在片元里按 `kind` 算出来再 `discard`（`dabShape()` 里七片叶、六根草叶、N 片花瓣都是解析式），
飘落、摆动、草的倾倒、蝴蝶扇翅在顶点里算，朝向相机的展开也在顶点里算。
README 说全场约 **650,000 个笔触**；它们不是 65 万个 mesh，也不是 65 万次 draw call。
固体另用 `createBatch()` 按材质合并，`customDepthMaterial` 让这套实例笔触也能进阴影图。

`src/glade/world.js` 读起来像一份手写的场景清单：流水的折线、路的样条、六块踏石、五层远山、
每种树的色阶表、每种花的花瓣数都在文件顶部。`update()` 里每帧 `paint.touch(feet)`；
走到 `(11.4, -26.2)` 六米半内触发 `flood()`、`uFinale` 和天空的最后一波。

### 角色：现成骨骼，自制身体

`src/hood.js` 载入 Patch 的 CC0 starter man，**把他原来的 mesh 全部隐藏，只留骨骼和动作**；
女孩的身体、斗篷、辫子、花篮都是自己拼的 `SkinnedMesh`，另加三根 `cloak_*` 骨头，
用两个弹簧量（后摆、侧摆）由速度和转向驱动，每帧写 `skeleton.boneTexture`。
脚下那块紫灰色软影是手画的 shader，和 `app/src/monk.js` 的假暗斑是同一种取舍。

### 确定性出图

`src/main.js` 有 `?painted`、`?capture`、`?px=`、`?wet=0`；`window.lab.step(dt, n)` 手动逐帧推进，
`lab.teleport()`、`lab.view(eye, target)` 固定机位，`timings` 记录建场各段耗时，
`renderer.compileAsync()` 后预热 6 帧、每帧用 `gl.fenceSync` 等 GPU 完成，才向宿主报 ready。
`tools/` 用 headless Chromium 出静帧和短片。这套纪律和 Saltline 的 `showcase()` 是同一路数。

## 和我们项目的对照

| 维度 | Watercolour | 我们（2026-11-13） | 判断 |
|---|---|---|---|
| 引擎 | three.js 0.186.1，Vite 构建 | three.js r186 vendored，零构建 | 接口基本对得上；不要连 Vite 一起搬 |
| 材质 | `MeshLambertMaterial` 注入铅笔/颜料，纸白当光 | `procMat` 注入 `MeshStandardMaterial`，逐片元算 fbm3 噪声 | 同一族技术。我们仍欠 Saltline 那条「启动烘焙」路线 |
| 纸面 | 独立 render target + `DepthTexture` + 深度门控扩散 | `post.js` 的 EffectComposer：bloom → OutputPass → grade；grade 里有颗粒、暗角、S 曲线，没有深度 | 差距最具体的一处，但只在拍照时补最划算 |
| 装裱 | 画面本身就是纸 | `card.js` 只在照片**外面**画纸纹与印章 | 我们的纸感停在相框，没进画面 |
| 近景植被 | 形状在 shader 里算的实例笔触 | `bamboo.js` 512 canvas 二次曲线叶、`trees.js` 256 椭圆花叶 | 正是 `HANDOFF.md` 说的「近看是色块」 |
| 批量 | 固体按材质合并，笔触一个实例网格 | 已合并，但每栋建筑每种材质各一网格，`HANDOFF.md` 记大院约 780 次绘制 | 它示范的是「形状交给 shader、批次压到极少」，不是少画三角形 |
| 可见化身 | CC0 骨骼 + 自制身体 + 弹簧斗篷 | 手工几何小沙弥，袍子不动、无跪拜 | 证明「骨骼用现成的、身体自己建模」可行 |
| 状态驱动画面 | 全局到达时间图，物体各有 root | 季节/时辰由 `mood.js` 统一驱动，没有空间上的渐进状态 | `site.js` 的 `put()` 已登记建筑与台地，天然适合登记 root |
| 测试 | `lab.step()`、GPU fence、固定机位、`timings` | `?shot=1`、`__pose`、`dataset.ready`；`portrait.js` 靠等 2.5/4.5 秒让合掌过渡完成 | 逐帧步进是我们最缺、也最便宜的一件 |
| 平台 | 快桌面显卡自测 4–6 ms/帧，建场 4.5 s，下载约 9 MB；笔记本与手机未测 | 手机优先，三档 + 帧时降级，真机帧率未知 | 数字不可直接引用；4× MSAA 半浮点 + 深度 + 14 采样对手机是实打实的负担 |

## 可以拿走的，按顺序

以下是建议，**没有动代码，也没有排进 `HANDOFF.md` 的优先级**。

1. **只在拍照出片时加一层深度感知的纸面。** 落点在 `app/yard.js` 的 `capture()` →
   `app/src/post.js` → `app/src/card.js`。纸感要往宣纸、淡墨、赭石、花青收，不是粉绿玫红。
   实现上要么让 composer 的读回目标带 `DepthTexture`，要么在 `capture()` 里单独渲一张带深度的目标，
   不要直接往现有 grade pass 里堆采样。低档位半分辨率或整关，平时漫游不付代价。
   验收：`court@autumn-dusk@third`、`winter-night`、`spring-dawn@third` 三张成片对比，看是否更「艺术品级」。
2. **把一处近景改成实例笔触。** 先挑竹叶或秋银杏，落点 `app/src/bamboo.js`、`app/src/trees.js`。
   从 2–5 万笔触试起，形状在片元里算，摆动在顶点里算，低档位减半并跳过平面反射那一遍。
   验收：`shots.js` 的 tris/calls 不退步，近看不再像贴纸。
3. **补确定性截图。** `tools/shots.js`、`tools/portrait.js` 里加 `?capture` 式的逐帧推进与 GPU 完成等待，
   替换 `waitForTimeout`；保留现有 `dataset.ready`、`__views`、`__pose`、`__photo` 钩子。
   这条几乎不改画面，却能让后面每一次视觉改动可比。
4. **若要做空间上的渐进状态**，先想清楚它属于哪个仪式：上香、钟声、登顶回望，而不是「走一步染一步」。
   `site.js` 的 `put()` 可以顺带登记每栋建筑的 root；我们路线约 250 米、三级台地，比它 92 米单块地面复杂，
   一张 256² 图未必够。
5. **小沙弥若要换带骨骼的实现**，保持 `group / update(dt, speed, pray, t)` 接口不变，
   按 `VISION-AND-RESEARCH.md` 的压缩预算处理骨骼与动作，并以 `walkthrough-test.js` 全程通过为验收。

## 不要拿走的

- **不要把明亮童话水彩变成默认美术。** README 第一原则是「画面精美庄严」，身份是湿石、深木、
  粉墙、灰瓦、竹影、AgX 下的低饱和山寺。红斗篷、虞美人、粉花树很美，但不是这座寺。
- **不要把「走路把世界上色」设为默认玩法。** 它会把漫游变成任务和奇观，与
  `VISION-AND-RESEARCH.md` 记的「慢走、无任务、净心」相冲。最后一波全场景晕染适合短视频，
  不一定适合让人久坐的寺院。
- **不要顺手引入 Rapier 或 Vite。** 我们自定义的 `walk` 矩形、台地、坡道已经能走通，
  `VISION-AND-RESEARCH.md` 已有「不为碰撞引入物理引擎」的结论；零构建静态发布是硬约束。
- **不要把作者的性能数字当我们的预算。** `page.js` 用 4× MSAA 半浮点目标、深度纹理和 14 次发散采样；
  我们手机低档位另有平面反射与竹林。任何实验都要过 `app/src/quality.js` 的分档。
- **不要整包盲拷。** `lib/patch-block.js` 是 Patch 自己的 helper，MIT/CC0 那句覆盖不到它；
  starter man 的身体在这个 demo 里根本没画，借的是骨骼和动作。

## 授权与来源

README 与仓库元数据写 **Code MIT / Art CC0 1.0**；`LICENCE-NOTES.md` 逐项列了
three.js MIT、Quaternius Universal Animation Library 与 Patch starter man 的 CC0、
Rapier 0.21.0 Apache-2.0，并声明画面里的纸、颜料、笔触、山水全部由代码生成，没有加载图片或成品模型。
真复用某个模块时保留出处；`lib/patch-block.js` 单独排除。

- 项目页与 README：<https://patch.gg/blendi/watercolour>
- 仓库元数据（授权、clone、README 全文）：<https://patch.gg/api/v1/projects/blendi/watercolour/repo?ref=713908667b250c35598a737503e68b72cb9a2192>
- 源码 raw 路径形状：`https://patch.gg/api/v1/projects/blendi/watercolour/repo/raw?ref=<commit>&path=src%2Fwash.js`，
  换 `path` 可取 `page.js` `pencil.js` `shape.js` `hood.js` `main.js` `glade/world.js` `LICENCE-NOTES.md`。
- 官方静帧：`shots/readme.jpg`、`shots/meadow.jpg`、`shots/wood.jpg`（同一 raw 接口）。

## 落地前要验的事

- 实时 demo 还没跑起来，手感、动画、真实帧率都未知；先在有 GPU 的浏览器里走一遍再谈移植。
- `page.js` 依赖 GLSL3、浮点单通道纹理、深度纹理和 mipmap 的 `textureLod`，
  要在我们的 r186 + WebGL2 目标上先做一个最小 pass 验证驱动支持。
- 任何纸面通道都要先在 `?q=low` 下量一次帧时间，再谈默认开启。
