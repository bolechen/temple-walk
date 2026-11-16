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

## Issue

用户 2026-11-16 定：每个 issue 都要有独立的 goal 和验收标准。

- 一个 issue 只交付一件事，正文写全背景（锁定的提交、原因、复现）、**目标**、**验收标准**（可勾选、能用截图或测试核对）和关闭条件。
- 独立：只读这一个 issue 就能动手、能验收。不写"见另一个 issue""与某 issue 共用"这类验收项；相关的 issue 可以在背景里提一句，但它的验收标准必须在本 issue 里写全，不依赖别的 issue 先完成。
- 拆成几个 issue 时，每个都各写一份；建议的先后顺序写在背景里，不写成验收条件。
