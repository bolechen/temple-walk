// A name board is written on its front only (#245). The plain board used to be one box with the lettered texture on all six
// faces, so that the pavilion at the start showed 望江亭 read forwards from behind and squashed along its four edges.
// Every triangle of every board that does not face the way the board hangs (+z in its own frame) must be drawn with a
// material that carries no picture.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite } from "../../app/src/site.js";
import { makePlaque } from "../../app/src/plaque.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });

// The faces of a board that look away from its front, with the material each is drawn in (a box's groups included).
function rear(root) {
  const bad = [], n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, p = g.attributes.position, idx = g.index, cnt = idx ? idx.count : p.count, rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i + 2 < cnt; i += 3) {
      const at = (k) => idx ? idx.getX(i + k) : i + k;
      a.fromBufferAttribute(p, at(0)).applyMatrix4(rel); b.fromBufferAttribute(p, at(1)).applyMatrix4(rel); c.fromBufferAttribute(p, at(2)).applyMatrix4(rel);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      if (n.z > 0.5) continue;   // the front
      const gr = g.groups.find((q) => i >= q.start && i < q.start + q.count), m = Array.isArray(o.material) ? o.material[gr ? gr.materialIndex : 0] : o.material;
      if (m && m.map) bad.push(`${o.name || o.type}: normal (${n.toArray().map((q) => q.toFixed(1))}) drawn with a picture`);
    }
  });
  return bad;
}

const wood = named("wood");
const kinds = {
  "plain, across": ["望江亭", { style: "wood", back: wood }], "plain, upright": ["功德箱", { vertical: true, style: "ink", seals: false, back: wood }],
  "gilt": ["正法眼藏", { gold: true, back: wood }], "banded": ["云径禅寺", { vertical: true, back: wood }], "bare": ["云径禅寺", { bare: true, back: wood }],
};
for (const [name, [text, opts]] of Object.entries(kinds)) test(`${name} board: only its front is lettered`, () => {
  const bad = rear(makePlaque(text, opts)); assert.deepEqual(bad.slice(0, 4), []);
});

test("every board on the plan: nothing but the front carries the writing", () => {
  const site = buildSite(M), boards = []; site.root.traverse((o) => { if (o.userData.plaque) boards.push(o); });
  assert.ok(boards.length >= 18);
  for (const b of boards) assert.deepEqual(rear(b).slice(0, 3), [], b.userData.plaque.text);
});
