// A tap on the ground walks there (#154): when the straight line is shut, round whatever is in the way, by the stairs, or
// down a porch edge's hop; to the nearest open point when the spot cannot be stood on; out of a blocked spot he stands in.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildSite, createWalker } = await import("../../app/src/site.js");
const { planRoute, clearLine, nearestOpen, planSteps, ROUTE } = await import("../../app/src/route.js");
const { stride } = await import("../../app/src/stride.js");
const { dropPose } = await import("../../app/src/drop.js");
const M = new Proxy({}, { get(t, k) { return k === "plaster" || k === "interior" ? () => (t[k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial()); } });
const site = buildSite(M), walker = createWalker(site), drops = walker.drops;   // (the porch edges as this walker has them: written, or found in the baked grid)
const { isGrid } = await import("./walkers.mjs");

// Walk a route as the page does, a few centimetres at a time, sliding as stride does; a hop is made as dropPose gives it.
function walkIt(route, from) {
  const pos = { x: from.x, z: from.z }, first = route.points[0];
  if (walker.blocked(pos.x, pos.z) && first) { pos.x = first.x; pos.z = first.z; }   // the step out of a blocked spot is made without asking the walker
  for (const p of route.points) {
    for (let n = 0; n < 4000; n++) {
      const dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz); if (d < 0.02) break;
      assert.ok(n < 3999, `could not get from (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) to (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
      if (!stride(walker, pos, (dx / d) * Math.min(d, 0.05), (dz / d) * Math.min(d, 0.05))) assert.fail(`stuck at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) on the way to (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
    }
    if (p.drop) { const e = dropPose(p.drop, p.drop.duration + 1); pos.x = e.x; pos.z = e.z; assert.ok(!walker.blocked(pos.x, pos.z), "a hop comes down in the open"); }
  }
  return pos;
}

test("the owner's spot at the tea house's south end (a blocked point at ground level): out, and to the court", () => {
  // On the written plan the spot is inside the porch's apron, drawn wider than the porch; on the grid baked from what is
  // drawn it is open ground beside the porch (#161: the cause of #154 is not there), and the routes out are held all the same.
  const from = { x: -12.85, z: 5.98 }; assert.ok(isGrid(walker) || walker.blocked(from.x, from.z), "this is the spot that was reported");
  for (const [x, z] of [[-12.3, 4.82], [-10.56, 3.92], [-8, 4], [-9, 9], [-5, 12], [0, 20], [-11, 0.5]]) {
    const r = planRoute(walker, drops, from, { x, z }); assert.ok(r.reached, `no way to (${x}, ${z})`);
    const at = walkIt(r, from); assert.ok(Math.hypot(at.x - x, at.z - z) < 0.3, `reached (${at.x.toFixed(2)}, ${at.z.toFixed(2)}), not (${x}, ${z})`);
  }
});

test("from the porches' ends, beside the tables and cushions, to the court below, on every platform with a hop down", () => {
  // "The court below" is ground that can be walked to from where he arrives: not ground the walker would let him stand on
  // but nothing leads to (beyond a court's wall, where a porch's back edge now looks out, #265).
  const S = 0.25, key = (i, j) => i * 100000 + j, seen = new Set(), todo = [[Math.round(site.start[0] / S), Math.round(site.start[1] / S)]];
  seen.add(key(...todo[0]));
  while (todo.length) { const [i, j] = todo.pop(), h = walker.heightAt(i * S, j * S); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, k = key(a, b); if (seen.has(k) || walker.blocked(a * S, b * S) || Math.abs(walker.heightAt(a * S, b * S) - h) > ROUTE.step) continue; seen.add(k); todo.push([a, b]); } }
  const reachable = (x, z) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (seen.has(key(Math.round(x / S) + a, Math.round(z / S) + b))) return true; return false; };
  let tried = 0; const bad = [];
  for (const e of drops) {
    if (e.top > 1.5) continue;
    const [nx, nz] = e.normal, ax = e.b[0] - e.a[0], az = e.b[1] - e.a[1], span = Math.hypot(ax, az);
    for (const along of [0.4, span * 0.3, span * 0.6, span - 0.4]) for (const back of [0.3, 0.9, 1.6]) {
      const x = e.a[0] + (ax * along) / span - nx * back, z = e.a[1] + (az * along) / span - nz * back;
      if (walker.blocked(x, z) || Math.abs(walker.heightAt(x, z) - e.top) > 0.03) continue;
      for (const out of [2, 4, 7]) for (const slide of [-3, 0, 3]) {
        const tx = e.a[0] + (ax * along) / span + nx * out + (ax / span) * slide, tz = e.a[1] + (az * along) / span + nz * out + (az / span) * slide;
        if (walker.blocked(tx, tz) || walker.heightAt(tx, tz) > 0.05 || !reachable(tx, tz)) continue;
        tried++; const r = planRoute(walker, drops, { x, z }, { x: tx, z: tz });
        try { assert.ok(r.reached, "no route"); const at = walkIt(r, { x, z }); assert.ok(Math.hypot(at.x - tx, at.z - tz) < 0.3, `ended ${Math.hypot(at.x - tx, at.z - tz).toFixed(2)} m short`); }
        catch (err) { bad.push(`(${x.toFixed(2)}, ${z.toFixed(2)}) -> (${tx.toFixed(2)}, ${tz.toFixed(2)}): ${err.message}`); }
      }
    }
  }
  assert.ok(tried > 100, `only ${tried} routes tried`);
  assert.equal(bad.length, 0, `${bad.length} of ${tried} routes failed:\n` + bad.slice(0, 12).join("\n"));
});

test("a spot he cannot stand on takes him to the nearest he can; an open straight line stays a straight line", () => {
  const inWall = { x: 0, z: 49.5 + 1.2 };   // (the gate house's own walls)
  const r = planRoute(walker, drops, { x: 0, z: 70 }, inWall);
  const last = r.points[r.points.length - 1];
  assert.ok(!walker.blocked(last.x, last.z), "he is taken to open ground"); assert.ok(Math.hypot(last.x - inWall.x, last.z - inWall.z) < 4, "and it is near the spot");
  const straight = planRoute(walker, drops, { x: 0, z: 24 }, { x: 6, z: 28 }); assert.ok(straight.points.length <= 2 && straight.points.every((p) => !p.drop), "nothing in the way: no hop, and at most a bend"); const end = straight.points[straight.points.length - 1]; assert.ok(Math.hypot(end.x - 6, end.z - 28) < 0.05);
  assert.ok(clearLine(walker, { x: 0, z: 24 }, { x: 6, z: 28 }));
});

test("a way round costs a frame no more than its budget, and the search can be given back and taken up again", () => {
  const it = planSteps(walker, drops, { x: -12.85, z: 5.98 }, { x: 12, z: 40 }, { budget: 0 }); let slices = 0, r;
  for (;;) { r = it.next(); if (r.done) break; slices++; }
  assert.ok(slices >= 1, "a far tap is worked out over several frames"); assert.ok(r.value.points.length >= 2);
  const t0 = performance.now(); planRoute(walker, drops, { x: -13.2, z: 7 }, { x: -9, z: 6 }); assert.ok(performance.now() - t0 < 400, "a near tap is quick");
});
