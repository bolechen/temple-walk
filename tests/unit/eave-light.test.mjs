// The light under the eaves (issue #212): the bracket sets, the beams on the column heads and the plate over them, and
// the eave purlin take light back from the court on the faces turned down and out to it; nothing else built changes.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { box, merge, bakeAO } from "../../app/src/geo.js";
import { buildHall, EAVE_BOUNCE } from "../../app/src/building.js";

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
// The buildings the plan has, by the parts that matter here: a plain hall, a gate with a balcony storey over a ring of
// sets, an upper storey walked round on the column heads of the one below, and a pavilion with no sets at all.
const KINDS = {
  hall: {},
  main: { cai: 0.232, xs: [-14.4, -10.8, -6.9, -2.7, 2.7, 6.9, 10.8, 14.4], zs: [8.6, 4.3, 0, -4.3, -8.6], platH: 1.5, colTop: 4.8, overhang: 2.6 },
  ping: { cai: 0.232, ping: true, platBase: 4, platH: 4.4, xs: [-6.2, -2.5, 2.5, 6.2], zs: [3, -3], colTop: 3.0, overhang: 1.8 },
  ring: { cai: 0.186, ping: true, pingRing: [-5.4, -3.4, 3.4, 5.4], platBase: 4, platH: 4.4, xs: [-3.4, -1.2, 1.2, 3.4], zs: [3.4, 1.2, -1.2, -3.4], colTop: 3.0, overhang: 2.0 },
  pavilion: { xs: [-1.5, 1.5], zs: [1.5, -1.5], G: 9, brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 0, walkAll: true },
};
const meshes = (b) => { const out = []; b.group.traverse((m) => m.isMesh && out.push(m)); return out; };

test("a three-argument occlusion is baked as before, whatever the normals say", () => {
  const fn = (x, y, z) => 0.3 + 0.1 * Math.sin(x * 3 + y * 2 - z);
  const a = merge([box(1, 1, 1, 0, 0, 0), new THREE.SphereGeometry(1, 8, 6)]), b = a.clone();
  const n = b.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  bakeAO(a, fn); bakeAO(b, fn);
  const p = a.attributes.position;
  for (let i = 0; i < p.count; i++) { const want = Math.fround(fn(p.getX(i), p.getY(i), p.getZ(i))); assert.equal(a.attributes.ao.getX(i), want); assert.equal(b.attributes.ao.getX(i), want); }
});

test("everything not lit from the court keeps its occlusion point for point", () => {
  for (const [kind, opts] of Object.entries(KINDS)) {
    const b = buildHall(M, opts);
    for (const m of meshes(b)) {
      if (m.userData.ao !== "position") continue;
      const p = m.geometry.attributes.position, ao = m.geometry.attributes.ao;
      for (let i = 0; i < p.count; i++) assert.equal(ao.getX(i), Math.fround(b.aoAt(p.getX(i), p.getY(i), p.getZ(i))), `${kind}: a mesh away from the sets changed its occlusion`);
    }
  }
});

test("only the sets, the beams and plate on the column heads, and the eave purlin are lit from the court", () => {
  for (const [kind, opts] of Object.entries(KINDS)) {
    const b = buildHall(M, opts), lit = meshes(b).filter((m) => m.userData.ao === "eave");
    const want = opts.brackets === false ? 2 : opts.ping ? 6 : 5;   // the beams and plate (two meshes), and with sets: the sets, the purlins (two), and the balcony's sets
    assert.equal(lit.length, want, `${kind}: ${lit.length} meshes lit from the court`);
    for (const m of lit) assert.ok(m.material === M.woodX || m.material === M.woodZ, `${kind}: something other than timber lit from the court`);
  }
});

test("under the eave the faces turned down and out are lit back; up to the boards they stay dark; beyond the eave nothing changes", () => {
  const b = buildHall(M, KINDS.main), sets = meshes(b).filter((m) => m.userData.ao === "eave");
  let down = 0, up = 0, nDown = 0, nUp = 0;
  for (const m of sets) {
    const p = m.geometry.attributes.position, n = m.geometry.attributes.normal, ao = m.geometry.attributes.ao;
    for (let i = 0; i < p.count; i++) {
      const base = b.aoAt(p.getX(i), p.getY(i), p.getZ(i)), v = ao.getX(i);
      assert.ok(v >= Math.fround(base) - 1e-6 && v <= EAVE_BOUNCE + 1e-6, "lit back beyond the bounce, or darker than before");
      if (base > 1 - 1e-9) assert.equal(v, 1, "a face the roof does not cover changed");
      if (base < 0.5) { if (n.getY(i) < -0.97) { down += v; nDown++; } else if (n.getY(i) > 0.97) { up += v; nUp++; assert.ok(Math.abs(v - base) < 1e-6, "a face turned up to the eave boards was lit back"); } }
    }
  }
  assert.ok(nDown > 50 && nUp > 50);
  assert.ok(down / nDown > 1.4, `the undersides of the arms are not lit back from the court: ${(down / nDown).toFixed(2)}`);
  assert.ok(up / nUp < 0.5, `the tops of the arms took light they cannot see: ${(up / nUp).toFixed(2)}`);
});
