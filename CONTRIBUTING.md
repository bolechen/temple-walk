# 协作与提交规范

## 统一 squash 合并

后续 PR 一律使用 **Squash and merge**，主线保留每份 PR 的一条完整变更记录。合并前整理 PR 标题与说明，使其描述最终实现、原因、验证及未验范围；最终 squash 提交标题与 PR 标题一致。

命令行合并示例：

```sh
gh pr merge <PR编号> --squash
```

通过 GitHub API 或代理工具合并时，显式指定 `merge_method: "squash"`，并核对预期 PR head SHA。不要使用普通 merge 或 rebase merge。

## Conventional Commits

新增提交信息和 PR 标题使用：

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

类型使用小写。常用类型：`feat`（功能）、`fix`（修复）、`docs`（文档）、`style`（格式）、`refactor`（重构）、`perf`（性能）、`test`（测试）、`build`（构建）、`ci`（持续集成）、`chore`（维护）、`revert`（回退）。scope 可省略，适合填写 `camera`、`loading`、`t00` 等模块；描述可用中文或英文，简洁说明实际变化。

```text
feat(loading): 增加首屏加载进度
fix(camera): correct trackpad look direction
docs: clarify contribution rules
feat(save)!: replace the save format

BREAKING CHANGE: describe the migration required by the new save format.
```

破坏性变更使用 `!` 或正文中的 `BREAKING CHANGE:` footer，说明影响与迁移方式。分支内新增提交也遵守相同格式。

[PR 标题检查](.github/workflows/pr-title.yml)在 PR 新建、编辑或更新时检查格式；合并者仍须确认 squash 方式及最终提交标题。仓库设置建议仅保留 squash，并使用 PR 标题生成提交标题、PR 正文生成提交正文；实际开关以 GitHub Settings 为准。

规范来源：[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)。规则自采用后生效，不改写已发布历史。

## 发版

版本由Release Please管理，接入基线为0.1.0。机器人创建的版本PR也使用Conventional Commits标题和squash合并；评审确认后合并，workflow再创建标签与GitHub Release。不要绕过版本PR手改版本或直接打发布标签。详见[发版流程](docs/RELEASING.md)，尤其注意默认GITHUB_TOKEN创建的PR不会自动触发其他Actions。

## 向研究 Site 同步

每轮开发同时更新 `docs/t00/delivery.json` 并随 PR 提交。main 合并后，GitHub 自动将交付、实际 CI、部署和独立评审数据同步给 Site，无需 Site 发布权限。详见[自动同步与证据规则](docs/SITE-SYNC.md)。

## PR 预览

改到网站的 PR 通过检查后会自动得到独立预览地址，PR 评论里有最新地址、本提交固定地址和六个验收机位链接；反馈视觉问题时请用固定地址。详见[PR 预览](docs/PREVIEWS.md)。
