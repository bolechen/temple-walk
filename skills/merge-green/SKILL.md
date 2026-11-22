---
name: merge-green
description: 合并一个已经绿了的 PR 之前，main 又往前走了，这个 PR 的旧绿灯还算不算数：用 tools/ci/stillgreen.cjs 判断，算数就直接合，不算数就先让作者合进最新 main 再等新的 CI。适用于主创合并 PR 的步骤。
metadata:
  version: "1.1.0"
  project: "山门之外 / temple-walk"
---

# 合并前：旧绿灯还算不算数

背景（#442）：LESSONS.md 的规矩是「PR 必须合上最新 main，在那个 head 上 CI 绿了才合」（2026-11-21，#357 在较早的 main 上绿，之后 #412 加了一条守卫，#357 正好踩着，合了以后 main 的 unit 红）。每合一个，其余 PR 都得更新分支再跑 5 分钟，几个 PR 只能一个接一个。GitHub 的合并队列对个人账号名下的仓库不开放（`docs/t00/ci-merge-queue.md`），所以合并前用一个脚本判断。

## 步骤

1. 先清消息队列，重读 PR 的 head 和最新评论（LESSONS.md「合并前清空消息队列」）。**最后一条美术结论要看清是「通过」还是「改判：暂不通过」**（#474：改判比合并晚到几十秒）。看得见的改动要有「美术通过」，关卡里的 PR 要有「T00/T05 主创可合」，改了共用代码的要有另一关主创的签字（LESSONS.md「改共用代码的 PR」）。
2. 跑 `node tools/ci/stillgreen.cjs <PR 号>`（要有 `gh`，在 PR 的仓库里）。
3. 看退出码和那一行输出：
   - **0，THE GREEN COUNTS**：这个 PR 的 head 上 `verify` 是绿的，而 main 自从和 PR 分开以来，要么什么也没多，要么多的只是文档（`docs/`、`skills/`、`*.md`），要么多的文件和 PR 改的互不相干、且不是代码、测试、workflow、依赖。旧绿灯算数，直接合（Squash and merge，标题按 AGENTS.md）。
   - **1，RUN IT AGAIN**：main 多了碰得到检查的东西（`app/`、`tools/`、`tests/`、`package.json`、`pnpm-lock.yaml`、`vite.config.mjs`、`.github/`、Worker 与它的配置），或者两边改了同一个文件，或者文件列表长到 GitHub 的比较接口不再列全（300 个）。主创自己点 Update branch（GitHub MCP 的 `update_pull_request_branch`，带 `expectedHeadSha`），告诉作者别往旧 head 推；有冲突时 GitHub 会拒绝，那就让作者自己合 main、解冲突、跑过 verify 再推。等新的 head 上 `verify` 绿了，**再跑一次本脚本**再合（等的时候 main 可能又往前走了）。
   - **2**：这个 head 上还没有绿的 `verify`，没有旧绿灯可算。
4. 脚本只回答「旧绿灯算不算数」，不替代读 diff：绿灯只说明跑过的检查没出问题（LESSONS.md，#414）。
5. `evidence-mirror.yml` 的 `mirror` 不在 `verify` 里，它还在跑或者红了都不挡合并（它只把证据镜像到 R2，夜间全量会再核）。草稿 PR 要先转 ready 再合；转 ready 会重跑 `title` 检查，等它绿。
6. 合并用 squash，带 `expectedHeadSha`，标题和 PR 标题一致、末尾带 `(#PR)`。合完告诉关卡主创和作者，并说明 issue 由谁复验关闭。

## 规则的出处

规则是所有者在 #442 定的；判断在 `tools/ci/stillgreen.cjs` 的 `judge`，改规则要同时改 `tests/unit/still-green.test.mjs`。文档类的路径沿用 `tools/ci/changes.cjs` 的 `PAPER`，站点类的沿用它的 `SITE`。
