# 发版流程

**main 自动上 canary，发版才上生产（所有者 2026-11-19，#308）。** 推送到 `main`，过了 `pages.yml` 的检查（解析与类型、两套单测、建站与 `boot`、走路与镜头的快检 `stairs`、`drop`）就部署到 canary，先在那里玩；合并版本 PR、打出 `vX.Y.Z` 标签之后，才把那个版本部署到生产。生产只从版本标签构建，Steam / 平台版也从标签打包。

- **canary**：<https://temple-walk-canary.bole-chen.workers.dev>（Worker `temple-walk-canary`，配置 `wrangler.canary.jsonc`）。内测地址，公开给内测玩家，不加访问限制，只是不被搜索引擎收录。页面行为和生产完全一样（不开调试面板，`?debug`、`?seals`、`?at`、`?play`、`?devpose` 这些工作台参数一律不生效；这些只有 PR 预览才有），只有三处不同：`noindex`（页面 meta 和 Worker 回的 `X-Robots-Tag: noindex, nofollow`）、没有访问统计、版本行显示提交号。
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

**缓存头（#308）**：三种目标的 Worker 发同一份缓存规则，写在一处（`vite.config.mjs` 的 `HEADERS`，构建时写成 `dist/_headers`，Cloudflare 静态资源读它）。文件名由 Vite 按内容带哈希的（`assets/*`）和名字里带指纹的（`shared/doorways/<厅>.<指纹>.webp|png`）设 `public, max-age=31536000, immutable`；`/`、`index.html`、`version.json`（#310 写出）设 `no-cache`（每次确认）；其余按名字取的（`shared/` 的贴图、模型、`walk/t00.bin`，字体，画廊图片，`doorways/t00.json`）不加规则，保持平台默认的 `must-revalidate` 加 ETag。`deploy.test.mjs` 构建三种目标，断言规则相同、`assets/` 下每个文件都带哈希。

**发版即上线。** 对外分享、或要让一个修复让玩家玩到，都靠发版：版本 PR 随时可合，看过 canary 觉得好就立刻合。合并后 `release-please.yml` 在打出标签的同一次运行里调用 `deploy-tag.yml`（`target: production`）（默认令牌打的标签不会触发别的 workflow，所以由它按 `release_created` 输出接着调用），从标签构建、跑一次 `boot`、部署到生产，并把线上首页与刚建好的首页比哈希。

## 出事先回滚，再修

1. 打开 Actions → **Deploy a version tag** → Run workflow（`deploy-tag.yml`）：`ref` 填要回到的标签（如 `v0.4.0`；必须是 `vX.Y.Z` 标签，分支和提交号会被拒绝），`target` 选 `production`（线上）或 `canary`（内部 Worker，用来演练，不碰玩家），点运行。它从那个标签自己的代码建站（可取消勾选 `check` 以略过 `boot`、求最快），部署到所选的 Worker，把线上首页和刚建好的首页比哈希，写进运行摘要。`dry_run` 勾上则只建站、检查、打印「要把哪个标签部署到哪个 Worker」，不部署。
2. 去生产的运行用 `production-deploy` 队列，去 canary 的与 `pages.yml` 共用 `pages-canary` 队列，同一时刻每处只有一个部署；排队中的运行会被更新的排队顶掉，看到「已取消」就再点一次。
3. 回滚不改 `main`，也不动标签和版本；`main` 继续往 canary 走。生产停在那个标签，直到下一个版本标签。要把修好的版本放上去，就合版本 PR。
4. 要回到最新版本，用同一个入口，`ref` 填最新标签。

## 同修留痕的 Worker 与绑定（#340）

页面之外，canary 和生产的 Worker 各多了一段脚本（`worker/`）和一个 Durable Object，只处理 `/api/*`；静态文件仍由 Cloudflare 直接回，不经脚本、不计脚本请求（配置里 `assets.run_worker_first: ["/api/*"]`）。

| 项 | 内容 |
|---|---|
| 接口 | `POST /api/trace`，体 `{ "place", "kind" }`（`place` 取 `worker/trace-core.js` 的 `PLACES`，`kind` 取 `rite`/`seal`，其余 400）；`GET /api/traces?day=today`（或保留期内的 `YYYY-MM-DD`）回 `{ day, traces: { <place>: { rite, seal } } }`，今天的在边缘缓存 30 秒 |
| 绑定 | `TRACES` → Durable Object 类 `TraceCounter`（SQLite 存储，`migrations` 的 `v1` 用 `new_sqlite_classes`），整座寺一个对象（`idFromName("temple")`），表只有 `counts(day, place, kind, n)` |
| 绑定（#341 除夕撞钟） | `JOYA` → Durable Object 类 `JoyaShard`（SQLite，`migrations` 的 `v2`，`v1` 不改），16 个对象（`idFromName("joya:0".."joya:15")`），每个表只有 `joya(year, n)`；`/api/joya` 的 POST 随机落一片，GET 读 16 片的和并在机房缓存 10 秒。部署后第一次运行 `v2` 迁移，令牌要有 Durable Objects 的写权限（同 `v1`） |
| 除夕撞钟的发版与当夜（#341，主创 2026-11-20 定） | **正式版在 12-30 前发出**（带这个功能）。12-31 北京时间 20:00 一到，主创在正式站和 canary 上**不带参数**各真敲一次，确认「今夜已撞 N 声」加一（canary 与正式站各是自己的计数）。窗口外的验证：PR 预览上 `?event=joya&joya=fake:104&at=bell`（页面里的假计数），真 Worker 由 `node tools/worker-smoke.mjs`（workerd + 真 DO，把服务端时钟拨到 12-31 12:00Z 能计数、拨到 1-01 15:00Z 回 403；时钟只能由冒烟用 `--var JOYA_TEST_NOW` 给，任何 wrangler 配置里都没有）和单测担保 |
| 除夕撞钟的回滚预案 | 当夜计数不加、接口报错或压力出问题时，**目标是前端不显示计数那一行，钟照常能敲**。最快（几分钟，不发版）：在 Cloudflare 控制台给正式站 zone 加一条自定义规则拦截路径 `/api/joya`（Block）；页面拿不到数据就不显示那一行、不报错（`joya-ui.js` 的静默，e2e `joya` 验过），撞钟、远钟以外的一切照旧，同修留痕的 `/api/trace` 不受影响。规则由所有者或有控制台权限的人加；问题解决后删掉规则即恢复。次选：按上文用 `deploy-tag.yml` 回滚到上一个版本标签（整版回退，除夕撞钟随之消失）。不要删 `JoyaShard` 的迁移或绑定（删类要另写 `deleted_classes` 迁移，当夜不做） |
| 除夕撞钟合并后在 canary 上验 `v2` 迁移（#341，第一次在真 Cloudflare 上执行） | **一、看部署**：合并后 `pages.yml` 的 `deploy` 作业执行 `wrangler deploy -c wrangler.canary.jsonc`，输出里应有迁移 `v2`（`JoyaShard`）被应用、没有报错。若因令牌缺 Durable Objects 权限而失败：canary 停在上一版（`wrangler deploy` 不会半途换脚本），由所有者在 Cloudflare 给 `CLOUDFLARE_API_TOKEN` 补 Workers Scripts 编辑权限后，在 Actions 里重跑该作业。**二、问接口**（不在窗口内，12-31 之前）：`curl -s https://temple-walk-canary.bole-chen.workers.dev/api/joya?year=2027` 应回 200、`{"year":2027,"total":0,"rounds":0,…}`；`curl -s -X POST -H 'content-type: application/json' -d '{"n":1,"tz":-480}' https://temple-walk-canary.bole-chen.workers.dev/api/joya` 应回 **403**（不是当夜，窗口判断在线上生效）；把 `n` 改成 `9` 应回 400；`/api/traces?day=today` 照旧 200（同修留痕不受影响）。**三、看页面**：canary 不带参数打开，顶上没有计数行（窗口未开），控制台无错误；钟照常能敲。**四、12-31 当夜**：北京 20:00 后主创在 canary 和正式站各真敲一次，顶上的数加一（canary 与正式站各是自己的计数）。**回滚**：只要隐藏计数，就用上一行的 Cloudflare 规则拦 `/api/joya`，不发版。不要在迁移已应用后回退到没有 `JoyaShard` 类的脚本：Cloudflare 要求删类必须另写 `deleted_classes` 迁移（按其 Durable Objects 迁移文档，本账号未实测），否则部署会被拒；要整版回退时保留 `JoyaShard` 的类与绑定，只撤页面的部分 |
| 隔离 | Durable Object 的命名空间属于 Worker：`temple-walk`（生产）和 `temple-walk-canary` 是两个 Worker，计数天然各自独立，没有共用的 id 要配。PR 预览（`wrangler.jsonc`，`wrangler preview`）**没有**这段脚本和绑定，页面也不会在预览里请求接口（`?presence=1` 只给测试和工作台，对预览 Worker 是 404，页面静默）。本地和测试：`node tools/worker-smoke.mjs [wrangler.canary.jsonc]`（`wrangler dev --local`，workerd 加本地 SQLite，不碰 Cloudflare），单测 `tests/unit/trace.test.mjs` 用 `node:sqlite` 跑同一条 SQL |
| 发布 | 只经 CI：`pages.yml` 的 `deploy`（canary）和 `deploy-tag.yml` 照旧执行 `wrangler deploy -c wrangler.<target>.jsonc`，两处的稀疏检出加了 `worker/`；`pages.yml` 多一个 `worker` 作业（上面的本地冒烟），列入 `verify` |
| 首次部署要注意 | 迁移 `v1` 会在第一次 `wrangler deploy` 时创建 Durable Object；`CLOUDFLARE_API_TOKEN` 要有 Workers Scripts 编辑权限（Durable Object 迁移随脚本一起提交，不另需权限；这一点未在本账号上实测，第一次发 canary 时看 `deploy` 作业的输出）；账号要是 Workers Paid（免费档每天 10 万请求，见下） |
| 回滚 | 回滚某个标签会把脚本也回到那个标签的版本；计数表不随版本变，旧页面读不到接口时静默。要整个关掉：把页面的 `presenceOn` 返回 false（下一版），或在 Cloudflare 里给 `/api/*` 加一条自定义规则拦截，页面静默 |
| 可选的边缘限流 | 脚本里的限流是按地点的总量桶加每日上限，不认人（trace-core.js 注释）。想要按来源地址的限流，在 Cloudflare 控制台给 `/api/trace` 加一条速率限制规则（它在边缘自己计数，我们的代码和库里不存任何地址），这要账号权限，CI 做不了，所以只作为可选项 |

**成本，按每日 10 万次访问估一次**（单价取自 2026-11-20 读到的 developers.cloudflare.com 的 Workers 与 Durable Objects 定价页，三个月后重读）：每次访问约 1 次读（页面进入时读当日）加平均 4 次报告（钟、香、茶、句、井、灯、坐、印，每处每页一次，多数访客做不到一半）≈ 50 万次脚本请求一天 ≈ 1500 万一月。
- Workers 请求：含 1000 万/月，超出 $0.30/百万 → (1500−1000)/100 × 0.30 ≈ **$1.5**；CPU 每次几毫秒，在含 3000 万 CPU 毫秒以内。
- Durable Object 请求：含 100 万/月，超出 $0.15/百万 → 约 **$2.1**（今日的读被边缘缓存挡掉大半，写每次一个请求）。
- Durable Object 时长：对象几乎不歇，128 MB × 86 400 s × 30 ≈ 32 万 GB-s，在含 40 万 GB-s 以内：$0。
- SQLite 写：约 1200 万行/月（含主键索引按两倍算 2400 万），含 5000 万：$0；存储每天几十行，可忽略。
- 合计约 **$3.6/月**，在 Workers Paid 的 $5/月基础费之上（账号已是 Paid 则只多这些）。免费档放不下：每天 10 万请求的上限一天就超。静态文件、`/api` 之外的一切不计费。
- 现在的实际量远小于此（`docs/t00/ANALYTICS.md`：每日几十到几百次访问），这份估算是留给「万一出圈」的上限。**花钱的开关在所有者手里**：Cloudflare 里可给 Workers 和 Durable Objects 各设花费上限（官方文档 spend management），超了脚本停、页面静默，不影响走路。

官方说明：[Release Please Action](https://github.com/googleapis/release-please-action)、[manifest配置与初始化](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)。
