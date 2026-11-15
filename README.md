# 山门之外（temple-walk）

**一城一寺，一段值得慢下来的路。**

![云径禅寺：竹径通向层叠山寺，T00生成概念参考](docs/images/T00-concept.webp)

<sub>T00「云径禅寺」生成概念参考，用于美术方向；当前实机效果以试玩为准。</sub>

《山门之外》是一款在浏览器中行走、停留与观看的寺院探索游戏。我们从真实寺院的文化背景、艺术与空间出发，创作有地方气质的数字寺院：让玩家穿过一段竹径、发现转角后的塔、听见院落里的声响，也在轻互动中理解一处地方。

选题优先寻找小众、有特色、值得细看的寺院；地域分布帮助拓宽视野，空间辨识度和文化内容决定是否入选。少量知名寺院也可以因容易被忽略的艺术细节进入研究名单。每一关保留一条可完成的路线和几个值得停留的瞬间，逐步连接不同地方的建筑、艺术与生活。

调研档案区分可核实的事实、仍待核证的说法与原创取舍。场景使用虚构名称，并重新设计具体布局和表达；真实原型作为研究依据，素材仍逐项核对来源与使用权。更名本身不代表取得授权。

当前开发场景是 **T00「云径禅寺」**，取意于杭州径山寺，以原创意境呈现。**《山门之外》是游戏名，`temple-walk` 是仓库标识，「云径禅寺」是T00场景名**；T00由现有开发工作继续推进，其余关卡处于调研与概念阶段。

仓库现已公开，用于协作开发。**公开可见不等于所有代码与素材已获得统一开源或再分发许可**；许可状态见下文。

- [体验原型](https://bolechen.github.io/temple-walk/)
- [T00 研究、进度与独立验收](https://temple-atlas-research.floralpage64.chatgpt.site/#temple/T00)
- [Claude / Fable 读取入口 llms.txt](https://temple-atlas-research.floralpage64.chatgpt.site/llms.txt)
- [开发交接与验收包](https://temple-atlas-research.floralpage64.chatgpt.site/handoff/T00-handoff-v001.zip)
- [开发方按交接包提交的 T00 交付物](docs/t00/README.md)：启动说明、基线、机位、评审记录、已知问题、验收自报与证据

## 当前实现

`app/` 已有一座可行走的山寺：从竹林出发，经照壁、山门、院落与多级台地，到达山顶。代码中的路线长度约 250 米，是场景设计尺度，不是实地测绘结果。调研依据与创作取舍见 [docs/JINGSHAN.md](docs/JINGSHAN.md)。

1. **竹径**：望江亭、三段折线石阶、洗砚池与半山亭。
2. **照壁和山门**：「双径归堂」照壁、重阁山门、两侧钟鼓空间、柳杉与碑亭。
3. **主院**：禅堂、茶寮、茶桌、铁香炉与大雄宝殿。
4. **台地**：藏经楼、药师殿、龙井、观音殿与大慧院。
5. **茶垄与山顶**：茶园石阶、凌霄阁和回望机位。

已有的游戏功能：

- 小沙弥第一／第三视角切换；第一视角眼高为 **1.3 米**，是儿童视角设计。
- WASD、鼠标环顾、点地行走与移动端虚拟摇杆。
- 靠近无栏矮台前沿并面向外侧时，按Space或点「下台阶」完成一次受限下跳；落差最多1.5米，保留栏杆和高处边界。
- 八座可进入的 3D 殿堂；室内画框的剧情内容仍待补充。
- 撞钟、上香、吃茶、请一句话、观水、燃灯、静坐七处轻互动及朱印帐。
- 四季 × 晨昼暮夜，共 16 种预设，包含植被、天气氛围和灯火变化。
- 拍照画幅、焦段、对焦、沙弥入画／合掌及分享卡片。
- 按情境出现并淡出的提示；按 `H` 查看键位，鼠标移动时恢复侧边控件。
- 材质、阴影、局部倒影、画质分档与自动降级。

建筑、植被、人物、部分器物和声音主要由代码生成；扫描贴图、字体及佛像模型另有来源，不能将整个项目视为纯原创资产。声音需首次用户交互后启用。

## 运行

应用没有构建步骤，页面是原生 ES 模块。**Three.js r186 和殿内佛像模型不放在 Git 里**，由 pnpm 取回：需要 Node.js 22+ 和 pnpm 10，先在仓库根目录执行一次

```sh
pnpm install   # 装依赖，并运行 tools/setup.mjs：把 three.js 用到的文件拷进 app/vendor/three/，把佛像与莲座取到 app/levels/t00/models/
```

之后只需要支持 WebGL2 的现代浏览器及一个静态服务器。

从仓库根目录运行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory app
```

打开 `http://127.0.0.1:8000/`。默认只绑定本机；不要把开发工具服务器暴露到公网或不可信网络。

桌面常用操作：

| 按键／输入 | 操作 |
|---|---|
| WASD／方向键 | 行走 |
| Shift | 快步 |
| 单击画面、移动鼠标 | 锁定鼠标并环顾；Esc 松开 |
| E | 执行当前提示的互动 |
| V | 切换第一／第三视角 |
| B | 朱印帐 |
| P | 拍照模式 |
| T | 季节与时辰 |
| H | 查看键位 |

移动端使用虚拟摇杆和触屏操作。具体可用操作以游戏提示为准。

## 测试与截图

测试与截图工具需要 **Node.js 22+、pnpm、Playwright 和 Chromium**。Playwright 已是开发依赖，`pnpm install` 之后只需再取一次浏览器：

```sh
pnpm exec playwright install chromium
# Linux CI 如缺系统库，可使用：pnpm exec playwright install --with-deps chromium
```

```sh
pnpm run check       # 脚本解析及着色器片段检查
pnpm test            # 单元测试：平面、建筑、路线、季节和朱印逻辑
pnpm run e2e:quick    # 启动档：页面、渲染、字体及基本控件
pnpm run e2e:smoke    # 更广的场景与控件检查
pnpm run e2e         # 完整端到端场景
pnpm run verify      # check + 单元测试 + smoke
node tools/shots.js court@autumn-dusk@third
```

截图与测试报告写入 `tools/out/`；运行时长受软件／硬件图形环境影响，不保证固定分钟数。默认无头测试使用软件渲染，其帧率不能代表 Mac 或手机性能。

调试参数：

- `?show=机位名`：使用 `app/src/site.js` 的命名机位。
- `?cam=x,z,朝向,俯仰`：指定取景位置与角度。
- `?season=summer&time=day&view=first`：固定季节、时辰和视角。
- `?q=low|medium|high`：锁定画质；不指定时自动选择并可降级。
- `?shot=1`：冻结时间、隐藏界面，用于截图。
- `?fast=1`：加速自动行走测试；不能据此宣称正常速度手动验收通过。

真实 GPU 渲染工具见 `tools/gpu-render.sh`。运行 Hugging Face Jobs 需要自己的账号、权限与预算，可能产生费用；不是启动游戏的必要条件。

## 进度与验收边界

以下是 **2026-11-14 的固定版本记录**，不是对未来提交的自动认证：

| 证据版本 | 已验证内容 | 仍不能据此认定 |
|---|---|---|
| `035efc0` | 独立复跑 27 项解析、31 项单元测试及 quick 启动回归通过；quick 在软件图形环境耗时约 86 秒 | 完整路线 E2E、全部美术机位或目标设备性能通过 |
| `c5f69f4` | 9 张独立运行截图；加速自动路点去程与返程通过，附约 325 秒连续录像 | 新版已经全套通过，或正常速度手动真机验收通过 |

独立验收目前**尚未通过完整交付标准**：植被自然度、材料变化与雾中层次仍需改进；Mac／手机的目标设备长采样与 p95 帧耗时尚待提交。历史 T4 测量见开发记录，不能直接换算为手机表现。

[独立验收 JSON](https://temple-atlas-research.floralpage64.chatgpt.site/t00-audit.json) 包含截图、录像、版本及逐项结论。生成概念图、历史运行截图、源码实现与目标设备测试是不同证据；不要互相替代。

## 协作方式

欢迎通过 Issue 讨论问题，通过分支或 fork 提交 PR。公开仓库不自动给予所有人写权限；需要直接写权限的协作者由维护者单独邀请。

开始前阅读：

- [docs/HANDOFF.md](docs/HANDOFF.md)：开发交接与历史记录。
- [docs/ART-SPEC.md](docs/ART-SPEC.md)：美术规范与实现对照。
- [docs/JINGSHAN.md](docs/JINGSHAN.md)：原型调研及取舍。
- [docs/VISION-AND-RESEARCH.md](docs/VISION-AND-RESEARCH.md)：项目定位。
- [T00 Goal、参考图与验收文件索引](https://temple-atlas-research.floralpage64.chatgpt.site/llms.txt)：交给 Claude／Fable 时，按读取顺序实际打开图片，并核对仓库 HEAD。

提交改动时，请说明问题、修改范围和验证结果。画面改动附相同机位、季节、时辰、画质、尺寸和视角的运行截图；性能改动附设备、运行时、原始数据和测量方式。记录截图对应的提交，不把参考效果图当作实机结果。

当前协作保护仍待完善：`main` 尚未启用分支保护，尚无 PR 合并前 CI。建议配置 PR 审查和必需检查；这属于待办，不能假定已经启用。

## 自动部署

[Pages 工作流](.github/workflows/pages.yml) 在 `main` 的 `app/**` 或工作流自身发生推送变更时，以及手动触发时运行：解析、单元测试和 quick 通过后部署。**仅修改 README 不会触发该部署工作流。**

[完整 E2E 工作流](.github/workflows/e2e.yml) 配置了每周计划和手动触发；配置存在不等于每个提交都已跑过完整套件。实际结果以 [Actions](https://github.com/bolechen/temple-walk/actions) 中对应提交的记录为准。

## 安全与素材许可

2026-11-14 对基线 `035efc0` 的完整可达历史 33 个提交及当前目录运行 Gitleaks v8.30.1，未检出规则命中的常见密钥。这是限定范围的扫描结果，不代表所有外部服务与依赖都已完成安全审计。不要提交 `.env`、账号令牌、私钥、云服务凭据或包含这些内容的日志。

测试／截图／GPU 作业工具的临时静态服务器曾有目录边界检查不足、无效 URL 编码异常及未限定监听地址的问题，已修复：路径在 `app/` 内解析并校验、无效编码返回 404、只监听 `127.0.0.1`；`tests/unit/serve.test.mjs` 对越界路径和坏编码有回归测试，`npm run serve` 也只绑定本机。影响只在开发工具服务器，与 GitHub Pages 静态托管无关。

许可须按资产分别处理：

- **项目代码**：根目录尚无项目 LICENSE，许可待维护者明确；不要因仓库 public 就推定已有统一开源许可。
- **佛像模型**：不在本仓库里。`pnpm install` 时由 `tools/setup.mjs` 从如是我闻 `/zen` 场景的 CDN 取回原始文件（约 3.9 MB，带校验和）到 `app/levels/t00/models/`；该目录被 Git 忽略。模型仍随 GitHub Pages 发布，授权依据仍需所有者确认或替换，不能将原站可下载视作授权。旧提交的 Git 历史里仍有转换过的副本。
- **扫描贴图**：来源与生成方式见 [tools/textures.py](tools/textures.py)，当前记录为 Poly Haven CC0。
- **字体**：本地子集、来源及相关许可见 [tools/fonts.py](tools/fonts.py) 和 [app/shared/fonts/OFL.txt](app/shared/fonts/OFL.txt)。
- **Three.js 与扩展**：由 pnpm 管理（`three@0.186.0`，MIT），安装时拷到 `app/vendor/three/`（Git 忽略），其 LICENSE 一并拷入。
- **参考图片与其他素材**：保留来源、作者、版本和用途记录；不能笼统由项目代码许可覆盖。

删除当前文件不等于移除 Git 历史中的内容。若发现真实凭据，先撤销或轮换，再按影响范围处理历史；如发现安全漏洞，请避免在公开 Issue 中贴出凭据、个人数据或真实敏感文件内容。

## 代码结构

| 文件／目录 | 内容 |
|---|---|
| `app/index.html`、`app/yard.js` | 界面、场景组装、行走、相机、画质与转场 |
| `app/src/building.js`、`site.js`、`geo.js` | 参数化建筑、总平面、台阶、台地和碰撞 |
| `app/src/interior.js` | 八座可进入的 3D 房间及待补剧情画框 |
| `app/src/materials.js`、`textures.js`、`ground.js` | 材质、扫描细节、铺地与局部倒影 |
| `app/src/bamboo.js`、`trees.js`、`backdrop.js` | 近景植被和远景环境 |
| `app/src/sky.js`、`mood.js`、`props.js`、`post.js`、`drift.js` | 天光、季节时辰、器物、后期和飘落物 |
| `app/src/monk.js`、`journey.js`、`game.js`、`hints.js` | 沙弥、朱印、交互与情境提示 |
| `app/src/card.js`、`goshuin.js`、`plaque.js`、`audio.js` | 分享卡片、印章、匾额与合成声音 |
| `app/levels/t00/` | 序章这一关自己的资源：`textures/` 扫描贴图、`gallery/` 殿内真迹图片、`boards/` 匾额取字、`models/` 佛像（不入库，安装时取回） |
| `app/shared/fonts/` | 各关共用的字体子集 |
| `app/vendor/three/` | three.js（不入库，由 pnpm 安装后拷入） |
| `package.json`、`pnpm-lock.yaml`、`tools/setup.mjs` | 依赖与安装后的准备步骤 |
| `tools/`、`tests/` | 截图、GPU 渲染及测试工具 |
| `refs/`、`docs/` | 视觉参考、研究与开发记录；参考图不是测绘或验收证明 |

单位为米，北向为 `-Z`。具体相机和建筑参数以当前源码为准。

## 下一步

1. 补齐资产许可（开发工具服务器的边界与监听问题已修）。
2. 配置 PR 检查与分支保护，明确贡献和项目许可。
3. 改善植被重复感、近景材质及雾的前中后景层次，提交固定机位对照图。
4. 完成当前版本正常速度往返走查及目标设备性能测量。
5. 继续核对斗拱、梁架、檐口、器物与构图；优先完善已实现区域，再扩展剧情与天气。

其他实现差距与参考见 [Saltline 对照](docs/SALTLINE-TEARDOWN.md) 和 [水彩表现对照](docs/WATERCOLOUR-TEARDOWN.md)。

## 可复用的独立评审 Skill

[评审流程与采用说明](docs/REVIEW-PROCESS.md) · [Skill规范](skills/temple-review/SKILL.md) · [自审与最佳实践依据](skills/temple-review/references/protocol.md)

```sh
python3 tools/install-review-skill.py --client both
```

Claude Code调用 `/temple-review`，Codex调用 `$temple-review`。其他项目可复制Skill或指定`--root`，并填写自己的仓库、授权范围和验收配置。安装器会保留有差异的本地版本，除非显式使用`--replace`。

评审锁定提交，按改动选检查，串行运行图形验证，区分实际用户操作与诊断hook；功能、视觉、性能与发布分别形成带证据的结论。历史截图保留原提交，修复后复测才能关闭问题。结构校验通过不代表美术或游戏整体通过。

图形验证确有需要时可以使用商业Hugging Face Jobs；创建前核对费率、额度与预算，限制时长和作业数量。PRO不是无限免费GPU，T4结果也不代替Mac或手机测试。纯文档更新无需启动GPU。

## 提交与合并规范

后续 PR 统一 **Squash and merge**；新提交、PR 标题及最终 squash 提交标题使用 **Conventional Commits**。示例：`feat(loading): 增加首屏加载进度`。详见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [代理协作规则](AGENTS.md)。

## 版本与发版

使用 [Release Please](.github/workflows/release-please.yml) 根据 Conventional Commits 维护版本PR、`CHANGELOG.md`、标签与GitHub Release，以 **0.1.0** 接入。当前版本见 [package.json](package.json)，操作与权限说明见 [发版流程](docs/RELEASING.md)。版本PR仍使用 squash 合并；GitHub Pages试玩部署独立运行。

### 开发交付与研究站联动

Claude 等开发者随 PR 更新交付记录；合并后 GitHub Actions 自动生成状态，研究 Site 读取最新交付、测试、部署和独立评审。测试通过不等于美术验收通过。详见[联动流程](docs/SITE-SYNC.md)。
