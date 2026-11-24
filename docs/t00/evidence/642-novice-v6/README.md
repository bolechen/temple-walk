# #642 小沙弥第六版（闭眼）代码重画 MVP 证据

对照设定图：`refs/monk-sheet-v6-2026-11-22-eyes-closed.webp`、`refs/monk-v6-ortho/{front,side,back}.webp`、`refs/monk-props-v6-2026-11-22.webp`、`refs/monk-poses-v6-2026-11-23-{gassho-head,sitting}.webp` 与开工简报 `docs/t00/novice-v6-brief.md`。

`collage.jpg` 内容（软件渲染 SwiftShader）：
- 左上：正 / 侧 / 背 A-pose 与 `refs/monk-v6-ortho/` 并排及剪影差（白=重合，红/绿=差）。
- 右上：脸部正侧近景对照 `monk-poses-v6-2026-11-23-gassho-head.webp`。
- 右中：夏昼首院 2.4 m 正面全身（旧代码身体左 / 新 v6 右）、竹径石阶 `cam02` 背影（旧左 / 新右）、首院 `cam06` 跟随（旧左 / 新右）。
- 左下：`novice-views.cjs --code` 站立、合掌、走路、坐凳、盘坐四向。
- 右下：`novice-views.cjs --code` 吃茶、举香、坐着吃茶四向。

## 数值核对

- **轮廓重合度（IoU，不含背笠，对齐 `refs/monk-v6-ortho/`）**：
  - 正面：**0.9293**（目标 ≥ 0.92）
  - 侧面：**0.9354**（目标 ≥ 0.90）
  - 背面：**0.9213**（目标 ≥ 0.92）
- **比例与头身比**：全高 1.18 m、4.55 头身；骨骼名、层级、37.8° A-pose 与 `monk.dress()` 接口不变。
- **首院夏昼 2.4 m 实景配色**（`?shot=1&q=medium&show=cam06&view=third&body=code`）：
  - 额头中位数：L\* 58.43、a\* 5.89、C\* 18.61（对比正式版闭眼代码身体 L\* 58.11、a\* 6.18、C\* 20.13；ΔL\* = +0.32 ≤ 3，不更红更艳）
  - 袍中位数：L\* 25.36、a\* 16.10、C\* 23.36（对比正式版 L\* 25.37、a\* 17.47、C\* 24.89；ΔL\* = −0.01 ≤ 3，不更红更艳）
  - 袍 ÷ 额头线性亮度比：**0.171**（正式版 0.174；供 `skills/art-gate` 判法 25 更新参考）
- **三角形数**：无笠 26,960 面、含笠 31,160 面；全场景 2,731,813 面（较改前 2,745,181 面少 13,368 面）。
- **外廓与可走地面**：`outline.json` 已重算（膝上最大 0.373 m ≤ 0.38 m），`pnpm run edges:grid` 0 处超出，`walk-diff` t00 / t05 命名地点全部可达。
- **待真机 / T4 复核**：首院 T4 帧耗对比尚未跑（需 T4 GPU 作业授权），画面待美术终审与所有者点头。
