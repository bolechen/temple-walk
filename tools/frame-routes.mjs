// The four walks of tools/frame-measure.cjs worked out in Node (issue #271): the same plan, walker and eye as the page
// (eye.js), sixty frames a second, the view turned with him round the censer, the eye's side step eased as yard.js eases
// it. For the eye of today and each of `FRAMES`, on three screens: where his middle (0.61 m over his feet, the middle of
// __probe().monkBox) falls across and down the picture, in percent; mean, range and the fastest change in any second.
// It agrees with the page's own measure (frame-measure.cjs) and takes seconds instead of an hour of software drawing.
//   node tools/frame-routes.mjs [out.json]
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import fs from "fs";
import { buildSite, createWalker } from "../app/src/site.js";
import { followEye, createFollow, FRAMES, frameArm } from "../app/src/eye.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site), dt = 1 / 60, FOV = { "16x9": 50, "4x3": 50, phone: 62 }, ASPECT = { "16x9": 16 / 9, "4x3": 4 / 3, phone: 390 / 844 };
// Each walk as a function of distance walked: where he is and which way the view looks.
const straight = (x, z0, z1) => ({ len: z0 - z1, at: (s) => [x, z0 - s, 0] });
const WALKS = {
  open: straight(5, 32, 18),
  censer: { len: 2 * Math.PI * 2.6, at: (s) => { const a = s / 2.6; return [-2.6 * Math.sin(a), 13 + 2.6 * Math.cos(a), Math.atan2(-Math.cos(a), Math.sin(a))]; } },
  columns: straight(12.25, 24, 7),
  wall: straight(21.3, 33, 9),
};
const stats = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length; let rate = 0;
  for (let i = 60; i < xs.length; i++) rate = Math.max(rate, Math.abs(xs[i] - xs[i - 60]));
  return { mean: +mean.toFixed(1), min: +Math.min(...xs).toFixed(1), max: +Math.max(...xs).toFixed(1), range: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), perSec: +rate.toFixed(1) };
};
const report = {};
for (const size of Object.keys(FOV)) for (const fr of ["now", ...Object.keys(FRAMES)]) for (const [name, W] of Object.entries(WALKS)) {
  const cam = new THREE.PerspectiveCamera(FOV[size], ASPECT[size], 0.05, 500), v = new THREE.Vector3(), F = FRAMES[fr];
  const arm = F ? frameArm(F, FOV[size], ASPECT[size]) : null, follow = createFollow(), xs = [], ys = [];
  let side = 1.2, eyeY = null;
  // a second standing at the start, as the page has after it is put there, then the walk
  for (let s = -2.1; s <= W.len; s += 2.1 * dt) {
    const [x, z, yaw] = W.at(Math.max(0, s)), foot = walker.heightAt(x, z), pitch = 0.06;
    eyeY = eyeY === null ? walker.eyeAt(x, z) : eyeY + (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
    const rx = Math.cos(yaw), rz = Math.sin(yaw); side += ((arm ? 0 : walker.wall(x + rx * 1.4, z + rz * 1.4) ? 0 : 1.2) - side) * Math.min(1, dt * 3);
    const c = follow.step(dt, followEye(walker, { x, z, foot, eyeY, yaw, pitch, side, reach: 6.2, arm }));
    if (s < 0 || follow.dist < 0.85) continue;   // standing at the start; or so near that he is hidden (yard.js)
    cam.position.fromArray(c); cam.rotation.set(pitch, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
    v.set(x, foot + 0.61, z).project(cam); xs.push((v.x + 1) * 50); ys.push((1 - v.y) * 50);
  }
  ((report[size] ??= {})[fr] ??= {})[name] = { across: stats(xs), down: stats(ys) };
}
const out = process.argv[2]; if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
for (const [size, frs] of Object.entries(report)) for (const [fr, ws] of Object.entries(frs))
  console.log(size.padEnd(5), fr.padEnd(4), Object.entries(ws).map(([w, r]) => `${w} ${r.across.mean}% (${r.across.min}–${r.across.max}, ${r.across.perSec}%/s) down ${r.down.mean}%`).join(" | "));
