# #460 石阶读成砌的：改前改后

Refs #460（`docs/ART-REVIEW.md` A3）。PR #486。

![改前改后拼图](collage-final.jpg)

拼图每行三格：改前（main `9954fdc`）｜改后（本分支）｜参照（第一行是美术原型 01，其余各行第三格是另一个机位或另一个时辰，格内有字）。每格都是 T4 的原图居中裁成 16:9，缩到 533 像素宽；原图在下面的地址里。

## 怎么拍的

- **机器**：Hugging Face Job，一块 Tesla T4（ANGLE，Vulkan 1.4），高档，1920×1080（`art*` 用 1920×804），一人称，`?shot=1`。运行号 `20261121-085034`（命名机位和帧耗）、`20261121-092256`（首院踏道和背阴后阶，用 `?cam=` 站到近处）；两次都是同一个站点构建。
- **改后的代码**：`2af05b1`（干净，没有 `+dirty`），站点指纹 SHA-256 `338ca54803a81628…`，366 个文件。
- **改前的代码**：`9954fdc`（本分支分出来时的 main），用 `BASE_SITE` 一并送上同一个 Job、同一个浏览器，放在 `base/` 下，文件名带 `_base`。
- 两个提交之间合进来的 main 改动是 T05 的白盒、证据流水线、新访客的第一枚印和文档，没有动 T00 台阶上画出来的东西。
- 重出：`BASE_SITE=<main 的 dist> tools/gpu-render.sh t4-small "$(cat t4-spec.json)"`（`t4-spec.json` 在本目录，是第一个 Job 的：交替量帧耗加出图；第二个 Job 只出图，规格在这个 README 的「机位」一条里）。
- 机位：`?show=cam02`、`cam01`、`art1`、`art5`、`terrace`（大殿后面上藏经楼台地的那一段）、`hall`（首院里远看大殿前阶）；首院踏道近景是 `?cam=0,2.2,0,0.12`（站在大殿台基前，夏昼、秋暮各一张），背阴的后阶是 `?cam=8.85,-31,3.14159,-0.25`（站在大殿后阶下面，向北下来的那一段，夏昼）。

## 三角面和绘制数：不增加

`bench` 每一行记的是页面里实际画出来的数，改前改后逐行相同：

| 机位 | 三角面 | 绘制数 |
|---|---|---|
| cam02 夏昼 | 527,283 → 527,283 | 86 → 86 |
| art5 夏昼 | 692,813 → 692,813 | 122 → 122 |
| cam01 夏昼 | 1,005,191 → 1,005,191 | 233 → 233 |

`__census()` 在 cam02 上改前改后逐项相同（`site` 628,722 面、140 个网格）：台阶的几何一个顶点都没有多，只是每个顶点多了一个 vec4 的属性（`stair`）。

## T4 帧耗：没有增加

同一个 Job、每次一个新开的页面，改前改后交替（改前先、改后先轮着来），`__cost(40)` 的毫秒数（只算画一帧，不含无头浏览器自己的呈现）：

| 机位 | 次数 | 改前 | 改后 | 差 |
|---|---|---|---|---|
| art5（台阶占画面下半，最不利） | 8 | 11.18 ± 0.46 | 10.96 ± 0.34 | −0.21 ms |
| cam02 | 6 | 12.06 ± 0.37 | 11.85 ± 0.21 | −0.21 ms |
| cam01 | 4 | 13.23 ± 0.15 | 13.23 ± 0.17 | 0.00 ms |

差都在每次的离散度之内：量不出变慢。（上一版没收窄噪声调用时是 +0.28、+0.67、−0.93 ms，同样在噪声里；提交 `2af05b1` 把噪声只放在可能有苔的踏步和垂带上。）

## 看哪里

- **cam02、art1**（`t4/cam02_summer-day*.png`、`t4/art1_summer-dawn*.png`）：垂带头上是一块压顶，其下是长短不一的条石，缝不齐；踏面由两到五块石拼成，缝一级一级错开；改前是整条光板和一整条横线。
- **首院踏道**（`t4/firstcourt-stair_*.png`）：大殿前阶，八级、宽 6.4 米，四五块石拼一级，垂带分三段；秋暮里垂带的亮面和暗面也分出了块。
- **背阴的苔**：朝北下去的台阶（大殿后阶）踏面角、踢面脚和垂带脚的缝里有苔，朝南下去的几乎没有。T4 的在 `t4/hall-back-stair_summer-day*.png`，近景在 `closeup-sw/main-hall-back-stair-shaded-from-*.png`（软件渲染，只证形和相对关系）。
- **磨亮的中线**：`closeup-sw/art5-treads-summer-day.png`、`cam01-treads-summer-day.png`，各块石磨得不一样；两头贴垂带处深而潮。
- **冬景**：`t4/cam02_winter-day*.png`、`closeup-sw/cam02-treads-winter-day.png`。积雪照旧（踏面前沿一条雪、垂带顶一层雪），没有新的破绽；#78 那件事（垂带积雪的样子）没动。
- **落叶**：踏面上零星几片竹叶，画在石面上，没有借 `litter.js`。

## 补的：十六种时辰、手机低档、T05（T00 主创 2026-11-21 要的）

Job `20261121-093102`（十六种时辰、手机、T05 的 `b`）和 `20261121-110043`（T05 的 `a`、`a-tall`），Tesla T4，代码提交 `fe818a4`（本分支，比 `2af05b1` 多合入的 main 只有文档），改前是 main `5f9e2a3` 的构建。

- **cam02 十六种时辰**（四季乘四个时辰，T4 高档 1280×720，一张拼图）：[`sheets/cam02-16-moods.jpg`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/169f75ef01404b439e19e7424e0a8b9567413f52/t00/stone-steps-460/sheets/cam02-16-moods.jpg)；每张原图在 `t4-moods/mood_cam02_<季>-<时>.png`。没有花屏、没有 NaN、没有破绽。夜景和暮景台阶很暗；在软件渲染上拿 main 的构建在同机位同时辰量台阶区域的平均亮度：夏夜 25.1 → 25.7、夏暮 41.1 → 42.2、冬夜 37.4 → 37.5（比值 1.02、1.03、1.00），不是新材质变暗，本来就这样。
- **手机低档**（`?q=low`，390×844，cam02 夏昼，改前｜改后）：[`sheets/phone-low-cam02-main-vs-460.jpg`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/169f75ef01404b439e19e7424e0a8b9567413f52/t00/stone-steps-460/sheets/phone-low-cam02-main-vs-460.jpg)。缝在低档上仍是细线、不闪；原图 `t4-moods/phone-low_cam02_summer-day{,_base}.png`。
- **T05**（`?level=t05&show=b|a|a-tall`，夏昼、冬昼，改前｜改后四行）：[`sheets/t05-main-vs-460.jpg`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/169f75ef01404b439e19e7424e0a8b9567413f52/t00/stone-steps-460/sheets/t05-main-vs-460.jpg)；原图 `t4-t05/`。T05 的台阶只有这一段（场前月台上殿的 9 米宽、17 级的一段），其余画面逐像素相同；换的只是台阶自己的石纹：每级五块、垂带分段。石块大小（约 1.8 米宽一块）和错缝是否合辽构，交 T05 关卡主创和美术总监判；要把石块参数做成关卡可配，默认值保持现在 T00 的样子，等他们看过图再定，现在没做。

## 关卡可配（T05 主创的要求，2026-11-21）

石块怎么排，一个关卡可以自己定：`M.steps.userData.stairStyle`，在关卡建场时设，第一次编译着色器时当 uniform 读（`stoneW` 踏面一块石的宽，决定每级几块；`cheekL` 垂带一段石的长；`leaves` 有没有竹叶；`moss` 有没有苔）。默认值是 `materials.js` 的 `STAIR_STYLE`，也就是 T00 现在的样子；没有说话的关卡一点没变（T00 的 cam02 默认值前后只差 66 个像素，是风吹的叶影）。T05 在 `app/levels/t05/site.js` 的 `STAIR_STYLE` 里把竹叶和苔都关了（竹叶：`docs/t05/ART.md` §4.2，没有竹、没有柳杉；苔：美术总监在 #486 定，初冬晴冷、朝南是干的），石块和垂带分段的数沿用（结构评审说尺度可以，只要求标自拟，见 `docs/t05/SOURCES.md` §11 的一行；美术总监要求石块不小于 1.5 米，要变往大里变）。单测：`stair-stones.test.mjs` 末两条。

T05 台阶近景，改前｜改后（T4，`?level=t05&cam=0,21.5,0,0.12`，夏昼）：[main](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/39647d4c8d54/t00/stone-steps-460/t4-final/t05-flight-close_summer-day_main.png)｜[#460](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/39647d4c8d54/t00/stone-steps-460/t4-final/t05-flight-close_summer-day_460.png)。T00 的 cam02 和首院踏道在最终代码上再出了一次：[cam02](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/d91b4ec969ea/t00/stone-steps-460/t4-final/final_cam02_summer-day.png)、[首院踏道](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/d91b4ec969ea/t00/stone-steps-460/t4-final/final_firstcourt-stair_summer-day.png)（T4 运行 `20261121-111621`，art5 帧耗改前改后 −0.19 ms，在波动内）。

## 冬天台阶上的雪（T00 主创问：是 main 本来如此，还是新材质盖掉的）

main 本来如此。同机位同一个 Job：雪白像素 main 766,884，本分支 766,776；放大对照 [`sheets/winter-cam02-main-vs-460-crop.jpg`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/0a96fdbd77bb/t00/stone-steps-460/sheets/winter-cam02-main-vs-460-crop.jpg)。踏面前面那条白带就是踏面（斜着看只剩一条），垂带顶通白。

## 共用代码改动

- `app/src/geo.js` 的 `stairGeo`：每一关所有台阶共用，多写一个顶点属性、可选参数 `place`，几何（位置、法线、索引）一点没变。`building.js`、`levels/t00/site.js`、`levels/t05/site.js` 把台阶摆到哪里告诉它。
- `app/src/materials.js` 的 `steps` 材质：只有 `stairGeo` 的台阶用它。
- `tools/site.cjs` 的 `serve()`：以 `/` 结尾的路径给该目录的 `index.html`（原来只有 `/` 有）；测试在 `tests/unit/serve.test.mjs`。
- `tools/gpu/job.cjs`：出图可以带 `path`（从 `BASE_SITE` 的另一版构建出同一张）。

## 没验的

夜景的近景（十六种时辰的夜景只在 cam02 上看过）、拍照模式成片、其余七座殿的台阶近看（`hall`、`terrace` 只在夏昼拍了）。雪下的踏面在冬景里被雪盖住，苔看不到，这是对的。

## 原图

地址钉在数据集提交（第一批 `7f719cef3100`，第二批 `e130c85de127`），清单见 `MANIFEST.json`；`node tools/evidence.mjs pull docs/t00/evidence/stone-steps-460` 取到 `tools/out/evidence/`。清单里还有 `collage.jpg`，是第一版拼图（四行），已被 `collage-final.jpg` 取代，库里不删。

- T4 命名机位（改后 / 改前）：
  - [`cam02_summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/cam02_summer-day.png) / [`cam02_summer-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/cam02_summer-day_base.png)
  - [`cam01_summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/cam01_summer-day.png) / [`cam01_summer-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/cam01_summer-day_base.png)
  - [`art1_summer-dawn.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/art1_summer-dawn.png) / [`art1_summer-dawn_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/art1_summer-dawn_base.png)
  - [`art5_summer-dusk.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/art5_summer-dusk.png) / [`art5_summer-dusk_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/art5_summer-dusk_base.png)
  - [`art5_summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/art5_summer-day.png) / [`art5_summer-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/art5_summer-day_base.png)
  - [`terrace_summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/terrace_summer-day.png) / [`terrace_summer-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/terrace_summer-day_base.png)
  - [`hall_summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/hall_summer-day.png) / [`hall_summer-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/hall_summer-day_base.png)
  - [`cam02_winter-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/cam02_winter-day.png) / [`cam02_winter-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/t4/cam02_winter-day_base.png)
- T4 `?cam=` 近景（改后 / 改前）：
  - [`firstcourt-stair_summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/e130c85de127fab13f6a2f800733986a7b6e095b/t00/stone-steps-460/t4/firstcourt-stair_summer-day.png) / [`firstcourt-stair_summer-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/e130c85de127fab13f6a2f800733986a7b6e095b/t00/stone-steps-460/t4/firstcourt-stair_summer-day_base.png)
  - [`firstcourt-stair_autumn-dusk.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/e130c85de127fab13f6a2f800733986a7b6e095b/t00/stone-steps-460/t4/firstcourt-stair_autumn-dusk.png) / [`firstcourt-stair_autumn-dusk_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/e130c85de127fab13f6a2f800733986a7b6e095b/t00/stone-steps-460/t4/firstcourt-stair_autumn-dusk_base.png)
  - [`hall-back-stair_summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/e130c85de127fab13f6a2f800733986a7b6e095b/t00/stone-steps-460/t4/hall-back-stair_summer-day.png) / [`hall-back-stair_summer-day_base.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/e130c85de127fab13f6a2f800733986a7b6e095b/t00/stone-steps-460/t4/hall-back-stair_summer-day_base.png)
- 软件渲染的近景（dev server，一页里换视角；只证形和相对关系）：
  - [`art5-treads-summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/closeup-sw/art5-treads-summer-day.png)
  - [`cam01-treads-summer-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/closeup-sw/cam01-treads-summer-day.png)
  - [`main-hall-back-stair-shaded-from-above.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/closeup-sw/main-hall-back-stair-shaded-from-above.png)
  - [`main-hall-back-stair-shaded-from-below.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/closeup-sw/main-hall-back-stair-shaded-from-below.png)
  - [`cam02-treads-winter-day.png`](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/7f719cef3100ca7650b3df54ab1c22830c6efc2b/t00/stone-steps-460/closeup-sw/cam02-treads-winter-day.png)
