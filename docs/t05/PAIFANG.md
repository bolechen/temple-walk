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

- `pf.group`：50 个网格，已烘好 `ao`，材质是 `M.woodV/woodX/woodZ/monolith/tile/rafters/fascia/ridge/gable`；`mergeStatic` 会按材质合批（9 种）。
- 烘焙地面从画出来的网格算（`tools/bake-walk.mjs`），夹杆石、柱、座板自然挡路；`walk.posts` 只给写成的平面（`?walker=old`、`createPlanWalker`）和眼睛用。
- `pf.passage.bays`：三间各自的净宽（夹杆石之间）与净空；`pf.board`：匾位（明间两层额枋之间，无字，字另交）。
- `pf.parts`：每个构件的 id、真实几何算出的包围盒、它搁在谁身上（`on`）；`loose(pf.parts)` 返回悬空的构件，应为空（`paifang.test.mjs`）。
- `pf.census()`：三角形总数与按材质分项、网格数、材质数。
- 转向：整组 `rotation.y` 取四分之一圈；`walk.*` 的矩形要按同样的转法换算（`site.js` 的 `put` 已有这套，放上中轴时照用）。

## 尺寸（节选，全表见 `PAIFANG` 与 `SOURCES.md` §12）

明间 4.8 m、次间 3.6 m（柱轴间）；柱半径 0.25 m；夹杆石高 1.4 m；下层小额枋下沿 4.7 m（净空 4.46 m）；上层 6.3 m；次楼脊 ≈ 6.9 m、明楼脊 ≈ 8.5 m；通宽（含檐）14.7 m、通高 9.2 m、进深 2.9 m。

三角形 13,874（斗栱占一半多）；合批前 50 个网格、9 种材质。帧耗未量。

## 出图

```
node tools/paifang-views.cjs [outdir]    # 默认 tools/out/paifang；正、侧、俯三张平面图（正射），加斜前、从来路望、檐下、近看四张
```

舞台是 `tools/paifang-stage/`（真材质，一个太阳一片天，没有关卡、没有走者、没有季时），所以颜色不代表 T05 的最终色调，形体和比例才是要看的。证据在 `docs/t05/evidence/paifang-generator/`。

## 请结构评审看的

1. **三楼的关系**：明楼比次楼高约 1.6 m，次楼的内端方切、贴着明间柱——真牌坊的次楼如何收口？（目标图里看不出）
2. **屋顶式样**：小庑殿还是歇山？目标图是庑殿，资料没说。
3. **柱与夹杆石的比例**：柱径 0.5 m、石高 1.4 m、座板 1.12 × 1.30 m。
4. **斗栱的朵数与材等**：材高取 0.14 m，每座屋顶前后各 3–4 朵；是否太密或太疏。
5. **两层额枋**：明间上层额枋之间的花板留作匾位，高 0.82 m，是否合适；目标图里匾的位置。
6. **三间都能走**：三个开间都留了通路，是否符合真寺（有的牌坊中门不开）——这影响放上中轴后的路线。

## 没做的

匾字；戗柱；彩画与雕刻；吻兽细节；放上中轴后的烘焙地面基准（第 8 项的 `walk-diff` 管）；斗栱与 `building.js` 共用（要走「T00 不变」三条，另开 issue）。
