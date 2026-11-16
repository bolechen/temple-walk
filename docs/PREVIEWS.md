# PR 预览

同一仓库发起的 PR，每次推送（只改文档的也算）通过检查后都会部署一次，得到一个独立的预览地址，方便合并前在 Mac 和手机上看画面。正式站点是 Cloudflare Worker（<https://temple.rushiwowen.co/>），预览不影响它。

## 地址

PR 里有一条机器人评论，每次推送后原地更新，写的总是 PR 的最新提交。2026-11-16 之前 `pages.yml` 对 PR 设了 `paths` 过滤，只改文档或交付材料的推送不触发运行，评论和「最新地址」就停在更早的提交上；现在去掉了过滤，代价是只改文档的推送也要跑一遍检查、构建和 `boot`（几分钟）。被更新推送取消的运行不部署也不评论。

- 最新地址 `https://pr-<编号>-temple-walk-preview.bole-chen.workers.dev`：始终是这个 PR 最近一次成功部署的版本。
- 本提交固定地址 `https://<部署号>-temple-walk-preview.bole-chen.workers.dev`：只对应一个提交，之后推送也不会变。截图、反馈问题和评审请用这个地址，并写上完整提交号。
- 六个验收机位：按 `docs/t00/camera-manifest.json` 生成的固定机位链接（J01 夏·昼），带 `debug=0`，看画面时不出调试面板。

预览地址默认打开调试面板（`app/src/debug.js`：位置、帧耗、季节时辰、机位跳转、各部分开关），反引号键收起或展开，地址加 `?debug=0` 则不打开。本地 `pnpm dev` 也默认打开。正式站点不加载它。

检查或部署失败时，评论会写明这个提交没有部署，并说明「最新地址」仍是哪个旧提交。预览只用来看效果，不代表 CI 全过、目标设备性能或独立验收。workers.dev 预览带 `X-Robots-Tag: noindex`，不会被收录。

## 流程

1. `pages.yml` 的 `verify` 照常执行检查、单测、构建和 `boot` 场景；PR 来自本仓库时，把同一份 `dist/` 交给 `preview` 作业。
2. `preview` 用 `wrangler preview --name pr-<编号>` 上传到 Cloudflare Worker `temple-walk-preview`，再更新 PR 评论和运行摘要。
3. PR 关闭（合并或放弃）时，`preview-cleanup.yml` 删除这个预览及其全部固定地址，并在评论里说明。

来自 fork 的 PR 拿不到 Cloudflare 令牌，不会得到预览。

## 费用与限额

只托管静态文件：请求静态资源不收费、不限量，存储不收费，不用 R2、KV 或 Workers Builds（Cloudflare 文档 *Static Assets · Billing and Limitations*，2026-11-12 版）。免费档每个 Worker 最多 100 个预览、每个预览最多保留 100 次部署，超出时 Cloudflare 自动删掉最旧的。当前构建约 87 个文件、22.5 MiB，最大单文件 3.2 MiB，远低于免费档每版本 20,000 个文件、单文件 25 MiB 的上限。

## 配置与维护

- `wrangler.jsonc`：Worker 名、`dist/` 静态资源，`workers_dev: false`，`preview_urls: true`，以及空的 `previews` 块（`wrangler preview` 要求有这个块）。
- Worker 必须先有一个生产版本，预览地址才会路由（否则返回 Cloudflare 错误 1042）。目前的生产版本是一页说明文字，`workers_dev` 已关闭，外部访问不到。不要在 CI 里对这个 Worker 运行 `wrangler deploy`。
- 仓库 Secret `CLOUDFLARE_PREVIEW_TOKEN`：账户级令牌，权限只有 Workers Scripts Write；Variable `CLOUDFLARE_ACCOUNT_ID`：账户 ID。可以在 Cloudflare 后台换成只作用于 `temple-walk-preview` 的 “Individual Workers Admin” 令牌，用同名 Secret 覆盖即可（OAuth 登录不能通过 API 创建这种单 Worker 令牌）。
- 手动删除某个预览：`npx wrangler@4.162.0 preview delete --worker-name temple-walk-preview --name pr-<编号> -y`。
