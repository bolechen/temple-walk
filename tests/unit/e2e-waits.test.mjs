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
  const i = body.indexOf("a tap on the court from the porch");
  const before = body.slice(i - 400, i);
  assert.match(before, /for \(let n = 0; n < \d+ && !s1\.target/);
});
