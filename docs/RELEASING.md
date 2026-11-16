# 发版流程

当前接入基线为 **0.1.0**，版本由根目录`package.json`与`.release-please-manifest.json`共同记录。Release Please使用`node`策略维护这两处版本及`CHANGELOG.md`。这是浏览器游戏的源码版本流程，保留`private: true`，不发布npm包。

## 日常发布

1. 功能或修复PR按Conventional Commits命名并squash合并到`main`。
2. `Release Please` workflow扫描新提交，创建或更新`chore(main): release X.Y.Z`版本PR，集中展示版本号和变更日志。
3. 评审版本PR，确认变更、版本和测试范围；使用 **Squash and merge**，保留其Conventional Commits标题及发布标签。
4. 合并后workflow创建`vX.Y.Z`标签和GitHub Release，并将发布说明关联到源码版本。流程不自动合并版本PR。

可以在Actions → Release Please → Run workflow手动重新扫描`main`。文档、CI等非发版变更本身不会强行产生新版本；多次提交会汇总到同一个待发布PR。

## 0.x版本策略与首次接入

- `fix: ...`：`0.1.0 → 0.1.1`。
- `feat: ...`：`0.1.0 → 0.2.0`。
- 破坏性变更在1.0之前提升次版本；进入1.0需明确决定，可使用Release Please支持的`Release-As: 1.0.0`提交footer。
- `.release-please-manifest.json`以0.1.0初始化，`bootstrap-sha`界定接入前的历史边界，不把旧历史重新算作下一次发布内容。首次由机器人完成发布后，bootstrap边界不再用于后续扫描。
- 初始0.1.0日志是人工整理的版本基线；本次接入不凭空创建旧日期的标签或声称已有GitHub Release，也不把版本号视为产品验收结论。下一次符合条件的变更才会生成版本PR。
- 日常不手改版本或直接打发布标签；版本文件、变更日志和manifest随版本PR一起更新。需要例外时在PR中说明。

## 权限与检查

workflow将`contents: write`、`issues: write`、`pull-requests: write`限制在发版job，使用固定SHA的Release Please Action。默认使用内置`GITHUB_TOKEN`，无需新增个人令牌。

仓库Settings → Actions → General → Workflow permissions需允许GitHub Actions创建PR。如果日志出现不允许创建PR的403，先开启 **Allow GitHub Actions to create and approve pull requests**，再手动重跑本workflow；不因此把默认令牌的写权限扩散到其他job。

由默认`GITHUB_TOKEN`创建的PR和Release不会自动触发其他Actions。因此机器人版本PR未出现标题/CI检查不等于检查通过，合并前仍须按实际改动验证标题、JSON版本一致性和变更日志。若要自动触发这些检查，可由仓库管理员配置范围适当的`RELEASE_PLEASE_TOKEN` secret（GitHub App安装令牌或PAT），workflow会优先使用它；不要提交令牌，也不要复制临时连接凭据充当长期secret。

## 与试玩部署的关系

`pages.yml`仍在`app/**`改变时验证`main`，通过后把`dist/`发布到 Cloudflare Worker `temple-walk`。GitHub Release是命名的源码版本；试玩网址持续跟随已通过部署验证的主线，不保证与最新发布标签完全相同。仅更新版本文件和日志不会强行重新部署游戏。

官方说明：[Release Please Action](https://github.com/googleapis/release-please-action)、[manifest配置与初始化](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)。
