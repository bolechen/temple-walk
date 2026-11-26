# 造像的闭合体检查（#578）

这几个脚本只读文件，不改模型；用 `bpy==5.3.0`（`tools/blender/README.md`）的只有 `backfaces.py`、`raycompare.py`、`repro-sweep.py`（借它的 `mathutils` 光线），其余只要 `trimesh`、`scipy`、`numpy`。

## 以后每尊新造像、新改的手，先过闸门再上色

1. **原件先量**：`python3 tools/t05-statue/closed/topology.py <原件.glb>`。七尊的原件都是一整块（焊后每条边两个面、朝向一致）；有开口边或朝向不一致就先报，不要往上改。
2. **每改一步量一次**：`python3 tools/t05-statue/closed/gate.py <varada.json> <out dir>`（约 2 分钟，13 行，有一行不过退出 1）：区外位移 ≤1 mm、面数 ≤原件 110%、开口边/非流形/≤10 面碎屑块/框内开口边不多于原件、朝向一致、六个访客机位的背面视线（西侧廊最近点、4.2 m、sakya 必须 0，其余不多于原件）。
3. **改手，从一开始就按「独立闭合块、叠而不是接」做**：把前臂、手、膝片各做成自己闭合的块，彼此穿插，不要把一块沉进另一块下面当「接缝」，也不要事后补（#578 试了五次补闭合都不成，原因是多层面叠着、边分叉，见 `docs/t05/CLOSED-BODY-578.md`）。
4. **不要信「背面视线 0」就够**：先量**原件**在同样视线下有多少（`backfaces.py`）；要求 0 而原件不是 0，等于要求改原件。
5. **出图**：判画面先拍访客的眼睛（`docs/t05/evidence/` 里的白盒殿同机位），再决定要不要修。

## 脚本

| 脚本 | 做什么 |
|---|---|
| `topology.py <glb>… [--json=]` | 焊接后：开口边、非流形边、块数、≤10 面碎屑块、朝向是否一致、最大块的体积 |
| `backfaces.py <glb> <out.json> [--turn=-90] [--window=0.8]` | 像按白盒殿站好（8.2 m，按包围盒），从访客机位向手腕附近的窗发 41×41 条线，数第一下打到面背的条数 |
| `raycompare.py <glb> <rays.json> <out.json>` / `--make-grid <rays.json>` | 同一组射线逐条记命中面号、几何法线与顶点法线两种判法、焊后块号 |
| `loops.py <glb> <原件.glb> <out.json> [--png=]` | 框内开口边：哪些是原件自己表面上的（`cut`）、哪些是编辑加的（`made`），各成几圈 |
| `face-gate.py <before.glb> <after.glb> <face.json>` | 只改了脸的闸（#701）：两份全模共用点序，脸区（颈 z0 减 fade）以下位移 ≤ 1 mm、面数不变、开口边/非流形/碎块不比改前多、六机位背面射线不比改前多。**和 `gate.py` 的区别：`gate.py` 拿改手的释迦对原件，要 `varada.json` 与 `varada-check3`，且要求三个机位背面为 0；`face-gate.py` 只比改前改后两份文件，不要求 0，只禁止增加（r3 本身有 210 条开口边，闸不修，也不让它变多）**。单测 `tests/unit/face-gate.test.mjs` |
| `classify.py` | 背面射线按命中的面分类（游离碎片、两层贴片、加的几何、原件的面） |
| `gate.py <varada.json> <out dir>` | 上面几项串成一张表 |
| `repro-sweep.py <glb>` | 站高、位置、窗口、机位各取几种，看背面条数会不会变（一次性，复现 #529 用） |

原件 f1 的重建：`python3 tools/t05-statue/repair.py <sakyamuni-mv-1.base_model.glb> tools/t05-statue/sakyamuni/repair-f1.json <out>`（约 15 分钟，SHA-256 与登记一致）；七尊原件在私有桶 `keep/t05-six-buddhas/`、`keep/t05-shakyamuni-370/`（不进 git）。

没有合入的失败试验（`knee.weld`、`varada-close.py`、`varada-window.py`、`layers.py`、`varada-orient.py`、`backside.cjs`）留在分支 `claude/t05-closed-hand-578`、`claude/t05-orient-578`、`claude/t05-backside-578`，记录用。
