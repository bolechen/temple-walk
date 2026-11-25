// No two faces lie flat on one another (z-fighting). Where two faces share a plane, face the same way and overlap, the depth
// buffer cannot say which is in front, and the picture flickers between them as the eye moves. The measurement is
// tools/flush-faces.mjs (after Kiln's FLUSH_FACES check, our own implementation): every drawn triangle of each level as
// the page builds it, with its real materials. What it found on the day it was written is in flush-faces.known.json and
// is let pass, so that CI stays green while each is looked at: a new pair fails, and a pair that has gone must be taken
// off the list, which may only get shorter.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
const { drawnScene, gatherTriangles, flushFaces, label, FLUSH } = await import("../../tools/flush-faces.mjs");
const { LEVELS } = await import("../../app/src/level.js");

const KNOWN = JSON.parse(readFileSync(new URL("./flush-faces.known.json", import.meta.url), "utf8"));

test("the measurement finds two boxes laid face to face, and not two that only touch", () => {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c }), root = new THREE.Group();
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); root.add(o); return o; };
  // A board laid in a step with its top flush with the step's top: the two tops fight over 0.5 × 0.5 m.
  const step = M(0x888888);
  box(2, 1, 2, step, 0, 0.5, 0); box(0.5, 0.2, 0.5, M(0x664422), 0, 0.9, 0);
  // A crate standing on the step (its bottom against the step's top, facing each other) is contact; a block of the
  // step's own material flush with it is a tie that does not show.
  box(0.4, 0.4, 0.4, M(0x224466), 0.7, 1.2, 0.7); box(0.3, 0.3, 0.3, step, -0.7, 0.85, 0);
  // A sheet a centimetre proud of a wall is not on its plane.
  box(1, 1, 0.1, M(0x999999), 0, 2, -3);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), M(0xffffff)); sheet.position.set(0, 2, -2.94); root.add(sheet);
  const r = flushFaces(gatherTriangles(root));
  assert.equal(r.pairs.length, 1, JSON.stringify(r.pairs, null, 1));
  assert.ok(Math.abs(r.pairs[0].area - 0.25) < 1e-6, `the shared area is the board's top: ${r.pairs[0].area}`);
  assert.deepEqual(r.pairs[0].normal, [0, 1, 0]);
});

for (const id of Object.keys(LEVELS)) {
  test(`${id}: no faces lie flat on one another, beyond those already listed`, async () => {
    const { scene } = await drawnScene(id), r = flushFaces(gatherTriangles(scene)), known = KNOWN[id] || {};
    assert.ok(r.triangles > 1000, "the level was built");
    const found = new Map(r.pairs.map((p) => [label(p), p]));
    const fresh = [...found.values()].filter((p) => !Object.hasOwn(known, label(p)))
      .map((p) => `${p.area.toFixed(4)} m² ${label(p)} (normal ${p.normal.join(",")}, ${p.gap * 1000} mm apart)`);
    assert.deepEqual(fresh, [], `faces within ${FLUSH.gap * 1000} mm of one plane, facing one way and overlapping: part them by a few millimetres, take away the covered face, or cut the opening (node tools/flush-faces.mjs --level=${id})`);
    const gone = Object.keys(known).filter((k) => !found.has(k));
    assert.deepEqual(gone, [], `no longer found: take these off tests/unit/flush-faces.known.json`);
  });
}
