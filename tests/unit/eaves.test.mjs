// Under the eaves of the Guanyin hall: the strip of porch between its lattice and the edge of its platform, the ground
// in front of it under the eave's lip, the alley between it and the patriarchs' hall, and the walk behind it.
// Two things went wrong there (2026-11-15): the eye that follows him went into the building, its walls, columns and
// eaves; and on the west half of the porch he could not get down, because the lamp stand stood where he would land.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker, LEVELS } from "../../app/src/site.js";
import { findDrop } from "../../app/src/drop.js";
import { followEye } from "../../app/src/eye.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site), T2 = LEVELS[1];
site.root.updateMatrixWorld(true);
const GZ = T2.zS - 12.2;   // the Guanyin hall's centre
const near = (g, x, z) => Math.abs(g.position.x - x) < 0.01 && Math.abs(g.position.z - z) < 0.01 && Math.abs(g.position.y - T2.y) < 0.01;
const guanyin = site.root.children.find((g) => near(g, 0, GZ)), dahui = site.root.children.find((g) => near(g, 16.4, T2.zS - 12));
const front = site.walk.drops.filter((e) => e.normal[1] === 1 && Math.abs(e.a[1] - (GZ + 6.6)) < 0.05);

test("the Guanyin hall and its porch edges are where the test thinks they are", () => {
  assert.ok(guanyin && dahui, "found both halls");
  assert.equal(front.length, 2, "two stretches of open porch edge, either side of the stair");
});

test("from anywhere along the Guanyin hall's open front he can hop down", () => {
  for (const e of front) {
    // From beside the stair's cheek (where the stair is the way down) to the corner of the platform.
    const [inner, outer] = Math.abs(e.a[0]) < Math.abs(e.b[0]) ? [e.a[0], e.b[0]] : [e.b[0], e.a[0]], dir = Math.sign(outer - inner);
    for (let along = 0.6; along <= Math.abs(outer - inner) - 0.3; along += 0.1) {
      const x = inner + dir * along; let z = null;
      for (let back = 0.2; back < 0.65; back += 0.02) if (!walker.blocked(x, e.a[1] - back)) { z = e.a[1] - back; break; }
      if (z === null) continue;   // a column stands just behind this bit of the edge
      assert.ok(findDrop(walker, [e], x, z, 0, 1), `at x=${x.toFixed(2)} on the porch, facing the court, there is no way down`);
    }
  }
});

test("there is room to walk between the Guanyin porch and the lamp stand", () => {
  const x = site.places.lamp.at[0], stand = site.places.lamp.flame[2];   // the lamps burn in the middle of the stand
  let free = 0; for (let z = GZ + 6.6; z < stand; z += 0.02) if (!walker.blocked(x, z)) free += 0.02;
  assert.ok(free > 0.7, `only ${free.toFixed(2)} m of standing room in front of the porch at the lamp stand`);
});

// The eye must not be inside anything, and nothing may stand between it and him: a ray from his head out to the
// eye's side, and from there back to the eye (and a hand past it, where the lens's near plane cuts), meets nothing
// of either hall.
const ray = new THREE.Raycaster(), meshes = [];
for (const g of [guanyin, dahui]) g.traverse((o) => o.isMesh && meshes.push(o));
function hits(a, b) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length(); if (len < 1e-4) return null;
  ray.set(a, d.divideScalar(len)); ray.near = 0; ray.far = len;
  return ray.intersectObjects(meshes, false)[0] || null;
}
test("the following eye stays out of the Guanyin hall: porch, eave lip, alley and the walk behind", () => {
  const spots = [[-8, -74.5], [-4, -74.0], [0, -74.4], [4, -74.6], [8.5, -74.1], [9.6, -74.2], [-9, GZ + 7.25], [6, GZ + 7.25], [11.35, -76], [11.35, -84.5], [0, GZ - 7.25], [-9, GZ - 7.25]];
  const bad = [];
  for (const [x, z] of spots) {
    assert.ok(!walker.blocked(x, z), `(${x}, ${z}) is somewhere he can stand`);
    const foot = walker.heightAt(x, z);
    for (let k = 0; k < 8; k++) for (const pitch of [-1.0, -0.6, -0.2, 0.3]) for (const side of [0, 1.2]) {
      const yaw = (k * Math.PI) / 4, e = followEye(walker, { x, z, foot, eyeY: foot, yaw, pitch, side, reach: 6.2 });
      const head = new THREE.Vector3(x, e.ty, z), o = new THREE.Vector3(e.ox, e.ty, e.oz), cam = new THREE.Vector3(...e.at(e.d));
      const past = cam.clone().sub(o).setLength(0.12).add(cam);   // the near plane, just behind the eye
      const h = hits(head, o) || hits(o, cam.distanceTo(o) > 1e-3 ? past : cam.clone().add(new THREE.Vector3(-e.lx, -e.ly, -e.lz).multiplyScalar(0.12)));
      if (h) bad.push(`at (${x}, ${z}) yaw ${k}/8 pitch ${pitch} side ${side}: eye at (${cam.toArray().map((v) => v.toFixed(2))}) is behind or inside ${h.object.material.name || "something"} at ${h.point.toArray().map((v) => v.toFixed(2))}`);
    }
  }
  assert.equal(bad.length, 0, `${bad.length} placements of the eye are inside the building:\n` + bad.slice(0, 12).join("\n"));
});
