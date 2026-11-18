# #200 枫与分叉（T4）

## 交接处（3D 评审 6970309915 之后）

- **`joints-t4-before-after.jpg`**：首院西侧枫（-9.5, 28）。四行依次是仰视秋昼 `-9.5,29.0,0,1.2`、仰视冬昼（同一机位）、正视 `-9.5,30.2,0,0.15`、侧视 `-7.3,28,-1.571,0.15`，均为第一人称，1600×900，`?shot=1&q=high`。三列：
  - 左：main `3b63974`，run `20261118-092319`，报告 `joints-t4-main.json`。
  - 中：上一轮的分支 `dde5efb`，run `20261118-054313`，报告 `joints-t4-before.json`。
  - 右：这一轮 `9f94af7`，run `20261118-092003`，报告 `joints-t4-after.json`。
  - 三次 run 都不带 `+dirty`。
- **`joints-t4-crops.jpg`**：从原图截出交接处放大，三列与上图相同。
  - 中列：子枝第一圈露在母枝外，形成锯齿唇口，冬天仰视透光；正视里两干贴着长，中间夹一条窄干。
  - 右列：唇口没有了，三根干分开了。

## 上一轮

- **`maple-t4-before-after.jpg`**：main 对分支的枫，报告 `t4-main.json`、`t4-branch.json`。

## 原图在哪里（#223）

本目录的图和录像（3 个文件：3 jpg，共 1.7 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/trees-92-93/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/trees-92-93/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/trees-92-93`。
