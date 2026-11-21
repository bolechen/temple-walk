# GitHub 合并队列（merge queue）对本仓库开不开放（#442）

查于 2026-11-21。

## 结论

**不开放。** 本仓库 `bolechen/temple-walk` 是个人账号名下的公开仓库（`gh api repos/bolechen/temple-walk` 的 `owner.type` 是 `User`，`visibility` 是 `public`）；GitHub 文档说合并队列只给组织名下的公开仓库，或企业云（GitHub Enterprise Cloud）组织名下的私有仓库。

官方文档原话（<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue>，「Managing a merge queue」开头的一句，2026-11-21 取页面原文）：

> Pull request merge queues are available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud.

个人账号不在其中。要用合并队列，得把仓库转到一个组织名下（所有者的决定，#442 里说了仓库保持现状，所以不做）。

## 如果以后转到组织名下，接入要改什么

同一页给的做法（原话）：

- 设置：「Repository administrators can require a merge queue by enabling the branch protection setting "Require merge queue" in the protection rules for the base branch.」不能用带通配符的分支保护规则。
- 工作流：「You **must** use the `merge_group` event to trigger your GitHub Actions workflow when a pull request is added to a merge queue.」所以 `pages.yml` 的 `on:` 要加 `merge_group:`；`merge_group` 与 `pull_request`、`push` 是各自独立的事件。必须报告的检查要在 `merge_group` 上也跑并报告，否则队列等不到。
- 加入队列：网页上的「Merge when ready」，或 `gh pr merge`。

## 现在怎么办

写了一个判断脚本，供主创合并前用：`node tools/ci/stillgreen.cjs <PR 号>`（规则和用法见 `tools/ci/stillgreen.cjs` 的开头、`skills/merge-green/SKILL.md`，单测 `tests/unit/still-green.test.mjs`）。它回答的是「这个 PR 在它的 head 上绿了，main 在那之后多出来的东西碰不碰得到它的检查」：不碰得到的，旧绿灯算数，不必更新分支重跑；碰得到的，仍按 LESSONS.md「合并前先确认 PR 合上了最新的 main，再看它的 CI」重跑。
