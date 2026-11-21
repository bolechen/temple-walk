# ginkgo-532 证据（#313 第 1 项，PR #532）

## 原图在哪里（#223）

`q*` 的 12 张 PNG 和 T05 两份 JSON 不在仓库里（仓库只留这份说明和一张不超过 1 MB 的拼图 `collage.jpg`、`MANIFEST.json`）：在 Hugging Face 数据集 `bolechen/temple-walk-evidence`，地址和哈希见 `MANIFEST.json`；`node tools/evidence.mjs pull docs/t00/evidence/ginkgo-532` 取回到 `tools/out/evidence/`。

## 比什么

改动：`inside: 0.68`，让银杏每根枝的首环（含 collar 的膨大）落在父枝半径之内。改前是 #327 合入的 `8ad45d4`，改后是本 PR 的 `02eaba7`；应用代码上只差 `three-tree.js` 和 `trees.js` 各几行。

## 机位

页面 `?shot=1&q=high&view=first&show=court&season=<季>&time=day` 打开，`__look(眼, 看)`（软件渲染，1280×720）。

| 图名前缀 | 看哪棵 | `__look` |
|---|---|---|
| `q1-front2m` | 前院 (14.5, 60.5)，近景约 2.6 m，看最低一层枝的根部 | `[11.8,2.6,62.2]` → `[14.5,3.4,60.5]` |
| `q2-court2m` | 首院 (9.5, 28)，近景约 2 m | `[11.2,2.0,29.4]` → `[9.5,3.4,28]` |
| `q3-front-far` | 前院那棵，远景 | `[3,1.6,62]` → `[14.5,5.8,60.5]` |

文件名 `<机位>-<季>-<before|after>.png`，季为 `summer`、`winter`（冬天枝木最清楚）。`collage.jpg`：`q1-front2m` 冬，左改前、右改后。

## 看到什么

近景里大枝的根部与主干相接处，改前改后肉眼看不出差别；没有出现细颈。变化只在首环：改前每根小枝的首环是父枝半径的 1.03–1.30 倍，改后不超过 0.68，在父枝里面，肉眼看不出。

## T05 指纹（共用代码 `three-tree.js` 的影响）

`?level=t05&season=summer&time=day` 下 `__trees()`：

| | cedars | hash | ginkgos | ginkgoHash |
|---|---|---|---|---|
| 改前 `8ad45d4` | 0 | `811c9dc5` | 0 | null |
| 改后 `02eaba7` | 0 | `811c9dc5` | 0 | null |

两份完整输出是 `t05-before.json`、`t05-after.json`，页面无报错。雪松走 `inside` 默认 0，行为不变。
