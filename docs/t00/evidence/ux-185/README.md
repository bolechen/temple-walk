# #185 标题页改前改后

「七处小事 · 七枚朱印」由 13 px、`--on-2` 改为 14 px、`--on` 并加一层字影（`ui.css` 的 `#title .how`）。

- 改前：`main` 上 `f22b9ab`（#179 合入后）构建的 `dist/`
- 改后：本 PR `f7d4bb9` 构建的 `dist/`
- 三种画幅：1280×720（16:9）、1024×768（4:3）、390×844 手机竖屏（触屏）
- `?q=low&season=summer&time=day`，SwiftShader 软件渲染，标题页未入山

`title-before-*.jpg` / `title-after-*.jpg`，由 85% JPEG 压缩。
