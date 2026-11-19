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

- 单个 Go 二进制 **34.3 MB**（站点约 28 MB 在内），无运行时依赖；macOS 上不依赖 cgo。
- 画面与 Pake 版一致：竹径、石阶、大殿、小沙弥、HUD 的「钟」标记都正常。
- 点「入山」进入场景，开场镜头正常播放，落到第三人称。
- **殿内模型**：`?in=main` 直接进大雄宝殿，佛像、须弥座、四尊立像、香案、功德箱、灯具和藻井全部加载，说明 GLB、meshopt 与 Basis KTX2 在 `mygo://` 下都正常。
- 站点资源经 `mygo://localhost/` 提供，`mygo.SetFrontend()` 不需要 mygo 的命令行工具。
- **交叉编译**：同一台 Mac 上 `GOOS=windows GOARCH=amd64` 与 `GOOS=linux GOARCH=amd64` 各约 10 秒产出 34.5 MB 的 `.exe` 和 34.3 MB 的 ELF；只验证了能编译，没有在 Windows/Linux 上运行。

## 与 Pake 的受控对比（各两遍，同样的启动与激活方法）

| | mygo v0.10.0 | Pake 3.19.4（我们的游戏配置） |
|---|---|---|
| 启动到标题可点 | **5.57 / 5.63 s** | **4.80 / 5.03 s** |
| 常驻内存（宿主进程） | 124 / 128 MB | 138 / 128 MB |
| 分发体积 | 34.3 MB 单二进制 | 31 MB `.app`，27.4 MB `.dmg` |
| 跨平台构建 | 任意机器交叉编译 | 需在各自系统上构建（Windows 需 MSVC 或 gnu 工具链） |
| 自动更新 | 内置，签名 + 增量 | **没有** |
| 成熟度 | v0.10.0，较年轻 | 成熟、使用者多 |
| 仓库里的代码 | 约 60 行 Go + `go.mod`/`go.sum` | 无（一份 JSON 配置 + 脚本） |

注：第一次量 Pake 得到 23.6 秒，原因是没有在启动后立刻把它带到前台，WKWebView 在后台会节流；受控对比里每次都用 System Events 激活，这个差异就消失了。

## 未验证

- 声音、键盘输入、触摸。
- Windows（WebView2）与 Linux（WebKitGTK）上的实际运行：只验证了交叉编译。
- 打包（dmg、签名、公证、自动更新）：这次只用 `go build`，没有走 mygo 的打包流程。

## 结论（暂定）

技术上可行：mygo 的网页模式就是系统 WebView，托管现有 `dist/` 不改一行前端代码，且自带签名自动更新，正好补上 Pake 的缺口。但它比 Pake 多引入 Go 工具链和一份 Go 源码，是否采用要看上面未验证项的结果。
