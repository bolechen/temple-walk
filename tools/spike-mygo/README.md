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

## 打包与自动更新（第二阶段，tools/spike-mygo-pack/，2026-11-19）

第二阶段在 `tools/spike-mygo-pack/`：同样的站点，换成 `mygo build` 的正式打包，加上 `mygo.Updater` 的真实更新检查（启动 3 秒后查一次、安装、`App.Relaunch()`，全部写进 `/tmp/mygo-update.log`）。

- **mygo.json**：`frontendDist: "dist"`（`mygo build` 自己嵌站点，不用 `SetFrontend`）、`slug: temple-walk`、`updates.url`。构建还要求 URL 是 https——本地试验用自签证书（`SSL_CERT_FILE` 让 app 信任它），生产直接用 `https://temple.rushiwowen.co/...`。
- **密钥**：`mygo keygen` 生成 Ed25519 对；公钥放进 mygo.json，私钥经 `MYGO_UPDATER_PRIVATE_KEY` 给构建。试验密钥在 `keys/`（git 忽略），**不能当生产密钥**。
- **打包产物**（17.8 秒）：`山门之外.app`（32.8 MB，ad-hoc 签名）、更新包 `temple-walk-0.3.0-darwin-arm64.tar.gz`（24.4 MB）、签名清单 `update-darwin-arm64.json`、`install.sh`、`SHA256SUMS`。
- **更新闭环实测**：装 0.3.0 → 清单换 0.3.1 → 启动后自动发现、下载、验签、安装 → 自动重启为 0.3.1 → 再查显示已是最新。app 被替换的是 `~/Applications` 式的用户目录安装（`/tmp/mygo-install`），与生产安装位置一致。
- **中途踩的坑**：构建机要能读到上一版的清单才生成增量更新（第一次服务器没起，构建自动跳过增量并说明原因）；服务器目录要指向新 build，否则 app 拿到旧清单会解析失败。两者都对应生产流程的正常步骤（先传包、最后传清单）。
- **生产部署**：`updates.url` 指向 HTTPS 目录，构建后上传 tar.gz 和 install.sh、**最后传清单**（避免 app 看到指向缺失文件的清单）。S3/R2 可用 `updates.s3` 让 `mygo build -upload` 直接传；或走 GitHub Releases。增量更新自动从已发布的最近 3 版生成。分发前还应配 Developer ID 签名 + `macos.notarize` 公证（试验是 ad-hoc）。

## 结论（暂定）

技术上可行：mygo 的网页模式就是系统 WebView，托管现有 `dist/` 不改一行前端代码，且自带签名自动更新，正好补上 Pake 的缺口。但它比 Pake 多引入 Go 工具链和一份 Go 源码，是否采用要看上面未验证项的结果。
