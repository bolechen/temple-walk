# #202 微信赞赏码（中文界面）的纸页

`sheet-390x844-360x640-844x390.jpg`：同一张纸在三种屏幕上的样子（软件渲染，非 T4；左 390×844，中 360×640，右 844×390 横屏）。横屏放不下整张，纸内滚动，「合上」粘在底部始终可点；码在滚动区里。

重新生成：`pnpm build && node tools/mobile-audit.cjs --only=offering`，图在 `tools/out/mobile/{upright,small,side}-offering.png`，再拼成一张。该审计检查 44 px 控件、12 px 字、越界，全绿。

码上的昵称与照片是所有者本人的，原样显示（见 `docs/t00/asset-register.csv` 的 `WECHAT-QR-2026-08-28` 行）。
