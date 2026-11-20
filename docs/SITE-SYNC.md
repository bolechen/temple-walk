# Claude 与研究 Site 的交付联动

GitHub 是开发交付与证据的来源；研究 Site 展示状态。无需向 Claude 提供 Site 凭据，也不将任何凭据提交到仓库。

## 每轮开发

1. 阅读研究 Site 的 `llms.txt`、本仓库 `AGENTS.md` 和当前独立评审。
2. 以评审 goal 为目标，更新 `docs/t00/delivery.json`：本轮摘要、实际变更、已知问题、截图/录像/测试报告的仓库路径或公开链接。不能仅写“已完成”。记录属于开发方陈述，不是独立验收。
3. 提交 Conventional Commits PR，说明复现、修改、验证、未验范围，统一 squash 合并。不要手填 CI 成功或自行修改独立验收结论。
4. main 上 Pages CI 并行跑解析与类型、两套单测、建站与 `boot`，全部通过（`verify`）后才部署游戏；「改没改站点」与上次成功部署的提交比（#296）。`stairs drop` 在 e2e.yml 里同时跑，不拦发布。状态工作流在主线更新与 Pages 结束时查询 GitHub 真实结果，发布 `site-status` 分支的 `status/t00.json`。不向 main 回写生成文件，不触发循环。
5. Site 打开 T00 时读取 JSON，打开期间每 60 秒刷新；失败则标记不可更新并保留明确标注的历史资料。GitHub CDN 可能有短暂缓存。关闭网页时，GitHub 工作流仍生成最新数据。

## 状态契约

固定地址：<https://raw.githubusercontent.com/bolechen/temple-walk/site-status/status/t00.json>

- `source.sha`：生成时检查的主线完整 SHA。
- `delivery.record_commit`：交付文档最后变更提交，避免把历史自报当作本次交付。
- `verification`：该 SHA 的 Pages workflow、实际步骤结果及证据链接；scope 仅为 boot、stairs、drop，不代表全游戏或美术通过。
- `deployment.sha`：`pages.yml` 在 main 上**部署那一步（job `deploy`）成功**的最近一次运行的提交；只改文档的运行虽然成功但不部署，不算（#299）。取法与 `tools/ci/changes.cjs` 判断「上次部署」共用 `tools/ci/deployed.cjs` 的 `findLastDeploy`，别各写一份。与 source 不同则显示尚未部署到当前提交。找不到时显示未知，不推测成功。`deployment.target` 是 `canary`：自 #308 起 main 部署到 canary Worker（`deployment.url`），生产只从版本标签部署，看板暂不报生产的标签。
- `independent_review`：独立评审人、完整 reviewed_commit、报告和问题。只有与 source SHA 完全相同才适用于当前版本；旧评审保留但新版本自动显示待复验。

开发者只维护 delivery.json。评审者维护 independent-review.json；主创维护 `docs/handoff/LATEST-GOALS.md`（用户需求与所有者决定，见 AGENTS.md「目标记录」）；此处是协作责任约定，不是仓库写权限隔离。同一源码改动后的旧验收不能自动转为通过。历史 `review-log.json` 不删除。

## 维护、恢复与验收

`site-status.yml` 只需默认 GITHUB_TOKEN 的 contents:write、actions:read；不使用 Site token、PAT、HF 或付费 GPU。不执行来自其他工作流的下载产物。site-status 分支是持续数据源，不得作为临时分支清理。

手动恢复：Actions → Sync T00 status to research Site → Run workflow。若权限受限，检查 Actions 的工作流权限/分支规则；失败应保持失败，不伪造更新。自动任务仅发布当前主线快照，不改 Site 源码。

验收：修改并合并 delivery 记录 → 状态工作流成功 → JSON 的 source.sha 与 main 一致 → Pages 完成后 verification/deployment 正确 → Site 展示同一 SHA；旧评审仍为待复验。网络失败应显示错误，不能出现假成功。运行 `node --test tests/unit/site-status.test.mjs` 验证失败部署、旧评审和证据串版场景。

独立评审由定时任务每天跑一次（新加坡时间 9:00，Opus，读 `skills/temple-review/` v1.1）；评审任务应将结论提交本仓库 independent-review.json，而非反复修改 Site 的进度快照。例行状态更新不重新发布 Site。

## 证据图的位置（#223）

证据的二进制（截图、录像）不再在仓库里，Site 和独立评审不要再按 `docs/t00/evidence/<目录>/<图>` 读图。读法：

1. 目录里的 `MANIFEST.json`（`https://raw.githubusercontent.com/bolechen/temple-walk/<提交>/docs/t00/evidence/<目录>/MANIFEST.json`）列出该目录每个二进制的 `path`、`bytes`、`sha256`、`rev`。
2. 图的地址是基础地址 + `rev` + `/t00/<目录>/<path>`，基础地址在 `tools/evidence.config.json` 的 `base`（R2 桶的公开域名，`https://evidence.dev.rushiwowen.co/`；原本在 Hugging Face，地址是同一文件的 `fallback`，两处路径相同，只是前缀不同）。R2 域名对机房地址（服务器、CI）可能返回验证页（403，`cf-mitigated: challenge`），尤其是录像：这时改用 `fallback` 的地址取同一路径，内容一样，`sha256` 照核。地址钉在数据集的提交号上，内容不会变；取回后可用 `sha256` 核对。
3. README、`delivery.json` 里写的图地址已是完整地址，可直接打开；整目录取回：`node tools/evidence.mjs pull docs/t00/evidence/<目录>`。

已移出仓库的目录以 `MANIFEST.json` 存在为准（逐步迁移时，没有清单的目录仍按旧路径）。

## 为什么「改没改站点」与上次部署比（#296）

main 的发布并发组不取消正在跑的运行，但新排队的会顶掉旧的排队。2026-11-19 12:13，改了 `app/` 的 7c86432 排队中被紧跟的文档提交顶掉（cancelled），最后一个文档提交 39692ee 与它的上一个提交（也是文档）比，判为没改站点，`deploy` 跳过。所以 `tools/ci/changes.cjs` 现在读 Actions 历史，找最近一次 `deploy` 作业成功的运行，与它的提交比；找不到就按改了站点处理。
