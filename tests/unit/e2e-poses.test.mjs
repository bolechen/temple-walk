// A scenario that stands him by one of the walk's places must put him in a cell he may stand in (#379). The rings of the bell and the
// tea table have shut cells in them, and put down in one he cannot take a step on a card that draws sixty frames a second (software
// rendering's long strides jump out of it, which is why the scenarios passed there): `window.__poseNear` finds the open cell beside.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const run = fs.readFileSync(new URL("../e2e/run.cjs", import.meta.url), "utf8"), lib = fs.readFileSync(new URL("../e2e/lib.cjs", import.meta.url), "utf8");
test("no scenario poses him by a place with __pose: __poseNear is how", () => {
  const bad = run.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => /__places/.test(l) && /window\.__pose\(/.test(l)).map(([i]) => i);
  assert.deepEqual(bad, [], `run.cjs lines ${bad.join(", ")} pose him at a place with window.__pose; use window.__poseNear`);
});
test("__poseNear is installed before the page's own scripts", () => {
  assert.match(lib, /addInitScript\(\(\) => \{ window\.__poseNear/);
});
