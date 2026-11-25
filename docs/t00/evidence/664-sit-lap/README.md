# #664 盘坐：先盘腿，手放腿面（PR #680，接 #666）

穿的是**代码身体**（`app/src/monk.js`，页面默认）。图在证据库，清单见 `MANIFEST.json`；仓库里只留这份说明、几份 JSON 和 `collage-8a1bfa2.jpg`（之前的 `collage.jpg` 是 `3f92687` 的，在证据库里）。

## 最新：`8a1bfa2`（collage-8a1bfa2.jpg）

- 上排：T4 实拍山顶 `shot-sit`（高档，夏昼），左 main `29fd055`，右本 PR `8a1bfa2`（运行 `20261125-062645`，同一个 Job 交替）。
- 中排：设定图对代码身体的剪影（正面 0.929、侧面 0.900）；两手正面和俯视特写（空台）。
- 下排：大殿蒲团、茶寮蒲团（`review-sheet`）；坐下途中第 6、10、15、22 帧；首院站着（T4，并拢的手）。

| 量什么 | d52d825 | `3f92687` | **`8a1bfa2`** |
|---|---|---|---|
| 正面 / 侧面 IoU | 0.873 / 0.772 | 0.930 / 0.909 | **0.929 / 0.900**（`iou-8a1bfa2.json`） |
| 手看得见（`shot-sit` / 大殿 / 茶寮） | 89.1 / 89.5 / — | 71.4 / 72.1 / — | **76.5 / 76.9 / 86.2%**（`review-*-8a1bfa2.json`） |
| 袍摆前沿比膝头 | −8.7 cm | −9.3 cm | **−9.3 cm** |
| 两手中心相距（皮肤质心） | | | **3.8 cm**，左手高 2.4 cm（单测 ≤4 cm） |

T4 第二次（`t4b-report.json`）`__cost` 毫秒，main → 本 PR：山顶坐着高档 9.23→9.53、9.26→9.29、9.37→9.64（中位 +0.27）；首院站着高档 13.08→13.65、13.14→12.72；低档手机 5.62→6.04、5.99→5.55（后两者在波动之内）。三角面 +1736（手做成连续曲面）。

站姿：`posehash-8a1bfa2.txt` 对 main 只差皮肤（并拢的新手，所有者「可以，站姿用并拢的手」），其余部件逐点相同。

新图（证据库）：`t4b-*.png`、`review-*-8a1bfa2.png`（含 `sit__8` 茶寮）、`sheet-8a1bfa2.jpg`、`sitting-down-8a1bfa2.jpg`。手部特写在 `../664-sit-lap-hands/`。

## collage.jpg（`3f92687`，在证据库）

- 上排：T4 实拍山顶 `shot-sit`（高档，夏昼），左 main `d7e8771`，右本 PR（`f45d58b`，同一个 Job 里交替拍的；其后只改了拇指的拱和斗笠放哪一侧）。
- 左下三排：设定图 `refs/monk-poses-v6-2026-11-23-sitting.webp` 的盘坐正面、侧面；代码身体在空台上从同样两面平视，缩到同一比例；两边剪影叠在一起（白＝重合，红＝只有我们，绿＝只有设定图），不含蒲团和斗笠。
- 右下：下巴底 main 对本 PR（T4 同一张图里裁的）；两手近看（空台）；大殿佛前蒲团（软件渲染，`review-sheet` 的原机位）。

## 数

| 量什么 | main | d52d825（#666 的头） | 本 PR `3f92687` | 怎么量 |
|---|---|---|---|---|
| 正面剪影 IoU | 没量 | 0.873 | **0.930** | `node tools/novice-sit-iou.mjs`，`iou.json` |
| 侧面剪影 IoU | 没量 | 0.772 | **0.909** | 同上 |
| 手看得见的比例（`shot-sit`，最好的机位） | 3.1% | 89.1% | 71.4% | `node tools/review-sheet.cjs shot-sit`，`review-*.json`；main 的数取自 `../review-sheet-664/` |
| 同上，大殿蒲团 `sit:main` | 6.7% | 89.5% | 72.1% | 同上 |
| 袍摆前沿比膝头高 | +9.8 cm | −8.7 cm | −9.3 cm | 同上（负数是低于膝头） |
| 两膝外缘 ÷ 肩宽 | | | ≥ 1.6（单测） | `tests/unit/monk-sit.test.mjs` |
| 膝与胯的高差 | | | ≤ 3 cm（单测；膝 8.5，胯 5.8） | 同上 |
| 两手中点离小腹 | | | ≤ 3 cm（单测） | 同上 |
| 右手最低点离布面 | | | ≤ 2 cm（单测） | 同上 |
| 下巴底与紧挨着的脖子的亮度（正面中线，山顶高档，软件渲染） | | 91 对 128 | 105 对 108 | `chin-*.png`，逐行取中线 8 像素的平均亮度 |

手看得见的比例比 d52d825 低，是因为左手现在压在右手上（设定图和定印都是这样），右手有一半在左手底下。

量法（IoU）：照 #642 量站姿的做法，两边缩到同高（头顶到下摆最低处），底边对齐，按头部中线对中，算交 ÷ 并。设定图的剪影由 `node tools/novice-sit-ref.mjs` 从设定图抠出（去掉蒲团和影子），存在 `refs/monk-v6-sit/`。腿怎么摆、布多紧、坐多深，是照这两个数搜出来的；膝高、袖口宽窄另按验收条目卡住，没有让它为了数去变。

## T4（`t4-report.json`，运行 `20261125-044123`，一个 Job，main 的构建用 `BASE_SITE` 放在同一个 Job 里交替量）

`__cost`（毫秒，显卡画完一帧；main → 本 PR）：

| 机位 | 档 | 各对 | 配对中位差 |
|---|---|---|---|
| `shot-sit`（坐着，近） | 高，1080p | 9.03→9.38，8.82→9.53，8.61→9.10 | **+0.49** |
| `court`（站着，首院） | 高，1080p | 11.93→12.00，11.67→11.82 | +0.11（波动之内） |
| `shot-sit` | 低，390×844@3 | 5.17→5.04，5.24→5.44 | +0.04（波动之内） |

站着没有量得出的差。坐着近看的高档多半毫秒，原因没有拆开：可能是 #666 给袍和皮肤加的形变目标，也可能是腿面铺开后屏上的布料像素多了、斗笠进了画面。三角面多 240 个（#666 把拇指改成三段）。只跑了这一次。

## 其他图（证据库）

- `views-3f92687.png`、`views-main-d7e8771.png`：`node tools/novice-views.cjs --code`，站、合掌、走、坐凳、盘坐各四面。除盘坐一排外，`node tools/novice-posehash.mjs` 说每个部件的每个点都没动（`posehash-*.txt`；和 main 只差皮肤，是 #666 把拇指改成三段；下巴底的法线和脖子的颜色改了，位置没动）。
- `views-sit-d52d825.png`：d52d825 的盘坐四面。`views-sitting-down.png`：坐下途中的一帧（空台上人不往下走，只看袍和斗笠在两个形之间的样子）。
- `review-*.png`：`review-sheet` 的三机位拼图，本 PR 和 d52d825 各两处。
- `t4-shot-sit*.png`：T4 上的原图，含一张秋暮。
- `chin-*.png/jpg`：下巴底，改前（d52d825 在上、改下巴前的本分支在下）和改后。
- `sheet.jpg`：左下那三排的原图。`rough-1.jpg`：给所有者先看的粗样（当时正面 0.926、侧面 0.906）。

## 怎么重出

```sh
node tools/novice-sit-iou.mjs                      # IoU 和叠图
node tools/novice-views.cjs --code --poses=sit --sides=平正,平右 --size=440,640 --out=tools/out/novice-sit/pair.png
python3 tools/novice-sit-collage.py tools/out/novice-sit/pair.png tools/out/novice-sit tools/out/novice-sit/sheet.jpg
node tools/review-sheet.cjs shot-sit; node tools/review-sheet.cjs sit:main
```
