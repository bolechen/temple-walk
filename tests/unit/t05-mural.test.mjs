// The ground of the great hall's murals (app/levels/t05/mural.js, #762): laid from the floor up to the column heads and no
// higher, where the bracket sets' inner arms come through the wall; the hall's own walls split by which way each face looks,
// so that what looks into the hall (the boards between the bracket sets with it) takes the ground and what looks out stays
// lime; and its shader free of the words GLSL ES 3 keeps for itself (the first version named a variable `patch`, the shader
// did not compile, and three rounds of measuring read the lime wall behind it).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { readFileSync } from "node:fs";
const { HALL, buildHall } = await import("../../app/levels/t05/hall.js");
const { splitInward, MURAL } = await import("../../app/levels/t05/mural.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const hall = buildHall(M), hp = hall.parts, b = hall.fogShut, heads = HALL.floor + HALL.column;
const faces = (list, fn) => { for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, N = g.attributes.normal; for (let t = 0; t < P.count / 3; t++) { const c = new THREE.Vector3(), n = new THREE.Vector3(); for (let k = 0; k < 3; k++) { const i = 3 * t + k; c.x += P.getX(i) / 3; c.y += P.getY(i) / 3; c.z += P.getZ(i) / 3; n.x += N.getX(i); n.y += N.getY(i); n.z += N.getZ(i); } fn(c, n.normalize()); } } };
const looksIn = (c, n) => n.x * ((b.x0 + b.x1) / 2 - c.x) + n.z * ((b.z0 + b.z1) / 2 - c.z) > 1e-6;

test("the mural ground stands from the hall's floor to the column heads, no higher", () => {
  assert.ok(hp.mural.length >= 3, "the back wall and both end walls");
  for (const g of hp.mural) { g.computeBoundingBox(); assert.ok(g.boundingBox.max.y <= heads + 1e-6, `a mural ground reaches ${g.boundingBox.max.y.toFixed(2)}, over the column heads at ${heads.toFixed(2)}`); assert.ok(g.boundingBox.min.y >= HALL.floor - 1e-6); }
});

test("the hall's walls: every face against a wall that looks into the hall takes the ground, the boards over the column heads with them; the door jambs and every outer face stay lime", () => {
  const [inward, lime] = splitInward(hp.plaster, b, HALL.wall);
  const r = HALL.wall + 0.02, against = (c, nn) => c.y > b.y0 && c.y < b.y1 && c.x > b.x0 - r && c.x < b.x1 + r && c.z > b.z0 - r && c.z < b.z1 + r &&
    ((nn.x > 0.7 && Math.abs(c.x - b.x0) < r) || (nn.x < -0.7 && Math.abs(c.x - b.x1) < r) || (nn.z > 0.7 && Math.abs(c.z - b.z0) < r) || (nn.z < -0.7 && Math.abs(c.z - b.z1) < r));
  let n = 0, high = 0, outN = 0, jambs = 0;
  faces(inward, (c, nn) => { n++; assert.ok(looksIn(c, nn) && against(c, nn), `a face given the ground at ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)} does not stand against a wall looking in`); if (c.y > heads + 0.5) high++; });
  faces(lime, (c, nn) => {
    if (looksIn(c, nn) && against(c, nn)) assert.fail(`a face against a wall that looks in is left lime at ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`);
    if (looksIn(c, nn) && Math.abs(nn.x) > 0.7 && c.z > b.z1 - r && c.z < b.z1 + r && c.y > b.y0 && c.y < b.y1) jambs++;
    if (!looksIn(c, nn)) outN++;
  });
  assert.ok(n > 0 && high > 0, `faces given the ground: ${n}, above the column heads: ${high}`);
  assert.ok(jambs > 0, "the front doors' jambs, sunlit from the terrace, stay lime");
  assert.ok(outN > 0, "the walls' outer faces stay lime");
  // nothing is lost or made twice
  const count = (l) => l.reduce((s, g) => s + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  assert.equal(count(inward) + count(lime), count(hp.plaster));
});

test("the mural ground's shader names nothing GLSL ES 3 reserves, and its numbers are in range", () => {
  const src = readFileSync(new URL("../../app/levels/t05/mural.js", import.meta.url), "utf8");
  const reserved = ["patch", "sample", "input", "output", "filter", "active", "common", "partition", "resource", "subroutine", "superp", "noperspective", "smooth", "flat", "centroid", "invariant", "precise", "buffer", "shared", "coherent", "volatile", "restrict", "readonly", "writeonly", "atomic_uint"];
  for (const w of reserved) assert.ok(!new RegExp(`\\b(float|int|vec[234]|bool)\\s+${w}\\b`).test(src), `the shader declares "${w}", which GLSL ES 3 reserves`);
  assert.ok(MURAL.sky > 0 && MURAL.sky <= 1 && MURAL.bounce >= 0 && MURAL.base.every((x) => x > 0 && x < 1));
  assert.ok(MURAL.base[0] > MURAL.base[1] && MURAL.base[1] > MURAL.base[2], "an earth colour, warm");
});
