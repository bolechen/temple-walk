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

## 合并后自动清理分支

`Clean merged branches`工作流在PR合并关闭后清理来源分支。只处理本仓库分支，跳过默认分支、目标分支、受保护分支以及合并后已有新增提交的分支；关闭但未合并的PR不会触发删除。删除使用预期SHA的Git lease，检查后出现新提交也会拒绝删除。

代码从默认分支读取，不执行来源分支脚本，令牌仅提供给清理步骤；已删除的分支重复清理会跳过。历史已合并PR可在Actions中手动运行该工作流，输入PR编号，沿用相同检查；无需依赖仓库管理开关。权限或lease拒绝时保留错误记录，不盲目重试。
