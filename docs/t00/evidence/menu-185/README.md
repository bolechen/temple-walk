# #185 菜单分三段：改前改后

歇脚菜单打开、时节已开（`body.seasons`），夏 · 昼，中文。

- **改后**（三种画幅）：T4 上画，`tools/gpu-render.sh t4-small`，运行 `20261118-052240`，Job 内页面用时约 1 分钟（05:22:55 → 05:23:54 UTC）。站点指纹：提交 `6a9a44e`，入口 `assets/index-Cs20HkLf.js`，111 个文件，SHA-256 `53a327defb94672e1f2b4ffc1f1610d903c033ebc546075728d0107d37ab0a10`。
  `menu-after-16x9.jpg`（1920×1080）、`menu-after-4x3.jpg`（1440×1080）、`menu-after-phone.jpg`（390×844）
- **改前**（一张）：main `61d1b54` 构建的 `dist/`，1920×1080，本机 SwiftShader（菜单是纸面，与场景渲染无关；T4 的 Job 只能带当前分支的站点）。`menu-before-16x9.jpg`
- 此前另有一次 T4 运行 `20261118-050538`（提交 `ce6ddab`，约 1 分钟）：浏览器默认成了英文，并发现宽屏两栏小标题没对齐，`6a9a44e` 已改，图未采用。

85% JPEG 压缩。
