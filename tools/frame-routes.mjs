// The walks of tools/frame-measure.cjs worked out in Node (issue #271): the same plan, walker and eye as the page
// (eye.js), sixty frames a second, the eye's height easing over the steps as yard.js eases it, the view turning after
// the way he goes as the measured walk turns it (`tour.js`), and with an arm the view tilted at him as the page tilts it
// (`aimAt`). For the eye as it was (`old`, `?frame=old`) and each of `FRAMES`, on three screens: where his middle
// (0.61 m over his feet, the middle of __probe().monkBox) falls across and down the picture, in percent, with mean, range
// and the fastest change in any second; and how much of him is in the picture (his feet, his knees at 0.35 m).
// It agrees with the page's own measure (frame-measure.cjs) and takes seconds instead of an hour of software drawing.
//   node tools/frame-routes.mjs [out.json]
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import fs from "fs";
import { buildSite, createWalker } from "../app/src/site.js";
import * as EYE from "../app/src/eye.js";
// (read as a whole, so that the same file measures a checkout from before #271, which has only the old eye)
const { followEye, createFollow } = EYE, FRAMES = EYE.FRAMES || {}, frameArm = EYE.frameArm, aimAt = EYE.aimAt;

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site), dt = 1 / 60;
const FOV = { "16x9": 50, "4x3": 50, phone: 62 }, ASPECT = { "16x9": 16 / 9, "4x3": 4 / 3, phone: 390 / 844 };
// Each walk is a line of points; round the censer the view is turned with him as a visitor turns it.
const ring = [...Array(25)].map((_, i) => { const a = (i / 24) * Math.PI * 2; return [-2.6 * Math.sin(a), 13 + 2.6 * Math.cos(a)]; });
const STAIR = [[19.5, 77.5], [10, 77.5], [0, 77.5], [0, 63.5]];   // up the flight by the half-way pavilion, along the landing, up the last flight
export const WALKS = {
  open: [[5, 32], [5, 18]],
  censer: ring,
  columns: [[12.25, 24], [12.25, 7]],
  wall: [[21.3, 33], [21.3, 9]],
  "stair-up": STAIR,
  "stair-down": [...STAIR].reverse(),
};
const stats = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length; let rate = 0;
  for (let i = 60; i < xs.length; i++) rate = Math.max(rate, Math.abs(xs[i] - xs[i - 60]));
  return { mean: +mean.toFixed(1), min: +Math.min(...xs).toFixed(1), max: +Math.max(...xs).toFixed(1), range: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), perSec: +rate.toFixed(1) };
};
export function measure(fr, size, path, pitch0 = 0.06) {
  const cam = new THREE.PerspectiveCamera(FOV[size], ASPECT[size], 0.05, 500), v = new THREE.Vector3(), F = FRAMES[fr] || null;
  const arm = F ? frameArm(F, FOV[size], ASPECT[size]) : null, follow = createFollow(), xs = [], ys = [], tops = [], bots = [];
  let x = path[0][0], z = path[0][1], yaw = Math.atan2(path[1][0] - x, -(path[1][1] - z)), eyeY = walker.eyeAt(x, z), side = 1.2, frames = 0, feet = 0, knees = 0, hidden = 0;
  const frame = (count) => {
    const foot = walker.heightAt(x, z);
    eyeY += (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
    const rx = Math.cos(yaw), rz = Math.sin(yaw); side += ((arm ? 0 : walker.wall(x + rx * 1.4, z + rz * 1.4) ? 0 : 1.2) - side) * Math.min(1, dt * 3);
    const c = follow.step(dt, followEye(walker, { x, z, foot, eyeY, yaw, pitch: pitch0, side, reach: 6.2, arm: arm ?? null }));
    if (!count) return;
    frames++;
    if (follow.dist < 0.85) { hidden++; return; }   // so near that he is hidden (yard.js)
    const aim = F ? aimAt(c, [x, foot, z], yaw, F, FOV[size]) : null;
    cam.position.fromArray(c); cam.rotation.set(aim ? aim[1] : pitch0, -(aim ? aim[0] : yaw), 0, "YXZ"); cam.updateMatrixWorld();
    const down = (h) => { v.set(x, foot + h, z).project(cam); return [(v.x + 1) * 50, (1 - v.y) * 50]; };
    const [mx, my] = down(0.61); xs.push(mx); ys.push(my); tops.push(down(1.22)[1]); const bot = down(0)[1]; bots.push(bot);
    if (bot <= 100) feet++; if (down(0.35)[1] <= 100) knees++;
  };
  for (let i = 0; i < 60; i++) frame(false);   // a second standing at the start, as the page has after it is put there
  for (const [tx, tz] of path.slice(1)) for (let n = 0; n < 20000; n++) {
    const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); if (l < 0.02) break;
    const step = Math.min(l, (walker.onStairs(x, z) ? 1.25 : 2.1) * dt); x += (vx / l) * step; z += (vz / l) * step;
    const want = Math.atan2(vx, -vz); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-3 * dt));
    frame(true);
  }
  const pc = (n) => +((n / Math.max(1, frames)) * 100).toFixed(1);
  return { across: stats(xs), down: stats(ys), top: +Math.min(...tops).toFixed(1), bottom: +Math.max(...bots).toFixed(1), feetIn: pc(feet), kneesIn: pc(knees), hidden: pc(hidden) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const report = {};
  for (const size of Object.keys(FOV)) for (const fr of ["old", ...Object.keys(FRAMES)]) for (const [name, path] of Object.entries(WALKS)) ((report[size] ??= {})[fr] ??= {})[name] = measure(fr, size, path);
  const out = process.argv[2]; if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
  for (const [size, frs] of Object.entries(report)) for (const [fr, ws] of Object.entries(frs)) {
    console.log(`${size} ${fr}`);
    for (const [w, r] of Object.entries(ws)) console.log(`  ${w.padEnd(10)} across ${r.across.mean}% (${r.across.min}–${r.across.max}, ${r.across.perSec}%/s)  down ${r.down.mean}% (${r.down.min}–${r.down.max})  head ≥${r.top}% feet ≤${r.bottom}%  feet in ${r.feetIn}% knees in ${r.kneesIn}% hidden ${r.hidden}%`);
  }
}
