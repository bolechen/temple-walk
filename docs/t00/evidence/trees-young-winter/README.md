# 幼柳杉与冬天树下（#93、#92）

## T4

- **`before-after.jpg`**：16:9，左 main `bc7a68f`（run `20261118-141713`），右本 PR `ddf49ca`（run `20261118-141531`），两次 run 都不带 `+dirty`，报告见 `t4-main.json`、`t4-head.json`。
  - 上：幼柳杉（-15.5, 1.8），夏昼，`cam=-11.5,7.5,-0.61,0.2`。这个角度上半部被身后的大树挡住一部分，改动要看下面的近景。
  - 下：首院西侧枫的树下，冬昼，`cam=-9.5,31.5,0,-0.45`。改前是一块硬边的灰圆斑；改后铺地的雪直通到树下，根脚下部积雪。
- **`after-three-screens.jpg`**：改后的幼柳杉在 16:9（1600×900）、4:3（1200×900）、手机竖屏（390×844）三种屏上各一张。

## 软件渲染

- **`young-local-before-after.png`**：本地 SwiftShader，不是 T4。看的是同一棵幼柳杉的整棵树形，眼睛位于 (-11.5, 1.6, 7.5)，看向 (-15.5, 2.9, 1.8)。左 main、右本 PR。改前上半部稀、看得见树干；改后从下到上都密，是窄圆锥。

## 原图在哪里（#223）

本目录的图和录像（3 个文件：2 jpg、1 png，共 0.8 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/trees-young-winter/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/trees-young-winter/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/trees-young-winter`。
