# 柳杉树坑补回：改前、改后（T4）

- **`owner-bed-t4-before-after.jpg`**：所有者在正式站报告用的机位，`?cam=14.95,-0.19,1.979,-0.055&view=third&season=autumn&time=day`，加 `shot=1&q=high`，1600×900。
  - 上：改前，main `b2615f3`，run `20261118-093849`，报告 `t4-main.json`。老柳杉和幼柳杉都直接从石板里长出来。
  - 下：改后，`3cd645f`，run `20261118-093950`，报告 `t4-head.json`。两棵柳杉脚下都回到一圈带苔的土。
  - 两次 run 的 site 指纹都不带 `+dirty`。

## 原图在哪里（#223）

本目录的图和录像（1 个文件：1 jpg，共 0.5 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/trees-cedar-bed/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/trees-cedar-bed/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/trees-cedar-bed`。
