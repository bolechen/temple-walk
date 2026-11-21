# T00 运营埋点（Umami）

更新：2026-11-19。站点 `temple.rushiwowen.co`，自建 Umami 3.5（`u.rushiwowen.co`），站点 id `e9b57921-f7a4-4d50-b0e9-8f0fcdccfa42`。
本文记两件事：**现在看到的数据**，以及**这一轮补的埋点**。数据是从 Umami 的 Postgres 只读查询得到的，不是估算。

---

## 1. 数据快照（2026-11-16 建站 至 2026-11-19 上午）

| 项 | 数 |
|---|---|
| 页面浏览 | 1,142 |
| 访客（visit） | 340 |
| 每日 | 11-16：498 / 227；11-17：131 / 55；11-18：495 / 60；11-19（半日）：18 / 9 |
| 来源 | 直接 944；`t.co` 196；微信 1；91aigame 1 |
| 语言 | zh 439 / en 103 / ja 22 / ko 12 |
| 语言来源 | 浏览器 141 / 上次保存 83 / 地址 29 |
| 设备 | 手机约六成（iOS WebView 68、Android WebView 56、iOS 27、Android Chrome 25…）；笔记本约四成；桌面少量 |
| 性能（448 次有 LCP 的页面） | LCP 平均 2,973 ms、p75 2,785 ms；INP 平均 2,245 ms；CLS 0.019；TTFB 751 ms |

**漏斗（按 visit 去重）**

| 事件 | 访客 | 相对上一行 |
|---|---|---|
| `demo.ready` | 234 | — |
| `demo.enter` | 194 | 83% |
| `demo.seal`（至少一枚印） | 43 | 22% |
| `demo.complete`（七印圆满） | 5 | 2.6% |

**序章开场**：`opening.played` 40 人，`opening.skipped` 21 人；跳过约占一半。

**七印分布**（事件次数，不是人数）：香 31、钟 11、茶 11、经 8、井 7、灯 7、坐 6。

> 另有一组 `offering.*` 事件（open/coin/qr/sheet）存在库里，但当前 `app/` 没有这些调用；应是旧构建或另一条分支的遗留，**不在本 PR 的事件表内**，也不据此判断现状。

---

## 2. 数据在说什么

1. **最大的漏点在「进来之后、第一枚印之前」**：194 人进入，只有 43 人拿到一枚印（22%）。不是加载问题（ready→enter 仍有 83%），是「不知道往哪走、走多久、能做什么」。
2. **开场镜头有一半人跳过**：40 人看、21 人跳过。不是失败，但说明开场太长或与「我想自己走」冲突；需要按设备/语言再看。
3. **七印完成只有 5 人**，而 `demo.ending` 有 8 人（含重看/换季），说明「走完」是极少数；运营内容应先服务「第一枚印」和「第一次回望」，不是通关。
4. **手机是主战场**，且 WebView 占比高（iOS WebView 68、Android WebView 56）。分享链接在微信/内置浏览器里打开是常态；横屏、触控、音频解锁都要按这个前提看。
5. **性能的 INP 2.2 s 偏高**，LCP p75 2.8 s。Umami 的 INP 是页面级近似，不等于每一次交互，但值得在真机上按 `?q=low` 复核；这一轮先不改渲染，只把「降级发生了」记下来。
6. **香是最多人完成的 observance（31 次）**，钟、茶各 11。香的流程最短、位置最明确，可作为「第一枚印」的默认引导候选；目前默认指向钟楼，值得 A/B。**已动手（#436）**：见下文「5b」。

---

## 3. 事件表

事件名一律 `demo.*` / `opening.*`（带走朱印帐的两个是 `save.*`）；每个事件自动带 `lang`（`zh|ja|en|ko`），字符串值截到 50 字符，布尔转 `1/0`。只在 `temple.rushiwowen.co` 发送；预览、测试、本机不发送（`__events()` 仍可在本机读到内存里的最后 200 条）。

### 3.1 已有（本轮不改）

| 事件 | 何时 | 数据 | 用途 |
|---|---|---|---|
| `demo.ready` | 页面画稳、三帧后 | `tier` `lang_source` `lang_from` `failed` `from`（分享链接带的场景，白名单外为空，#344） | 到达；加载质量与语言来源；本轮起带失败贴图数（缺席表示旧数据，按未知处理，不当 0） |
| `demo.enter` | 点「入山」后 | `resumed` `seals` `tier` | 从标题进入；新访/续走 |
| `opening.played` | 开场开始 | `eye` `again` | 开场覆盖 |
| `opening.skipped` | 开场被跳过 | `eye` `at`（走到几成） | 开场长度 |
| `opening.title` | 山门前序章标题升起 | — | 序章标题到达率 |
| `demo.seal` | 每得一枚印 | `id` `count` | 核心进度 |
| `demo.complete` | 第七印、书满 | `count` `seconds` | 通关 |
| `demo.ending` | 收尾看完/跳过 | `skipped` `how`（`hold`/`tap`/`wake-ignored`/`played`）`ignored`（被当作唤醒而不算的按下）`count` `seconds` | 结尾；`wake-ignored` 是没略过、但防护拦过至少一次 |
| `demo.ending.replay` | 朱印帐「山顶再坐一回」点下（`phase: start`），重播结束时再发一次（`skipped` `how` `ignored`） | — | 回看；不是新的一季 |
| `demo.restart` | 从头走起 | `from` `seals` | 重开 |
| `demo.load_error` | 加载失败 | `reason`（`error`/`webgl`）`asset` `stage` `where` | 失败原因、哪个资源、停在哪一步、哪里出的错（本轮补 `asset`/`stage`/`where`，见下） |

### 3.2 本轮新增

| 事件 | 何时 | 数据 | 回答什么 |
|---|---|---|---|
| `demo.walk` | 本次访问第一次真正走动（进入后、非仪式/非拍照） | `view` `tier` | 进入后有没有迈出第一步；第一/第三人称 |
| `demo.hall` | 第一次进入某座殿（每次访问每殿一次） | `id` `count` | 有没有进屋；一共进了几座 |
| `demo.book` | 点朱印簿 | `seals` | 有没有打开过进度；在第几印 |
| `demo.photo` | 按快门 | `view` `aspect` `monk` `zoom` `mood` | 留影使用率、画幅、是否带人 |
| `demo.menu` | 打开歇脚菜单 | `inside` `up` `tier` | 设置/求助；在室内/楼上的比例 |
| `demo.mood` | 手动换季/换时辰/回到随时辰 | `season` `time` `follow` | 赛季权限用得多不多；偏好 |
| `demo.view` | 按 V 或滚轮/双指切换第一/第三人称 | `to` | 视角偏好 |
| `demo.rite` | observance 开始/结束 | `id` `phase` `seconds` `done` | 哪个仪式被开始、多久、有没有做完（补上 `demo.seal` 看不到的放弃） |
| `demo.share` | 分享了一张图或一段短片：系统分享成功、打开了「长按保存」那张纸，或点了下载（#344；短片 #342、除夕撞钟卡片 #341 只走系统分享） | `from`（`print` / `book` / `clip` / `joya`）`method`（`share` / `save` / `download`）`scene`（链接里带的场景） | 分享出口；在 App 内置浏览器里走的是哪条路 |
| `demo.clip.start` | 按「拍一段」，录制开始（#342） | `aspect` `tier` `fmt`（`mp4`/`webm`）`mark`（带不带落款） | 短片使用率、画幅、各浏览器出什么格式、落款有没有被关 |
| `demo.clip.export` | 一段录完、文件出来（自然结束或中途停下） | `fmt` `secs`（取整）`early`（中途停）`tier` | 录得完不完整、平均多长；`start` 与 `export` 之差是录到一半被放弃（收起相机、切到后台）的 |
| `joya.ring` | 除夕撞钟窗口内，这一页第一次撞钟计入（#341） | `year`, `forced`（工作台 `?event=joya` 提前打开为 1） | 参与活动的人数 |
| `joya.card` | 生成除夕撞钟卡片（#341） | `year`, `mine`（自己计入的下数） | 卡片生成次数 |
| `lamp.link` | 在供灯处选了一句祝语、生成了链接和卡片（#343） | `wish`（预设祝语的编号）`season` `time` | 为他人点灯做了多少次、选的哪句；不记链接，不记任何文字 |
| `lamp.open` | 经「为他人点灯」的链接打开，灯被带到眼前 | `wish` `season` `time` | 链接有没有被打开；与 `lamp.link` 对比，再加 `utm_source=lamp` 的访问数 |
| `demo.quality` | governor 降一档 | `tier` `level` `gtao` `soft` `planar` `scale` | 有多少人在跑的过程中被降级，降到哪一步 |
| `demo.leave` | 入山后第一次页面隐藏（每次打开一次） | `seconds`（本次页面打开秒数）`seals` `metres`（这一趟）`place`（殿 id / 楼上 id / 地点名）`inside` `up` | 每次访问在哪儿结束、多久、走了多少、几枚印 |
| `demo.setting` | 改设置（同一 key 800 ms 内合并，取最后值；值未变不发） | `key` `value`（布尔为 `1/0`） | 谁改了哪项：自动镜头、画质、锁定鼠标、音量、视野等 |

### 3.3 带走朱印帐（#338）

| 事件 | 何时 | 数据 | 回答什么 |
|---|---|---|---|
| `save.export` | 在朱印帐的「带走朱印帐」里复制或分享了链接 | `to`（`here` / `canary` / `production`） | 有没有人搬存档；搬去哪里 |
| `save.import` | 打开带 `#save=` 的链接后的结果 | `result`（`ok` / `declined` / `damaged` / `newer` / `empty`） | 搬成了没有；坏链接、旧版本拒绝的比例 |

两个事件都不带存档的任何内容（没有印、地点、设置），见 `docs/t00/SAVE.md`。

`demo.load_error` 的三个新字段（`app/loading.js`）：

- `asset`：失败资源的文件名（去掉网址、query 与 hash）。依次取：调用方传入的资源；这次错误信息里的第一个网址（如 three 的 `fetch for "…/buddha.glb" responded with 404`）；页面里最近一个加载失败的 `<img>`/`<script>`/`<link>`。资源加载失败不冒泡到 `window`，只有捕获阶段听得到；这个监听只记下文件名，**不判为加载失败**，一张图缺了不等于整页没加载好。three 用不进文档的图片取的扫描贴图，捕获阶段也听不到，它们只记在 `demo.ready.failed` 里。
- `stage`：最后一次 `loading.step(name)` 的步骤名（不带「山路正在铺开」）。
- `where`：代码抛错时是脚本文件名与行号（如 `yard-3f9a.js:722`）；未处理的 Promise 拒绝时是错误信息的前 50 字，其中网址只留文件名。

`demo.leave` 的 `place` 与「接着走」保存的地点同源：殿内是殿 id（如 `main`），楼上是 `lingxiao`，其余是用 `labelOf` 得出的地点名（如 `钟楼`、`山路上`）。

**为什么是这些，不是更多**：它们正好补上「ready → enter → 第一枚印 → 第一座殿 → 第一次留影/分享」这条运营主线，以及「仪式中途放弃」和「性能降级」两个质量信号。点击热区、每帧位置、滚动深度都不做——页面没有滚动，也不该把访客的每一步都记下来。

---

## 4. 看数的方法

- **漏斗按 visit 去重**：`event_name` 分组后 `count(distinct visit_id)`；不要用事件次数当人数。
- **事件数据**：Umami 的 Events 表按事件名筛，再按 `id`、`lang`、`from` 分组；`demo.rite` 先筛 `phase=start` 和 `phase=end`，`done=0` 是放弃。
- **语言**：每个事件都带 `lang`，所以「日文访客走到哪一步」可以直接筛；不要用浏览器语言代替。
- **性能降级**：`demo.quality` 的 `level` 是第几次降级（1…5），`tier` 是起始档；和 `demo.ready.tier` 对比。
| `demo.share` | 系统分享成功（留影、朱印簿、短片或除夕撞钟卡片） | `from`（`print` `book` `clip` `joya`） | 分享出口 |
- **朱印帐上的二维码（#319）**：分享出去的朱印帐带一枚码，写 `https://temple.rushiwowen.co/?utm_source=goshuin&utm_medium=share&utm_content=<lang>`；扫码进来的访问在 Umami 里按 `utm_source=goshuin` 筛，`utm_content` 是图上的语言。`demo.share` 照旧只数「分享」按钮成功的次数，扫码进来的数不能拿它去对，二者可以相差很多（图可以被保存、转发、截屏）。留影卡片上的码（默认开，可在留影设置里关）写 `utm_source=photo`，同样的筛法；`utm_content` 是卡片的语言。

---

## 5. 边界

- 不采集姓名、账号、位置、设备指纹；只有 Umami 自带的浏览器/系统/语言/国家与页面性能。
- 事件值截到 50 字符，避免把长文本带出去；`track()` 在非公开域名直接返回，不发送。
- `__events()` 是测试与主控台用的内存记录（最后 200 条），不上传。
- 这份数据是自建 Umami 的 Postgres 只读查询；查询日期 2026-11-19，之后会变。引用时写日期。

**同修留痕（#340）不是统计，是游戏数据。** 站在钟楼前看到的「当日已有 N 人在此敲钟」来自 Worker 的 `/api/trace` 与 `/api/traces`（`worker/`，docs/RELEASING.md），不经 Umami，也不写进 Umami：
- 只存「日期（UTC）× 地点 × 种类（`rite`/`seal`）× 计数」，没有 IP、UA、Cookie、访客号、语言、来源页；Worker 的代码只读请求的方法、路径、`day` 和那一小段体，`tests/unit/trace.test.mjs` 扫源码保证这点。
- 它的数字不能拿来当访客数、转化率或留存：每处每页面只报一次，同一个人刷新、换设备都会再算一次；尝试刷数的被总量桶和日上限挡住，所以也不是精确的人数。要看人数，仍看 Umami。
- 因此没有新增 Umami 事件。`demo.rite`、`demo.seal` 照旧；留痕的请求只在公开站和 canary 发（预览、测试、steam/平台版不发），遵守浏览器的 Do Not Track 和 Global Privacy Control（读，不报）。

---

## 5b. 第一枚印的引导改为上香（#436，所有者 2026-11-21 同意的试验）

- **改动**：一枚印都没有的访客，目标行、`#way` 印章、起步提示都指向大雄宝殿上香；拿到任意一枚印后恢复 `SEALS` 的顺序。只改了 `journey.js` 的 `next()`，提交 `d288538`（合并前的分支提交，squash 后以合并提交为准，由主创在合并时补）。印的顺序、朱印帐版式、七印规则、三下撞钟的规则都没动。
- **预期**：「进入后拿到第一枚印」的比例从 22%（43/194）上升；超过 30% 算有效，没超过回到主创重议。
- **判定**：第一个包含本改动的版本上线满 14 天后，由每周数据分析比较（不挡合并）。
- **口径提醒**：旧数据里上香 31 次不排除重复上香（三座殿都能上，只有大殿给印），样本小；比较时按 visit 去重，并只数大殿给印的那一次。这是一次试验，不是定论。
- **二阶**：钟楼不再是默认第一站，撞钟、上香的次数会一起变，所以除了「第一枚印」也看各印的分布；朱印帐里 0 枚时的那行提示也跟着变成上香（同一个 `next()`）。

---

## 6. 这一轮不做的

- 不做 A/B 测试框架；先看「默认指向钟楼 vs 香」哪个人更容易拿到第一枚印，用现有数据加一次运营改动即可（已做，#436）。
- 不做 session replay、热图、逐帧位置。
- 不改 Umami 的采样与保留策略；站点流量还小。
- 不把 `offering.*` 旧事件接回来；若主创要「供养」玩法，另立 issue。

- **除夕撞钟（#341）**：卡片上的码写 `https://temple.rushiwowen.co/?utm_source=joya&utm_medium=share&utm_content=<lang>`，扫码进来的访问在 Umami 里按 `utm_source=joya` 筛。全山的撞钟总数是游戏数据，存在 #340 的计数服务里（只有「年份 × 计数」，不存任何标识），不是统计，不进 Umami。
