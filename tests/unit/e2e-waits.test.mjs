// A scenario that goes into a hall must let the pass finish (settle) before it asks to come out: pass() ignores a call made while one is under way (#349).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../e2e/run.cjs", import.meta.url), "utf8");
const body = src.slice(src.indexOf("  hallexit: {"), src.indexOf("  seats: {"));

test("hallexit lets a pass settle before coming out", () => {
  for (const m of body.matchAll(/await t\.until\(t\.inHall[^;]*;([^\n]*)\n\s*await t\.page\.evaluate\(\(\) => window\.__inside\(null\)\)/g)) {
    assert.match(m[1], /settle\(\)/, "unsettled __inside(null) after a tap led inside");
  }
});

test("hallexit waits on frames for the route after a tap from the porch", () => {
  // (the way round from a porch is worked out over a few frames: a single read misses it, #349. Since #411 the tap is
  // projected onto the picture and what it is bound for is `goal`, not its first leg `target`.)
  assert.match(body, /for \(let n = 0; n < \d+ && !s1\.(?:target|goal)[^\n]*\n[^\n]*should be bound past the foot of the steps/);
});

// The `taps` scenario's court taps from the blocked spot are made in the third person: the eye asks the written plan until its hierarchy is built, and what is drawn after (#295),
// and it moves when the change comes (at the first tap it was still gathering). They wait for it (nightly run 45469441175: taps failed on a card 2.5 times slower than the idle one).
test("taps waits for the eye's space to be ready before it taps the court from the blocked spot", () => {
  const taps = src.slice(src.indexOf("  taps: {"), src.indexOf("\n  } },", src.indexOf("  taps: {")));
  const view = taps.indexOf('window.__view("third")'), ready = taps.indexOf('__eyeSpace().state === "ready"'), tap = taps.indexOf("touchscreen.tap(cp[2], cp[3])");
  assert.ok(view > 0 && tap > view, "the third-person half of taps is not where this test looks for it");
  assert.ok(ready > view && ready < tap, "no wait for the eye's space to be ready between going to the third person and the first court tap");
});
