// The great hall's bracket sets under its roof (#741, second PR): the eave purlin on their outermost arms is the roof's own eave
// purlin, where its fold begins, and it lies under the roof's boards; each corner beam rests on the two eave purlins' crossing,
// the corner set's top; the corner set's diagonal slanting arms stay in among the sides' arms, not out past that crossing.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { HALL, ZS, XS, buildHall } = await import("../../app/levels/t05/hall.js");
const { cornerSet, REACH, CORNER_REACH, DOU } = await import("../../app/levels/t05/dougong.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const h = buildHall(M), dg = h.dougong, X = XS[XS.length - 1], zB = ZS[ZS.length - 1];

test("the bracket sets' eave purlin is the roof's eave purlin: the fold begins over it", () => {
  assert.ok(Math.abs(h.roof.purlin - (HALL.overhang - dg.reach)) < 1e-6, `the roof's purlin ${h.roof.purlin.toFixed(3)} m in from the eave, the sets' ${(HALL.overhang - dg.reach).toFixed(3)}`);
  assert.ok(dg.fen > 0.016 && dg.fen < 0.02, `a fen of ${dg.fen.toFixed(4)} m (a timber ${(15 * dg.fen).toFixed(3)} m deep; S04 measured 0.28–0.29)`);
});

test("the eave purlin's top lies under the roof's boards, within a centimetre, on every side", () => {
  const t = DOU.purlin.t * dg.fen / 2;
  for (const [name, x, z] of [["front", 0, ZS[0] + dg.reach + t], ["back", 0, zB - dg.reach - t], ["east", X + dg.reach + t, h.roof.zm], ["west", -X - dg.reach - t, h.roof.zm]]) {
    const gap = h.roof.underAt(x, z) - dg.purlinTop;
    assert.ok(Math.abs(gap) < 0.01, `${name}: the boards ${gap.toFixed(4)} m over the purlin's top`);
  }
});

test("each corner beam rests on the eave purlins' crossing, the corner set's top", () => {
  assert.equal(h.roof.cornerBeams.length, 4, "four corner beams, each resting");
  for (const b of h.roof.cornerBeams) {
    assert.ok(Math.abs(b.rest - dg.purlinTop) < 1e-9, "the rest is the purlins' top");
    const gap = b.bottom(b.x, b.z) - b.rest;
    assert.ok(Math.abs(gap) < 0.01, `the beam's underside ${gap.toFixed(4)} m off the crossing at (${b.x.toFixed(2)}, ${b.z.toFixed(2)})`);
    assert.ok(Math.abs(Math.abs(b.x) - (X + dg.reach)) < 1e-6 && Math.abs(Math.abs(b.z - (b.z > 0 ? ZS[0] : zB)) - dg.reach) < 1e-6, "at the crossing in plan");
  }
});

test("the corner set's diagonal arms stay within the sides' reach, not out past the eave purlins' crossing", () => {
  const g = new THREE.Box3();
  for (const geo of cornerSet(dg.fen)) { geo.computeBoundingBox(); g.union(geo.boundingBox); }
  // in the set's own frame x runs out along the end and z along the front: the crossing is at (reach, reach)
  const over = Math.max(g.max.x, g.max.z) - REACH(dg.fen);
  assert.ok(over < DOU.purlin.t * dg.fen, `the set reaches ${over.toFixed(3)} m past the crossing (the purlin's own thickness, ${(DOU.purlin.t * dg.fen).toFixed(3)}, at most)`);
  assert.ok(CORNER_REACH.every((n) => n < 4), "the diagonal arms are held within the sides' four steps");
});
