# 发版流程

**main 自动上 canary，发版才上生产（所有者 2026-11-19，#308）。** 推送到 `main`，过了 `pages.yml` 的检查（解析与类型、两套单测、建站与 `boot`、走路与镜头的快检 `stairs`、`drop`）就部署到 canary，先在那里玩；合并版本 PR、打出 `vX.Y.Z` 标签之后，才把那个版本部署到生产。生产只从版本标签构建，Steam / 平台版也从标签打包。

- **canary**：<https://temple-walk-canary.bole-chen.workers.dev>（Worker `temple-walk-canary`，配置 `wrangler.canary.jsonc`）。不加访问限制，只是不公开：页面带 `noindex`，Worker 回 `X-Robots-Tag: noindex, nofollow`，不放访问统计，调试面板默认打开（和 PR 预览一样，`?debug=0` 关）。
- **生产**：`temple.rushiwowen.co`，只从 `vX.Y.Z` 标签部署（`deploy-tag.yml`，`target` 选 `production`，默认）。

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

三种构建目标，由环境变量 `VITE_DEPLOY=production|canary|preview` 在构建时定下（`app/src/deploy.js`，`vite.config.mjs` 里一处读取；没设时取 `preview`，所以漏写 production 只会少一个统计，不会反过来）：

| 目标 | 谁构建 | 去哪 | 统计 | 搜索引擎 |
|---|---|---|---|---|
| `production` | `deploy-tag.yml`，从标签 | Worker `temple-walk`（`temple.rushiwowen.co`） | 有（Umami，仅此一个构建带） | 可收录 |
| `canary` | `pages.yml` 的 `site`，main 的推送 | Worker `temple-walk-canary` | 无 | `noindex` |
| `preview` | `pages.yml` 的 `site`，PR | `temple-walk-preview` 的 PR 预览 | 无 | `noindex` |

`pages.yml` 在站点改变时验证 `main`：`verify` 汇总 `unit`、`grid`、`site`（建站与 `boot`）和 `quick`（`stairs`、`drop`，各占一台机器，与 `site` 并行），`deploy`（canary）等 `verify` 和 `quick`。只改文档的推送什么都不建、不发。夜间全量仍测 `main`。

**发版即上线。** 对外分享、或要让一个修复让玩家玩到，都靠发版：版本 PR 随时可合，看过 canary 觉得好就立刻合。合并后 `release-please.yml` 在打出标签的同一次运行里调用 `deploy-tag.yml`（`target: production`）（默认令牌打的标签不会触发别的 workflow，所以由它按 `release_created` 输出接着调用），从标签构建、跑一次 `boot`、部署到生产，并把线上首页与刚建好的首页比哈希。

## 出事先回滚，再修

1. 打开 Actions → **Deploy a version tag** → Run workflow（`deploy-tag.yml`）：`ref` 填要回到的标签（如 `v0.4.0`；必须是 `vX.Y.Z` 标签，分支和提交号会被拒绝），`target` 选 `production`（线上）或 `canary`（内部 Worker，用来演练，不碰玩家），点运行。它从那个标签自己的代码建站（可取消勾选 `check` 以略过 `boot`、求最快），部署到所选的 Worker，把线上首页和刚建好的首页比哈希，写进运行摘要。`dry_run` 勾上则只建站、检查、打印「要把哪个标签部署到哪个 Worker」，不部署。
2. 去生产的运行用 `production-deploy` 队列，去 canary 的与 `pages.yml` 共用 `pages-canary` 队列，同一时刻每处只有一个部署；排队中的运行会被更新的排队顶掉，看到「已取消」就再点一次。
3. 回滚不改 `main`，也不动标签和版本；`main` 继续往 canary 走。生产停在那个标签，直到下一个版本标签。要把修好的版本放上去，就合版本 PR。
4. 要回到最新版本，用同一个入口，`ref` 填最新标签。

官方说明：[Release Please Action](https://github.com/googleapis/release-please-action)、[manifest配置与初始化](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)。
