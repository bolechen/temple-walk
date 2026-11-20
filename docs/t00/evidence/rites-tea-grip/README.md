# 吃茶握法放低（#286 的 `fix(rites)` PR）

| 文件 | 内容 |
| --- | --- |
| `tea-ba.png` | 吃茶导演机位（`site.js` SHOTS.tea，第三人称），第二口、碗倾到最高（0.78）的那一帧：左为改前（main），右为改后。页面跑在 Vite 开发服务器上，`?play=tea&q=high`；页面时钟放慢到 0.15 倍，到这一帧时把仪式时钟停住，再截图。软件渲染跟得上 |
| `shot-tea-static.png` | `?show=shot-tea`（`node tools/shots.js shot-tea@summer-day@third`），改后。这个视图把他摆成刚坐下、碗还在托上的样子，手没有动，改前改后一样，所以只放一张 |
| `stage-tea-grip.png` | 空舞台近看（`tools/novice-views.cjs --poses=teaSeat --hold=…`）：上一行是旧握法，下一行是新握法；代码身体｜Tripo 第六轮 |
| `collage.jpg` | `tea-ba.png` 缩小一半 |

截图脚本是临时写的，没进仓库：用 Playwright 的 `addInitScript` 把 `performance.now` 放慢到 0.15 倍；仪式时钟用 `__riteClock` 停住，再按 40 ms 一步往前推。
