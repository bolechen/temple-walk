// The phone audit runs beside every publication (#400), in a workflow of its own so that a push to main does not cancel it half way, and keeps its pictures when it fails.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const y = fs.readFileSync(new URL("../../.github/workflows/mobile.yml", import.meta.url), "utf8"), e2e = fs.readFileSync(new URL("../../.github/workflows/e2e.yml", import.meta.url), "utf8");
test("mobile.yml runs the audit in Chinese and English on every push to main and uploads the pictures of a failing run", () => {
  assert.match(y, /on:\n  push:\n    branches: \[main\]\n    paths: \[/);
  assert.match(y, /workflow_dispatch:/, "asked for by hand on a branch");
  assert.match(y, /lang: \[zh, en\]/, "Chinese and English, a machine each");
  assert.match(y, /run: node tools\/mobile-audit\.cjs \$\{\{ matrix\.lang != 'zh' && format\('--lang=\{0\}', matrix\.lang\) \|\| '' \}\}\n/);
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
