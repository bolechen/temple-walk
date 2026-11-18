# 名匾不再被斗拱盖住（#213）证据

T4（`tools/gpu-render.sh t4-small`，Vulkan，NVIDIA Tesla T4），夏昼，`q=high`，1280×720，第一人称；每张左为改前（main `fa58cea`，运行 20261118-140452，站点指纹 sha256 `aa5ed6ced85c…`，入口 `assets/index-CUxvwwXz.js`），右为改后（本分支 `8a9e4fd`，运行 20261118-140419，sha256 `438661228ddb…`，入口 `assets/index-DdyVETze.js`）。每张缩到 3/4 存成 jpg。

- `hall-3m.jpg`、`hall-4.5m.jpg`、`hall-7m.jpg`：大殿门前 3、4.5、7 米，仰视「正法眼藏」；`?cam=0,z,0,pitch`（z=-1.67、-0.17、2.33，仰角 0.8、0.68、0.5）。改前「正」的上半被盖住，改后四个字完整。
- `cam01…cam06_summer-day_first.jpg`：六个锁定机位并排。
- 页面错误 0（两次运行）。

## 原图在哪里

图不在仓库里（#223）：在 Hugging Face 公开数据集 `bolechen/temple-walk-evidence`，按提交号钉死，清单见 [`MANIFEST.json`](MANIFEST.json)（路径、字节数、SHA-256、提交号）。想看：[hall-3m](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/972a32c96a280f8e7dd3f0498acba572165ec05d/t00/plaque-clear-213/hall-3m.jpg)、[hall-4.5m](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/972a32c96a280f8e7dd3f0498acba572165ec05d/t00/plaque-clear-213/hall-4.5m.jpg)、[hall-7m](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/972a32c96a280f8e7dd3f0498acba572165ec05d/t00/plaque-clear-213/hall-7m.jpg)、[六个机位并排：cam01](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/972a32c96a280f8e7dd3f0498acba572165ec05d/t00/plaque-clear-213/cam01_summer-day_first.jpg)…cam06 同目录；整目录取回到 `tools/out/evidence/`：`node tools/evidence.mjs pull docs/t00/evidence/plaque-clear-213`。
