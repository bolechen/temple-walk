# #403 领印时的双字幕

`before-after.jpg`：左改前、右改后；960×640、`q=low`、秋日，燃灯红印出现的同一时刻（印已按下、印下一行可见）。

- 改前（main `0195f82`）：`#say` 与 `#toastLine` 都是「一灯能除千年暗。」，两层不透明度都是 1。
- 改后：`#say` 不透明度 0，只剩印下面一行。

回归断言：`node tests/e2e/run.cjs pilgrimage`（页内 MutationObserver，静坐、吃茶、观水、燃灯领印期间任一时刻不得两处同时显示同一句）。
