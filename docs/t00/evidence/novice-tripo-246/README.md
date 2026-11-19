# Tripo 分层小沙弥，离线接入的对照图（#246）

工具 `tools/novice-tripo.mjs`，软件渲染（SwiftShader），光秃秃的台子（`tools/novice-stage/`），夏昼的固定光。图在公开数据集里，按清单的提交号固定（`MANIFEST.json`）；仓库里只留拼图 `collage.jpg`。

| 文件 | 内容 | 地址 |
| --- | --- | --- |
| `views-3col.png` | 代码身体｜现有 `novice.glb`（Meshy）｜新身体，站、合掌、走、坐凳、盘坐 × 正、侧、背、斜俯 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/b6ccf5a042ef6f990efae5425da128a5d2bead5f/t00/novice-tripo-246/views-3col.png) |
| `hands-code-vs-tripo.png` | 合掌、捧碗到唇边（吃茶）、举香到眉，代码身体｜新身体，正、侧 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/b6ccf5a042ef6f990efae5425da128a5d2bead5f/t00/novice-tripo-246/hands-code-vs-tripo.png) |
| `hat-beads.png` | 新身体戴代码做的斗笠（背在身后）和念珠，正、侧、背 | [原图](https://huggingface.co/datasets/bolechen/temple-walk-evidence/resolve/b6ccf5a042ef6f990efae5425da128a5d2bead5f/t00/novice-tripo-246/hat-beads.png) |
| `collage.jpg` | 上面三张拼成一张（1600 宽，322 KB） | 仓库里 |

## 怎么重出

```sh
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx hf buckets sync hf://buckets/bolechen/temple-walk-render/keep/tripo-2026-11-19/monk2 /tmp/monk2
node tools/novice-tripo.mjs /tmp/monk2                       # → tools/out/novice-tripo.glb
node tools/novice-views.cjs --code --glb=app/shared/models/novice.glb --glb=tools/out/novice-tripo.glb --out=views-3col.png
node tools/novice-views.cjs --code --glb=tools/out/novice-tripo.glb --poses=pray,tea,incense --sides=正,侧 --out=hands-code-vs-tripo.png
node tools/novice-views.cjs --glb=tools/out/novice-tripo.glb --poses=stand --sides=正,侧,背 --out=hat-beads.png
```

产物 `novice-tripo.glb`（SHA-256 `c969d62cb0b9de0cfc8a2ed21f4e91bb38ea3b8b15ab78c2dbf3d2d7f2fa5010`，1,413,704 字节）放在私有桶 `keep/novice-b/2026-11-19/`。图是在分支 `claude/novice-tripo-246` 的这份工具上画的；报告见 `docs/t00/refactor/novice-spike.md`。
