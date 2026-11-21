// What hangs over the Wuliang hall's passage (app/levels/t05/wuliang-frame.js): the lead's note on #492 was that looking up
// from the passage there is one flat black sheet, the boards' underside. The roof is left open to its timber now. Asked of
// the frame as built: that something is there to be seen (beams and purlins across the passage, rafters along it), that it
// all lies under the boards and none of it stands out through them, and that none of it is within a head's reach of the
// passage floor (the eye in third person rides above his head, and the near plane must cut into nothing).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildHall } = await import("../../app/src/building.js");
const { hallOptions } = await import("../../app/levels/t05/gates.js");
const { HALL } = await import("../../app/levels/t05/axis.js");
const { frameParts } = await import("../../app/levels/t05/wuliang-frame.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const opts = hallOptions(HALL), b = buildHall(M, { ...opts, rise: opts.rise ?? 1, ground: 0 });
const parts = frameParts(b, HALL), all = [...parts.wood, ...parts.woodZ];
const box3 = (g) => { g.computeBoundingBox(); return g.boundingBox.clone(); };
const boxes = all.map(box3);
const ix = HALL.xs[Math.floor((HALL.xs.length - 1) / 2) + 1];   // the passage's half width: the middle bay's column line

test("over the passage there is timber to see: beams along it on the inner column lines, purlins across it, rafters between", () => {
  const across = parts.wood.map(box3).filter((x) => x.max.x - x.min.x > 2 * ix);
  assert.ok(across.length >= 5, `purlins run across the passage (${across.length})`);
  const alongBeams = parts.woodZ.map(box3).filter((x) => x.max.z - x.min.z > 6 && x.max.x - x.min.x < 0.5);
  assert.ok(alongBeams.length >= 8, `two tiers of tie beam on each of the four inner column lines (${alongBeams.length})`);
  const rafters = parts.woodZ.map(box3).filter((x) => x.max.x - x.min.x < 0.2 && x.max.z - x.min.z < 1 && Math.abs((x.min.x + x.max.x) / 2) < ix - 0.2);
  const lines = new Set(rafters.map((x) => ((x.min.x + x.max.x) / 2).toFixed(2)));
  assert.ok(lines.size >= 6, `a rafter every half metre across the passage (${lines.size} lines)`);
});

test("all of it lies under the boards: no corner of any piece is above the roof's underside over it", () => {
  const sheet = [];
  b.group.traverse((o) => { if (o.isMesh && o.material === M.rafters) sheet.push(o); });
  assert.ok(sheet.length > 0, "the roof's underside is drawn in the rafters material");
  for (const o of sheet) o.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
  ray.far = 12;
  const bad = [];
  for (const [i, g] of all.entries()) {
    const p = g.attributes.position, seen = new Set();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k); const key = v.toArray().map((q) => q.toFixed(3)).join(); if (seen.has(key)) continue; seen.add(key);
      ray.set(new THREE.Vector3(v.x, v.y - 0.3, v.z), up);
      const hit = ray.intersectObjects(sheet, false).find((h) => h.point.y > v.y - 0.3);
      if (!hit || hit.point.y < v.y - 0.02) bad.push([i, v.toArray().map((q) => +q.toFixed(2)), hit ? +hit.point.y.toFixed(2) : null]);
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} corners stand out through the boards (of ${all.length} pieces)`);
});

test("none of it is within reach of a head: the lowest piece over the passage is over 4.2 m above its floor", () => {
  const floor = b.platH;
  let low = Infinity;
  for (const x of boxes) if (x.min.x < ix && x.max.x > -ix) low = Math.min(low, x.min.y - floor);
  assert.ok(low > 4.2, `the lowest timber over the passage is ${low.toFixed(2)} m above the floor`);
});
