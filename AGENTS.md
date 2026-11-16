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

## 目标记录

[docs/handoff/LATEST-GOALS.md](docs/handoff/LATEST-GOALS.md) 是用户需求和所有者决定的记录，研究 Site 和独立评审按它判断"要的是什么"。

- **由主创（游戏主创与上线前评审）维护。** 用户在对话里提出一条需求，或在评审里拍板一个取舍，主创在同一轮把它写进 LATEST-GOALS，和对应的 issue、目标文件同一个提交，不留到以后补。
- 开发方不改 LATEST-GOALS：完成情况写 `delivery.json` 和 `docs/HANDOFF.md`，不把"做到了什么"写成"要做什么"。
- 它只写需求和去哪里看状态，不写完成；是否在线以实时 JSON 和完整 SHA 为准。被取代的需求就地改写并注明取代了什么、依据是谁哪天的话。
- PR 改了 `docs/t00/*-goal.md`、`docs/t00/decisions.md` 或 `docs/PHOTO-MODE.md` 而没改 LATEST-GOALS 时，预览评论会提醒一行（`tools/preview/comment.cjs`），不拦合并。
- 主创每次评审先对一遍：`docs/HANDOFF.md` 里新出现的「所有者定」「用户要求」，LATEST-GOALS 里没有的当场补上。

## 每个 issue 一份独立的验收标准

所有者 2026-11-16 定：**每个 issue 都要有自己的 goal 验收标准**，不能只写「见某文档」或和别的 issue 共用一份。

- 正文至少有四节：**背景**（现状、原因、复现方法）、**目标**（做到什么样，一两句）、**验收标准**（逐条打勾，每条都要能用测试、数字、截图或指定的命令判定）、**关闭条件**（谁在哪个提交上复核后关闭）。格式见 `.github/ISSUE_TEMPLATE/goal.md`。
- 大的工作线（比如结构修改、美术原型）可以有一份长的目标文件（`docs/t00/*-goal.md`），但每个 issue 仍要把自己那一份验收标准写进正文，并链接到目标文件的对应章节。多个阶段拆成多个 issue 时，每个阶段各有一份。
- PR 按所关联 issue 的验收标准逐条写完成情况；没有做到的写明，不打勾。实施方只能标「已修待复核」，由不是实施方的评审人按同一份标准复核后才关闭。
- 没有验收标准的需求先补标准再开工；主创在同一轮把需求写进 `docs/handoff/LATEST-GOALS.md`（见上一节）。

