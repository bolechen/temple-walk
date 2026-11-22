// The phone audit runs beside every publication (#400), in a workflow of its own so that a push to main does not cancel it half way, and keeps its pictures when it fails.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const y = fs.readFileSync(new URL("../../.github/workflows/mobile.yml", import.meta.url), "utf8"), e2e = fs.readFileSync(new URL("../../.github/workflows/e2e.yml", import.meta.url), "utf8");
test("mobile.yml runs the audit in Chinese and English on every push to main and uploads the pictures of a failing run", () => {
  assert.match(y, /on:\n  push:\n    branches: \[main\]\n    paths: \[/);
  assert.match(y, /workflow_dispatch:/, "asked for by hand on a branch");
  assert.match(y, /lang: \[zh, en\]/, "Chinese and English");
  assert.match(y, /run: node tools\/mobile-audit\.cjs \$\{\{ matrix\.lang != 'zh' && format\('--lang=\{0\}', matrix\.lang\) \|\| '' \}\} --shapes=\$\{\{ matrix\.group\.shapes \}\}\n/);
  assert.match(y, /if: failure\(\)\n\s+uses: actions\/upload-artifact@v4/);
  assert.match(y, /path: tools\/out\/mobile\*\//);
  assert.match(y, /retention-days: 14/);
});
// 2026-11-21: the first run on main was cancelled by the next merge: e2e.yml's push runs replace each other, and the audit takes about twenty-three minutes.
test("no push cancels an audit that is running: a push waits behind it, a run by hand is its own group", () => {
  const group = /^  group: (.*)$/m.exec(y)?.[1] || "", cancel = /^  cancel-in-progress: (.*)$/m.exec(y)?.[1] || "";
  assert.match(group, /github\.event_name == 'push' && 'main' \|\| github\.run_id/);
  assert.equal(cancel, "false");
  assert.doesNotMatch(e2e, /tools\/mobile-audit\.cjs/, "and e2e.yml, whose pushes replace one another, no longer holds it");
});
test("what the audit writes lies where the job uploads from", () => {
  const src = fs.readFileSync(new URL("../../tools/mobile-audit.cjs", import.meta.url), "utf8");
  assert.match(src, /"mobile" : `mobi/, "zh goes to tools/out/mobile and another language to tools/out/mobile-<lang>");
});

// #614: 28 minutes a language became a few: the site is built once and handed on, and the four screens are shared by two machines for each language.
test("the audit's site is built once and handed to every machine; the four sizes are shared, every one by one machine", () => {
  assert.match(y, /\n  build:\n/);
  assert.match(y, /name: mobile-site-\$\{\{ github\.run_id \}\}\n\s+retention-days: 1\n\s+overwrite: true\n\s+include-hidden-files: true/, "named by the run only, so that re-running the failed machines finds it");
  const m = /\n  mobile:\n([\s\S]*)$/.exec(y)?.[1] || "";
  assert.match(m, /needs: build/);
  assert.match(m, /actions\/download-artifact@v4\n\s+with:\n\s+name: mobile-site-\$\{\{ github\.run_id \}\}/);
  assert.match(m, /run: touch dist\/\.built/, "so that tools/site.cjs does not build the site again");
  assert.doesNotMatch(m, /pnpm run build|bake-doorways|bake-walk/, "no machine of the audit builds");
  const shapes = [...m.matchAll(/shapes: "([a-z,]+)"/g)].map((x) => x[1].split(",")).flat().sort();
  assert.deepEqual(shapes, ["large", "side", "small", "upright"], "every size, once");
  assert.match(m, /name: e2e-mobile-report-/, "the report of a passing run is kept too");
});
test("the audit waits for conditions, never for seconds, and opens the page built and not drawn", () => {
  const src = fs.readFileSync(new URL("../../tools/mobile-audit.cjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /waitForTimeout/, "CLAUDE.md: wait on frames, never on seconds");
  assert.match(src, /const BARE = "&off=/, "the interface's DOM is what is measured");
  assert.match(src, /--shapes=/, "the sizes can be shared among machines");
});
