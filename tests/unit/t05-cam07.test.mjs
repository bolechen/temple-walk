// cam07, 内山门望殿 (docs/t05/PRD.md §3; #482): the eye in the inner gate's passage looks up the axis, and over the Wuliang hall and through the archway
// the Great Hall's roof is to show. The art director's three tests, measured by ray on what is drawn, in cam07's own lens (50° from top to bottom, 1280×720):
//   1. the ridge's whole length with both ornaments is not stopped by anything (50 of 53 points: three lie inside an ornament's own box);
//   2. on the middle column of pixels the Great Hall's tiles show over the Wuliang hall's ridge for at least 1.5% of the height (11 of 720 px);
//   3. between the ornament's top and the underside of the archway's middle bay's upper small beam at least 7 px of sky or roof show below the beam (the tip is lower on the picture).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { MeshBVH, acceleratedRaycast } = await import("three-mesh-bvh");
const { loadLevel } = await import("../../app/src/level.js");
const { buildDrawn } = await import("../../tools/walk/scene.mjs");
const AX = await import("../../app/levels/t05/axis.js"), GH = await import("../../app/levels/t05/hall.js");

THREE.Mesh.prototype.raycast = acceleratedRaycast;
const drawn = buildDrawn(await loadLevel("t05")); drawn.scene.updateMatrixWorld(true);
const meshes = []; drawn.scene.traverse((o) => { if (o.isMesh && !o.userData.land && o.userData.walk !== false && o.visible) { o.geometry.boundsTree = new MeshBVH(o.geometry); meshes.push(o); } });
const [vx, vz, yaw, pitch] = drawn.site.views.cam07, eyeY = AX.SECOND.y + 1.6;
const cam = new THREE.PerspectiveCamera(50, 1280 / 720, 0.1, 2000); cam.position.set(vx, eyeY, vz);
cam.lookAt(vx + Math.sin(yaw) * Math.cos(pitch) * 10, eyeY + Math.sin(pitch) * 10, vz - Math.cos(yaw) * Math.cos(pitch) * 10); cam.updateMatrixWorld(true);
const rc = new THREE.Raycaster(); rc.near = 0.05;
const first = (origin, dir, far) => { rc.set(origin, dir); rc.far = far; let b = null; for (const o of meshes) for (const i of rc.intersectObject(o, false)) if (!b || i.distance < b.d) b = { d: i.distance, p: i.point.clone(), m: o.material.name }; return b; };
const row = (p) => ((1 - new THREE.Vector3(...p).project(cam).y) / 2) * 720;
const R = GH.RIDGE;

test("cam07 stands in the inner gate's passage, four metres behind its north face, looking up the axis", () => {
  assert.equal(vx, 0); assert.equal(vz, AX.AXIS.innerZ + 1); assert.equal(yaw, 0);
  assert.ok(Math.abs(AX.FOOT.inner.z0 + 4.2 - AX.AXIS.innerZ) < 1e-9 && vz > AX.AXIS.innerZ - 3 && vz < AX.AXIS.innerZ + 3, "between the gate's two columns lines");
});

test("1: the Great Hall's ridge, along its length and to both ornaments, is not stopped by anything: at least 50 of 53 points", () => {
  const eye = cam.position.clone(), pts = [];
  for (let x = -R.rx; x <= R.rx + 1e-6; x += 0.5) pts.push([x, R.height + 0.4 - 0.4 + 0.1, R.zm]);
  for (const s of [-1, 1]) pts.push([s * R.rx, R.ornamentTop - 0.05, R.zm + 0.64], [s * (R.rx - 0.3), R.ornamentTop - 0.05, R.zm + 0.64], [s * R.rx, R.ornamentTop - 0.6, R.zm + 0.64]);
  assert.ok(pts.length >= 52);
  let seen = 0; const hidden = [];
  for (const p of pts) { const P = new THREE.Vector3(...p), dir = P.clone().sub(eye), L = dir.length(); dir.normalize(); const h = first(eye, dir, L); if (h && h.d < L - 0.4) hidden.push(`${p.map((n) => n.toFixed(1))} by ${h.m} at (${h.p.x.toFixed(1)}, ${h.p.y.toFixed(1)}, ${h.p.z.toFixed(1)})`); else seen++; }
  assert.ok(seen >= pts.length - 3, `${seen} of ${pts.length} seen; hidden: ${hidden.slice(0, 6).join("; ")}`);
});

test("2: on the middle column the Great Hall's tiles show for at least 11 of 720 rows", () => {
  let tiles = 0;
  for (let r = 300; r < 460; r++) {
    rc.setFromCamera(new THREE.Vector2(0, 1 - ((r + 0.5) / 720) * 2), cam); rc.far = 3000;
    let b = null; for (const o of meshes) for (const i of rc.intersectObject(o, false)) if (!b || i.distance < b.d) b = { d: i.distance, z: i.point.z, y: i.point.y, m: o.material.name };
    if (b && b.m === "tile" && b.z < 6 && b.y > 11) tiles++;
  }
  assert.ok(tiles >= 11, `${tiles} rows`);
});

test("3: the ornament's top stands at least 7 px lower on the picture than the underside of the archway's middle bay's upper small beam", () => {
  const beam = row([0, AX.SECOND.y + 6.1, AX.AXIS.paifangZ + 0.13]), tip = row([0, R.ornamentTop, R.zm]);
  assert.ok(tip - beam >= 7, `the tip is at row ${tip.toFixed(1)}, the beam's underside at ${beam.toFixed(1)}`);
});

test("the Wuliang hall's tips are not higher on the picture than the Great Hall's", () => {
  const w = new THREE.Box3(); for (const o of meshes) if (o.material.name === "ridge") { const b = new THREE.Box3().setFromObject(o); if (b.min.z > 55 && b.max.z < 80) w.union(b); }
  assert.ok(row([w.max.x, w.max.y, AX.AXIS.hallZ]) > row([R.rx, R.ornamentTop, R.zm]), "the Wuliang hall's ornament is lower on the picture than the Great Hall's");
});
