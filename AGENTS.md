# 项目协作规则

本规则适用于本仓库的所有开发者与代码代理。提交与合并细则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

- 后续所有 Pull Request 统一使用 **Squash and merge**。一份 PR 在主线上形成一条提交；不要选择 merge commit 或 rebase merge。
- 新增 Git commit message、PR 标题、最终 squash 提交标题均使用 **Conventional Commits**：`<type>[optional scope][!]: <description>`。描述可以使用中文。
- 最终 squash 提交标题使用通过检查的 PR 标题；合并前确认摘要与最终实现一致，按改动完成验证并记录未验范围。
- 本规则自采用后生效，不为调整提交格式而改写已发布的主线历史。

示例：`fix(camera): correct trackpad look direction`、`feat(loading): 增加首屏加载进度`、`docs: clarify contribution rules`。
