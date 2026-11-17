# 项目协作规则

本规则适用于本仓库的所有开发者与代码代理。提交与合并细则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

- 后续所有 Pull Request 统一使用 **Squash and merge**。一份 PR 在主线上形成一条提交；不要选择 merge commit 或 rebase merge。
- 新增 Git commit message、PR 标题、最终 squash 提交标题均使用 **Conventional Commits**：`<type>[optional scope][!]: <description>`。描述可以使用中文。
- 最终 squash 提交标题使用通过检查的 PR 标题；合并前确认摘要与最终实现一致，按改动完成验证并记录未验范围。
- 本规则自采用后生效，不为调整提交格式而改写已发布的主线历史。

示例：`fix(camera): correct trackpad look direction`、`feat(loading): 增加首屏加载进度`、`docs: clarify contribution rules`。

- 版本由Release Please管理；版本PR同样使用Conventional Commits标题与squash合并。版本、manifest和变更日志一起维护，操作与权限边界见[docs/RELEASING.md](docs/RELEASING.md)。

## Site 联动与交付

每轮交付更新 [docs/t00/delivery.json](docs/t00/delivery.json)，记录变更、已知问题和证据；遵守 [docs/SITE-SYNC.md](docs/SITE-SYNC.md)。CI 和部署状态由工作流生成，不手写成功。Claude 等开发者不得自行把独立验收改为通过；独立报告绑定完整提交 SHA。`site-status` 是持久数据分支，不按临时分支清理。

## 与研究 Site 的关系

研究 Site（<https://temple-atlas-research.floralpage64.chatgpt.site/>，下称 Site）是《山门之外》的研究图集和对外的进度、验收看板，本仓库是 T00 的实现。两边的分工：

- **Site 出研究和最初的交接**：径山寺的调研、T00 交接包（目标、八项交付物、六个机位、八条验收标准）、美术规范的出处、参考图，以及独立评审的报告（`t00-audit.json`）。T00 交接包的原文以 Site 的 `llms.txt` 为入口。
- **仓库出实现和证据**：代码、`delivery.json`（开发方陈述）、`independent-review.json`（评审方维护）、`docs/t00/evidence/`。
- **单向同步**：main 更新后，`site-status.yml` 把交付、真实 CI、部署和独立评审汇成 `site-status` 分支的 `status/t00.json`，Site 打开时读取。仓库不改 Site，也不持有 Site 凭据；Site 不往仓库写。细则见 `docs/SITE-SYNC.md`。
- **之后的需求以仓库为准**：交接包之后用户提出的需求和所有者的决定记在 `docs/handoff/LATEST-GOALS.md`（下节），每一件具体的事是一个带验收标准的 issue。Site 的 `llms.txt` 指回这两处。

## Issue 与验收标准

每个要做的事是一个 issue，每个 issue 都有独立的验收标准。用 `.github/ISSUE_TEMPLATE/goal.md` 开，五节缺一不可：

1. **背景**：谁、哪天、锁定哪个提交、怎么复现；用户或所有者的原话照录。
2. **目标**：做完以后玩家看到、听到、能做的是什么。
3. **验收标准**：可勾选的清单，每条都能由不是实施方的人照着检查，给出机位、命令、数值或对照图。「好看」「自然」不算一条，要写成在哪个机位、和什么比、看什么。
4. **不在范围内**：防止一个 issue 越做越大。
5. **关闭条件**：谁在什么提交上复核后关闭。实施方只能标 `fixed_pending_retest`，不能自己关。

另外：

- 大的目标可以写成仓库里的目标文件（如 `docs/t00/structure-goal.md`），issue 链到它，但验收标准仍要在 issue 或目标文件里写全，不能只写「见评审」。
- PR 用 `Closes #n` 或 `Refs #n` 链到 issue，PR 说明逐条对验收标准写「过 / 没过 / 没验」和证据路径。
- 用户在对话里提的需求，由主创开 issue（或改已有 issue 的验收标准）并同一轮写进 LATEST-GOALS；没有 issue 的需求不交给开发。
- 主创评审时先查 issue 是否五节俱全，缺的补上再评。

### 标签

**谁开 issue，谁在开的时候打标签**（所有者 2026-11-16 定）：主创、各评审线、开发方都一样。漏打的，主创评审时补上并提醒。只用下面这几个，不另造；确实不够用时先问主创：

- **线**（至少一个）：`景观`（山、林、云、天、雪、光和色调）、`建筑`（木构、台阶、殿内陈设、井）、`角色`（小沙弥）、`镜头`、`交互`（输入、行走、界面）、`发行`（上架、授权、版本）。
- **类**（一个）：`bug`、`feature`、`review`（只评审或只交证据，不改游戏）。
- **状态**（需要时）：`待所有者定`（卡在所有者的一个决定上）、`有前置`（要等另一个 issue 或 PR，正文里写明等哪个）。状态变了就摘掉。

景观是第一卖点（`docs/handoff/LATEST-GOALS.md`），排期有冲突时 `景观` 的先做。

### 谁派活，谁合并

所有者 2026-11-16 定：

- **主创派的活直接接。** 主创派给各开发、评审对话的任务，不必再等所有者确认。
- **PR 能不能合并由主创判断。** 主创评审通过即可 squash 合并：对应 issue 的验收标准逐条有证据、CI 通过、与 main 无冲突、评审意见已贴在 PR 上。开发方仍然不自己合并、不自己关 issue。
- **仍然要所有者点头的**：发版（Release Please 的版本 PR）；要花钱的（购买插件、订阅、超出已说明额度的 GPU）；标了 `待所有者定` 的取舍（画面方向、轮廓变化、文案定稿这一类）；issue 的关闭条件写明「所有者看过后关闭」的，合并可以先做，关闭仍等所有者；独立评审的结论谁也不能代改。

### 合入 main 之后重测什么

所有者 2026-11-17 问：变基时大半工夫花在重跑上，能不能省。主创定：

- **不落后就不必合 main。** PR 的 `verify` 跑的本来就是「本分支 + 当时的 main」合起来的结果（`pull_request` 检出的是合并提交）。只有 GitHub 报冲突，或主创说 main 上进了与本 PR 同一处的改动时才合 main；合并用 `git merge`，不变基。
- **合了 main 只重跑有交集的。** 先看 main 带进来什么：`git diff --name-only <合入前的 main>..origin/main`。
  - 只带进文档、证据、`tools/` 里与本 PR 无关的脚本：**什么都不重跑**，等 CI 的 `verify`（检查、类型、单测、构建、`boot`，约三分钟）变绿即可。
  - 带进了 `app/` 的改动：只重跑与**本 PR 改到的文件或同一条线**有关的场景（例如两边都动了镜头，才重跑 `director`）；没有交集的同上。
  - 不在本地重跑整套 `pnpm run verify` 或 smoke：软件渲染一趟九分钟，交给 CI。要整套或某几个场景在分支上跑一遍，用 Actions 里「End to end, every scenario」的 Run workflow 选本分支（四台机器分摊），把运行链接贴进 PR。
- **T4 证据不因合 main 重拍。** `report.json` 的 `site` 指纹说明图是哪个提交画的；只有 main 带进来的改动会改变这些画面或帧耗时才重拍，否则在 PR 里写一句「证据在 <提交> 上，其后只合入了 <哪些 PR>，不影响画面」。
- **PR 正文里的测试结果写明是哪个提交上跑的。** 主创合并时核的是：最终提交的 CI 绿、无冲突、各项证据所在的提交之后没有会推翻它的改动；不再要求「在最终提交上全部重跑」。
- **合并之后有兜底。** 进 main 的每次推送都跑 `verify`，动了 `app/` 的还跑 `edges`、`nearplane`、`stairs`、`drop`；红了由合并它的人（主创）当场处理：能修就修，不能就回退那一个 PR。
- `docs/HANDOFF.md`、`docs/t00/SOURCES.md` 在 `.gitattributes` 里设了 `merge=union`：两边各加各的段落和行时，本地 `git merge` 不再报冲突（合完看一眼有没有重复行）。`delivery.json` 是 JSON，不这样合；冲突时两边的行都留下。

### 改形体的，从几个方向看

改了一件东西的**形体**（建筑构件、树、器物、殿内陈设、人物模型）时，证据除了玩家平时看到的视角，还要有同一件东西的**正面、侧面、俯视或斜俯视**三张，改前改后各一套，同一提交、同一季节时辰、同一距离。只从一个好看的角度验，另一面的穿插、悬空、接缝就看不到（2026-11-16 的例子：静坐悬空 10 厘米只在侧面看得出；吃茶机位的黑瓶只在机位上才挡人）。

- 写 issue 时，形体类的验收标准里列出这三个方向各用哪个地址（`?cam=x,z,yaw,pitch` 或命名机位）；人物用 `node tools/portrait.js`（它本来就出正、侧、背）。
- 机位和构图类的改动，换成**几种画幅**：16:9、4:3、手机竖屏各一张。
- 只改颜色、材质、光、声音、文案的不需要；这条不是每个 PR 都要交三张图。
- 出处：《小王子：星辰之旅》作者的制作说明（先定主视图，再补俯视定布局、斜视定高低，每轮从正面和侧面截图对照），经第三方镜像读到，配图未见。

## 目标记录

[docs/handoff/LATEST-GOALS.md](docs/handoff/LATEST-GOALS.md) 是用户需求和所有者决定的记录，研究 Site 和独立评审按它判断"要的是什么"。

- **由主创（游戏主创与上线前评审）维护。** 用户在对话里提出一条需求，或在评审里拍板一个取舍，主创在同一轮把它写进 LATEST-GOALS，和对应的 issue、目标文件同一个提交，不留到以后补。
- 开发方不改 LATEST-GOALS：完成情况写 `delivery.json` 和 `docs/HANDOFF.md`，不把"做到了什么"写成"要做什么"。
- 它只写需求和去哪里看状态，不写完成；是否在线以实时 JSON 和完整 SHA 为准。被取代的需求就地改写并注明取代了什么、依据是谁哪天的话。
- PR 改了 `docs/t00/*-goal.md`、`docs/t00/decisions.md` 或 `docs/PHOTO-MODE.md` 而没改 LATEST-GOALS 时，预览评论会提醒一行（`tools/preview/comment.cjs`），不拦合并。
- 主创每次评审先对一遍：`docs/HANDOFF.md` 里新出现的「所有者定」「用户要求」，LATEST-GOALS 里没有的当场补上。
