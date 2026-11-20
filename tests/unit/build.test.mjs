import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { box, merge, mesh, plain, bakeAO, stairGeo, mergeStatic } from "../../app/src/geo.js";
import { buildHall } from "../../app/src/building.js";
const { createMonk } = await import("../../app/src/monk.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const tris = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return n; };
const finite = (o) => { o.traverse((m) => { if (!m.isMesh) return; const p = m.geometry.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) throw new Error("a vertex is not a number in " + (m.material.name || "mesh")); }); };

test("geometry helpers", () => {
  const g = merge([box(1, 1, 1, 0, 0, 0), new THREE.SphereGeometry(1, 8, 6)]);
  assert.ok(g.attributes.position && g.attributes.normal && g.attributes.uv && !g.index);
  bakeAO(g, (x, y) => (y > 0 ? 1 : 0.5)); assert.equal(g.attributes.ao.count, g.attributes.position.count);
  const s = stairGeo(3, 1.8); assert.ok(Math.abs(s.run - 0.34 * 10) < 1e-9); s.geo.computeBoundingBox(); assert.ok(Math.abs(s.geo.boundingBox.max.y - 1.8) < 0.3);
  assert.ok(plain(new THREE.BoxGeometry(1, 1, 1)).index === null);
});
test("a hall, built from its numbers, is whole", () => {
  const b = buildHall(M, {});
  finite(b.group); assert.ok(tris(b.group) > 5000);
  b.group.traverse((m) => { if (m.isMesh && m.userData.eye !== "stop" && m.material !== M.dark && m.material !== M.flame && m.material !== M.interior(0)) assert.ok(m.geometry.attributes.ao, "a mesh without baked occlusion"); });
  assert.ok(b.walk.solids.length >= 1 && b.walk.ramps.length === 1 && b.walk.decks.length === 2);
  assert.ok(b.roofAt(0) < b.roofAt(3) && b.ridgeY > b.eaveY && b.eaveY > b.colTop);
});
test("every kind of building the plan uses can be built", () => {
  const kinds = {
    gate: { xs: [-5, -2, 2, 5], zs: [2.4, -2.4], front: "pass", back: "pass", dark: false, steps: 3, stepsBack: 3 },
    pavilion: { xs: [-1.5, 1.5], zs: [1.5, -1.5], G: 9, brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 0, walkAll: true },
    walk: { xs: [-6, -3, 0, 3, 6], zs: [1.1, -1.1], G: 0, brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 0, walkAll: true },
    railed: { rail: true, steps: 6 }, upper: { platH: 6, platBase: 5.6, platOut: 0.05, dark: false, steps: 0, rail: true },
  };
  for (const [name, o] of Object.entries(kinds)) { const b = buildHall(M, o); finite(b.group); assert.ok(tris(b.group) > 500, name); }
});
test("merging what never moves keeps every triangle and leaves the marked meshes alone", () => {
  const root = new THREE.Group(), a = new THREE.MeshBasicMaterial(), b = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 6; i++) { const m = mesh(box(1, 1, 1, 0, 0, 0), i % 2 ? a : b); m.position.set(i, 0, i < 3 ? 10 : -10); root.add(m); }
  const kept = mesh(box(1, 1, 1, 0, 0, 0), a); kept.userData.keep = true; root.add(kept);
  const before = tris(root), r = mergeStatic(root, [0, -1e9]);
  assert.equal(tris(root), before); assert.equal(r.before, 6); assert.equal(r.after, 4); assert.ok(root.children.includes(kept));
  const box3 = new THREE.Box3().setFromObject(root); assert.ok(box3.max.x > 5 && box3.min.z < -9, "merged meshes keep their places");
});
test("the novice stands, walks and prays without coming apart", () => {
  const monk = createMonk(); finite(monk.group); assert.ok(tris(monk.group) > 8000, "he should be finely made");
  for (let i = 0; i < 400; i++) monk.update(1 / 60, i < 200 ? 2.1 : 0, i > 250, i / 60);
  monk.group.updateMatrixWorld(true);
  monk.group.traverse((o) => { for (const v of o.matrixWorld.elements) assert.ok(Number.isFinite(v)); });
  const size = new THREE.Box3().setFromObject(monk.group).getSize(new THREE.Vector3());
  assert.ok(size.y > 1.0 && size.y < 1.4, "a child's height, got " + size.y.toFixed(2));
});
