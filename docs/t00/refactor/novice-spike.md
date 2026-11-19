# 小沙弥换分层模型：离线接入试验（#246，#163 的接入一半）

2026-11-19，分支 `claude/novice-tripo-246`。只加工具和测试，`app/` 一行没改，线上仍穿代码身体。

## 一句话

一条命令（`node tools/novice-tripo.mjs <目录>`，3.5 秒）把 Tripo 第二轮的 16 件分层模型做成 `monk.dress()` 不改就能穿的四件身体：20,671 面，1.41 MB，两张贴图。站、合掌、走、上台阶、坐凳、盘坐时同一位置的点都不分家，袍下有裤子、不露黑。要接上线还得**重调**三处：手位（手比代码身体大）、`BODY`（大 1.9 cm）、念珠（会穿进胸口）。

![对照图](../evidence/novice-tripo-246/collage.jpg)

原图和重出方法见 `docs/t00/evidence/novice-tripo-246/README.md`。

## 现成的做法（2026-11-19 当天查的原始资料）

| 候选 | 版本（发布日） | 许可 | 结论 |
| --- | --- | --- | --- |
| glTF-Transform（core / functions / extensions） | 4.5.1（2026-09-28） | MIT | 用来读写（项目原来就有）。它的 `palette` 只合并没有贴图的材质里的数值，**合并不了**这 48 张贴图，所以图集自己拼 |
| meshoptimizer | 1.3.0（2026-09-25） | MIT | 用 `simplify` 加 `LockBorder` 减面，边界和贴图缝不动。它也有 `simplifyWithAttributes`，眼下用不着 |
| xatlas（jpcy，MIT）、xatlasjs 0.2.0 / xatlas-three 0.2.1（都是 2024-09-28，MIT） | — | MIT | 不用。16 件的 UV 都在 0–1 里，按件拼图集、只改偏移就够了，不必重展 |
| maxrects-packer 3.0.0（2026-10-15）、potpack 2.1.0（2025-07-14） | — | MIT / ISC | 不用。16 块都是 2 的幂，一行一行往下排几行代码就够了，不为它加依赖 |
| Blender 5.3.0（Data Transfer 可以无界面 `blender -b --python` 跑） | — | GPL-2.0+ | 暂不用。Linux 包 388 MB，而现有的转权重做法（下面）对这个模型够用 |
| Robust Skin Weights Transfer（rin-23，SIGGRAPH Asia 2023） | — | MIT，Python + libigl | 备选。腋下、裆部如果出问题再换它；这次没出 |
| Tripo 自动绑骨 | — | — | 不用（issue 已经说明：骨架不是我们的） |

**新增 npm 依赖：无。** 用到的 glTF-Transform、meshoptimizer、sharp 都是 `tools/novice.mjs` 早就在用的开发依赖，不进页面包体。

## 做法

`tools/novice-tripo.mjs`，按顺序：

1. **读件、转向、定高**：从 `seg-model.glb` 读 15 件，裤子从 `comp-model.glb` 读，都带上节点变换。Tripo 的模型面朝 +x、左手在 −z，转成我们的面朝 +z、左手在 +x，再缩放到 1.18 m 高、鞋底落在 y = 0、水平居中。
2. **补全的裤子**：Tripo 补全时新做出来的面，判法是离分件里原裤面超过 3 mm。补全做出了 2,927 面，其中封住裤口的 713 面藏在绑腿里，删掉。其余是裤腰和裆，原来是黑的，改成指向图集里一块纯色，颜色取裤子自己贴图的平均色 rgb(83,70,61)。**用的是平均色，不是顶点色。**
3. **前臂左右对称**：右前臂被分件并进了右袖。按贴图颜色（肤色而不是袍的砖红）把这 155 面挪到皮肤。挪完两只前臂都在皮肤里，都按「沿手臂」取权重。
4. **切垂带**：垂带是袍摆那张面的一部分，比袍面凸出 2–3 cm，在他左前 30°–72°、高 0.36–0.59 m（量法：每个高度上取垂带两侧的袍面半径，连一条直线，看超出多少）。
   - 凸出超过 6 mm 的点连成的那一块切出来，共 480 面，单独一块。
   - 这块再拷一份，不贴着袍面的点压回那条直线往里 4 mm（247 点），补在袍上原来的位置。这样垂带摆开时袍上不露洞。
   - 垂带离顶端 8 cm 以内的权重逐渐过渡到 `sashTail`，再往下全在 `sashTail` 上。它不参加焊权重，边缘可以离开袍面；只有还没过渡的顶边缝在腰结上。
5. **减面**：每件按 `PIECES` 表里的比例减，边界和贴图缝锁住。31,509 面减到 20,671 面。头留得多（0.8），裤子大半被袍挡住，留得少（0.45）。
6. **一张图集**：颜色图在 2048 的图集里拼好后存成 2048，法线存成 1024，都是 WebP。每块四周留 4 px 的边。金属粗糙度图收成一个常数（粗糙度 0.616，按面积加权平均；金属度 0），所以只有两张贴图。
7. **权重**：
   - 默认取代码身体同一部件里最近四个点的权重；手臂上按离肩多远取，和 `tools/novice.mjs` 的 4、4a 两步一样（已抽成 `tools/novice-weights.mjs`）。
   - **袍身**（上衣、腰带、袍摆、垂带背后补的那块）改用 `monk.js` 里袍子自己的权重公式 `robeW`（按高度和朝向算，抄进 `robeWeights`）。原因：代码身体的袍前面有开口，这件袍摆前面是合的，取最近点时左右两侧落在不同的骨上，坐凳时袍前被撕开。
   - 最后一个点一个权重：`NOVICE_WELD=8`，用 `tools/novice-weld.mjs`。
8. **写文件**：格式和 `novice.glb` 一样，四个网格（skin、robe、legs、shoes），一个材质，`extras.bones` 照骨骼顺序列出。

**和 `tools/novice.mjs` 的关系。**
- 共用的：焊权重（`novice-weld.mjs`），以及从代码身体转权重、沿手臂取权重这两步。后两步抽成了 `novice-weights.mjs`，`novice.mjs` 里那份没删：沙箱里没有 Meshy 原件（24 MB）重跑，没法确认合并后线上的 `novice.glb` 一字节不变。下次手边有原件时，让 `novice.mjs` 也引这个模块，并比对 SHA-256。
- 新写的：部件对照表、找补全做的面、切垂带、拼图集、袍身按公式取权重。

**Tripo 重新生成一版后要手动改的**：
- `PIECES`：节点编号每次分件都会变。看 `parts` 图对上「头、耳、手、袖……」。哪只袖子里并进了前臂，就给它标 `skinInside`。
- `SASH`：垂带的角度和高度。工具会打印切了多少面，对照图上看切得对不对。
- 其余步骤不用改。

## 验收逐条（在提交 `交活` 那一条里的 head 上）

| # | 验收 | 结果 |
| --- | --- | --- |
| 1 | 不花 Tripo 点数 | **过**。没有调用 `api.tripo3d.ai`，余额 120 没动 |
| 2 | 一条命令重出，两次 SHA-256 相同 | **过**。见下面「输入与产物」 |
| 3 | 四件，`dress()` 不改，垂带在 `sashTail`，前臂对称，领口杂色面清掉 | **过**。领口杂色面是补全在上衣领口封口时做出来的；上衣取的是没补全的分件版本，所以不带它。`novice.js` 的 `loadNovice` 也不用改（没用 meshopt 压缩） |
| 4 | 预算：≤1.5 倍面数，≤1.5 MB，≤2 张贴图 | **过**。20,671 面，是现有 20,460 的 1.01 倍；1.41 MB；2 张 |
| 5 | 不撕裂（同一位置一个权重；站、走、上台阶不分家；加坐蒲团、坐凳） | **过**，`tests/unit/novice-tripo.test.mjs` 九条全过，下面列出测试名 |
| 6 | 袍下不露空不露黑 | **过**，有保留。四面图上袍下看到的是裤子的颜色；测试查了裤和袍没有一个点落在近黑的贴图上。保留的地方：坐凳时袍前那片抬到腿下面去了，正面看得到整条裤腰（有颜色，不黑），和代码身体盖在腿上的样子不同；站立正面袍摆下沿有几处小白点（没查清是哪件，下一步用 `__pick` 查） |
| 7 | 对照图三列五姿四面、斗笠和念珠三面 | **过**。拼图在仓库，原图在数据集 |
| 8 | 量，不改 | 见下面「量出来的」 |
| 9 | 许可 | 见下面「许可」 |
| 10 | 报告 | 本文 |
| 11 | `pnpm run check`、`pnpm test` | 见 PR 交活评论 |

**测试名**（`node --test tests/unit/novice-tripo.test.mjs`，文件不在时整套跳过）：
- made for this skeleton: four parts, joints numbered as monk.js's bones, two textures
- within budget: at most 1.5 times the sculpted body's triangles, at most 1.5 MB
- he stands 1.18 m tall, soles on the floor, centred; every weight whole and on a bone that is there
- the sash's end hangs on sashTail, at his left front; the rest of the robe does not
- his hands go with his hands, both forearms with their forearms, his shoes with his feet
- every copy of one point takes the same weights (the sash's free edge apart)
- copies stay within a millimetre standing, through a stride and up a flight
- copies stay within a millimetre sitting on a stool and cross-legged on a cushion, and with palms together
- nothing he wears is black: the faces the completion made under the robe are coloured

这些测试在 CI 上会跳过，因为产物不在 git 里、私有桶 CI 也取不到。要在 CI 上跑，得等文件进了 `app/`。

## 输入与产物

| 文件 | SHA-256 |
| --- | --- |
| `seg-model.glb`（分件） | `7966f90d9d58cf117cb674177aa65cb73091f7f16c51e572af27e9056a711c75` |
| `comp-model.glb`（补全） | `82d04b491538bbd0a219f381ea8e4270aac78a387b7541ddb69e823640a21c11` |
| `pbr_model.glb`（整体，没用到） | `c8a3194c7ea80af045f6659177f1f2e001845423567e07d3af9d0e008ab68d1e` |
| **产物** `novice-tripo.glb`（1,413,704 字节，两次运行相同） | `c969d62cb0b9de0cfc8a2ed21f4e91bb38ea3b8b15ab78c2dbf3d2d7f2fa5010` |

产物放在 `hf://buckets/bolechen/temple-walk-render/keep/novice-b/2026-11-19/novice-tripo.glb`。

## 量出来的（`node tools/novice-measure.mjs app/shared/models/novice.glb tools/out/novice-tripo.glb`）

| | 代码身体 | Meshy | 新身体 | 结论 |
| --- | --- | --- | --- | --- |
| 外廓半径（edges.test 的六个姿势） | 0.377 m | 0.379 m | **0.399 m**（比 `BODY` 0.38 大 1.9 cm，出现在原地跳、两臂张开时） | **重调**：把 `BODY` 改成 0.40，可走格子（#194）和 `edges` 表跟着重烘；或者收窄 A 姿的臂展。这一项牵连最大 |
| 头顶高 | 1.177 m | 1.180 m | 1.180 m | 不变（按身高归一的） |
| 眼高 | 1.017 m | （闭眼，量不准） | 1.000 m | 不变。第一人称的眼睛跟着头骨走，不按模型的眼睛；低 1.7 cm 看不出来 |
| 合掌 | 掌心相合 | — | 手比代码身体大，十指张开，**掌心没合上** | **重调**：合掌的手位和手掌朝向 |
| 吃茶（碗到唇边） | 手在碗两侧 | — | 手大，**遮住了脸颊和眼睛**，碗在下巴前面 | **重调**：`rites.js` 里捧碗的手位（`hold` 的偏移） |
| 举香到眉 | 双掌在额前 | — | **手掌盖在额头和脸上** | **重调**：`brow` 的偏移往前放 |
| 袖子 | — | — | 三个手位里袖子都没有穿进袍身 | 不变 |
| 斗笠（背在身后） | — | — | 贴在背上，没有穿进身体 | 不变 |
| 念珠 | — | — | **大半穿进胸口**，只在肩上和领口露出来 | **重调**：念珠的环再放大一些，或者往前挪 |

合起来：骨骼、`monk.update`、`dress()` 这条路、坐姿、步态都**不变**；`BODY`、三个仪式的手位、念珠要**重调**；没有哪一项要**重做**。

## 许可

Tripo 的条款：「Terms of User Agreement」，**Last updated: July 11, 2025**，Holymolly Ltd，<https://developers.tripo3d.ai/en/terms>（2026-11-19 读。`www.tripo3d.ai/terms` 对自动抓取返回 403，这里引的是同一份协议在开发者站上的文本，正文写明适用于 www.tripo3d.ai 及相关网站）。

- §3.2：「…you may use Outputs for lawful commercial or non-commercial purposes, so long as such Outputs are not distributed or made available to third parties in a manner inconsistent with this Agreement or applicable laws」
- §5.2.2（付费用户，原文如此）：「…Paid Users generally have all rights (including but not limited to: use, copy, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, … derive revenue …) of the Inputs and Outputs by the paid Users and the Intellectual Property Rights based on the Inputs and Outputs by the paid Users. For the avoidance of doubt, Company will not use Inputs and Outputs as training data…」
- §5.2.1：免费用户的产出，所有权利归 Tripo。
- 署名：条款里没有署名或水印的要求（搜「attribut」「watermark」都没有）。
- API 积分：§6.4 只说积分「intended primarily for business and professional use」、不退。没有单独写 API 产出归谁；按付费使用理解，落在 §5.2.2。

所以：这两轮是用充值的 API 积分做的，属于付费产出，可以商用，不用署名。进 `app/` 时在 `asset-register.csv` 登记账号类别、两轮的任务号和条款日期 2025-07-11。

## 接入线上还差什么

1. 所有者看图，定「接入 / 重新生成 / 放下」。
2. `BODY` 0.38 → 0.40（或者收窄臂展），然后重烘可走格子（#194、`tools/bake-walk.mjs`），重跑 `pnpm run edges`。#161 的第三步要知道这件事。
3. 重调 `rites.js` 的合掌、吃茶、举香手位。手大了，按新身体的手长重设偏移，每个仪式出正、侧图。
4. 念珠的环放大或前移。
5. 产物进 `app/shared/models/`，登记 `asset-register.csv`（含 SHA-256、Tripo 任务号、条款日期）。`novice.js` 默认取哪个身体由所有者定。这时 `novice-tripo.test.mjs` 才会在 CI 上真跑。
6. 坐凳时袍前抬到腿下面的问题：调 `robeFront` 的抬起量，或者把这件袍摆的前片单独加权。站立时袍摆下沿的小白点：用 `__pick` 查。
7. 颜色：袍比 Tripo 原图的砖红浅。原因是金属粗糙度收成了常数，舞台的环境光也不同。进场景后在夏昼里对一次色。
8. `tools/novice.mjs` 改为引用 `novice-weights.mjs`（要有 Meshy 原件才能比对字节）。
9. 弹簧骨和碰撞体换 VRM 是 #163 第 5 条，不在这里做。

## 连带影响

- **别的模块**：这次一个都没动。将来接入时会动到的见上面「量出来的」：`BODY` → walker、可走格子、`edges`；手位 → `rites.js`；念珠 → `monk.js`。
- **玩家**：现在没有变化，线上不取这个文件。
- **多出来要同步的东西**：一个新工具，它的输入在桶里；一个测试文件；`novice-views.cjs` 多了几个选项（多身体并排、`--poses`、`--sides`、吃茶和举香两个手位）。
- **维护**：Tripo 再生成一版时，只改 `PIECES` 和 `SASH` 两张表；依赖都是项目原有的。
