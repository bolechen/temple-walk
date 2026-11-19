// Anything that carries writing or a picture is drawn on one side only (#252, from #245's plaque-back test). A mesh whose
// material has a picture on it (a name board, a frame's sheet, a slip, a seal) must show that picture on triangles that all
// face one way, and in a material that does not draw its back: a box lettered on all six faces, or a double-sided sheet,
// reads backwards from behind. `KNOWN` is what the walk-round survey found wrong on the day it was written (docs/t00/around-review.md);
// each is a bug to fix, not a pass: the list may only get shorter, and a new offender fails the test.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildDrawn } = await import("../../tools/walk/scene.mjs");

const KNOWN = new Set([]);   // the screen wall's two panels were the last (#272)

/** Every picture-bearing mesh in `root`: the way(s) its pictured triangles face, in the mesh's own frame, and the material's side. */
export function pictured(root) {
  const out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material], g = o.geometry, p = g.attributes.position, idx = g.index, cnt = idx ? idx.count : p.count;
    const dirs = [];
    for (let i = 0; i + 2 < cnt; i += 3) {
      const gr = g.groups.find((q) => i >= q.start && i < q.start + q.count), m = Array.isArray(o.material) ? mats[gr ? gr.materialIndex : 0] : o.material;
      if (!m || !m.map || m.type === "ShaderMaterial" || m.blending === THREE.AdditiveBlending || o.userData.ground) continue;
      const at = (k) => (idx ? idx.getX(i + k) : i + k);
      a.fromBufferAttribute(p, at(0)); b.fromBufferAttribute(p, at(1)); c.fromBufferAttribute(p, at(2));
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize(); n.transformDirection(o.matrixWorld);
      if (!dirs.some((d) => d.dot(n) > 0.5)) dirs.push(n.clone());
    }
    if (!dirs.length) return;
    const double = mats.some((m) => m && m.map && m.side === THREE.DoubleSide);
    const w = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3()), ct = box.getCenter(new THREE.Vector3());
    out.push({ mesh: o, name: `${o.name || o.userData.plaque?.text || o.type} at (${ct.x.toFixed(1)}, ${ct.y.toFixed(1)}, ${ct.z.toFixed(1)}) ${sz.x.toFixed(2)}×${sz.y.toFixed(2)}×${sz.z.toFixed(2)}`, dirs: dirs.length, double });
  });
  return out;
}

test("every picture on the plan and in the halls is drawn on one side only", () => {
  const { site, rooms } = buildDrawn(), found = [];
  for (const root of [site.root, rooms.group]) for (const p of pictured(root)) {
    if (p.dirs > 1) found.push(`${p.name}: picture drawn facing ${p.dirs} ways`);
    if (p.double) found.push(`${p.name}: picture in a double-sided material`);
  }
  assert.ok(pictured(site.root).length >= 18, "the name boards at least were found");
  const fresh = found.filter((f) => !KNOWN.has(f));
  assert.deepEqual(fresh, []);
});
