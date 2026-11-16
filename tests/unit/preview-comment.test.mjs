// The preview comment reminds a pull request that changed a goal without the goal of record (AGENTS.md, 目标记录).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { goalsNote, body } = createRequire(import.meta.url)("../../tools/preview/comment.cjs");

test("a goal file changed without LATEST-GOALS is pointed out; with it, or with no goal file, nothing is said", () => {
  assert.match(goalsNote(["docs/t00/art-goal.md", "app/yard.js"]), /art-goal\.md.*LATEST-GOALS/);
  assert.match(goalsNote(["docs/t00/decisions.md"]), /decisions\.md/);
  assert.match(goalsNote(["docs/PHOTO-MODE.md"]), /PHOTO-MODE/);
  assert.equal(goalsNote(["docs/t00/art-goal.md", "docs/handoff/LATEST-GOALS.md"]), "");
  assert.equal(goalsNote(["app/yard.js", "docs/HANDOFF.md", "docs/t00/art-targets.md"]), "");
  assert.equal(goalsNote(null), "");
});

test("the note is carried on the comment when deployed and when not", () => {
  const record = { preview_urls: ["https://pr-1.example"], deployment_urls: ["https://abc.example"] };
  const files = ["docs/t00/structure-goal.md"], sha = "a".repeat(40);
  assert.match(body({ state: "success", sha, run: "r", record, manifest: "none.json", files }), /目标同步/);
  assert.match(body({ state: "failure", sha, run: "r", files }), /目标同步/);
  assert.doesNotMatch(body({ state: "success", sha, run: "r", record, manifest: "none.json", files: ["app/yard.js"] }), /目标同步/);
});
