# #202 功德箱的纸与别的纸并排

`phone-before-after.jpg`（390×844）与 `desk-before-after.jpg`（1280×720 中间 640 宽）：每张从左到右是 改前功德箱、改前鸣谢、改后功德箱、改后鸣谢。软件渲染。

改前功德箱四边是直的（`--deckle` 是回退值），底部「合上」是一条平的浅色带；改后有撕边，底部渐隐带带纸纹，「合上」仍是带笔划下划线的 chip：这张纸上唯一的印是去护持页那枚（鸣谢、朱印帐上「合上」是唯一按钮，所以是印）。

重新生成：`node tools/sheet-compare.cjs <label>`（图在 `tools/out/sheets/`），再拼图。

> 其余图片（本目录 `MANIFEST.json` 列着的）在证据库，不在 git：`node tools/evidence.mjs pull <本目录>` 取回到 `tools/out/evidence/`，每张的地址是 `base + rev + 路径`（见 `MANIFEST.json`、`tools/evidence.config.json`）。每个证据目录在 git 里只留一张拼图。
