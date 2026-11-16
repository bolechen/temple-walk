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

## 目标记录

[docs/handoff/LATEST-GOALS.md](docs/handoff/LATEST-GOALS.md) 是用户需求和所有者决定的记录，研究 Site 和独立评审按它判断"要的是什么"。

- **由主创（游戏主创与上线前评审）维护。** 用户在对话里提出一条需求，或在评审里拍板一个取舍，主创在同一轮把它写进 LATEST-GOALS，和对应的 issue、目标文件同一个提交，不留到以后补。
- 开发方不改 LATEST-GOALS：完成情况写 `delivery.json` 和 `docs/HANDOFF.md`，不把"做到了什么"写成"要做什么"。
- 它只写需求和去哪里看状态，不写完成；是否在线以实时 JSON 和完整 SHA 为准。被取代的需求就地改写并注明取代了什么、依据是谁哪天的话。
- PR 改了 `docs/t00/*-goal.md`、`docs/t00/decisions.md` 或 `docs/PHOTO-MODE.md` 而没改 LATEST-GOALS 时，预览评论会提醒一行（`tools/preview/comment.cjs`），不拦合并。
- 主创每次评审先对一遍：`docs/HANDOFF.md` 里新出现的「所有者定」「用户要求」，LATEST-GOALS 里没有的当场补上。
