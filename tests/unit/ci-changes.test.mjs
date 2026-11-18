// Which pushes build the site (issue #187): the list of the site's paths is one, in tools/ci/changes.cjs, and a change that
// is none of it (papers, notes, tools that are not the build's) is checked and not built. Getting it wrong the other way
// would leave a preview on old code under a comment that says it is new, so the cases that must build are held here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { siteChanged, walkChanged, LIMIT } = createRequire(import.meta.url)("../../tools/ci/changes.cjs");

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
