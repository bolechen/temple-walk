// Which pushes build the site (issue #187): the list of the site's paths is one, in tools/ci/changes.cjs, and a change that
// is none of it (papers, notes, tools that are not the build's) is checked and not built. Getting it wrong the other way
// would leave a preview on old code under a comment that says it is new, so the cases that must build are held here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { siteChanged, walkChanged, codeChanged, lastDeployed, DOC_TESTS, LIMIT } = createRequire(import.meta.url)("../../tools/ci/changes.cjs");

test("a change under app/ builds; so do the files the build or the browser tests are made of", () => {
  for (const f of ["app/yard.js", "app/src/interior.js", "app/shared/fonts/kai.woff2", "tests/e2e/run.cjs", "package.json", "pnpm-lock.yaml", "vite.config.mjs", "wrangler.production.jsonc", "tools/setup.mjs", "tools/site.cjs", ".github/workflows/pages.yml", "tools/ci/changes.cjs"]) {
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
  const yml = fs.readFileSync(new URL("../../.github/workflows/e2e.yml", import.meta.url), "utf8");
  const line = yml.match(/paths:\s*\[(.*)\]/)[1];
  const globs = [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(globs.length >= 5, "e2e.yml's paths were not found");
  for (const g of globs) assert.equal(siteChanged([g.replace("**", "x")]), true, `e2e.yml runs on ${g}, which pages.yml would not build for`);
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
  assert.match(jobOf(y, "verify"), /needs: \[changes, unit, grid, site\]/);
  assert.match(jobOf(y, "deploy"), /needs: verify/);
  assert.match(jobOf(y, "unit"), /pnpm test\b/);
  assert.match(jobOf(y, "grid"), /swap\.mjs --test tests\/unit/);
  assert.ok(jobOf(y, "grid").indexOf("node tools/bake-walk.mjs") < jobOf(y, "grid").indexOf("swap.mjs"), "the grid job writes the floor before the swapped walker reads it");
  const site = jobOf(y, "site");
  assert.match(site, /pnpm run build/); assert.match(site, /run\.cjs boot/);
  // none waits for another (they are parallel); only `changes` comes first
  for (const j of ["unit", "grid", "site"]) assert.match(jobOf(y, j), /needs: changes\n/, j);
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
  for (const name of ["at the public address", "in the original store", "holds what the manifests say \\(S3\\)"]) {
    const i = e2e.search(new RegExp(name)); assert.ok(i > 0, name);
    assert.match(e2e.slice(i, i + 500), /github\.event_name == 'schedule'/, name);
  }
});
