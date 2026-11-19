// The debug panel's drawing of what stops him (#274, app/src/walkviz.js): what it would draw, without a renderer.
import test from "node:test"; import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
const { cellsNear, outlineRings, VIZ } = await import("../../app/src/walkviz.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { OUTLINE, BAKE } = await import("../../tools/walk/bake.mjs");

const file = ensure(prepare()), decoded = decode(file.bytes, (b) => inflateRawSync(b), () => "floors");

test("the baked file carries what the drawing needs: his outline and the bake's settings, as it was baked with", () => {
  assert.deepEqual(decoded.header.outline, OUTLINE); assert.equal(decoded.header.bake.EYE_R, BAKE.EYE_R); assert.equal(decoded.header.bake.EYE, BAKE.EYE);
});

test("the cells round him: every cell with a floor within the radius, green where he may stand, red where he may not, at the floor's own height", () => {
  const g = decoded.grids.find((q) => q.kind === "outdoors"), seed = decoded.header.grids.find((q) => q.kind === "outdoors").seeds[0];
  const c = cellsNear(g, seed[0], seed[1]);
  assert.ok(c.open > 2000 && c.shut > 100, `${c.open} open and ${c.shut} shut cells round where he arrives`);
  assert.equal(c.positions.length, (c.open + c.shut) * 3); assert.equal(c.colors.length, c.positions.length);
  let far = 0, green = 0;
  for (let n = 0; n < c.positions.length; n += 3) {
    far = Math.max(far, Math.hypot(c.positions[n] - seed[0], c.positions[n + 2] - seed[1]));
    const k = g.cell(c.positions[n], c.positions[n + 2]); assert.ok(Math.abs(c.positions[n + 1] - (g.height[k] / 100 + g.base + VIZ.lift)) < 1e-4, "a dot at the floor's height");
    const isGreen = c.colors[n + 1] > c.colors[n]; assert.equal(isGreen, g.state[k] === 0); if (isGreen) green++;
  }
  assert.ok(far <= VIZ.radius + 0.1 && far > VIZ.radius - 0.5, `the farthest dot is ${far.toFixed(2)} m from him`); assert.equal(green, c.open);
  // in every room and on the balcony too
  for (const q of decoded.grids) { const s = decoded.header.grids.find((h) => h.id === q.id).seeds[0], r = cellsNear(q, s[0], s[1]); assert.ok(r.open > 300, `${q.id}: ${r.open} open cells round its door`); }
});

test("his outline is drawn as it was measured: a ring at each height, as wide as he reaches there; his shoes and hem below the knee", () => {
  const r = outlineRings(OUTLINE, BAKE.CLIMB, 16), rings = OUTLINE.reach.filter((v, n) => ((n + 0.5) * OUTLINE.bin < BAKE.CLIMB ? OUTLINE.low[n] : v) > 0).length;
  assert.equal(r.positions.length, rings * 16 * 2 * 3);
  let widest = 0, top = 0; for (let n = 0; n < r.positions.length; n += 3) { widest = Math.max(widest, Math.hypot(r.positions[n], r.positions[n + 2])); top = Math.max(top, r.positions[n + 1]); }
  assert.ok(Math.abs(widest - Math.max(...OUTLINE.reach)) < 1e-6, `the widest ring is ${widest}`); assert.ok(top > 1.0 && top < 1.5, `the top ring is at ${top} m`);
});
