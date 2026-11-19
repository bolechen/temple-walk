# #202 功德箱的纸：赞赏码四种语言都有

`phone-zh-en-ja-ko.jpg`：390×844 手机竖屏，从左到右 中、英、日、韩（软件渲染，非 T4）。非中文界面里码图的替代文字和第一行写明是 WeChat Pay 的码、可选；去护持页的印章按钮仍在码上面。

重新生成：`pnpm build && node tools/mobile-audit.cjs --only=offering --lang=<zh|en|ja|ko>`，图在 `tools/out/mobile[-<lang>]/upright-offering.png`，再拼成一张。四种语言四个尺寸（390、844 横、360、430）审计全绿。
