// The camera's near plane (issue 16, G04): the picture is cut off a tenth of a metre in front of the eye, so the eye
// must keep that much clear in every direction it looks, or a wall cut open by the near plane shows its inside, or a
// column between the eye and that plane vanishes and what is behind it shows through. The eye that follows him is
// stepped frame by frame as the page steps it (eye.js) along the routes the follow test walks and along every hall's
// porch past its columns; his own eyes (the first person, or the wheel pushed all the way in) look ahead and to either
// side, into the columns. The rectangle is the real one: `camera.near`, and the widest angle of view the settings
// allow, on a phone held upright and on a wide screen.
//
// A minute and a half: run by `pnpm run nearplane`, beside `pnpm run edges` in .github/workflows/e2e.yml, not with the quick unit tests.
import test from "node:test";
import assert from "node:assert/strict";
import "../unit/dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker, LEVELS } from "../../app/src/site.js";
import { followEye, createFollow } from "../../app/src/eye.js";
import { FOV_RANGE } from "../../app/src/settings.js";
import { ROUTE } from "../../app/src/tour.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), { name: String(k) });   // both faces: from inside a wall its back faces are what would show
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site);
site.root.updateMatrixWorld(true);
const meshes = []; site.root.traverse((o) => { if (o.isMesh && o.visible && !o.userData.soft && !o.material.transparent) { o.geometry.computeBoundingBox(); meshes.push({ o, box: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) }); } });
const NEAR = 0.1, EYE = 1.3, dt = 1 / 60;   // yard.js: PerspectiveCamera(…, 0.1, 800); a child's eye at 1.3 m
// The widest the walk is drawn (yard.js `lens()`): 50° behind him, 65° from his eyes, 62°/75° on a screen held upright,
// and the visitor may add up to FOV_RANGE[1].
const LENSES = [{ name: "a phone held upright", aspect: 390 / 780, third: 62, first: 75 }, { name: "a wide screen", aspect: 21 / 9, third: 50, first: 65 }];
const cam = new THREE.PerspectiveCamera(50, 1, NEAR, 800), ray = new THREE.Raycaster(), v = new THREE.Vector3();

// Whatever is within reach of the near rectangle: the eye to each corner and the middle, and round its edges.
function cut(pos, yaw, pitch, fov, aspect) {
  cam.fov = fov; cam.aspect = aspect; cam.updateProjectionMatrix(); cam.position.fromArray(pos); cam.rotation.set(pitch, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
  const eye = cam.position.clone(), c = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([x, y]) => new THREE.Vector3(x, y, -1).unproject(cam));
  const near = meshes.filter((m) => m.box.distanceToPoint(eye) < 0.35).map((m) => m.o); if (!near.length) return null;
  const seg = (a, b) => { const d = b.clone().sub(a), l = d.length(); ray.set(a, d.divideScalar(l)); ray.far = l; return ray.intersectObjects(near, false)[0] || null; };
  for (const p of c) { const h = seg(eye, p); if (h) return h; }
  for (let i = 0; i < 4; i++) { const h = seg(c[i], c[(i + 1) % 4]) || seg(c[i], c[(i + 2) % 4]); if (h) return h; }
  return null;
}

// Walk `path` as follow.test.mjs walks it, and hand each frame's eyes to `look`.
function walk(path, look, { pitch = 0.04, reach = 6.2 } = {}) {
  const follow = createFollow();
  let x = path[0][0], z = path[0][1], yaw = Math.atan2(path[1][0] - x, -(path[1][1] - z)), eyeY = walker.eyeAt(x, z), side = 1.2, n = 0;
  for (const [tx, tz] of path.slice(1)) for (let k = 0; k < 20000; k++) {
    const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); if (l < 0.02) break;
    const step = Math.min(l, (walker.onStairs(x, z) ? 1.25 : 2.1) * dt); x += (vx / l) * step; z += (vz / l) * step;
    const want = Math.atan2(vx, -vz); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-3 * dt));
    const foot = walker.heightAt(x, z); eyeY += (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
    const rx = Math.cos(yaw), rz = Math.sin(yaw); side += ((walker.wall(x + rx * 1.4, z + rz * 1.4) ? 0 : 1.2) - side) * Math.min(1, dt * 3);
    const third = follow.step(dt, followEye(walker, { x, z, foot, eyeY, yaw, pitch, side, reach }));
    if (n++ % 6 === 0) look({ x, z, yaw, pitch, third, first: [x, eyeY + EYE, z], dist: follow.dist });   // every sixth frame: a tenth of a second, a fifth of a metre at his pace
  }
}
const T = LEVELS;
const routes = {
  "the measured route, bamboo to the first court": ROUTE,
  "round the first court, close past the bell and drum towers": [[-10.8, 19], [10.8, 19], [10.8, 6], [-10.8, 6], [-10.8, 19]],
  "up the axis of the first court to the main hall's stair": [[0, 29], [0, 12], [0, -4.5]],
  "up the stair to the second terrace and on to the Guanyin hall's steps": [[0, T[1].zS + 10], [0, T[1].zS - 5.5]],
};
// Along each hall's porch from end to end, at the depth nearest its columns that still lets him by (edges.test.mjs finds the same run).
for (const h of site.halls) {
  const [ox, oz] = h.out, f = [Math.sin(h.outYaw), -Math.cos(h.outYaw)], s = [-f[1], f[0]]; let best = null;
  for (let d = -0.2; d <= 1.6; d += 0.02) { let a = null, b = null; for (let t = -6; t <= 6; t += 0.05) { const x = ox + f[0] * d + s[0] * t, z = oz + f[1] * d + s[1] * t; if (walker.blocked(x, z)) { if (t < 0) a = null; else if (a !== null) break; } else { if (a === null) a = t; b = t; } } if (a !== null && (!best || b - a > best.len + 0.3)) best = { d, a, b, len: b - a }; }
  if (best) routes[`along the porch of ${h.name}`] = [[ox + f[0] * best.d + s[0] * best.a, oz + f[1] * best.d + s[1] * best.a], [ox + f[0] * best.d + s[0] * best.b, oz + f[1] * best.d + s[1] * best.b], [ox + f[0] * best.d + s[0] * best.a, oz + f[1] * best.d + s[1] * best.a]];
}

test("the check sees a column the eye is put up against", () => {
  // Face a column from just outside it, at the height of a child's eye above its own porch: the near plane is in it.
  const hall = site.halls.find((h) => site.walk.posts.some((q) => q.r !== undefined && Math.hypot(q.x - h.out[0], q.z - h.out[1]) < 4)), col = site.walk.posts.find((q) => q.r !== undefined && Math.hypot(q.x - hall.out[0], q.z - hall.out[1]) < 4);
  const floor = walker.heightAt(hall.out[0], hall.out[1]), toward = Math.atan2(col.x - hall.out[0], -(col.z - hall.out[1]));
  const at = (d) => [col.x - Math.sin(toward) * d, floor + EYE, col.z + Math.cos(toward) * d];
  assert.ok(cut(at(col.r + 0.05), toward, 0, 80, 16 / 9), "an eye 5 cm off a column, facing it, should be found cutting into it");
  assert.ok(!cut(at(col.r + 0.4), toward, 0, 80, 16 / 9), "an eye 40 cm off a column should be clear of it");
});

for (const [name, path] of Object.entries(routes)) test(`the near plane cuts into nothing: ${name}`, () => {
  const bad = []; let looks = 0;
  for (const pitch of name.startsWith("along") ? [0.04, -0.5, 0.3] : [0.04]) walk(path, (p) => {
    for (const L of LENSES) {
      const fovT = L.third + FOV_RANGE[1], fovF = L.first + FOV_RANGE[1];
      const at = (what, h) => bad.push(`${what} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) pitch ${p.pitch}, ${L.name}: ${h.object.material.name} at (${h.point.toArray().map((q) => q.toFixed(2))})${what === "behind him" ? `, eye ${p.dist.toFixed(2)} m back` : ""}`);
      looks++; let h = cut(p.third, p.yaw, p.pitch, fovT, L.aspect); if (h) at("behind him", h);
      for (const turn of [0, Math.PI / 2, -Math.PI / 2]) { looks++; h = cut(p.first, p.yaw + turn, p.pitch, fovF, L.aspect); if (h) at(`from his eyes, looking ${turn ? (turn > 0 ? "right" : "left") : "ahead"}`, h); }
    }
  }, { pitch });
  assert.ok(looks > 100, `only ${looks} looks`);
  assert.equal(bad.length, 0, `${bad.length} of ${looks} looks cut into something:\n` + bad.slice(0, 10).join("\n"));
});

// Up on the summit pavilion's top storey he sees with his own eyes only (issue #101): round the balcony, at the depth
// nearest its columns that still lets him by and along its middle, looking ahead, to either side and out over the railing.
test("the near plane cuts into nothing: round the top storey of the summit pavilion, from his eyes", () => {
  const L = site.lofts.lingxiao, [cx, cz] = L.at, bad = []; let looks = 0;
  walker.setLoft("lingxiao");
  try {
    for (const r of [L.half.wall + 0.13 + 0.38 + 0.02, (L.half.wall + L.half.edge) / 2, L.half.edge - 0.64 - 0.02]) {
      const ring = [[cx + r, cz + r], [cx + r, cz - r], [cx - r, cz - r], [cx - r, cz + r], [cx + r, cz + r]];
      for (let i = 0; i < 4; i++) {
        const [ax, az] = ring[i], [bx, bz] = ring[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2), yaw = Math.atan2(bx - ax, -(bz - az));
        for (let k = 0; k <= n; k++) {
          const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; if (walker.blocked(x, z)) continue;
          const eye = [x, L.floor + EYE, z];
          for (const L2 of LENSES) for (const turn of [0, Math.PI / 2, -Math.PI / 2]) for (const pitch of [0, -0.5, 0.4]) {
            looks++; const h = cut(eye, yaw + turn, pitch, L2.first + FOV_RANGE[1], L2.aspect);
            if (h) bad.push(`at (${x.toFixed(2)}, ${z.toFixed(2)}) turn ${turn.toFixed(2)} pitch ${pitch}, ${L2.name}: ${h.object.material.name} at (${h.point.toArray().map((q) => q.toFixed(2))})`);
          }
        }
      }
    }
  } finally { walker.setLoft(null); }
  assert.ok(looks > 1000, `only ${looks} looks`);
  assert.equal(bad.length, 0, `${bad.length} of ${looks} looks cut into something:\n` + bad.slice(0, 10).join("\n"));
});
