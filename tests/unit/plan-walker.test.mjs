// The walker of a written plan that knows no level (app/src/plan-walker.js, #409): on a small place laid out here — a
// court, a platform 2 m up with a flight onto it, a wall, a post and a railing — it answers from those rectangles alone,
// as the grid walker asks it to (the eye, the sound of his steps, the railings), and it imports no level.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { createPlanWalker } from "../../app/src/plan-walker.js";
import { stairProfile } from "../../app/src/geo.js";

const RISE = 2, RUN = stairProfile(RISE).run;
const site = { walk: {
  decks: [{ x0: -10, x1: 10, z0: -10, z1: 10, h: 0, floor: "paving" }, { x0: -4, x1: 4, z0: -8, z1: -2, h: RISE, floor: "stone" }],
  ramps: [{ x0: -1.5, x1: 1.5, z0: -2.5, z1: -2 + RUN + 0.3, base: 0, h: RISE, low: [0, -2 + RUN], high: [0, -2], floor: "stone" }],
  solids: [{ x0: -4.4, x1: 4.4, z0: -8.4, z1: -1.6, top: RISE }, { x0: -10, x1: 10, z0: 9, z1: 10, eyeTop: 3.3 }],
  posts: [{ x0: 5, x1: 6, z0: 5, z1: 6 }],
  rails: [{ x0: -4, x1: -1.6, z0: -2.2, z1: -2, bottom: RISE, top: RISE + 0.85 }],
} };
const w = createPlanWalker(site);

test("the floor's height and what it sounds like, from the decks and the flight", () => {
  assert.equal(w.heightAt(0, 5), 0); assert.equal(w.floorAt(0, 5), "paving");
  assert.equal(w.heightAt(0, -5), RISE); assert.equal(w.floorAt(0, -5), "stone");
  assert.equal(w.floorAt(30, 30), "earth", "where no floor is given");
  // Up the flight, tread by tread: each the same height, and the eye's height following the slope.
  const { count, height, tread } = stairProfile(RISE), seen = [];
  for (let i = 0; i < count; i++) seen.push(w.heightAt(0, -2 + tread * (i + 0.5)));
  for (let i = 1; i < count; i++) assert.ok(Math.abs(seen[i - 1] - seen[i] - height) < 1e-6, `tread ${i}`);
  assert.ok(w.onStairs(0, -2 + RUN / 2) && !w.onStairs(0, 5));
  const mid = w.eyeAt(0, -2 + RUN / 2); assert.ok(mid > 0.3 * RISE && mid < 0.7 * RISE, `the eye rides the slope: ${mid}`);
});

test("what stops him: no floor, a wall, a post, the platform's stone from below; not the flight cut through it, nor its own top", () => {
  assert.ok(w.blocked(30, 30), "outside every floor");
  assert.ok(w.blocked(0, 9.5), "the wall"); assert.ok(w.blocked(5.5, 5.5), "the post");
  assert.ok(w.blocked(3, -1.8), "beside the platform, below its floor");
  assert.ok(!w.blocked(0, -5), "on the platform"); assert.ok(!w.blocked(0, -1.8), "on the flight, where it is cut through the stone");
  assert.ok(!w.blocked(0, 5), "in the court");
});

test("the eye keeps out of a wall to over its top and out of the platform below its floor; it passes over a railing, which it can be told of", () => {
  assert.equal(w.eyeShut(0, 2, 9.5), true); assert.equal(w.eyeShut(0, 3.5, 9.5), false);
  assert.equal(w.eyeShut(3, 1, -5), true); assert.equal(w.eyeShut(3, 3.6, -5), false);
  assert.equal(w.eyeShut(0, 1.6, 5), false);
  assert.ok(w.railNear(-3, RISE + 0.5, -2.1)); assert.ok(!w.railNear(-3, RISE + 2, -2.1)); assert.ok(w.railNear(-3, RISE + 0.9, -2.1, 0.1));
});

test("in a room it answers from the room alone", () => {
  w.setRoom({ x0: -3, x1: 3, z0: -3, z1: 3, y: -60, solids: [{ x0: -1, x1: 1, z0: -1, z1: 1 }] });
  try {
    assert.equal(w.heightAt(2, 2), -60); assert.equal(w.floorAt(2, 2), "room");
    assert.ok(w.blocked(0, 0) && w.blocked(4, 0) && !w.blocked(2, 2)); assert.ok(!w.railNear(-3, RISE + 0.5, -2.1));
  } finally { w.setRoom(null); }
  assert.equal(w.room, null); assert.equal(w.loft, null); assert.deepEqual(w.drops, []);
});

test("it imports no level: no plan, no terraces, no terrain", () => {
  const src = fs.readFileSync(new URL("../../app/src/plan-walker.js", import.meta.url), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./geo.js"]);
  assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /\bSITE\b|\bLEVELS\b|\bAPPROACH\b|\bterrain\b|levels\//);
});
