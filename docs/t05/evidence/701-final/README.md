# 701-final · 七尊的形与减面：交接表（2026-11-25）

#701 的形与减面这一条线收尾。七尊的形总监都已认；下面是每尊的最终文件、面数分档、gate、姿势、关键参数和总表图号。图在各 `701-rN/collage.jpg`（每个文件夹一张），数在各自的 `README.md`。**灰模与 Cycles 一盏太阳只看形，不代表上色后的样子；T4 上的开殿一眼还没看。**

桶：`hf://buckets/bolechen/temple-walk-render/keep/t05-six-buddhas/ship-701/`（私有，不入 git）：`<名>-<版>.glb`（全分辨率）、`<名>-<版>z.glb`（分区减面）；`baked/<名>-<版>b.glb`（烘焙后直出，PNG 贴图）、`.png-meshopt.glb`、`.webp-meshopt.glb`。上色取 `baked/` 的直出版或 PNG+meshopt 版；WebP 版法线有损、没对比过明暗。Basis（KTX2）没做（本机没有 toktx）。登记：`docs/t05/asset-register.csv` 的 `STATUE-t05-<名>-ship-701`（拘留孙、毗舍浮、拘那含合在 `STATUE-t05-six-buddhas-ship-701` 与 `STATUE-t05-six-buddhas-ship-baked-701` 两行）。

| 尊 | 最终版 | 面数分档（脸 / 耳 / 颈·手 / 其余） | gate | 姿势 | 关键参数 | 总表图号 |
|---|---|---|---|---|---|---|
| 拘留孙 krakucchanda | `krakucchanda-B4H10` | 30,784 / 8,500 / ~9.0k / 31,000 = 79,262 | 16/16 | 身 4° + 头 10° | `--tilt=10 --lean=4 --chin-shift=0.015 --no-furrows --no-lift`；chinBehind 9.5 mm；不淡沟、不 mouthlift | r21、r25、r27 |
| 毗舍浮 visvabhu | `visvabhu-V3` | 30,895 / 8,500 / ~9.0k / 31,000 = 79,374 | 16/16 | 身 4° + 头 10° | 同上 + `--fill=1 --bell=1.25`（颏中竖沟补平，钟形 ×1.25）；chinBehind 8 mm；唇不动 | r22、r25、r26、r27 |
| 拘那含 kanakamuni | `kanakamuni-K1L` | 26,404 / 8,500 / ~9.0k / 31,000 = 74,882 | 16/16 | 身 4° + 头 10° | 同上 + `--corners=0.5 --mar=0.1 --ridge=0.15` + mouthlift 24 mm（`--lift` 默认）；chinBehind 6.5 mm | r22、r25、r26、r27 |
| 迦叶 kasyapa | `kasyapa-B4H10` | 30,945 / 8,499 / 9,000 / 31,000 = 79,430 | 16/16 | 身 4° + 头 10° | `--tilt=10 --lean=4 --chin-shift=0.015 --no-furrows --no-lift`；chinBehind 8 mm | r28 |
| 毗婆尸 vipasyin | `vipasyin-B4H10` | 31,146 / 8,500 / 8,999 / 30,999 = 79,624 | 14/16（全分辨率版 3 非流形边 + 2 碎片，手臂 (1.67, 5.27, 0.06)；上桶的减面版 topology 全 0；主创已接受） | 身 4° + 头 10° | 同迦叶（从 r3c 起手，不带 r5 旧脸操作）；chinBehind 8 mm；总监取「改前」，r32–r35 的试做不用 | r29（r32、r33、r35 是没采用的试做） |
| 尸弃 sikhin | `sikhin-M40v` | 28,449 / 8,499 / 8,999 / 30,999 = 76,928 | 16/16 | 身 4° + 头 10° | `--fill=1 --bell=1.25 --lift=0.04 --corners=0.5 --mar=0.1 --ridge=0.1 --ridge-dz=-0.36 --ridge-r=0.03 --unfold`；chinBehind 8 mm | r30、r34（取代）、r36（颏面抹平，现用） |
| 释迦牟尼 sakyamuni | `sakyamuni-V14` | 38,847 / 8,499 / 9,000 / 31,000 = 86,634（上限放宽到 90,000） | 11/16（绕向一致：嫁接版本身如此 #578；六机位背面射线四处各多 1–5 条；头线以下没点动 > 1 mm） | **只头 14°（先 10° 再 4°），不倾身** | `ship-fig.py sakyamuni V14 06 --from=sakyamuni-varada0.glb --anchors=sakyamuni-v2 --tilt=4 --prebow=10 --lean=0 --no-base --fill=1 --bell=1.25 --corners=0.5 --unfold`；不做 mouthlift；chinBehind 8 mm | r31 |

脸盒内不减面、不带法线；耳 8,500、颈·手约 9.0k、其余约 31k；每尊上限 80,000（释迦牟尼 90,000）。`topology.py`：六个减面版与释迦牟尼的减面版边界 0（释迦牟尼的嫁接版本身有几千开放边，#578）。gate = `closed/face-gate.py`（r3c → 各版；「elsewhere」一行对身倾不适用，阈值放宽，其余行照看）。

## 文件与 sha256（全）

| 文件 | sha256 |
|---|---|
| `krakucchanda-B4H10.glb` | `b2d482ec62c9ca308ccefa0758c90065cdaf2bf1fd1349fe9215f5030fcb5dfb` |
| `krakucchanda-B4H10z.glb` | `08c961c5cee00fb380bc8423e111f69ed80b743a4cbb1c1f901d043c31e84cfe` |
| `krakucchanda-B4H10b.glb` | `440dc6875bd188f09a0a0427c6ef17423d5655a473386d866961e73312de5e79` |
| `krakucchanda-B4H10b.png-meshopt.glb` | `5b3a162d894ec20eab267590cc4f3d596704ff8f5df075615c3c99669fa84fdc` |
| `krakucchanda-B4H10b.webp-meshopt.glb` | `ca553e438743c71718a30db43a074127952be6c227431b61fc2a6ac3c7152584` |
| `visvabhu-V3.glb` | `166f55e729933c9a3861e66179e1fbc87a1fdfceb995161e120d52f5cb05b731` |
| `visvabhu-V3z.glb` | `a986cfde097aaa01e271ef1e777eaf58124ac435d7d2b2d0a6713a0a6b48e528` |
| `visvabhu-V3b.glb` | `475aebaff0d9655c162e75fb280c2e694d046fbb959473c4b79eb914def86189` |
| `visvabhu-V3b.png-meshopt.glb` | `ff1a48e62d0ea8cb869dc0fb0da2ed5b2f1d4cffc71376918948e7fd36b7522b` |
| `visvabhu-V3b.webp-meshopt.glb` | `3c0d4d6be79bfdac8cd392ce1a7c06a3795e021780c3d5b17409ecf13fc00dc4` |
| `kanakamuni-K1L.glb` | `dbc89a0ebe02d004f616f3e99b0691b6d11258a378f1739ab1c6a41042157e99` |
| `kanakamuni-K1Lz.glb` | `7a2cf585f2e54116d79ebd38bd2b376a3ee168cf2c6ea9cbfcbb82e68dcdd4f2` |
| `kanakamuni-K1Lb.glb` | `537ddc6db3e51b3aabc49bbd155dba8d8c492a05e9d594dfe37ac77e7ee2d50f` |
| `kanakamuni-K1Lb.png-meshopt.glb` | `e53a2a0f7798b065d29d0acdb2a4791628fce9a38224be1e206db28fd1d8b573` |
| `kanakamuni-K1Lb.webp-meshopt.glb` | `8ecac2cbac1d3a52d04bd2201113b35d78f4674e3b71f4a102c15552c0ac54d6` |
| `kasyapa-B4H10.glb` | `ae3f24d7cfdf7aa8259b84437150eae78b10b43d854b287fa3e62b528200bf7a` |
| `kasyapa-B4H10z.glb` | `afe0ced18dcef4dc7d315931f498d493eb3e0bf2e9756afb518604c042636d27` |
| `kasyapa-B4H10b.glb` | `2f73013479cfb0ad1fbf7e78b0b8686e34b816f824aca94485ba5f3688faf19d` |
| `kasyapa-B4H10b.png-meshopt.glb` | `34f57a8b7f580b5e51f387e61ffd9d87ee8ae6922f8b2c6b320ff9f20193e4c0` |
| `kasyapa-B4H10b.webp-meshopt.glb` | `5f5979ceb277b0f9df710d9c6bcb4cbf00e776bdeace628cb9a7102ebaa69342` |
| `vipasyin-B4H10.glb` | `5b2b51d216cbd88717c8a61cf751bcc155c39e5b1b4137b9dcb2f686760447bf` |
| `vipasyin-B4H10z.glb` | `5690f66b841035b6d6162d0ad95d31032ef5dce533954d5c392c4131f94487aa` |
| `vipasyin-B4H10b.glb` | `a4048531dca18b45b9298185cdb92cc049465ee25ef830a89647e1ace2728428` |
| `vipasyin-B4H10b.png-meshopt.glb` | `848001cba1d17bc05b9f8618a8f7bafd6cabdd1abc88bdec3c065b7dc166c1c3` |
| `vipasyin-B4H10b.webp-meshopt.glb` | `1af68a5600189ca89a53b1b68b1a61a81f45076f7073b569fdc67086577be005` |
| `sikhin-M40v.glb` | `9bf328cb43a94f15d7b1795ac995d0fef958404769fe92e5af492d156789ddd4` |
| `sikhin-M40vz.glb` | `2e5d0ae3a4254f725c0f53d98043eff2ba78cc60637304c0e642cc908ad34379` |
| `sikhin-M40vb.glb` | `b28819eb37afca19c52dad54809399770ba22f29ee69a533e75fa8e793bfe299` |
| `sikhin-M40vb.png-meshopt.glb` | `ae06e1ce7191946ae39408332a3b48ba8358a12a9d8645197f9217dd884ebcb4` |
| `sikhin-M40vb.webp-meshopt.glb` | `7bbff120de6ad5d8ef993a05c1beb6f22ba26f80a4663d0aa013134b5af2acab` |
| `sakyamuni-V14.glb` | `62a1427ebd856a7935709606d7e1b850bde0446579aba66526c055a011492358` |
| `sakyamuni-V14z.glb` | `888e4030eab8ec6577a68eaf7a561053914d1431a851b0af7b7e39442719914b` |
| `sakyamuni-V14b.glb` | `df2bc9ef57641860c92602eb0b607bbe72e9704bd47254ab5f9fade396a1a229` |
| `sakyamuni-V14b.png-meshopt.glb` | `439ea167e4ebdfaceaded68218253206c44cc0d7bb9009e03da8c99903d18831` |
| `sakyamuni-V14b.webp-meshopt.glb` | `19a38b93e67f843b2e2d18eaa3973a700061a532e8aa4327f90773d5f500fc2c` |
| `sakyamuni-varada0.glb`（释迦牟尼的嫁接底，复现用） | `a4cbae7458f8a3373a8de07744554a03f1d240b4defad8310c75c7a7d211c1db` |

## 要知道的事

- **L2 的锚点别用来重画**：`tools/t05-hall/paint/<尊>-L2.json`（配色线 #727 在 r3c 上重测的预览锚点，已与 main 一致）和 L2 的网格（拘留孙 fbe46814…、毗舍浮 052dc2cb…、拘那含 44009a2e…，`STATUE-t05-six-buddhas-L2-701` 行）是 701 中途的试作形状，**不进上色**；七尊以本表的 `ship-701` 文件为准。
- **改嘴之前先核 `face.json` 的嘴角坐标**（x = ±0.25 m）：701 前两轮的鼻唇沟/嘴角窝块子落在两嘴角之间，抹的是唇框和唇红外圈（`docs/t05/STATUE-PIPELINE.md` §八；毗婆尸 701-r33/r35）。拘那含 K1L 用了那两个块子，脸总监已认。
- 释迦牟尼的验收版（36d4abc2…）不在桶里；`sakyamuni-varada0.glb` 是按 `514-r2-final81/README.md` 的做法、用新焊接容差并带 10° 头倾重建的嫁接底；「≤0.01 mm」核不到，差在腕后补块一处（#578 已知）。
- 毗婆尸全分辨率版 gate 两行没过（见表），不影响上桶的减面版；不改 gate 的「面数不变」，不在 repair 末尾合并点（主创定）。
- 螺发上有几处小尖刺（烘焙在薄卷尖上的投射杂点），鼻侧与莲瓣上有几个小黑点（原模针孔，r3c 上就有）：都没处理，上色后 10 米看得见再修。
- 总监要留到 T4 再看的：cam03 七尊并排时正中的释迦牟尼头会不会比两边低一截，显了就把它退到 12°；身倾轴（高 3.0 m、深 −1.6 m）是拘留孙量的，其余五尊沿用（自拟）。
- 工具：`face-ship.py`、`repair.py`（`chinshape`、`chinfill`、`flatblocks`、`mouthlift`、`unfold`）、`zoned.mjs`、`bake.py`、`pack.mjs`、`seam-render.py`、`ship-fig.py`、`fig-sheet.py`、`ship-upload.py`、`closed/face-gate.py`（均在 `tools/t05-statue/`）。
