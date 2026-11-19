# mygo 网页模式试验

用 [mygo](https://github.com/egoist/mygo) v0.10.0 托管网站在桌面窗口里，验证它能否替代 Pake 作为跨平台外壳。**只在本机验证过，没有打包，没有发布。**

## 构建

```sh
pnpm run setup                      # app/vendor/（git 忽略）先就位
pnpm build                          # 站点 → dist/
cp -R dist tools/spike-mygo/dist    # 嵌进 Go 程序（dist/ 已被 git 忽略）
cd tools/spike-mygo
GOTOOLCHAIN=go1.27.3 GOPROXY=https://goproxy.cn,direct go build -o spike .
./spike                             # 标题页 → 入山
SPIKE_URL="/?in=main" ./spike       # 直接进大殿，验证殿内模型
```

需要 Go 1.27.3（mygo 的 go.mod 要求；本机 1.27.1 走自动工具链下载）和网络拉模块。模块版本固定在 `go.sum`。

## 已验证（2026-11-19，本机 macOS 26 / Apple Silicon）

- 单个 Go 二进制 **34.3 MB**（站点约 28 MB 在内），无运行时依赖、无 cgo。
- 启动到标题页可点「入山」约 **6.5 秒**；Go 进程常驻内存约 **111 MB**（不含 WebKit 的独立辅助进程）。
- 画面与 Pake 版一致：竹径、石阶、大殿、小沙弥、HUD 的「钟」标记都正常。
- 点「入山」进入场景，开场镜头正常播放，落到第三人称。
- 站点资源经 `mygo://localhost/` 提供，`mygo.SetFrontend()` 不需要 mygo 的命令行工具。

## 未验证

- 殿内模型（`buddha.glb` 的 meshopt + Basis 贴图）经 `mygo://` 的加载：窗口启动时屏幕已休眠，没看到画面。
- 声音、键盘输入、触摸。
- Windows（WebView2）与 Linux（WebKitGTK）：没有对应机器。
- 与 Pake 版的冷启动、内存并排对比：Pake 窗口当时无法通过辅助功能访问，没量成。
- 打包（dmg、签名、自动更新）：这次只用 `go build`，没有走 mygo 的打包流程。

## 结论（暂定）

技术上可行：mygo 的网页模式就是系统 WebView，托管现有 `dist/` 不改一行前端代码，且自带签名自动更新，正好补上 Pake 的缺口。但它比 Pake 多引入 Go 工具链和一份 Go 源码，是否采用要看上面未验证项的结果。
