# 为他人点灯（#343，PR #357）

- `sheet.jpg`：上一行是朋友打开链接后在手机（390×844）上看到的画面，下一行是那张卡片；列依次是中、日、英、韩。
- `lamp-arrival-<lang>-desktop.jpg`（1280×720）、`lamp-arrival-<lang>-phone.jpg`（390×844）：朋友打开链接后，被带到供灯处，灯台上多一盏灯和一张小签，说「有人在此为你点了一盏灯。」再说那句祝语。
- `lamp-card-<lang>.jpg`：点灯的人得到的卡片（祝语、寺名、季节与时辰、印式二维码，码里是整条链接）。
- `sheet-<lang>-<desktop|upright|side>-<list|card>.jpg`：「为他人点灯」这张纸，桌面 1280×720、手机竖屏 390×844、手机横屏 844×390，选之前和选之后。
- 生成：`node tools/lamp-views.cjs`（卡片和朋友看到的画面）、`node tools/lamp-sheet-shots.cjs`（这张纸）。
- `final-sheet.jpg`（a9e8e93 之后，7d78b3a）：上一行四语卡片（中日英韩），下一行手机竖屏 390×844 朋友打开链接后的画面；`final-card-<lang>.jpg`、`final-arrival-<lang>-phone.jpg` 为其原图。右上那盏灯的小签在竖屏上有意只作氛围：同一句祝语已在画面下方以字幕说出，且卡片上有全文。
