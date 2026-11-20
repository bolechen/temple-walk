# T00 运营埋点（Umami）

更新：2026-11-20（`demo.load_error` 补字段、`__eventLog()` 与 `offering.*` 两处过期说明改正：#328）。站点 `temple.rushiwowen.co`，自建 Umami 3.5（`u.rushiwowen.co`），站点 id `e9b57921-f7a4-4d50-b0e9-8f0fcdccfa42`。
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

> `offering.*`（coin/sheet/open/qr）不是遗留：`app/src/game.js` 里确有调用（功德箱投币 `offering.coin`，网页版再开供养单 `offering.sheet`/`offering.open`，扫码 `offering.qr`，`src/donate.js`）。第 1 节的快照取自 11-19 上午，当时的数据与现状分开看；事件表在 3.3。

---

## 2. 数据在说什么

1. **最大的漏点在「进来之后、第一枚印之前」**：194 人进入，只有 43 人拿到一枚印（22%）。不是加载问题（ready→enter 仍有 83%），是「不知道往哪走、走多久、能做什么」。
2. **开场镜头有一半人跳过**：40 人看、21 人跳过。不是失败，但说明开场太长或与「我想自己走」冲突；需要按设备/语言再看。
3. **七印完成只有 5 人**，而 `demo.ending` 有 8 人（含重看/换季），说明「走完」是极少数；运营内容应先服务「第一枚印」和「第一次回望」，不是通关。
4. **手机是主战场**，且 WebView 占比高（iOS WebView 68、Android WebView 56）。分享链接在微信/内置浏览器里打开是常态；横屏、触控、音频解锁都要按这个前提看。
5. **性能的 INP 2.2 s 偏高**，LCP p75 2.8 s。Umami 的 INP 是页面级近似，不等于每一次交互，但值得在真机上按 `?q=low` 复核；这一轮先不改渲染，只把「降级发生了」记下来。
6. **香是最多人完成的 observance（31 次）**，钟、茶各 11。香的流程最短、位置最明确，可作为「第一枚印」的默认引导候选；目前默认指向钟楼，值得 A/B。

---

## 3. 事件表

事件名一律 `demo.*` / `opening.*`；每个事件自动带 `lang`（`zh|ja|en|ko`），字符串值截到 50 字符，布尔转 `1/0`。只在 `temple.rushiwowen.co` 发送；预览、测试、本机不发送（`__eventLog()` 仍可在本机读到内存里的最后 100 条）。

### 3.1 已有（本轮不改）

| 事件 | 何时 | 数据 | 用途 |
|---|---|---|---|
| `demo.ready` | 页面画稳、三帧后 | `tier` `lang_source` `lang_from` | 到达；加载质量与语言来源 |
| `demo.enter` | 点「入山」后 | `resumed` `seals` `tier` | 从标题进入；新访/续走 |
| `opening.played` | 开场开始 | `eye` `again` | 开场覆盖 |
| `opening.skipped` | 开场被跳过 | `eye` `at`（走到几成） | 开场长度 |
| `opening.title` | 山门前序章标题升起 | — | 序章标题到达率 |
| `demo.seal` | 每得一枚印 | `id` `count` | 核心进度 |
| `demo.complete` | 第七印、书满 | `count` `seconds` | 通关 |
| `demo.ending` | 收尾看完/跳过 | `skipped` `count` `seconds` | 结尾 |
| `demo.restart` | 从头走起 | `from` `seals` | 重开 |
| `demo.load_error` | 加载失败 | 见 3.2 末的字段表 | 失败在哪一步、哪个资源、什么错 |

### 3.2 本轮新增（`demo.load_error` 的字段见下表）

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
| `demo.share` | 系统分享成功（留影或朱印簿） | `from` | 分享出口 |
| `demo.quality` | governor 降一档 | `tier` `level` `gtao` `soft` `planar` `scale` | 有多少人在跑的过程中被降级，降到哪一步 |

**`demo.load_error` 的字段（#328）**。一个页面只发一次，取第一次失败，连锁的报错不再发。`loading.js` 是纯脚本，单测在 Node 里直接跑它，拿不到 `deploy.js` 的 `PRODUCTION`，所以仍按 hostname（`temple.rushiwowen.co`）判断是否发送；金丝雀和预览不发。

| 字段 | 值 |
|---|---|
| `reason` | 旧字段，保留：`webgl` 或 `error`，旧报表照用 |
| `stage` | 失败时最后一个 `step(name)` 的名字；还没进第一步是 `boot`（截 50 字） |
| `percent` | 失败时进度条的值（0–99） |
| `kind` | `script-error`（window `error`，代码抛错）、`resource`（`<img>` `<script>` `<link>` 的 `error`，在捕获阶段听；以及纹理没取到）、`rejection`（`unhandledrejection`）、`webgl` |
| `resource` | 失败资源的路径：站内只留路径，去掉域名、查询串和片段，截 120 字；站外只写域名。只有 `kind=resource` 有 |
| `message` | 错误信息头 120 字，其中的完整网址换成路径（站外换成域名），`?` 之后的内容去掉。`resource` 没有 |
| `where` | 抛错的文件名和行号（`app.js:42`，不含目录和查询串）。只有 `script-error` 有 |

两点要知道：一，纹理没取到不会让页面打不开（以它的均色顶替），所以只记 `kind=resource`，不弹重试；`<img>`、`<link>` 同样只记不弹，`<script>` 没取到才弹。二，因为只发一次，先因一张图记了、随后才崩的页面，数据里留的是那张图。事件也进 `__eventLog()`（本机可读）。

**为什么是这些，不是更多**：它们正好补上「ready → enter → 第一枚印 → 第一座殿 → 第一次留影/分享」这条运营主线，以及「仪式中途放弃」和「性能降级」两个质量信号。点击热区、每帧位置、滚动深度都不做——页面没有滚动，也不该把访客的每一步都记下来。

### 3.3 供养（`offering.*`，`game.js`，只带 `lang`）

| 事件 | 何时 |
|---|---|
| `offering.coin` | 在功德箱前合掌、投下一枚（每个渠道的构建都有） |
| `offering.sheet` | 投币后打开供养单（仅网页版） |
| `offering.open` | 在供养单上点了去往如是我闻的链接（仅网页版） |
| `offering.qr` | 供养单上展开了赞赏码（仅网页版，每次访问一次） |

---

## 4. 看数的方法

- **漏斗按 visit 去重**：`event_name` 分组后 `count(distinct visit_id)`；不要用事件次数当人数。
- **事件数据**：Umami 的 Events 表按事件名筛，再按 `id`、`lang`、`from` 分组；`demo.rite` 先筛 `phase=start` 和 `phase=end`，`done=0` 是放弃。
- **语言**：每个事件都带 `lang`，所以「日文访客走到哪一步」可以直接筛；不要用浏览器语言代替。
- **性能降级**：`demo.quality` 的 `level` 是第几次降级（1…5），`tier` 是起始档；和 `demo.ready.tier` 对比。
- **分享**：`demo.share.from` 只有 `print | book`；`t.co` 的 196 次进入是外部，不是站内分享。

---

## 5. 边界

- 不采集姓名、账号、位置、设备指纹；只有 Umami 自带的浏览器/系统/语言/国家与页面性能。
- 事件值截到 50 字符，避免把长文本带出去；`track()` 在非公开域名直接返回，不发送。
- `__eventLog()` 是测试与主控台用的内存记录（最后 100 条），不上传。
- 这份数据是自建 Umami 的 Postgres 只读查询；查询日期 2026-11-19，之后会变。引用时写日期。

---

## 6. 这一轮不做的

- 不做 A/B 测试框架；先看「默认指向钟楼 vs 香」哪个人更容易拿到第一枚印，用现有数据加一次运营改动即可。
- 不做 session replay、热图、逐帧位置。
- 不改 Umami 的采样与保留策略；站点流量还小。
- `offering.*` 已在 `game.js` 里发送（见第 1 节的说明），本文不重新设计它们。
