// The preview comment reminds a pull request that changed a goal without the goal of record (AGENTS.md, 目标记录).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { goalsNote, body, markers } = createRequire(import.meta.url)("../../tools/preview/comment.cjs");

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

const sha = "a".repeat(40), old = "b".repeat(40), fixed = "https://f1.example", latest = "https://pr-7.example";
const record = { preview_urls: [latest], deployment_urls: [fixed] }, manifestFile = "docs/t00/camera-manifest.json";
// What the comment shows by its own lines: everything but the folded links.
const visible = (text) => text.replace(/<details>[\s\S]*<\/details>/, "");

test("a built commit's comment is short outside its fold, and the links are inside it, once each", () => {
  const text = body({ state: "success", sha, run: "https://r.example/1", record, manifest: manifestFile, files: ["app/yard.js"] });
  assert.ok(visible(text).length <= 900, `${visible(text).length} characters outside the fold`);
  assert.match(text, /<details><summary>/); assert.equal((text.match(/\[CAM-0[1-6] /g) || []).length, 6, "six views");
  assert.equal((text.match(/\[(缺印结尾|七印圆满结尾|冬天结尾|撞钟|上香|吃茶|得句|观水|燃灯|静坐)\]/g) || []).length, 10, "ten moments");
  assert.ok(visible(text).includes(latest) && visible(text).includes(fixed), "the two addresses are not folded");
  assert.deepEqual(markers(text), { deployed: sha, fixed, latest });
});

test("a commit that built nothing says so, names the commit the preview shows, and keeps both addresses and the links", () => {
  const previous = { deployed: old, fixed, latest };
  const text = body({ state: "same", sha, run: "r", previous, manifest: manifestFile, files: ["docs/HANDOFF.md"] });
  assert.match(text, new RegExp(`\`${sha}\`：本提交不改站点，预览仍是 \`${old.slice(0, 7)}\` 的版本`));
  assert.ok(visible(text).includes(latest) && visible(text).includes(fixed) && visible(text).length <= 900);
  assert.equal((text.match(/\[CAM-0[1-6] /g) || []).length, 6);
  assert.deepEqual(markers(text), previous, "what the next push compares with is still the build the preview shows");
});

test("a failed commit keeps what the earlier preview was, so that the next push is compared with that", () => {
  const previous = { deployed: old, fixed, latest };
  const text = body({ state: "failure", sha, run: "r", previous, files: [] });
  assert.match(text, /没有部署/); assert.match(text, new RegExp(old.slice(0, 7)));
  assert.deepEqual(markers(text), previous);
  assert.deepEqual(markers(body({ state: "failure", sha, run: "r", previous: null, files: [] })), { deployed: undefined, fixed: undefined, latest: undefined });
});
