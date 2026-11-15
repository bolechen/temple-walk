# T00 独立评审 · 锁定 9e78569b77794b6174d698799f42f4e580882039

- 评审人：Claude 定时独立评审（Skill temple-review 1.0.0，固定 c4c3ba5cad3eb9337c3f21c07cbdbd4ac62f3ee3）
- 上次评审：6c72023d8266c26cb3370c154e254a218c7f116f（Codex，partial / not_accepted）
- 本轮差异：6c72023..9e78569，23 个提交、178 个文件：建筑边缘碰撞整改、拍照模式改为"所见即所拍"、A-pose 蒙皮小沙弥、殿内博物馆雕塑、配乐、界面层栈。
- 环境：托管 Linux，4 核；Node 22.23.4；Playwright Chromium headless shell 1243，SwiftShader（软件 GL）；所有运行代码的子进程以 `env -i` 去掉 GitHub/HF/AWS/GCloud 凭据，服务只绑定 127.0.0.1。非目标设备。
- 评审期间主线前进到 7b4a5a0f4635d7520ae2a9e79cc462cf32c1d1b9（10 个提交，含 app/ 改动）。本报告只对 9e78569 成立，最新 HEAD 待复验，没有把结果移贴到新提交上。

## 实际执行

| 项 | 结果 | 文件 |
|---|---|---|
| `pnpm run check` | 36 个文件，0 问题 | check.log |
| `pnpm test` | 108/108 通过 | unit.log |
| 评审校验器自测 | 17/17 通过 | validator-tests.log |
| `pnpm run edges`（开发方自检工具） | 15 组 0 cm 越界 | edges.log |
| 独立探针：上次 EDGE-001/002 坐标在锁定计划上 | 8 处前檐柱：离柱心最近的可站点 = 柱半径 + 0.377 m + 0.5–0.7 cm；两张茶案中心阻挡，半径 0.45 m 内全部阻挡 | post-probe.json、edge-probe.json、probes/ |
| e2e 第一轮（12 个场景，串行） | boot layers menu photo-ui keys jump drop stairs 通过；camera 失败；phone halls music 被本评审自设的 1500 s timeout 杀掉（harness） | e2e-first-run.log |
| e2e 重跑被杀的三个 | phone halls 通过；music 失败 | e2e-retry.log |
| 诊断：music + sound | 两个都在"鼓声"断言失败 | e2e-music-diag.log |
| 诊断：鼓声采样 | 鼓声确实发出（54 Hz，rms 0.02–0.03），约 1 s 内衰减；每次 `__listen` 在 SwiftShader 下约 600 ms，测试等 150 ms 墙钟后才采样，因此采到的是衰减后 | drum-diag.log |
| 正常速度实际键鼠（Playwright 键盘/鼠标事件，无 ?cam/?fast/__walk/__pose；只读 __yard/__ui 记状态） | 标题页点"入"进入；按住 W 6 段×60 帧：从竹林起点 (21.3, 91.5, h −14.5) 上到 (21.3, 75.5, h −10.5)；Esc 菜单下 E B P T H V Enter Space W 滚轮均无反应；P 举相机只露 收起/设置/快门；快门出 1700×1130 照片 | normal-input.log/json、shots/normal-*.jpg |
| 固定机位 cam01–cam06（tools/shots.js，夏·昼，第一人称） | 0 错误；已逐张打开 | shots.log 未入库，shots/cam0*.jpg |

## 看图

- **normal-02-walk-3/5**：一直按 W，他走出石阶平台边，站到落叶坡上，然后被一道看不见的边界挡住（z 不再变）。地面没有路缘或挡墙说明这里走不过去。UX-08 复现。
- **normal-05-print**：近处铺地与远处竹林都清晰，没有景深模糊。符合"不要景深"。画幅是屏幕比例（3:2），不是目标里的 16:9 横幅。
- **cam01**：踏面有了浅色边，挡墙分出了砌块，比上次好，但踏面、踢面、挡墙仍是同一种灰石、明度相近（ART-08 有改善，未到位）。竹冠里仍有大片亮天和片状叶团（ART-07）。
- **cam03**：照壁"雙徑歸堂"砖台座与石框可见；白墙上沿的风化仍偏均匀（ART-05）；大片平灰天空（ART-02）。
- **cam05**：门洞框住照壁，构图成立。看不到竹根，STR-14 无法复验。
- **cam06**：首院湿铺地比上次哑光，积水成块，倒影不再像硬边镜面（ART-01 / ART-14 有改善，需同机位对比后才能关闭）；柳杉仍是细长尖塔剪影（ART-10）；天空仍是最大最亮的平面（ART-02）。正脊在此分辨率下看不出浅线，STR-10 未能判定。

## 未执行 / blocked

- Mac 与手机 120 s×3 性能：没有目标设备。SwiftShader 在 1280×720 约 0.4 帧/秒，不能推断任何设备的表现。
- 完整五区往返：只完成竹林→第一段石阶平台；没有转过之字形、没有到山门/首院再返回。
- 殿内：halls 场景通过，但没有打开殿内截图看墨画、雕塑、新柱网。外景 GPU 脚本不含佛像，不能证明殿内资产完整。
- 配乐：只有自动测试，没有人试听。按任务约定，配乐只评审，不生成音乐。
- 触屏真机、Safari/iOS：未测。
- 研究 Site：llms.txt 里"最新独立验收"仍指向 954f84d 的旧报告。例行状态靠 site-status 工作流同步，本轮没有重新发布 Site。
