// The iron censer before the great hall (issue #217): the Wanli censer of Jingshan in its three parts, to its measure;
// in his way as the thing itself is, no more and no less; and never with the eye that follows him inside it.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker } from "../../app/src/site.js";
import { followEye, createFollow } from "../../app/src/eye.js";
import { BODY } from "../../app/src/geo.js";
import { CENSER, CAST, censerGeometry, clearOfCenser } from "../../app/src/censer.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site), geo = censerGeometry(), pos = geo.attributes.position;

// How far the censer reaches from its axis, in bands 5 cm high.
const BAND = 0.05, reach = new Float32Array(Math.ceil(3.2 / BAND));
for (let i = 0; i < pos.count; i++) { const b = Math.floor(pos.getY(i) / BAND); reach[b] = Math.max(reach[b], Math.hypot(pos.getX(i), pos.getZ(i))); }
const reachAt = (y) => (y < 0 || y >= reach.length * BAND ? 0 : reach[Math.floor(y / BAND)]);

test("it is the real one's shape and size: 2.7 m to the cap, a small gourd over it, 1.12 m across the belly, three feet and two ears", () => {
  geo.computeBoundingBox(); const b = geo.boundingBox;
  assert.ok(b.max.y >= 2.7 && b.max.y <= 3.0, `stands ${b.max.y.toFixed(2)} m with its gourd`);
  assert.ok(reachAt(2.66) > 0.08 && reachAt(2.71) < 0.08, "the cap ends at 2.7 m, as the real one stands");
  assert.ok(reachAt(2.69) > 0.06 && reachAt(2.75) < 0.12, "the gourd sits on the cap");
  const belly = Math.max(...[0.8, 0.9, 1.0, 1.1].map(reachAt)) * 2;
  assert.ok(Math.abs(belly - 3.53 / Math.PI) < 0.04, `the belly is ${belly.toFixed(3)} m across (3.53 m round)`);
  assert.equal(CENSER.legs.length, 3);
  assert.ok(CENSER.legs.some(([x, z]) => Math.abs(x) < 1e-6 && z > 0), "one foot toward the visitor");
  assert.ok(b.max.x > b.max.z + 0.05 && -b.min.x > -b.min.z + 0.05, "the ears stand out on either side, not before and behind");
  assert.ok(reachAt(1.88) >= CENSER.belly, "a pavilion over the lip, under an eave as broad as the belly");
});

test("what is cast on it: the date in one line, the couplet five and five", () => {
  assert.equal([...CAST.date].length, 10); assert.equal([...CAST.right].length, 5); assert.equal([...CAST.left].length, 5);
  const uv = geo.attributes.uv; let lettered = 0; for (let i = 0; i < uv.count; i++) if (uv.getX(i) >= 0) lettered++;
  assert.ok(lettered > 0 && lettered < uv.count / 10, "only the plates carry letters");
});

test("he is kept off it as far as it reaches below his head, and no farther than a hand's breadth more", () => {
  const post = site.walk.posts.find((p) => p.r !== undefined && Math.hypot(p.x - site.censer.x, p.z - site.censer.z) < 1e-6);
  assert.ok(post, "the censer stands in the walk as a round post");
  let low = 0; for (let y = 0; y < 1.3; y += BAND) low = Math.max(low, reachAt(y));
  assert.ok(post.r >= low - 1e-6, `the post (${post.r}) is narrower than the censer (${low.toFixed(3)})`);
  assert.ok(post.r - low < 0.05, "and not much wider");
  assert.equal(CENSER.reach, post.r);
  assert.ok(walker.blocked(site.censer.x, site.censer.z + low + BODY - 0.02), "his centre cannot come within his width of it");
  assert.ok(!walker.blocked(site.censer.x, site.censer.z + low + BODY + 0.05), "but can just beyond");
  assert.ok(post.top >= CENSER.height, "the eye may pass over it only above its gourd");
});

// Walk a way as the follow test walks it and look at where the following eye is each frame.
function eyes(path, reachK = 6.2) {
  const follow = createFollow(), out = [], dt = 1 / 60;
  let x = path[0][0], z = path[0][1], yaw = Math.atan2(path[1][0] - x, -(path[1][1] - z)), eyeY = walker.eyeAt(x, z), side = 1.2;
  for (const [tx, tz] of path.slice(1)) for (let k = 0; k < 20000; k++) {
    const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); if (l < 0.02) break;
    const step = Math.min(l, 2.1 * dt); x += (vx / l) * step; z += (vz / l) * step;
    const want = Math.atan2(vx, -vz); yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-3 * dt));
    const foot = walker.heightAt(x, z); eyeY += (walker.eyeAt(x, z) - eyeY) * (1 - Math.exp(-dt / 0.14));
    const rx = Math.cos(yaw), rz = Math.sin(yaw); side += ((walker.wall(x + rx * 1.4, z + rz * 1.4) ? 0 : 1.2) - side) * Math.min(1, dt * 3);
    out.push({ x, z, eye: clearOfCenser(follow.step(dt, followEye(walker, { x, z, foot, eyeY, yaw, pitch: 0.04, side, reach: reachK })), [x, foot + 1.15, z], site.censer) });   // as yard.js steps it
  }
  return out;
}
const C = site.censer, ring = (s) => [...Array(17)].map((_, i) => [C.x + s * Math.sin(i * Math.PI / 4) * 1.05, C.z + Math.cos(i * Math.PI / 4) * 1.05]);
const ways = {
  "round it, it on his left": ring(1),
  "round it, it on his right": ring(-1),
  "away from it, north and then south": [[C.x, C.z - 1.0], [C.x, C.z - 5], [C.x + 1.2, C.z], [C.x, C.z + 1.0], [C.x, C.z + 6]],
  "up the axis past it": [[0, 29], [0, 15.4], [1.3, 13], [0, 10.6], [0, -4.5]],
};
for (const [name, path] of Object.entries(ways)) test(`the eye that follows him is never inside it: ${name}`, () => {
  const inside = eyes(path).filter(({ eye: [ex, ey, ez] }) => Math.hypot(ex - C.x, ez - C.z) < reachAt(ey - C.y) + 0.1);
  assert.equal(inside.length, 0, `${inside.length} frames with the eye inside the censer, e.g. him at (${inside[0]?.x.toFixed(2)}, ${inside[0]?.z.toFixed(2)}), eye at ${inside[0]?.eye.map((q) => q.toFixed(2))}`);
});

test("the eye may not stand anywhere inside it, from its feet to its gourd, and may stand just off it and over it", () => {
  for (let y = 0.1; y < CENSER.height; y += 0.1) for (let a = 0; a < 8; a++) {
    const r = Math.max(0.02, reachAt(y) - 0.03), x = C.x + Math.sin(a * Math.PI / 4) * r, z = C.z + Math.cos(a * Math.PI / 4) * r;
    assert.equal(walker.eyeShut(x, C.y + y, z, C.y), true, `the eye could stand in the censer at height ${y.toFixed(1)}`);
  }
  assert.ok(!walker.eyeShut(C.x, C.y + CENSER.height + 0.2, C.z, C.y), "over the gourd it is open air");
  assert.ok(!walker.eyeShut(C.x + CENSER.reach + BODY + 0.2, C.y + 1.3, C.z, C.y), "a step off it is open air");
});
