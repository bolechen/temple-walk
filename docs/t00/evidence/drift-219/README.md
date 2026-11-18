# drift-219 证据

## 原图在哪里（#223）

本目录的图和录像（1 个文件：1 jpg，共 0.4 MB）不在仓库里：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/drift-219/` 下，按提交号钉死。清单 [`MANIFEST.json`](MANIFEST.json) 给出每个文件的路径、字节数、SHA-256 和提交号；一个文件的地址是 `tools/evidence.config.json` 的 `base` + 清单里的 `rev` + `/t00/drift-219/<path>`。上文提到的文件名都按这份清单找。整目录取回（核哈希，放进 git 忽略的 `tools/out/evidence/`）：`node tools/evidence.mjs pull docs/t00/evidence/drift-219`。

## 图

- `pr1-before-after.jpg`：#221，秋昼四处改前（左）改后（右）：竹林起点、半山亭石阶、第一进院、大殿前。软件渲染。
- `pr2-litter-v2.jpg`：#226 积叶第二版（调色、成团之后）：枫下秋、枫下春、银杏下秋，平视，下半。软件渲染。
- `pr2-after-four.jpg`（仓库里留着的一张拼图）：#226 最终改后，左上起：枫树下（秋昼）、银杏树下（秋昼）、大殿台阶脚（秋昼）、枫树下（春昼）。**软件渲染**（SwiftShader，q=high，800×450 再缩到 700 宽），没有用 T4，GPU 上的亮度没看过。重出：`node tools/shots.js "x&cam=-9.5,32,0,0.02@autumn-day@first" "x&cam=9.5,33,0,0.02@autumn-day@first" "x&cam=6,9.5,0,0.03@autumn-day@first" "x&cam=-9.5,32,0,0.02@spring-day@first" --size=800x450`。
- 已作废的 `pr2-before-after.jpg`（旧积叶）已从仓库去掉；它在数据集里的 `t00/drift-219/` 下没有（它在 #226 之前就不在清单里）。
