# #192 第二步：匾字的集字可行性与字体候选（只对照，不改线上）

文字结论在 [`docs/t00/board-hand-candidates.md`](../../board-hand-candidates.md)。

- **`compare-raw.jpg`**：五块匾（正法眼藏、萬年正續、雙徑歸堂、喫茶去、雲徑禪寺）画在真匾的配色上，五款字体各一行，**不补墨**；每行标字体名、许可、笔画宽（‰字格），每块匾下标同匾各字笔画宽的最大差。工具 `tools/board-compare.py <字体目录> <out.jpg> --raw`，用 `tools/board-ink.py` 自己的画法（`Glyph.even`、`breadth`）。
- **`compare-even.jpg`**：同样的图，各字按 `board-ink.py` 补墨（上限 0.025）。Yuji Boku 补墨后 19 块匾全部过 10%，最大 5.4%；Kaisei Tokumin Bold 4 块不过；Potta One 6 块不过；全字庫正楷體加粗到 58‰ 后全过。
- **`zhang-strip.jpg`**：张即之大字（大都会 2000.325《乐游园歌》，CC0，八字「幕排銀牓拂水低徊」，从原图 4000×3002 上按墨截出）在第一行，下面每款候选字体画同样的字，让人一眼看出哪款最近。「牓」Yuji、Kaisei、Potta One 都没有，留空。工具 `tools/zhang-strip.py`。
- **`compare-raw.json`、`compare-even.json`**：每款字体、每块匾逐字的数。

字体与来源（都不进仓库）：Yuji Boku、Kaisei Tokumin Bold、Potta One 取自 `github.com/google/fonts` 的 `ofl/…`；全字庫正楷體取自 Debian 包 `fonts-cns11643-kai` 11403.01+20250325-3（原始出处 `data.cns11643.gov.tw`）；霞鹜文楷 TC 粗体是 #207 的 `bang.woff2`（`git show bc7a68f:app/shared/fonts/bang.woff2`），只含匾上用字。

## 原图在哪里（#223）

图在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence` 的 `t00/plaque-192-hands/` 下，按提交号钉死；清单见 [`MANIFEST.json`](MANIFEST.json)。

> 其余图片（本目录 `MANIFEST.json` 列着的）在证据库，不在 git：`node tools/evidence.mjs pull <本目录>` 取回到 `tools/out/evidence/`，每张的地址是 `base + rev + 路径`（见 `MANIFEST.json`、`tools/evidence.config.json`）。每个证据目录在 git 里只留一张拼图。
