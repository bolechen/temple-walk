# 发版流程

**网页持续部署，版本只作里程碑（所有者 2026-11-19，#308）。** 推送到 `main`，过了 `pages.yml` 的检查（解析与类型、两套单测、建站与 `boot`、走路与镜头的快检 `stairs`、`drop`）就上线，不等版本。版本（`vX.Y.Z` 标签）是给人看的里程碑：对外分享前，或大约每周合一次版本 PR；Steam / 平台版从标签打包。版本不决定玩家玩到什么；线上出事，先回滚，再修（见下）。

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

`pages.yml`在站点改变时验证`main`，通过后把`dist/`发布到 Cloudflare Worker `temple-walk`（`temple.rushiwowen.co`）。GitHub Release是命名的源码版本；试玩网址持续跟随已通过部署验证的主线，不保证与最新发布标签完全相同。仅更新版本文件和日志不会强行重新部署游戏。

部署前的检查全部过了才发布：`verify` 汇总 `unit`、`grid`、`site`（建站与 `boot`）和 `quick`（`stairs`、`drop`，各占一台机器，与 `site` 并行），`deploy` 等 `verify` 和 `quick`。只改文档的推送什么都不建、不发。

## 出事先回滚，再修

1. 打开 Actions → **Roll back the live site** → Run workflow（`rollback.yml`），在 `ref` 里填要回到的标签（如 `v0.5.0`）或提交号，点运行。它从那个 ref 自己的代码建站，在浏览器里跑一次 `boot`（可取消勾选 `check` 以求最快），再用同一个 `deploy` 发布，最后把线上首页和刚建好的首页比哈希，写进运行摘要。
2. 它和 `pages.yml` 的发布排在同一个队列（`pages-production`），不会同时发布；排队中的运行会被更新的排队顶掉，看到「已取消」就再点一次。
3. 回滚之后线上停在那个 ref，直到下一次改了站点的推送：那次推送会把 `main` 重新发布。所以先在 `main` 上修好（或还原出事的提交），修的提交合并就会重新上线；只改文档的推送不会改变线上。
4. 回滚不改 `main`，也不动标签和版本；回滚的运行不算 `pages.yml` 的「上次部署」，所以修好之后的那次推送仍会正常建站、发布。

官方说明：[Release Please Action](https://github.com/googleapis/release-please-action)、[manifest配置与初始化](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)。
