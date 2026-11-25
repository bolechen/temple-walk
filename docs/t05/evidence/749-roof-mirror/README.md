# T05 大殿屋面不进地面倒影（#749 第一项）

2026-11-25，分支 `claude/t05-roof-mirror`，代码 `139ce7fd`。改前是 main `08800661`。图在证据库，钉在 `ac4f282e`（`node tools/evidence.mjs pull docs/t05/evidence/749-roof-mirror`）。git 里只有这份说明、`MANIFEST.json` 和一张拼图。

## 软件渲染（SwiftShader）

- 命令：`node tools/shots.js --level=t05 --tag=-after`（本提交），`git stash` 后同样出 `--tag=-before`（main）。T05 全部 30 个视角，1280×720。
- 夏·昼：院子铺地是湿的，有积水，镜子那一遍照得出大殿。
- `shots/<视角>-before.png`、`shots/<视角>-after.png`。
- `collage.jpg`：cam01、cam02、b、corner 前后并排，缩到一半。

两张图明度差超过 6 的像素数：

| 视角 | 像素 | 说明 |
|---|---|---|
| cam01 | 6 | 大水洼里 |
| cam02 | 100 | |
| b | 104 | |
| a-tall | 76 | |
| corner | 69 | |
| stele | 92 | |
| shot-copy | 302 | |
| eave | 558 | 满幅淡噪声：几何没变，只是不再并进批次 |
| terrace | 440 | 同上 |
| shot-p1a | 16,146 | 小沙弥的动作，差图的轮廓是他和斗笠，屋面倒影里没有 |
| 其余 20 个 | 0–8 | |

看到的：
- 水洼都在殿脚近处，屋面在倒影里本来就落在水洼外，所以这些视角里看不出缺。
- 斗栱不进倒影时，a 站缺一排是 2,145 像素（`../741-dougong-mirror/`）。屋面比它还少。
- 已知问题写在 `docs/t05/DECISIONS.md` §7。

三角形（`shots.js` 计数，第一人称）：

| 视角 | 三角 | 绘制次数 |
|---|---|---|
| cam01 | 237,142 → 182,092 | 93 → 95 |
| cam02 | 236,440 → 181,370 | 89 → 90 |
| cam07 | 466,582 → 411,532 | 153 → 155 |

## T4

还没量。等 #722 合进 main 后，在合了 main 的头上和 main 轮流量，补在这里。
