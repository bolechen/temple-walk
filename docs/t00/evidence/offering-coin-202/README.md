# 功德箱返工（#202）的证据

每张图的来源写在文件名里：`t4-` 是 Tesla T4 上拍的，`sw-` 是软件渲染（SwiftShader）拍的。

| 文件 | 内容 | 来源 |
|---|---|---|
| `t4-16x9-1-palms` … `t4-16x9-4-bow` | 箱的机位里的四格连拍：合掌一礼（手开始后 0.45 s）、递出（2.0 s）、松手（3.1 s）、再合掌一礼（4.8 s），1920×1080，夏昼 | T4，站点提交 `1d31ae4`（运行 `20261118-143632`，站点指纹 `38ce0f696466`） |
| `t4-door-day-third` | 进殿门处第三人称，夏昼，1920×1080，三字「功德箱」认得出（T4 的站台里没有佛像模型，不影响箱子） | 同上 |
| `sw-4x3-*`、`sw-phone-*` | 同样四格连拍，4:3（800×600）和手机竖屏（360×780），`q=low` | 软件渲染，`node tools/offering-frames.cjs --aspect=4x3,phone --small`，同一提交 |
| `sw-door-night-third`、`sw-door-day-third` | 进殿门处第三人称，夜里与夏昼各一张（1280×720，`q=high`） | 软件渲染，`node tools/inside.cjs` |
| `sw-at-the-box-day-16x9` | 走到箱前：箱自己的机位（`?show=shot-main-box`），手握钱停在口上方，字露出 | 软件渲染，`node tools/shots.js` |
| `sw-before-16x9-main-fa58cea` | 改前：main `fa58cea`，同一「时刻」（点按钮后 1.85 s，眼睛仍在肩后，钱在飞） | 软件渲染，960×540，`q=low` |

T4 用量：本 PR 的第一轮（旧位置）约 5.9 分钟，这一轮（新位置）约 2 分钟（`report.json` 的 started/finished：2026-11-18T14:36:48.373Z → 2026-11-18T14:38:44.193Z）；旧位置的 T4 图已删掉，不留。
