// The dragon well: a drop now and then, heard only near by, its rings kept on the water seen between the jambs.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createWell, wellLevel, HEAR, RING } = await import("../../app/src/well.js");
const { buildSite } = await import("../../app/src/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), pool = site.places.well.pool;

test("the drop is loud at the lip, fades with distance and is silent beyond hearing", () => {
  assert.equal(wellLevel(0.5), 1); assert.equal(wellLevel(HEAR), 0); assert.equal(wellLevel(HEAR + 5), 0);
  for (let d = 0; d < HEAR; d += 0.5) assert.ok(wellLevel(d + 0.5) <= wellLevel(d), `louder farther off at ${d} m`);
});

const run = (x, z, secs, away = false) => {
  const meshes = [], heard = [], scene = { add: (m) => meshes.push(m) }, w = createWell(scene, pool, (l) => heard.push(l));
  let worst = 0, off = 0, seen = 0;
  for (let t = 0; t < secs; t += 0.05) {
    w.update(0.05, x, z, away);
    for (const m of meshes) if (m.visible) {
      seen++; const r = m.scale.x; worst = Math.max(worst, r);
      // The opening between the jambs is 1.9 m wide; the pool runs back from the sill to the dark at the back of the niche.
      if (Math.abs(m.position.x - pool[0]) + r > 0.95 || Math.abs(m.position.z - pool[2]) + r > 0.575) off++;
    }
  }
  return { w, heard, worst, off, seen };
};

test("drops fall now and then; near the well they are heard, from across the terrace they are not", () => {
  const far = run(pool[0] - 20, pool[2] + 10, 60), near = run(pool[0], pool[2] + 2.5, 60);
  assert.ok(far.w.state().drops >= 3 && far.w.state().drops <= 9, `${far.w.state().drops} drops in a minute`);
  assert.equal(far.heard.length, 0, "a drop was heard twenty metres off");
  assert.ok(near.heard.length >= 3 && near.heard.every((l) => l > 0.3 && l <= 1), "standing at the well no drop was heard: " + near.heard);
});

test("every ring stays on the water between the jambs, and none is drawn while he is indoors", () => {
  const near = run(pool[0], pool[2] + 2.5, 60);
  assert.ok(near.seen > 0, "no ring was ever drawn");
  assert.ok(near.worst <= RING.max + 0.031, `a ring grew to ${near.worst.toFixed(2)} m`);
  assert.equal(near.off, 0, "a ring spread over the stone");
  const inside = run(pool[0], pool[2] + 2.5, 60, true);
  assert.equal(inside.seen, 0); assert.equal(inside.heard.length, 0);
});

test("the pool is in the niche, inside what keeps him from walking into it", () => {
  const [x, , z] = pool;
  assert.ok(site.walk.solids.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1), "nothing keeps him out of the pool at " + JSON.stringify(pool));
});
