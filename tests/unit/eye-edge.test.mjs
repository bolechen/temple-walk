// The following eye stays on his side of a terrace's edge: it may ride over a stair he stands on, but never out over
// the hillside beside a flight (from the head of the summit stair it once stepped to his right and back along the
// wall's outer face, and looked at him across the drop).
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker, LEVELS } from "../../app/src/site.js";
import { followEye, createFollow } from "../../app/src/eye.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site);

// Is the eye out over open ground beyond the edge of the terrace he stands on, other than in the opening of its stair? (Over a stair or a floor is fine.)
const outside = (c, foot) => walker.onGround(c[0], c[2]) && LEVELS.some((L) => Math.abs(foot - L.y) < 0.6 && (Math.abs(c[0]) > L.x || c[2] < L.zN || (c[2] > L.zS && Math.abs(c[0]) > L.stair / 2 + 0.5)));

test("from the head of each terrace stair the eye never steps out past the terrace's edge, whichever way he faces", () => {
  const bad = [];
  for (const L of LEVELS) for (const x of [-1.5, -0.5, 0.63, 1.5]) for (const dz of [-0.2, -0.55, -1.2, -3]) {
    const z = L.zS + dz, foot = walker.heightAt(x, z); if (walker.blocked(x, z)) continue;
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * Math.PI * 2, eye = followEye(walker, { x, z, foot, eyeY: walker.eyeAt(x, z), yaw, pitch: 0.04, side: 1.2, reach: 6.2 });
      for (const dist of [0, eye.d / 2, eye.d]) { const c = eye.base(dist); if (outside(c, foot)) bad.push(`(${x}, ${z.toFixed(2)}) yaw ${yaw.toFixed(2)} dist ${dist.toFixed(1)}`); }
    }
  }
  assert.deepEqual(bad.slice(0, 6), [], `${bad.length} eyes past the edge`);
});

test("the view from the summit stair's head (cam 0.63,-118.95, yaw 1.502) keeps the eye on the terrace", () => {
  const top = LEVELS[2], x = 0.63, z = -118.95, foot = walker.heightAt(x, z);
  const eye = followEye(walker, { x, z, foot, eyeY: walker.eyeAt(x, z), yaw: 1.502, pitch: 0.008, side: 1.2, reach: 6.2 });
  assert.ok(foot > top.y - 0.5, "he stands on the summit");
  const c = eye.at(eye.d);
  assert.ok(!outside(c, foot), `the eye is outside the terrace at (${c[0].toFixed(2)}, ${c[2].toFixed(2)})`);
});

// Where the picture's eye settles when he stands still at (x, z) looking `yaw, pitch`: the side eases out from 0 as the page does, 20 frames a second.
const settle = (x, z, yaw, pitch, frames = 120) => {
  const follow = createFollow(), foot = walker.heightAt(x, z); let side = 0, c;
  for (let i = 0; i < frames; i++) {
    side += ((walker.wall(x + Math.cos(yaw) * 1.4, z + Math.sin(yaw) * 1.4) ? 0 : 1.2) - side) * 0.15;
    c = follow.step(0.05, followEye(walker, { x, z, foot, eyeY: walker.eyeAt(x, z), yaw, pitch, side, reach: 6.2 }));
  }
  return { c, foot, dist: follow.dist };
};

test("under a terrace's retaining wall the eye does not climb the stair above to look at his feet (cam 2.1,-66.63, yaw -2.794, pitch -0.459 once stood at 10 m and lost him)", () => {
  const { c, foot } = settle(2.1, -66.63, -2.794, -0.459);
  assert.ok(c[1] < foot + 2, `the eye stands at ${c[1].toFixed(2)} m over his ${foot} m`);
});
