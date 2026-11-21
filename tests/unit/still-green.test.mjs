// Whether a green pull request's checks still count after main has moved on (#442, tools/ci/stillgreen.cjs). The four cases the owner named,
// the 2026-11-21 one that made the rule (#357: green on an older main, which then gained a guard its pull request broke), and the edges.
import test from "node:test"; import assert from "node:assert/strict"; import { createRequire } from "node:module";
const { judge, risky } = createRequire(import.meta.url)("../../tools/ci/stillgreen.cjs");
const { LIMIT } = createRequire(import.meta.url)("../../tools/ci/changes.cjs");

test("main gained papers alone: the green counts", () => {
  const v = judge({ prFiles: ["app/yard.js", "tests/e2e/run.cjs"], mainFiles: ["docs/t00/decisions.md", "README.md", "skills/e2e-waits/SKILL.md", "LESSONS.md"] });
  assert.equal(v.counts, true); assert.equal(v.rule, "papers");
});
test("main gained files of no concern (neither code, tests, a workflow nor a dependency) that the pull request did not touch: the green counts", () => {
  const v = judge({ prFiles: ["app/src/ui.js", "tests/unit/ui-reopen.test.mjs"], mainFiles: [".gitignore", "refs/plaque.png"] });
  assert.equal(v.counts, true); assert.equal(v.rule, "unrelated");
});
test("main changed code the pull request's checks read, even in files the pull request did not touch: run again", () => {
  for (const f of ["app/src/eye.js", "tools/site.cjs", "tests/unit/eyegather.test.mjs", "app/shared/walk/x.bin"]) {
    const v = judge({ prFiles: ["app/src/ui.js"], mainFiles: [f] });
    assert.equal(v.counts, false, f); assert.equal(v.rule, "main changed what checks are made of", f);
  }
});
test("both changed one file: run again, and the file is named", () => {
  const v = judge({ prFiles: ["app/src/ui.js", "docs/a.md"], mainFiles: ["docs/a.md", "docs/b.md", "app/src/ui.js"] });
  assert.equal(v.counts, false); assert.equal(v.rule, "overlap"); assert.match(v.why, /app\/src\/ui\.js/);
  assert.equal(judge({ prFiles: ["docs/a.md"], mainFiles: ["docs/a.md"] }).counts, true, "papers on both sides are still only papers");
});
test("main changed a workflow or a dependency: run again", () => {
  for (const f of [".github/workflows/pages.yml", "package.json", "pnpm-lock.yaml", "vite.config.mjs", "wrangler.canary.jsonc", "worker/index.js"]) {
    const v = judge({ prFiles: ["docs/x.md"], mainFiles: [f] });
    assert.equal(v.counts, false, f);
  }
});
test("the case that made the rule: #357 was green before #412 added a guard on tests/ that its own e2e line broke", () => {
  const v = judge({ prFiles: ["tests/e2e/run.cjs", "app/src/game.js"], mainFiles: ["tests/e2e/lib.cjs", "tests/e2e/run.cjs", "tests/unit/e2e-poses.test.mjs"] });
  assert.equal(v.counts, false);
});
test("nothing new on main: the green counts; a list that cannot be known is run again", () => {
  assert.deepEqual([judge({ prFiles: ["app/a.js"], mainFiles: [] }).counts, judge({ prFiles: ["app/a.js"], mainFiles: [] }).rule], [true, "nothing new"]);
  for (const bad of [{ prFiles: null, mainFiles: [] }, { prFiles: ["a"], mainFiles: null }, { prFiles: ["a"], mainFiles: Array.from({ length: LIMIT }, (_, i) => `docs/${i}.md`) }, { prFiles: Array.from({ length: LIMIT }, (_, i) => `x${i}`), mainFiles: [] }])
    assert.deepEqual([judge(bad).counts, judge(bad).rule], [false, "unknown"]);
});
test("what counts as risky is the owner's list and the site's", () => {
  for (const f of ["app/a", "tools/a", "tests/a", "package.json", "pnpm-lock.yaml", "vite.config.mjs", ".github/workflows/x.yml", "worker/a.js", "wrangler.production.jsonc"]) assert.ok(risky(f), f);
  for (const f of ["docs/a.md", "README.md", "refs/a.png", ".gitignore", "LICENSE"]) assert.ok(!risky(f), f);
});
