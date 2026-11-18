# 功德箱返工（#202）的证据

（所有者 2026-11-18 的规矩：每个 PR 进仓库的证据不超过 1 MB，并排图拼成一张、JPEG、长边不超过 1600。单张原图不进 git，可按下面的命令重出。）

每张图的来源写在文件名里：`t4-` 是 Tesla T4 上拍的，`sw-` 是软件渲染（SwiftShader）拍的。

| 文件 | 内容 | 来源 |
|---|---|---|
| `t4-16x9-four-moments.jpg` | 箱的机位里的四格连拍：左上合掌一礼（手开始后 0.45 s）、右上递出（2.0 s）、左下松手（3.1 s）、右下再合掌一礼（4.8 s）；原图 1920×1080，夏昼 | T4，站点提交 `1d31ae4`（运行 `20261118-143632`，站点指纹 `38ce0f696466`） |
| `door-day-t4-and-night-sw.jpg` | 进殿门处第三人称：左上夏昼（T4，原图 1920×1080），右上夜里（软件渲染，1280×720）；下排是各自把箱子一带放大的裁剪，「功德箱」三字认得出 | 夏昼 T4 同上；夜里 `node tools/inside.cjs` 软件渲染 |
| `sw-4x3-four-moments.jpg` | 同样四格连拍，4:3（原图 800×600，`q=low`） | 软件渲染，`node tools/offering-frames.cjs --aspect=4x3,phone --small`，同一提交 |
| `sw-phone-four-moments.jpg` | 同样四格连拍，手机竖屏（原图 360×780，`q=low`），四格并排 | 同上 |
| `at-the-box-and-before-sw.jpg` | 左：走到箱前，箱自己的机位（`node tools/shots.js --size=1280x720 shot-main-box`，手握钱停在口上方，字露出）；右：改前，main `fa58cea`，同一「时刻」（点按钮后 1.85 s，眼睛仍在肩后，钱在飞，960×540，`q=low`） | 软件渲染 |

重出 T4 的图：`node tools/offering-frames.cjs --spec > spec.json; tools/gpu-render.sh t4-small "$(cat spec.json)"`。
T4 用量：本 PR 第一轮（旧位置）约 5.9 分钟，这一轮约 2 分钟（`report.json`：2026-11-18T14:36:48.373Z → 2026-11-18T14:38:44.193Z）；旧位置的 T4 图已删掉，不留。
