# #134 歇脚菜单宽屏横排：改前改后

`before-*` 是 main `9c09ae5`，`after-*` 是本分支；季节时辰已解锁（`body.seasons`），`q=low`，`shots` 脚本见 PR。
文件名 `<前后>-<宽x高>-<语言>.png`。改前 1366×768 en 的卡片 scrollHeight/clientHeight = 1094/748（要滚动），改后 529/529。

## 开屏顶栏（验收 9–12）
`title-before-<宽x高>-<语言>.png`：main `3c629d2`；`title-after-*`：本分支。尺寸 360×640、390×844、430×932、844×390，语言 zh/ja/en/ko。
改法 A：手机宽（≤ 600 px）上「内测反馈群／设置」一行，四种语言单独占第二行，每项 `white-space: nowrap`、不小于 44 px；副题在窄屏缩到 12 px。
