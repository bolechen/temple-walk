// Which pushes build the site (issue #187): the list of the site's paths is one, in tools/ci/changes.cjs, and a change that
// is none of it (papers, notes, tools that are not the build's) is checked and not built. Getting it wrong the other way
// would leave a preview on old code under a comment that says it is new, so the cases that must build are held here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { siteChanged, walkChanged, codeChanged, prCompare, lastDeployed, DOC_TESTS, LIMIT } = createRequire(import.meta.url)("../../tools/ci/changes.cjs");

test("a change under app/ builds; so do the files the build or the browser tests are made of", () => {
  for (const f of ["app/yard.js", "app/src/interior.js", "app/shared/fonts/kai.woff2", "tests/e2e/run.cjs", "package.json", "pnpm-lock.yaml", "vite.config.mjs", "wrangler.production.jsonc", "wrangler.canary.jsonc", "worker/index.js", "worker/trace-core.js", "tools/worker-smoke.mjs", "tools/setup.mjs", "tools/site.cjs", ".github/workflows/pages.yml", "tools/ci/changes.cjs"]) {
    assert.equal(siteChanged([f]), true, f);
    assert.equal(siteChanged(["docs/HANDOFF.md", f]), true, `${f} beside a paper`);
  }
});

test("papers, notes and tools that are not the build's do not build", () => {
  const papers = ["docs/HANDOFF.md", "docs/t00/SOURCES.md", "README.md", "CLAUDE.md", "AGENTS.md", "docs/t00/evidence/x/box-front.jpg", "tools/preview/comment.cjs", "tools/gallery.py", "tests/unit/ci-changes.test.mjs", ".github/workflows/e2e.yml", ".github/workflows/preview-cleanup.yml", "docs/t00/delivery.json"];
  assert.equal(siteChanged(papers), false);
  for (const f of papers) assert.equal(siteChanged([f]), false, f);
});

test("papers with package.json build; and what cannot be known builds", () => {
  assert.equal(siteChanged(["docs/HANDOFF.md", "package.json"]), true);
  assert.equal(siteChanged(null), true, "no comparison was possible");
  assert.equal(siteChanged([]), true, "an empty list is a comparison that failed, not a change of nothing");
  const many = Array.from({ length: LIMIT }, (_, i) => `docs/t00/evidence/${i}.png`);
  assert.equal(siteChanged(many), true, `${LIMIT} files: the compare API stops listing there, so the rest are unknown`);
  assert.equal(siteChanged(many.slice(1)), false, `${LIMIT - 1} files that are all papers are known`);
});

test("the floor is baked when the site changes and when what the bake is made of changes", () => {
  assert.equal(walkChanged(["app/src/site.js"]), true);
  for (const f of ["tools/walk/outline.json", "tools/bake-walk.mjs", "tools/walk-diff.mjs"]) { assert.equal(siteChanged([f]), false, f); assert.equal(walkChanged([f]), true, f); }
  assert.equal(walkChanged(["docs/HANDOFF.md"]), false);
  assert.equal(walkChanged(null), true);
});

test("every path that starts the nightly regression run on a push is one that builds the site", () => {
  // e2e.yml keeps its own `paths:` (a workflow cannot read a file for it); each of them must be a site change here.
  for (const f of ["e2e.yml", "mobile.yml"]) {   // (the phone audit's own workflow, #400, keeps the same list)
    const yml = fs.readFileSync(new URL(`../../.github/workflows/${f}`, import.meta.url), "utf8");
    const line = yml.match(/paths:\s*\[(.*)\]/)[1];
    const globs = [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(globs.length >= 5, `${f}'s paths were not found`);
    for (const g of globs) assert.equal(siteChanged([g.replace("**", "x")]), true, `${f} runs on ${g}, which pages.yml would not build for`);
  }
});

// #296: a push to main is compared with the last commit whose deploy succeeded, so a site change whose run was cancelled
// (replaced in the queue by the next push) is not hidden by a papers-only commit after it.
test("the base of a push is the last deploy that succeeded, never the run before or the run itself", async () => {
  // newest first: this run (id 5), a papers-only run that succeeded without deploying (4), a cancelled one never listed, a deployed one (2)
  const runs = [{ id: 5, head_sha: "e" }, { id: 4, head_sha: "d" }, { id: 2, head_sha: "b" }, { id: 1, head_sha: "a" }];
  const deployed = async (id) => id === 2 || id === 1;
  assert.equal(await lastDeployed(runs, deployed, 5), "b");
  assert.equal(await lastDeployed(runs, async () => false, 5), null, "no deploy found: null, which builds");
  assert.equal(await lastDeployed([{ id: 5, head_sha: "e" }], async () => true, 5), null, "a run is not its own base");
});

test("a site change followed by a papers-only commit is still a site change against the last deploy", async () => {
  // 2026-11-19: 7c86432 changed app/ and was replaced in the queue by 39692ee, which changed papers. Against the commit
  // before, 39692ee changed no site; against the last deploy (before 7c86432) it changed both.
  const againstBefore = ["AGENTS.md"];
  const againstDeploy = ["app/src/audio.js", "app/yard.js", "docs/t00/SOURCES.md", "tests/e2e/run.cjs", "AGENTS.md"];
  assert.equal(siteChanged(againstBefore), false);
  assert.equal(siteChanged(againstDeploy), true);
  assert.equal(await lastDeployed([{ id: 9, head_sha: "x" }, { id: 8, head_sha: "y" }], async (id) => id === 8, 10), "y", "run 9 did not deploy, so the base is run 8's commit");
});

test("papers alone skip the heavy unit tests; anything else, and anything unknown, runs them", () => {
  for (const f of ["docs/HANDOFF.md", "docs/t00/delivery.json", "README.md", "AGENTS.md", "skills/temple-review/SKILL.md"]) assert.equal(codeChanged([f]), false, f);
  for (const f of ["tools/gallery.py", "tests/unit/plan.test.mjs", ".github/workflows/e2e.yml", "tools/preview/comment.cjs", "app/src/readme.md"]) assert.equal(codeChanged([f]), true, f);
  assert.equal(codeChanged(["docs/a.md", "tools/x.mjs"]), true);
  assert.equal(codeChanged(null), true);
  assert.equal(codeChanged([]), true);
  // whatever the site is made of is also code: a build never goes out without both sets of tests
  for (const f of ["app/x.md", "package.json", ".github/actions/prepare/action.yml"]) assert.equal(codeChanged([f]), true, f);
});

test("the tests run for papers alone exist", () => {
  assert.ok(DOC_TESTS.length >= 5);
  for (const f of DOC_TESTS) assert.ok(fs.existsSync(new URL(`../../${f}`, import.meta.url)), f);
});

const read = (f) => fs.readFileSync(new URL(`../../.github/workflows/${f}`, import.meta.url), "utf8");
const jobOf = (yml, name) => { const a = yml.indexOf(`\n  ${name}:\n`); assert.ok(a >= 0, `job ${name}`); const rest = yml.slice(a + 1); const m = rest.slice(1).search(/\n  [a-z-]+:\n/); return m < 0 ? rest : rest.slice(0, m + 1); };

test("pages.yml: the publication waits for both sets of unit tests, the build and boot, side by side", () => {
  const y = read("pages.yml");
  assert.match(jobOf(y, "verify"), /needs: \[changes, unit, floor, build, tests, grid, quick, worker\]/);
  assert.match(jobOf(y, "deploy"), /needs: \[verify, quick\]/);
  assert.match(jobOf(y, "tests"), /node tools\/ci\/unit-shard\.cjs run \$\{\{ matrix\.shard \}\}\/5\n/);
  assert.match(jobOf(y, "grid"), /unit-shard\.cjs run \$\{\{ matrix\.shard \}\}\/5 --import \.\/tools\/walk\/swap\.mjs/);
  for (const j of ["tests", "grid"]) assert.match(jobOf(y, j), /shard: \[1, 2, 3, 4, 5\]/, `${j}: five machines, as SHARDS says`);
  // the floor is baked once, by `floor`, and handed to every shard as an artifact before any test reads it (#442)
  assert.match(jobOf(y, "floor"), /node tools\/bake-walk\.mjs/); assert.doesNotMatch(y, /floor-[^\n]*run_attempt/, "the floor's name has no run_attempt: re-running only the failed jobs must find it"); assert.match(jobOf(y, "floor"), /overwrite: true/); assert.match(jobOf(y, "floor"), /upload-artifact@v4[\s\S]*name: floor-\$\{\{ github\.run_id \}\}\n/);
  for (const j of ["tests", "grid"]) {
    const body = jobOf(y, j);
    assert.match(body, /needs: \[changes, floor\]/, `${j} waits for the floor`);
    assert.match(body, /download-artifact@v4[\s\S]*name: floor-\$\{\{ github\.run_id \}\}\n[\s\S]*path: app\/shared\/walk/, `${j} takes the floor as it is`);
    assert.ok(body.indexOf("download-artifact") < body.indexOf("unit-shard.cjs"), `${j} has the floor before its tests run`);
    assert.doesNotMatch(body, /node tools\/bake-walk\.mjs/, `${j} does not bake it again`);
  }
  assert.match(jobOf(y, "build"), /pnpm run build/); assert.match(jobOf(y, "quick"), /scenarios: "boot"/, "boot is one of the quick machines");
  assert.ok(!/\n  site:\n/.test(y), "no job of its own for boot: it runs beside the other scenarios");
  // none waits for another (they are parallel); only `changes` comes first
  for (const j of ["unit", "floor", "build"]) assert.match(jobOf(y, j), /needs: changes\n/, j);
  assert.doesNotMatch(jobOf(y, "deploy"), /if: always\(\)/, "deploy keeps the implicit success()");
  assert.match(jobOf(y, "verify"), /if: \$\{\{ !cancelled\(\) \}\}/);
});

test("no pull request reads the evidence over the network to compare hashes; the nightly run does", () => {
  assert.doesNotMatch(read("pages.yml"), /run:.*evidence\.mjs (verify|mirror)/);
  const mirror = read("evidence-mirror.yml");
  for (const name of ["Every listed file through the public domain", "The original agrees"]) {
    const i = mirror.indexOf(name); assert.ok(i > 0, name);
    assert.match(mirror.slice(i, i + 400), /github\.event_name != 'pull_request'/, name);
  }
  const e2e = read("e2e.yml");
  assert.match(e2e, /cron: "17 19/);
  // the three reads are the steps of the `evidence` job, which runs in the nightly and when a run by hand asks, and nowhere else
  const job = /\n  evidence:\n([\s\S]*?)\n  [a-z0-9-]+:\n|\n  evidence:\n([\s\S]*)$/.exec(e2e), body = job ? (job[1] ?? job[2]) : "";
  assert.match(body, /if: [^\n]*github\.event_name == 'schedule' \|\| github\.event\.inputs\.evidence == 'true'/, "the evidence job runs in a pull request's way");
  for (const name of ["at the public address", "in the original store", "holds what the manifests say \\(S3\\)"]) assert.ok(new RegExp(name).test(body), name + " is not a step of the evidence job");
});

// #308: what stops a bad walk or camera before it is live, and the way back.
test("pages.yml: main goes to the canary, after the quick scenarios, and never to production", () => {
  const y = read("pages.yml");
  const deploy = jobOf(y, "deploy");
  assert.match(deploy, /needs: \[verify, quick\]/, "the canary waits for verify and the quick scenarios, by name");
  assert.match(deploy, /deploy -c wrangler\.canary\.jsonc/);
  assert.match(deploy, /shell: bash\n\s*run: npx[^\n]*wrangler\.canary\.jsonc \| tee/, "a pipe to tee runs under pipefail (shell: bash), or a failed deploy shows green");
  assert.doesNotMatch(y, /wrangler\.production\.jsonc|CLOUDFLARE_PREVIEW_TOKEN.*deploy/, "pages.yml no longer touches the production Worker");
  const quick = jobOf(y, "quick");
  assert.match(quick, /needs: \[changes, build\]\n/, "quick waits for the one build and for nothing else");
  assert.match(quick, /needs\.changes\.outputs\.site == 'true'/, "only when the site is built");
  // four machines, paired by what CI measured (boot 129 s, drop-touch 134, drop 107, stairs 91 + stairs-edge 32): the longest is 134 s
  for (const sc of ["boot", "drop-touch", "drop", "stairs stairs-edge"]) assert.match(quick, new RegExp(`scenarios: "${sc}"`));
  assert.match(quick, /run\.cjs \$\{\{ matrix\.scenarios \}\}/);
  assert.match(jobOf(y, "verify"), /needs: \[[^\]]*\bquick\b/, "a red scenario fails verify too");
  const site = jobOf(y, "build");
  assert.match(site, /\n    env:\n[\s\S]*?VITE_DEPLOY: \$\{\{ github\.event_name == 'pull_request' && 'preview' \|\| 'canary' \}\}/, "the one build says where it goes, on the job");
  assert.match(site, /VITE_COMMIT: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/, "and which commit");
  // the site is built once (#442 step 3) and every job that drives or publishes it takes that artifact, named by the run only
  assert.match(site, /upload-artifact@v4[\s\S]*name: built-site-\$\{\{ github\.run_id \}\}\n[\s\S]*overwrite: true[\s\S]*include-hidden-files: true/, "the build hands dist/ on, hidden stamp and all");
  assert.doesNotMatch(y, /built-site-[^\n]*run_attempt/, "re-running only the failed jobs must find the built site");
  for (const j of ["quick", "preview", "deploy"]) assert.match(jobOf(y, j), /download-artifact@v4[\s\S]*name: built-site-\$\{\{ github\.run_id \}\}\n\s*path: dist/, `${j} takes the site that was built`);
  for (const j of ["quick"]) assert.match(jobOf(y, j), /touch dist\/\.built/, `${j} tells site.cjs the downloaded dist/ is current`);
  for (const j of ["quick"]) assert.doesNotMatch(jobOf(y, j), /pnpm run build|bake-doorways/, `${j} does not build the site again`);
  assert.equal(JSON.parse(fs.readFileSync(new URL("../../wrangler.canary.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "")).name, "temple-walk-canary");
});

test("e2e.yml no longer repeats the scenarios that stop the publication", () => {
  const e = read("e2e.yml");
  const regression = jobOf(e, "regression");
  assert.doesNotMatch(regression, /run\.cjs[^\n]*\b(stairs|drop)\b/);
  assert.match(regression, /run\.cjs menufit/, "the menu in every language stays where it was");
});

test("deploy-tag.yml: only a version tag is put live, to a named place, by release-please and by hand, and a dry run deploys nothing", () => {
  const p = read("deploy-tag.yml");
  assert.match(p, /workflow_call:\s*\n\s*inputs:\s*\n\s*ref:/, "release-please calls it with a ref");
  assert.match(p, /workflow_dispatch:\s*\n\s*inputs:\s*\n\s*ref:/, "a rollback is a run by hand with a ref");
  assert.match(p, /target:\n\s*description: "Where it goes[^\n]*\n\s*required: true\n\s*type: choice\n\s*options: \[production, canary\]\n\s*default: production/, "the place is chosen, production by default");
  assert.match(p, /dry_run:/, "a dry run is asked for by name");
  assert.match(p, /\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$/, "the ref must be a version tag");
  assert.match(p, /production\|canary\) ;; \*\) echo "::error::target must be/, "and the target one of two places");
  assert.match(p, /ref: refs\/tags\/\$\{\{ inputs\.ref \}\}/, "and it is the tag that is checked out");
  const build = jobOf(p, "build");
  assert.match(build, /echo "VITE_DEPLOY=\$TARGET" >> "\$GITHUB_ENV"/, "the build says where it goes, for every later step: boot builds dist/ again");
  assert.match(build, /echo "VITE_COMMIT=\$sha" >> "\$GITHUB_ENV"/, "and which commit of the tag it is");
  assert.doesNotMatch(build, /\n\s+env:\n\s+VITE_DEPLOY:/, "a variable on one step alone is lost in the build that boot makes");
  assert.match(build, /run\.cjs boot/);
  // `check` is declared for both ways in: GitHub reads an undeclared input as null, and `null != false` is false, so a
  // condition written `!= false` skipped `boot` for every run called by release-please.
  assert.match(p, /workflow_call:[\s\S]*?check:\n\s*description[^\n]*\n\s*required: false\n\s*type: boolean\n\s*default: true[\s\S]*?workflow_dispatch:/, "a call gets check too, true by default");
  assert.doesNotMatch(p, /inputs\.check != false/, "no comparison of a possibly-undeclared input with false");
  assert.match(build, /if: inputs\.check\n\s*env:|if: inputs\.check\n\s*run: node tests\/e2e\/run\.cjs boot/, "boot runs when check is on");
  assert.match(build, /X-Robots-Tag/, "the canary is kept out of search whatever the tag's age");
  const deploy = jobOf(p, "deploy");
  assert.match(deploy, /needs: build/);
  assert.match(deploy, /deploy -c "wrangler\.\$TARGET\.jsonc"/, "the Worker is the target's");
  assert.match(deploy, /if: inputs\.dry_run != true\n[\s\S]*?wrangler@[\d.]+ deploy/, "a dry run does not publish");
  assert.match(deploy, /sparse-checkout: \|\n\s*wrangler\.production\.jsonc\n\s*wrangler\.canary\.jsonc/, "the Workers' settings come from the workflow's branch, not the tag");
  assert.match(deploy, /group: \$\{\{ inputs\.target == 'canary' && 'pages-canary' \|\| 'production-deploy' \}\}\n\s*cancel-in-progress: false/, "one publication to a place at a time; the canary shares pages.yml's queue");
  assert.equal(p.match(/wrangler@[\d.]+ deploy/)[0], read("pages.yml").match(/wrangler@[\d.]+ deploy/)[0], "the same wrangler as pages.yml");
  assert.doesNotMatch(p, /push:|branches:/, "nothing but a tag, asked for by name, starts it");
});

test("release-please.yml deploys production when, and only when, a version was made", () => {
  const r = read("release-please.yml");
  assert.match(r, /release_created: \$\{\{ steps\.rp\.outputs\.release_created \}\}/);
  assert.match(r, /tag_name: \$\{\{ steps\.rp\.outputs\.tag_name \}\}/);
  const job = jobOf(r, "production");
  assert.match(job, /needs: release/);
  assert.match(job, /needs\.release\.outputs\.release_created == 'true'/);
  assert.match(job, /uses: \.\/\.github\/workflows\/deploy-tag\.yml/);
  assert.match(job, /target: production/, "the release goes to production, nothing else");
  assert.match(job, /ref: \$\{\{ needs\.release\.outputs\.tag_name \}\}/);
  assert.match(job, /secrets: inherit/);
});

test("unit tests: every file runs on exactly one of the five machines, none over its budget, and `pnpm test` is the same set", async () => {
  const { createRequire } = await import("node:module");
  const sh = createRequire(import.meta.url)("../../tools/ci/unit-shard.cjs");
  const all = sh.files(), { parts, loads } = sh.plan(all, sh.SHARDS), seen = parts.flat();
  assert.equal(seen.length, all.length); assert.deepEqual([...seen].sort(), all);
  for (const l of loads) assert.ok(l <= sh.BUDGET, `a machine's share is ${l.toFixed(0)} s, over ${sh.BUDGET}`);
  for (const l of loads) assert.ok(l <= sh.BUDGET - 15, `a machine's share is ${l.toFixed(0)} s: less than 15 s of room under ${sh.BUDGET} for a new test (#697)`);
  for (const f of Object.keys(sh.durations())) assert.ok(all.includes(f), `durations.json names ${f}, which is not a test`);
  assert.match(fs.readFileSync(new URL("../../.github/workflows/pages.yml", import.meta.url), "utf8"), new RegExp(`unit-shard\\.cjs run \\$\\{\\{ matrix\\.shard \\}\\}/${sh.SHARDS}`));
});

test("unit tests: a share with no file runs nothing, because `node --test` with no file would run the whole suite", async () => {
  const { createRequire } = await import("node:module");
  const sh = createRequire(import.meta.url)("../../tools/ci/unit-shard.cjs");
  assert.equal(sh.testArgs([]), null);
  assert.deepEqual(sh.testArgs(["a.test.mjs"], ["--import", "x"]), ["--import", "x", "--test", "tests/unit/a.test.mjs"]);
  assert.equal(sh.shareOf("0/5"), null); assert.equal(sh.shareOf("6/5"), null);
  // 200 machines for 123 files: the last ones are empty, and say so rather than run everything
  const empty = sh.plan(sh.files(), 200).parts.filter((p) => p.length === 0);
  assert.ok(empty.length > 0);
  const { spawnSync } = await import("node:child_process");
  const bad = spawnSync(process.execPath, ["tools/ci/unit-shard.cjs", "run", "0/5"], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  const none = spawnSync(process.execPath, ["tools/ci/unit-shard.cjs", "run", "200/200"], { encoding: "utf8" });
  assert.equal(none.status, 0); assert.match(none.stdout, /holds no test file/);
});

test("evidence-mirror: runs of different branches never queue in one group; each commit on main has its own", () => {
  const y = read("evidence-mirror.yml");
  const group = /concurrency:\n\s+group: (.+)\n\s+cancel-in-progress: false/.exec(y);
  assert.ok(group, "a concurrency group that does not cancel a run in progress");
  assert.match(group[1], /github\.ref/, "pull request runs are grouped by their own branch");
  assert.match(group[1], /github\.event_name == 'push' && github\.sha/, "a push to main is its own group, so the next push cannot replace it");
  assert.doesNotMatch(group[1].trim(), /^evidence-mirror$/, "not one group for everything");
});

// #601: a pull request with no preview yet used to be compared with nothing, and so was built whole, though it only changed papers
// (#597, #598 and #600). It is now compared with its base, and what that says is decided by the same lists as every other push.
test("a pull request with a preview is compared with the commit the preview shows; without one, with its base", () => {
  const shown = { deployed: "d".repeat(40), fixed: "https://f.example", latest: "https://l.example" }, base = "b".repeat(40);
  assert.deepEqual(prCompare(shown, base), { sha: "d".repeat(40), deployed: true }, "what the preview shows, not the base");
  for (const none of [null, undefined, {}, { fixed: "https://f.example", latest: "https://l.example" }, { deployed: "d".repeat(40) }]) assert.deepEqual(prCompare(none, base), { sha: base, deployed: false }, JSON.stringify(none));
  assert.equal(prCompare(null, undefined), null, "no preview and no base: nothing to compare, so it builds");
});

test("a new pull request that only changes papers builds and tests nothing; one that changes code builds as before", () => {
  const papers = ["docs/t00/decisions.md", "README.md", "skills/ci/SKILL.md"], code = [...papers, "app/src/mood.js"];
  assert.equal(siteChanged(papers), false);
  assert.equal(walkChanged(papers), false);
  assert.equal(codeChanged(papers), false, "papers alone: only the tests that read papers");
  assert.equal(siteChanged(code), true);
  assert.equal(walkChanged(code), true);
  assert.equal(codeChanged(code), true);
  assert.equal(siteChanged(null), true, "a comparison that could not be made builds");
});

test("pages.yml tells changes.cjs the pull request's base commit", () => {
  const y = fs.readFileSync(new URL("../../.github/workflows/pages.yml", import.meta.url), "utf8");
  const step = /- name: Did this push touch the site\n([\s\S]*?)run: node tools\/ci\/changes\.cjs/.exec(y)?.[1] || "";
  assert.match(step, /BASE: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
});
