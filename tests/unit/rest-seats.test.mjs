// The pavilions on the old path have a sitting bench between their columns (#479): every seat is registered, sits at a
// sitting height, can be come to from the path, and the bench never shuts the way into the pavilion or out of it.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker } = await import("../../app/src/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site);

const REST = ["半山亭", "望江亭"];
const seatsOf = (name) => site.seats.filter((s) => s.room === null && s.pavilion === name);
const pav = (name) => { const b = site.buildings.find((k) => k.name === name); assert.ok(b, `${name} is not on the plan`); return { b, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 }; };

test("each rest pavilion has two or more bench seats, the sill-bench's height, he sits facing in with his back to the rail", () => {
  for (const name of REST) {
    const { cx, cz } = pav(name), seats = seatsOf(name); assert.ok(seats.length >= 2, `${name} has ${seats.length} seats`);
    const floor = walker.heightAt(cx, cz);
    for (const s of seats) {
      assert.equal(s.kind, "stool", `${name}: a bench is sat on as a chair`);
      const h = s.top - floor; assert.ok(h >= 0.55 && h <= 0.62, `${name}: a seat ${h.toFixed(2)} m high`);
      assert.ok(Math.hypot(s.at[0] - cx, s.at[1] - cz) < 2.3, `${name}: a seat off the platform`);
      // Facing in: the way he looks leads toward the middle, his back to the rail.
      const away = (s.at[0] - cx) * Math.sin(s.face) + (s.at[1] - cz) * Math.cos(s.face); assert.ok(away < -0.5, `${name}: a seat that faces out`);
    }
  }
});

test("a flood from outside reaches the middle of each pavilion and open ground beside every seat: the bench shuts nothing", () => {
  const step = 0.1, key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  for (const name of REST) {
    const { cx, cz } = pav(name), seen = new Set(), q = [];
    // Start from outside the pavilion's platform, the way in being on its front or its back.
    const starts = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([a, c]) => [cx + a * 4.2, cz + c * 4.2]).filter(([x, z]) => !walker.blocked(x, z));
    assert.ok(starts.length, `${name}: nowhere outside to start from`);
    for (const [x, z] of starts) { seen.add(key(x, z)); q.push([x, z]); }
    for (let i = 0; i < q.length; i++) {
      const [x, z] = q[i], h = walker.heightAt(x, z);
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const nx = x + dx, nz = z + dz, k = key(nx, nz);
        if (seen.has(k) || Math.abs(nx - cx) > 7 || Math.abs(nz - cz) > 7 || walker.blocked(nx, nz) || Math.abs(walker.heightAt(nx, nz) - h) > 0.3) continue;
        seen.add(k); q.push([nx, nz]);
      }
    }
    assert.ok(seen.has(key(cx, cz)), `${name}: its middle is not reached from outside: the way in is shut`);
    for (const s of seatsOf(name)) {
      let ok = false; for (let a = 0; a < 36 && !ok; a++) for (const r of [0.45, 0.6, 0.75, 0.9]) if (seen.has(key(s.at[0] + Math.sin((a / 36) * 6.283) * r, s.at[1] + Math.cos((a / 36) * 6.283) * r))) { ok = true; break; }
      assert.ok(ok, `${name}: the seat at ${s.at.map((v) => v.toFixed(2))} has no open ground beside it`);
    }
  }
});
