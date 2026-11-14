# temple-review Skill

将按提交独立评审、证据追溯、功能/视觉/性能/安全分层结论与授权发布流程打包，供项目协作者复用。入口为 [SKILL.md](SKILL.md)。规范和脚本不包含模型、贴图、账号或项目机密。

在本仓库根目录运行：

```sh
python3 tools/install-review-skill.py --client both
```

Python需3.9+。Claude Code使用`.claude/skills/temple-review`，调用`/temple-review`；Codex使用`.agents/skills/temple-review`，调用`$temple-review`。可只选`--client claude`或`--client codex`。已有目录与源包不同时安装器会拒绝覆盖；先比较，需要时显式`--replace`。

其他项目可复制本目录到对应客户端的skills目录，或使用安装器`--root <目标项目>`。先替换references/project.example.json的项目地址、测试命令、授权范围和性能目标。客户端是否自动发现及权限能力以实际版本为准；普通聊天窗口可直接附整个包并要求按SKILL.md执行，不能声称已安装工具。

建议先生成本地报告；只有用户授权才同步站点。报告格式见references/review-template.json，初始空模板必须填写才能验证。validator拒绝没有当前提交证据的pass，不会替你看图或测性能。

```sh
python3 skills/temple-review/scripts/validate_review.py review.json --root path/to/evidence
```

轻量结构自检与失败案例测试见`scripts/test_validate_review.py`。本Skill未单独为整个游戏、第三方素材或外部工具授予许可，相关许可仍分别处理。
