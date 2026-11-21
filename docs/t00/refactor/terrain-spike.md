# 远景用真实地形：试验报告（#183）

日期：2026-11-21。分支：`spike/183-terrain`（基于 main `6246673`）。这是试验，不要求合入：只有地址里加了 `?terrain=made` 或 `?terrain=dem`，远景才换成高度图；不带参数的页面和 main 一模一样（山环照旧，`tests/unit/horizon.test.mjs` 照旧两条都过）。

## 结论

**换成「一张高度图 + 一张环形网格」这条管线，但不用真实高程数据发布；高度图用我们自己做的，形参考真实山地。真正换之前，要先把山环的两样笔触搬过来：林冠锯齿、山脚雾。开场第一格还要给北面的山定一个高度上限。**

理由：

1. **形。** 山顶回望（`loft`），真实高程裁出来的那张山形可信、一层压一层，比同心山环好得多。做出来的那张（`made`，噪声加五个高斯峰）是一团团圆包，还不如山环。所以「形」值得换，但自己做的高度图要做到真实地形那个水平，得有侵蚀（Gaea、World Machine、THREE.Terrain 的侵蚀滤镜之一，第二步再定）。
2. **真实数据不能随游戏发布。** 五个全球数据集的许可都允许商用（见下表），问题在中国的规定。《测绘地理信息管理工作国家秘密目录》（2020）第 23 项：高程精度优于（含）15 米、连续覆盖超过 25 平方千米的数字高程模型属秘密级。《公开地图内容表示规范》（2023）第十九条：境内的高程精度不得优于 15 米。我们这块是 9 km × 9 km，约 81 km²；源数据精度好于 15 米。境外机构生产的全球 DEM 落不落进这份目录、游戏里的远景算不算「附着地图图形的产品」，都没有找到答案（**未核**）。所以按最保守的做法：不发布。`dem.bin` 已写进 `.gitignore`，只在本机和这次 T4 Job 里画过。境外地区的 DEM（如 NASADEM，CC0）可以发布，但那样就不是这座山了，和自己做一张没有区别。
3. **代价小。** 同一个 T4 Job 交替三轮，帧耗差值在噪声以内（见下文），网格约 11.5 万面，下载 55–200 KB。
4. **下一关可直接用。** 一关一张高度图加一个 JSON，`createBackdrop(…, far)` 不改代码就能用。这正是 #183 问的「下一关能不能直接换一张图就用」。
5. **现在就换会变差的地方。** ① 新地形的轮廓是光滑线，没有山环那道林冠锯齿（#118 原本要做的）；② 山脚没有山环那种从下往上的雾；③ 开场第一格「雾里只见凌霄阁」被破坏：`dem` 北面近处一道深色山脊压在阁顶上，`made` 阁后冒出一个圆包。这三条是实施 issue 的前置，不是试验能顺手修的。

**真实数据（主创 2026-11-21 定）：** 只用自制高度图；真实 DEM 仅作本机参照，不入库、不发布。不再为此请所有者找人确认法规；哪天要用真实数据，另行确认。

**美术审图二的意见：** 待回（对照图已发给它，见文末）。

## 候选

查阅日期都是 2026-11-21。许可那几列的原文出处见下一节。

| 名称 | 链接 | 许可 | 用不用，为什么 |
|---|---|---|---|
| 不换：山环加噪声、加层数（#116 的老路） | `app/src/backdrop.js` | 自有 | 对照。笔触最「画」（林冠锯齿、山脚雾），但形是同心圈，山顶回望看得出来；同一处已经修到第三次。 |
| 真实高程 Copernicus DEM GLO-30 | https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM | COP-DEM-GLO-30-F 许可：免费，可商用，可分发修改过的数据；署名和免责句都要用指定原文，而且后续用户要受同样约束 | **做了，页面里看得见（`?terrain=dem`），但不发布**：中国的规定见上文第 2 条。数据取自 AWS 公开桶的 1°×1° GeoTIFF。 |
| 真实高程 SRTM GL1 v3 / NASADEM | https://www.earthdata.nasa.gov/data/catalog/lpcloud-srtmgl1-003 、https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001 | NASA EOSDIS 数据政策：CC0，建议引用 | 同上；许可最宽，但中国境内的问题一样。 |
| 真实高程 ASTER GDEM v3 | https://www.earthdata.nasa.gov/data/catalog/lpcloud-astgtm-003 | 同上，无限制 | 同上；伪影比前两个多。 |
| 真实高程 JAXA AW3D30 | https://earth.jaxa.jp/en/data/policy/index.html | 可商用，**须事先通知 JAXA**；署名 JAXA | 不用：多一道手续，好处和 GLO-30 一样。 |
| AWS Terrain Tiles（Mapzen joerd） | https://github.com/tilezen/joerd/blob/master/docs/data-sources.md | 按数据源；这一带 z7–15 用的就是 SRTM | 不用：等于 SRTM 再重采样一次，项目已不维护。 |
| 做出来的高度图：按五峰布局程序生成 | `tools/terrain/heightmap.mjs made` | 自有 | **做了，页面里看得见（`?terrain=made`）**。形不过关（圆包），说明光靠噪声不够，要有侵蚀。 |
| 做出来的高度图：侵蚀工具（THREE.Terrain 3.1.1，2026-08-27，MIT，peer three ≥0.160；Gaea / World Machine） | https://github.com/IceCreamYou/THREE.Terrain | MIT；Gaea、World Machine 的导出物归属和 EULA **未核** | 未做。实施时的首选：在 Node 里离线生成，产物是同一种 `.bin`。 |
| 把高度图变成网格：一张环形网格（本试验） | `app/src/terrain-far.js` | 自有 | **用**。内密外疏的 120 圈 × 480 段，11.5 万面，Node 里 75 ms 建成。远处沿视线拉近画（见下文「怎么画到 4.4 km」），不动相机。 |
| 分块 LOD：CDLOD、geometry clipmap、three-tile 0.12.2（MIT，peer 锁死 three 0.183.1）、3d-tiles-renderer 0.5.4（Apache-2.0） | https://github.com/sxguojf/three-tile 、https://github.com/NASA-AMMOS/3DTilesRendererJS | 见左 | 不用：适合走得进去的大地形或全球流式；我们的远景走不进去，一张固定网格就够，不值得再加一个依赖。 |
| three-geo 1.4.5（2022-06），geo-three 0.1.15 | https://github.com/w3reality/three-geo | MIT；three-geo 必须用 Mapbox token，Mapbox 条款能不能把数据打进游戏包**未核** | 不用：依赖在线服务，数据许可不清。 |
| 远处不用网格：烘一圈全景或几层剪影（impostor） | — | — | 未做，**未验**。网格的代价已经在噪声以内，这一条省不下什么；它的长处是可以把林冠锯齿、雾直接画进贴图，实施时可以作为远景最外一圈的做法再试。 |

## 做了什么

- `tools/terrain/dem-window.py`：从 GLO-30 的 1°×1° GeoTIFF 裁一个 16 km 见方的窗口，重采样到 10 m 的米制网格（中间文件，不进 git）。
- `tools/terrain/heightmap.mjs dem <window>`：在窗口里找寺址。搜索范围是寺址的位置和中轴的朝向（±3 km，步长 100 m，每 15° 一档），打分依据有三项：真实地面和 `site.js` 画出的院落、台地、山道的高差均方根要小（接缝处要抹的米数少）；四周 0.5–2 km 的山要围得紧；北面要高（五峰环抱、北面最高）。另外要求寺址在台地上（比谷底高 420 m 以上）。选中的位置：接缝均方根 8.3 m，四周山的平均仰角 9.3°，北面比南面高 4°。输出 512² 的 int16（分米），覆盖 9 km，以山环中心（0, -45）为中心，写在场景坐标里。
- `tools/terrain/heightmap.mjs made`：五座峰（北峰最高，比院落高约 300 m，1.15 km 外），峰间有山脊，南面开口，谷口往下落到平原，4 km 外一圈远山，再叠上游走的脊状噪声。
- `app/src/terrain-far.js`，三段高度：
  - 已画出的地面（`createEarth` 那块 280 m × 360 m）之下，网格沉 3 m，看不见；
  - 地面边缘往外 220 m，从 `terrain()` 渐变到高度图；
  - 最外 900 m 抬成一圈做出来的远山，两张图都有，挡住地平线以下的天空。
- 远景着色：
  - 林木纹理、天光和太阳的明暗；
  - 按真实距离加雾，距离每翻一倍雾多六分之一，所以山脊一层压一层；
  - 寺下 50 m 以下的谷里铺雾；
  - 近处 160–420 m 和场景本身的雾接上。
  - 颜色取季节和时辰表的 `hills`、`fog`、`haze`，和山环一样。
- `backdrop.js` 多一个参数 `far`：给了就画地形，不建山环，竹林带照旧。`yard.js` 只在 `?terrain=dem|made` 时加载高度图，加载失败退回山环并打一条 warning。
- **怎么画到 4.4 km。** 相机远裁面是 800 m，天穹在 600 m。所以 350 m 以外的地形在顶点着色器里沿视线拉近，压到 575 m 以内。屏幕上的位置不变，前后次序不变（拉近的函数单调递增），雾按真实距离算。相机和其他模块都不用改。

## T4 帧耗（同一个 Job 交替三轮，只报差值）

Job `20261121-064630`，提交 `49c061d`（不带 `+dirty`），站点 SHA-256 `0d04d287…`，ANGLE on Vulkan，Tesla T4。高档 1920×1080，夏昼，每次 `__cost(40)`，顺序 rings → made → dem，共三轮。原始数在 `docs/t00/evidence/183-terrain/bench.json`。

| 机位 | rings（中位 / 范围） | made | dem | 差值（中位） |
|---|---|---|---|---|
| 首院 cam06 | 12.88 / 11.93–13.44 ms | 12.79 / 12.58–13.09 | 13.67 / 13.34–13.90 | made −0.09，dem +0.79 |
| 山顶 loft | 10.17 / 10.08–10.47 ms | 10.76 / 10.05–10.86 | 10.30 / 10.28–10.43 | made +0.59，dem +0.13 |

made 和 dem 的网格、着色器完全一样，只是高度不同，所以它们之间的差（0.5–0.9 ms）就是这台机器的噪声。两个候选相对山环的差值都在 +1 ms 以内，按《几何预算》五之二直接过。

- 三角面：cam06 2,002,024 → 2,226,424（+224,400：网格画两遍，第二遍是首院的镜面反射）；loft 966,483 → 1,078,683（+112,200）。
- 绘制次数：cam06 364 → 358，loft 218 → 215（少了四圈山环）。
- 低档、手机：**未验**。实施时低档可以把圈数、段数减半（约 2.9 万面）。

## 多下载多少

| | 原始 | gzip | 改存法后 |
|---|---|---|---|
| 高度图 512²，0.1 m 一档 | 512 KB | made 390 KB / dem 426 KB | 按行差分再 gzip：0.5 m 一档 182 / 199 KB，1 m 一档 139 / 154 KB |
| 高度图 256²，0.5 m 一档 | — | — | 差分再 gzip：55 / 65 KB |
| `terrain-far.js` | — | 3.1 KB | — |

试验用的是最笨的存法（int16 原样 gzip）。实施时用 256²、0.5 m 一档，加下载约 60 KB；远景用不着更细。

加载要多花的时间：网格在 Node 里建 75 ms，浏览器里没有单独测（**未验**），文件在建场景前取。

## `tests/unit/horizon.test.mjs` 在候选上

`TERRAIN=made|dem node --test tests/unit/horizon.test.mjs`：

- 「地平线以下不露天」：两种都过，10 个采样点 × 432 条光线全部打到东西。
- 「山环在角度回绕处没有接缝」：两种都跳过（没有山环了；新网格不读角度，没有这个问题）。

最外一圈的远山是做出来的，所以另量了一次只靠高度图本身的情况（`node tools/terrain/horizon-norim.mjs`，同样的光线，`FAR.lift = 0`）：

- dem：8 个点漏 1–3 条，都在 −0.5°，从谷口看出去穿过 4.4 km 落到平原以外。
- made：10 个点漏 1–9 条，最多的是山顶和第三台地，也都在 −0.5°。

也就是说，真实地形本身几乎围得住；最外一圈做出来的远山只补 −0.5° 那几条线。

## 对照图

拼图：`docs/t00/evidence/183-terrain/sheet.jpg`。单张原图按 `MANIFEST.json` 在证据库里：`node tools/evidence.mjs pull docs/t00/evidence/183-terrain`，或直接打开 https://huggingface.co/datasets/bolechen/temple-walk-evidence/tree/fde6d52c0345c567276bb3953fd5dbc1535ee6ad/t00/183-terrain 。

全部来自同一个提交、同一个 Job，J01 夏昼高档：cam01、cam04、cam06、art1、loft 和开场第一格，每个机位 rings / made / dem 各一张，共 18 张。

| 机位 | 变化 |
|---|---|
| cam01、art1 | 三张几乎一样：远处全是竹。 |
| cam04 | dem 在左上山门檐角外多出一座山的肩；made 看不出。 |
| cam06 | dem 在右上柳杉之间多出一座山；made 看不出。 |
| loft | 区别最大：dem 的山形最好；made 是圆包；rings 有锯齿和雾，但形是同心圈。 |
| 开场第一格 | 两种候选都坏了，见结论第 5 条。 |

## 连带影响

### 1. 别的模块

| 谁 | 读什么 | 换地形以后 |
|---|---|---|
| `site.js` 台地、柳杉、茶垄、旧 walker 的 `level`/`landAt` | `terrain()` | **不相干**：近处的地仍然是手写的 `terrain()`，高度图只管 220 m 渐变带以外。 |
| `bamboo.js` 近竹 | `L.land` = `terrain()` | 不相干。 |
| `backdrop.js` 远竹带 | 竹林带的高度写死在台地数上 | 不相干，照旧；但远竹带是平面剪影，地形变了以后它的脚可能悬空或埋进山里。本试验的图里没看出来，**未逐处验**。 |
| `ground.js` | 不读 `terrain()`（它读 `site.shade`、铺地） | 不相干。 |
| 开场 `opening.js` | `GROVE.top` 加 `terrain()` 管航线不进竹梢 | 航线不相干。画面**要重拍、要改**：第一格被北面的山破坏。 |
| `horizon.test.mjs` | 远景网格 | **跟着换**：已加 `TERRAIN=` 开关，两种都过。实施时这条测试要改成默认就读地形。 |
| 可走格子（#161、#274） | 烘焙读画出来的网格 | 远景网格标了 `userData.walk = false`，不进格子，也不进镜头的 BVH。山在墙外走不到，**不进格子**是对的。 |
| 六个锁定验收机位、`art1`–`art6` | 画面 | cam01、art1 不变；cam04、cam06 角上多一座山，**要重拍**；其余机位本次没拍（**未验**）。 |

### 2. 玩家

- 手机多下载：实施时约 60 KB（256²，0.5 m 一档）；试验存法是 390–426 KB。
- 加载多花：建网格约 75 ms（Node 里测），浏览器和手机**未验**。
- 六个验收机位：见上表，cam04、cam06 要重拍。
- 开场第一格：现在不是「雾里只见凌霄阁」了。要给北面的山定上限，或者把第一格的视线让开。需要美术给数。

### 3. 复杂度

- **接缝。** 寺院的台地仍是手写的 `terrain()`。高度图在已画出的地面以外 220 m 内渐变过去；已画出的地面以内，网格沉 3 m 藏在下面，加 `polygonOffset` 防闪。不用两边逐点对齐。代价是渐变带里的山形是插出来的。寻址工具挑了接缝处高差最小的位置（均方根 8.3 m），这个数越小，插出来的越少。
- **多了一份要同步的描述吗？** 多了一份数据（`.bin` + `.json`），没有多一份要手工同步的描述：渐变带直接读 `terrain()`，台地挪了，渐变自己跟着走。只有一个隐含约定：已画出的地面那块矩形（`FAR.earth`）要和 `createEarth` 的尺寸一致。实施时应该从同一个常量读。
- **可走格子：** 不进（见上表）。

### 4. 长期维护

- **下一关换一座山：** 换一张 `.bin` 和 `.json`，`level.js` 里给 `backdrop` 加上它的名字。代码不改，寻址那一步只有用真实数据时才需要。
- **署名：**
  - 自己做的高度图不用署名。
  - 如果用境外 DEM：NASADEM 写引用，不强制；GLO-30 要在鸣谢页写指定原文，还要在游戏许可里加一句免责（「The organisations in charge of the Copernicus programme … do not incur any liability …」）。不论用哪种，都要进 `asset-register.csv`。
- **依赖：** 没有新依赖，只用了 three 自带的 `BufferGeometry` 和 `ShaderMaterial`，不会卡在升级上。侵蚀工具只在离线生成时用，不进页面。

## 数据许可（核过的原文）

- **Copernicus DEM GLO-30**（COP-DEM-GLO-30-F 许可，2025-06 版 PDF：https://dataspace.copernicus.eu/sites/default/files/media/files/2025-06/copernicus_contributing_mission_data_access_v2_cop_dem_licenses.pdf ）
  - 第 4 条授予复制、分发、向公众传播、改编和组合。
  - 第 5 条：免费。
  - 修改过的数据要写：「produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved」。
  - 还要加上免责句；第 6(e) 条要求后续用户受同样约束。
  - **能随收费游戏发布**（就许可而言）。
- **SRTM GL1 v3、NASADEM、ASTER GDEM v3**（NASA EOSDIS 数据使用指南：https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance ）
  - 原文：「Unless the content is marked with a use restriction or license, data provided from a NASA-led mission are licensed as Creative Commons Zero (CC0)」。
  - 不得暗示 NASA 背书。
  - **能随收费游戏发布**（就许可而言）。
- **JAXA AW3D30**：可商用，「the user needs to notify JAXA thereof in advance」。数据集专用条款页从这里打不开（**未核**）。
- **中国法规**：见结论第 2 条。两份文件都核过原文：
  - 秘密目录：https://www.gov.cn/zhengce/zhengceku/2020-07/08/5525075/files/08e817f622814c4799255f2464bf9ed5.pdf
  - 表示规范：https://www.gov.cn/zhengce/zhengceku/2023-02/17/content_5741977.htm
  - 适用性**未核**，所以真实数据一律不发布。
  - 「降到 15 米精度以下就能发布」只是推论，不能代替审图机构的意见；而且那样的精度远景也用不上。

## 怎么复现

```sh
pip install tifffile imagecodecs numpy
curl -o cop.tif https://copernicus-dem-30m.s3.amazonaws.com/<1°×1° 瓦片名>/<同名>.tif   # 公开桶，瓦片名按经纬度
python3 tools/terrain/dem-window.py cop.tif <瓦片北纬> <瓦片西经> <中心纬度> <中心经度> 16000 10 win.f32
node tools/terrain/heightmap.mjs dem win.f32 --above=420     # 搜寺址；--at=e,n --turn=deg 固定一个
node tools/terrain/heightmap.mjs made
TERRAIN=made node --test tests/unit/horizon.test.mjs
node tools/terrain/horizon-norim.mjs
node tools/shots.js --query=terrain=made --tag=-made loft
```

T4 的规格是 cam06、loft 两个机位，rings / made / dem 交替三轮，加上 18 张图。`tools/gpu/job.cjs` 的 bench 行加了 `terrain`，`tools/shots.js` 加了 `--query=`。

## 没做的、没验的

- 低档、手机的帧耗和加载时间。
- 远竹带在新地形上的脚：没有逐处查悬空或埋进山里。
- 林冠锯齿、山脚雾：没有搬到新着色器里。
- 侵蚀做出来的高度图：没做。
- 全景、剪影烘焙：没做。
- 季节和时辰：只看了 J01 夏昼，其余 15 种没拍。
- cam02、cam03、cam05、art2–art6：没拍。
