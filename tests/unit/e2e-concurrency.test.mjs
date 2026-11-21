// A run of the whole suite started by hand is read by the person who started it: nothing may cancel it, neither a push nor another
// run started by hand on the same branch (two of them did, 2026-11-21). The nightly and a push may still replace their own kind.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const y = fs.readFileSync(new URL("../../.github/workflows/e2e.yml", import.meta.url), "utf8");
test("a hand-started run is its own concurrency group and is not cancelled", () => {
  const group = /^  group: (.*)$/m.exec(y)?.[1] || "", cancel = /^  cancel-in-progress: (.*)$/m.exec(y)?.[1] || "";
  assert.match(group, /workflow_dispatch/, "the group tells a hand-started run apart");
  assert.match(group, /github\.run_id/, "and gives each its own");
  assert.match(cancel, /github\.event_name != 'workflow_dispatch'/, "and nothing cancels it");
  assert.match(group, /push' && 'regression'/, "a push still has the one regression group");
  assert.match(group, /full-\{0\}', github\.ref/, "the nightly keeps to its own ref");
});
