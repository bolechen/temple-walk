// Two sweeps over the whole temple, so that a building or a prop put down later, or a new level built with the same
// plan, is held to what the Guanyin hall's eaves were (eaves.test.mjs):
//  - the eye that follows him never stands inside a building, nor with a building between it and him;
//  - wherever a porch edge offers a hop down, it can be taken along its whole open length.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker } from "../../app/src/site.js";
import { findDrop } from "../../app/src/drop.js";
import { followEye } from "../../app/src/eye.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site);
site.root.updateMatrixWorld(true);

// Each building is the group `put` stood at the middle of its footprint; `floor` is the top of its platform.
const halls = site.buildings.map((b) => {
  const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2, under = site.walk.roofs.filter((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  return { name: b.name, group: site.root.children.find((g) => g.isGroup && Math.abs(g.position.x - x) < 0.01 && Math.abs(g.position.z - z) < 0.01), floor: Math.min(...under.map((r) => r.floor)) };
});

test("every building on the plan is found as a group", () => {
  assert.ok(halls.length >= 20, `only ${halls.length} buildings`);
  for (const h of halls) assert.ok(h.group && Number.isFinite(h.floor), `no group or no roof for ${h.name || "a building"}`);
});

test("the following eye stays out of every building and never has one between it and him", () => {
  const ray = new THREE.Raycaster(), bad = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let looks = 0;
  for (const { name, group, floor } of halls) {
    const meshes = []; group.traverse((o) => o.isMesh && meshes.push(o));
    const box = new THREE.Box3().setFromObject(group);
    const seg = (a, b) => { const d = b.clone().sub(a), len = d.length(); if (len < 1e-4) return null; ray.set(a, d.divideScalar(len)); ray.far = len; return ray.intersectObjects(meshes, false)[0] || null; };
    // A dozen places he can stand, anywhere from under its eaves to a metre beyond them.
    for (let n = 0, tries = 0; n < 12 && tries < 4000; tries++) {
      const x = box.min.x - 1 + rnd() * (box.max.x - box.min.x + 2), z = box.min.z - 1 + rnd() * (box.max.z - box.min.z + 2);
      if (walker.blocked(x, z)) continue; n++;
      const foot = walker.heightAt(x, z);
      for (let k = 0; k < 8; k++) for (const pitch of [-1.0, -0.5, -0.15, 0.3]) {
        looks++;
        const e = followEye(walker, { x, z, foot, eyeY: foot, yaw: (k * Math.PI) / 4, pitch, side: 1.2, reach: 6.2 });
        const head = new THREE.Vector3(x, e.ty, z), o = new THREE.Vector3(e.ox, e.ty, e.oz), eye = new THREE.Vector3(...e.at(e.d));
        const lens = new THREE.Vector3(-e.lx, -e.ly, -e.lz).multiplyScalar(0.12).add(eye);   // the near plane, just behind the eye
        const h = seg(head, o) || seg(o, lens);
        // The platform itself, and the floor he stands on, are another matter: an eye looking up from below a floor
        // built out over a slope (the half-way pavilion) sees past its edge, as it sees past a stair's nosing on the climb.
        if (h && h.point.y > Math.max(foot, floor) + 0.05) bad.push(`${name || "?"}: at (${x.toFixed(2)}, ${z.toFixed(2)}) yaw ${k}/8 pitch ${pitch}: ${h.object.material.name} at (${h.point.toArray().map((v) => v.toFixed(2))})`);
      }
    }
  }
  assert.ok(looks > 7000, `only ${looks} looks taken`);
  assert.equal(bad.length, 0, `${bad.length} of ${looks} looks put a building between the eye and him:\n` + bad.slice(0, 12).join("\n"));
});

test("every porch edge that offers a hop down can be hopped from along its whole open length", () => {
  let edges = 0;
  for (const e of site.walk.drops) {
    const [nx, nz] = e.normal, span = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]); let stood = 0;
    // From beside the stair's cheek at one end to beside the corner column at the other.
    for (let along = 0.6; along <= span - 0.6 + 1e-9; along += 0.1) {
      const px = e.a[0] + ((e.b[0] - e.a[0]) * along) / span, pz = e.a[1] + ((e.b[1] - e.a[1]) * along) / span;
      let at = null;
      for (let back = 0.2; back < 0.65 && !at; back += 0.02) { const x = px - nx * back, z = pz - nz * back; if (!walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - e.top) < 0.03) at = [x, z]; }
      if (!at) continue;   // nowhere to stand behind this bit of the edge (a gate's front, a column)
      stood++;
      assert.ok(findDrop(walker, [e], at[0], at[1], nx, nz), `standing at (${at[0].toFixed(2)}, ${at[1].toFixed(2)}) on a porch at ${e.top.toFixed(2)} m, facing out over its edge, there is no way down`);
    }
    if (stood) edges++;
  }
  assert.ok(edges >= 10, `only ${edges} porch edges could be stood behind`);
});

test("the log that strikes the bell is kept out of the eye's way too", () => {
  // Beside the bell tower, walking toward the gate with the view lowered: the eye's line used to pass through the log,
  // which is slung out past the tower's columns.
  const bell = halls.find((h) => h.name === "钟楼"), meshes = []; bell.group.traverse((o) => o.isMesh && meshes.push(o));
  const ray = new THREE.Raycaster();
  for (let x = 16.8; x <= 17.1; x += 0.05) for (let z = 36.4; z <= 36.6; z += 0.05) {
    if (walker.blocked(x, z)) continue;
    const foot = walker.heightAt(x, z), e = followEye(walker, { x, z, foot, eyeY: foot, yaw: Math.PI / 2, pitch: -0.5, side: 1.2, reach: 6.2 });
    const o = new THREE.Vector3(e.ox, e.ty, e.oz), eye = new THREE.Vector3(...e.at(e.d)), d = eye.clone().sub(o), len = d.length();
    ray.set(o, d.divideScalar(len)); ray.far = len;
    const h = ray.intersectObjects(meshes, false)[0];
    assert.ok(!h, `at (${x.toFixed(2)}, ${z.toFixed(2)}) the eye looks through ${h?.object.material.name} at (${h?.point.toArray().map((v) => v.toFixed(2))})`);
  }
});
