# #199 柳杉：改前、改后（T4）

- **`cedar-t4-clean-before-after.jpg`**：左列是改前，右列是改后。五个画面：幼柳杉夏昼、柳杉全貌秋昼、柳杉全貌冬昼、前庭冬昼、回望秋昼。
  - **改前一列拍的是 `f20e0f0`（2026-11-16 的 main），不是合入时的 main `15ea861`**。原因是本地的 main 引用没有更新。所以这一列不含 #159、#178、#197，柳杉还是 #197 修之前的树干和根脚。
  - 改后一列是 `651a558`（本分支并入 `15ea861` 之后）。
  - 两列都从已提交的代码出图，不带 `+dirty`。报告：`t4-clean-main.json`（run `20261118-083904`）、`t4-clean-head.json`（run `20261118-083909`）。
- **`cedar-t4-before-after.jpg` 与 `t4-report.json`**：同一个 Job 里新旧柳杉交替三次（run `20261118-052520`）。旧柳杉放在测量副本的 `?trees=old` 后面，那段代码不提交，所以 site 指纹带 `+dirty`。帧耗以这一组为准：前庭 high 1080p，新比旧多 0.15 ms。

## 原图在哪里（#223）

本目录的图和录像（2 个文件：2 jpg，共 1.1 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/trees-cedar/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/trees-cedar/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/trees-cedar`。
