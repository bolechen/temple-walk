# 独立评审与协作

《山门之外》评审流程 v1.0（2026-11-14）。规范的唯一维护入口是 [temple-review Skill](../skills/temple-review/SKILL.md)，本页说明如何采用；[流程自审与官方资料](../skills/temple-review/references/protocol.md)记录取舍。

## 使用

```sh
python3 tools/install-review-skill.py --client both
```

Claude Code调用 `/temple-review`；Codex调用 `$temple-review`。也可仅安装一个客户端；其他项目用 `--root <项目目录>`，并替换[配置示例](../skills/temple-review/references/project.example.json)。安装不运行游戏、不创建任务、不上传素材或获得账号权限。

1. 固定源码提交和上次报告，按改动选择检查，结束前单列最新HEAD。
2. 隔离凭据，先静态检查；浏览器/截图/性能检查串行。保存首次失败，诊断重试不能替代验收。
3. 分别核对实际输入、画面、目标设备性能、安全与素材，不以代码或开发者声明代替运行证据。
4. 报告关联提交、环境、原始文件哈希与稳定问题ID；修复需复测才能关闭。
5. 校验报告后同步已授权站点，发布同一源版本并读回；失败保留上次有效报告。

## 何时需要GPU

文档改动无需GPU。图形验证受软件渲染干扰时，可按已有授权采用商业HF Jobs。PRO不是无限免费GPU：创建前核对当前费率、正余额和配置，显式timeout、限制单作业，记录费用与job ID。[HF策略](../skills/temple-review/references/protocol.md#按需真实gpu--hugging-face-jobs)提供默认预算护栏，其他项目需自行配置。T4不能替代Mac或手机验收。

现有GPU脚本未完整携带内殿模型，必须检查预期资源清单，不得将忽略404后的外景诊断称作完整验收。

## 本次采用情况与边界

- 新Skill包含结构化报告模板、证据校验器、跨客户端安装器和失败案例测试。
- 旧站点进度/审计仍为legacy格式；保留原始提交与历史结论，不把旧图改写成新提交证据。后续新评审先生成v1报告，再派生页面摘要；展示适配尚需逐次迁移。
- 现有六小时定时任务引用同一Skill；保存任务不代表无人值守环境已验证，首次成功的读取、执行、发布和线上读回后才能确认完整链路。
- 本轮只更新文档和评审工具，不新增游戏运行或目标设备性能结论，也不自动修复已记录的开发服务器和素材许可问题。
- 复用Skill不授予整个游戏或第三方资产许可，仓库公开与许可证分别处理。

本地检查：`python3 skills/temple-review/scripts/test_validate_review.py`。脚本通过只说明所测证据一致性与安装行为符合预期，不能证明游戏质量。
