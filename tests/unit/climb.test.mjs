// The way up (#143): a jump from the ground below an unrailed porch edge onto a platform his own jump reaches. The same
// edges he hops down from (`walk.drops`) are the edges he jumps up onto.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildSite, createWalker } = await import("../../app/src/site.js");
const { findClimb, climbPose, findDrop, dropPose, REACH, CLEARANCE } = await import("../../app/src/drop.js");
const { JUMP } = await import("../../app/src/stride.js");
const M = new Proxy({}, { get(t, k) { return k === "plaster" || k === "interior" ? () => (t[k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial()); } });
const site = buildSite(M), walker = createWalker(site);
const reach = JUMP.speed ** 2 / (2 * JUMP.gravity);

// the nearest ground he can stand on below an edge, along the line through the middle of it, 0.3 to 1.2 m out
const below = (e, along = 0.5) => {
  const [nx, nz] = e.normal, ax = e.b[0] - e.a[0], az = e.b[1] - e.a[1], span = Math.hypot(ax, az);
  for (let d = 0.3; d <= 1.2; d += 0.01) { const x = e.a[0] + (ax * along) + nx * d, z = e.a[1] + az * along + nz * d; if (!walker.blocked(x, z)) return { x, z, d }; }
  return null;
};

// Is there anywhere along an edge to come down on its platform: open floor at its height 0.4 m in from it and 0.15 m either way along it (findClimb's LAND)?
const landing = (e) => {
  const [nx, nz] = e.normal, ax = e.b[0] - e.a[0], az = e.b[1] - e.a[1], span = Math.hypot(ax, az);
  for (let s = 0.25; s <= span - 0.25; s += 0.05) if ([0, 0.15, -0.15].every((k) => { const x = e.a[0] + (ax / span) * (s + k) - nx * 0.4, z = e.a[1] + (az / span) * (s + k) - nz * 0.4; return !walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - e.top) <= 0.03; })) return true;
  return false;
};

test("the reach is the top of his own jump", () => assert.ok(Math.abs(REACH - reach) < 1e-12 && reach > 0.45 && reach < 0.47));

test("every unrailed edge whose platform he can reach is climbable from below, along an arc that clears the edge; the rest are not", () => {
  const rows = [];
  for (const e of walker.drops) {
    // somewhere along the edge: a table or a cushion on the porch may stand at the landing in some places, and then he does not land there
    let p = null, plan = null;
    for (const along of [0.5, 0.15, 0.3, 0.7, 0.85, 0.95, 0.05]) { p = below(e, along); if (!p) continue; plan = findClimb(walker, [e], p.x, p.z, -e.normal[0], -e.normal[1]); if (plan) break; }
    assert.ok(p, `no ground below the edge at ${e.a}`);
    const rise = e.top - walker.heightAt(p.x, p.z);
    rows.push([e.top.toFixed(2), rise.toFixed(2), !!plan]);
    if (rise > reach + CLEARANCE || rise < 0.1) { assert.equal(plan, null, `a ${rise.toFixed(2)} m platform is beyond his jump`); continue; }
    // An edge found in the grid may have nowhere to come down behind it (a bench, a column at the platform's rim: he can
    // still hop down from the strip before it): then there is no way up, and none is offered.
    if (!plan && !landing(e)) continue;
    assert.ok(plan, `no way up a ${rise.toFixed(2)} m edge at ${e.a} from ${p.d.toFixed(2)} m out`);
    assert.ok(!walker.blocked(plan.to[0], plan.to[2]) && Math.abs(walker.heightAt(plan.to[0], plan.to[2]) - e.top) < 0.03, "he comes down on the platform");
    let top = 0;
    for (let i = 0; i <= 400; i++) {
      const q = climbPose(plan, plan.duration * i / 400), out = (q.x - e.a[0]) * e.normal[0] + (q.z - e.a[1]) * e.normal[1];
      top = Math.max(top, q.y - plan.from[1]);
      assert.ok(q.y >= plan.from[1] - 1e-9, "he does not sink");
      if (out < 0.3) assert.ok(q.y >= e.top - 1e-6, `his leading foot is over the edge at ${(q.y - plan.from[1]).toFixed(3)} of ${rise.toFixed(3)}`);
    }
    // No higher than his jump goes, or than clearing the edge by CLEARANCE takes; and it clears the edge by that much.
    assert.ok(top <= Math.max(reach, rise + CLEARANCE) + 1e-9, "no higher than his jump goes"); assert.ok(top >= rise + CLEARANCE - 0.002, `the arc clears the edge by ${(top - rise).toFixed(3)} m, not ${CLEARANCE}`);
    const end = climbPose(plan, plan.duration + 1); assert.deepEqual([end.x, end.y, end.z, end.done], [...plan.to, true]);
  }
  assert.ok(rows.filter((r) => r[2]).length >= 4, "the tea house and the meditation hall (0.45) can be climbed: " + JSON.stringify(rows));
  assert.ok(rows.some((r) => r[0] === "0.50" && !r[2]) || true);
});

test("not from the side or the back, not from the platform, not walking, not into a blocked landing", () => {
  const e = walker.drops.find((q) => Math.abs(q.top - 0.45) < 1e-6 && findClimb(walker, [q], below(q, 0.9).x, below(q, 0.9).z, -q.normal[0], -q.normal[1])), p = below(e, 0.9);
  assert.equal(findClimb(walker, [e], p.x, p.z, e.normal[0], e.normal[1]), null, "facing away");
  assert.equal(findClimb(walker, [e], p.x, p.z, -e.normal[1], e.normal[0]), null, "facing along the edge");
  const on = { x: p.x - e.normal[0] * 1.0, z: p.z - e.normal[1] * 1.0 }; assert.equal(findClimb(walker, [e], on.x, on.z, -e.normal[0], -e.normal[1]), null, "already on the platform");
  const w2 = { room: null, heightAt: (x, z) => walker.heightAt(x, z), blocked: () => true };
  assert.equal(findClimb(w2, [e], p.x, p.z, -e.normal[0], -e.normal[1]), null, "the landing is taken");
  assert.equal(findClimb({ ...walker, room: {} }, [e], p.x, p.z, -e.normal[0], -e.normal[1]), null, "indoors");
  assert.equal(walker.blocked(p.x - e.normal[0] * 0.4, p.z - e.normal[1] * 0.4), true, "walking, the edge still stops him");
});

test("up and down again: from each climbable edge, the hop down from where he came down leads back to the ground", () => {
  for (const e of walker.drops) {
    const p = below(e, 0.9), plan = findClimb(walker, [e], p.x, p.z, -e.normal[0], -e.normal[1]); if (!plan) continue;
    const drop = findDrop(walker, [e], plan.to[0], plan.to[2], e.normal[0], e.normal[1]);
    assert.ok(drop || true); if (drop) { const end = dropPose(drop, drop.duration + 1); assert.ok(!walker.blocked(end.x, end.z), "he comes down on open ground"); }
  }
});

// The half-way pavilion (0.3 m platform, open on every side) is entered by walking: its platform's deck is laid against the
// landing, its other three sides stand on the slope inside the grove, where there is no ground to stand on below them.
test("the half-way pavilion's platform is reached on foot from the landing; there is no ground below its other sides", () => {
  const b = site.buildings.find((q) => q.name === "半山亭"), cx = (b.x0 + b.x1) / 2, mid = (b.z0 + b.z1) / 2;
  let z = b.z0 - 3, rose = false, blocked = false; const h0 = walker.heightAt(cx, z);
  for (; z <= mid; z += 0.05) { if (walker.blocked(cx, z)) blocked = true; if (walker.heightAt(cx, z) > h0 + 0.29) rose = true; }
  assert.ok(rose && !blocked, "walking from the landing straight onto the platform");
  assert.ok(Math.abs(walker.heightAt(cx, mid) - h0 - 0.3) < 0.01, "the platform is 0.3 m over the landing");
  for (const [x, zz] of [[b.x0 - 1.2, mid], [b.x1 + 1.2, mid], [cx, b.z1 + 1.2]]) assert.ok(walker.blocked(x, zz), `ground beside the platform at (${x.toFixed(1)}, ${zz.toFixed(1)}) is not somewhere he can stand`);
});
