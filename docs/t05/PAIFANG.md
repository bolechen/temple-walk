# 牌坊生成器（`app/src/paifang.js`，#433，第一阶段第 10 项）

四柱三间三楼木牌坊的生成器：一个独立模块，不改 `building.js`，所以 T00 一字未动（`git diff origin/main -- app/src/building.js app/src/site.js app/levels/t00` 为空）。放上中轴是第 8、9 项的事；这里只交生成器、尺寸表、测试和一个调用示例。每处尺寸的出处程度在 `SOURCES.md` §12，没有一个是测绘的。

## 调用示例

```js
import { buildPaifang, PAIFANG } from "../../src/paifang.js";

// M: createMaterials() 的结果（单测里用任何带这些键的对象）
const pf = buildPaifang(M);
pf.group.position.set(0, groundY, zOnAxis);   // 柱的平面是 z = 0，正面朝 +z（朝来路）
root.add(pf.group);

// 走路与镜头用的数据，在局部坐标里；放到关卡的 site.walk 里要跟着挪到 (0, zOnAxis)：
for (const q of pf.walk.posts) walk.posts.push({ ...q, z0: q.z0 + zOnAxis, z1: q.z1 + zOnAxis });
for (const r of pf.walk.roofs) walk.roofs.push({ ...r, z0: r.z0 + zOnAxis, z1: r.z1 + zOnAxis, core: { ...r.core, z0: r.core.z0 + zOnAxis, z1: r.core.z1 + zOnAxis },
  bottom: r.bottom + groundY, inner: r.inner + groundY, top: r.top + groundY });
```

- `pf.group`：60 个网格，已烘好 `ao`，材质是 `M.woodV/woodX/woodZ/monolith/tile/rafters/fascia/ridge/gable` 与两个改色的克隆（`beam`、`board`）；`mergeStatic` 会按材质合批（12 种）。
- 烘焙地面从画出来的网格算（`tools/bake-walk.mjs`），夹杆石、柱、座板自然挡路；`walk.posts` 只给写成的平面（`?walker=old`、`createPlanWalker`）和眼睛用。
- `pf.passage.bays`：三间各自的净宽（夹杆石之间）与净空；`pf.board`：匾位（明间两层额枋之间，无字，字另交）。
- `pf.parts`：每个构件的 id、真实几何算出的包围盒、它搁在谁身上（`on`）；`loose(pf.parts)` 返回悬空的构件，应为空（`paifang.test.mjs`）。
- `pf.census()`：三角形总数与按材质分项、网格数、材质数。
- 转向：整组 `rotation.y` 取四分之一圈；`walk.*` 的矩形要按同样的转法换算（`site.js` 的 `put` 已有这套，放上中轴时照用）。

## 尺寸（节选，全表见 `PAIFANG` 与 `SOURCES.md` §12）

明间 4.8 m、次间 3.6 m（柱轴间）；柱半径 0.25 m；夹杆石高 1.25 m（柱下净高的四分之一）；下层小额枋下沿 5.0 m（净空 4.76 m）；上层 6.1 m；次楼脊 7.26 m、明楼脊 8.37 m；通宽（含檐）14.3 m、通高（到吻尖）8.9 m、进深 3.5 m。

三角形 16,580（#482 之后；第三版前 16,892）；合批前 60 个网格、12 种材质（加了 `beam` 与 `board` 两个由 `woodX` 改色的克隆）。帧耗未量。

## 出图

```
node tools/paifang-views.cjs [outdir]    # 默认 tools/out/paifang；正、侧、俯三张平面图（正射），加斜前、从来路望、檐下、近看四张
```

舞台是 `tools/paifang-stage/`（真材质，一个太阳一片天，没有关卡、没有走者、没有季时），所以颜色不代表 T05 的最终色调，形体和比例才是要看的。证据在 `docs/t05/evidence/paifang-generator/`。

## 请结构评审看的

1. **三楼的关系**：明楼比次楼高约 1.1 m；次楼的瓦面和脊走到明间柱轴为止（收进），明楼的檐压在上面——目标图里是这样读的，真牌坊如何收口资料没有。
2. **屋顶式样**：小庑殿还是歇山？目标图是庑殿，资料没说。
3. **柱与夹杆石的比例**：柱径 0.5 m、石高 1.25 m（柱下净高的四分之一）、下口 1.10 m 见方上口 1.04 m、座板 1.4 m 见方。
4. **斗栱的朵数与材等**：材高取 0.16 m 再拉高三分之一，次楼前后各 3 朵、明楼各 5 朵；是否太密或太疏。
5. **两层额枋**：明间两层额枋之间的垫板只有 0.32 m 高（美术总监要 0.6–0.7 m，可他给的上层 6.1 m 与这个数互相矛盾，见 `DECISIONS.md`），匾位够不够；目标图里匾的位置。
6. **三间都能走**：三个开间都留了通路，是否符合真寺（有的牌坊中门不开）——这影响放上中轴后的路线。

## 放上中轴时一起做的四处（美术总监 2026-11-21 第三版「美术通过」时提的，#482 做完）

牌坊现在站在高台上，柱的平面在 z = +100（`AXIS.paifangZ`，内山门与无量殿之间），朝来路（+z），由 `app/levels/t05/gates.js` 的 `buildShells` 放；柱脚的夹杆石与三间都是烘焙地面里的实体与通路（`t05-gates.test.mjs`：三间各从南 6 m 走到北 6 m，两个 walker 都不挡、高程不变；四块夹杆石挡路）。在 `cam07` 上判；那四处：
1. **枋用柱色，垫板退进压暗：做了。** 小额枋、大额枋、平板枋是柱材质向暖褐拉（`paifang.js` 的 `beamMat`），垫板压暗并后移，前沿比两侧的枋面退进 0.09 m（`boardMat`、`band.back`）。
2. **封檐板 ≤ 0.12 m，斗栱层约 0.85 m：做了。** 封檐板 0.12 m、瓦下的板距瓦面 0.12 m（原檐口厚 0.36–0.40 m）；材高 0.16 → 0.18 m，斗栱层 0.87 m；**两条脊的高度不动**（次楼 +7.26、明楼 +8.37，现在由脊高给定，举由它与挑檐檩的高度反推），结果是明楼檐口离次楼脊拉开了约 0.25 m（`paifang.test.mjs` 的上限 0.35 → 0.6 m）。
3. **`roof.out` 1.6 → 1.0：做了。** 次楼两翼收到出外柱 1.0 m；通宽 15.3 → 14.3 m。
4. **正脊正面的灰带：查清，是脊高本身。** 那一圈是正脊（脊壁）的正面，露出瓦面 0.30 m，通长一条，颜色比瓦浅，所以读成一道灰带；不是屋顶上表面露出来（从檐下的视点看不到上表面）。试验：把脊的露出量从 0.30 改成 0.18 m，别的不动，正立面里那条带的高度同比例变薄（证据库 `t05/cam07-482` 的 `paifang-ridge-band.png`，上为改前、下为改后）。已改为 0.18 m。

## 没做的

匾字；戗柱；彩画与雕刻；吻兽细节；放上中轴后的烘焙地面基准（第 8 项的 `walk-diff` 管）；斗栱与 `building.js` 共用（要走「T00 不变」三条，另开 issue）。
