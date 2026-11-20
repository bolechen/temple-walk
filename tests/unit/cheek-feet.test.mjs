// The cheek stones' feet (#272): seen from the side, every flight's cheek stands on the ground it comes down to, or on a
// stone laid under it; no slot of air shows under its foot. Every flight of the place is looked under, as it is drawn
// (the plan's buildings, the terraces, the path, the paving and the earth), at points across each cheek and along it.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { cheekProfile, stairProfile, CHEEK } from "../../app/src/geo.js";
const { buildDrawn } = await import("../../tools/walk/scene.mjs");
const { gather } = await import("../../tools/walk/bake.mjs");

const GAP = 0.01;   // a centimetre of air under a stone is not seen; more is a slot

/** Every flight in the place, with its matrix in the world. */
export function flightsOf(scene) {
  const out = [];
  scene.traverse((o) => { for (const f of o.userData.flights || []) out.push({ ...f, world: o.matrixWorld.clone().multiply(f.m), owner: o.userData.flightOwner || o.name || "" }); });
  return out;
}

/**
 * Under one cheek of a flight: at points across it and along it, how far its underside stands above the highest thing
 * under it that looks up at all (a steep bank of earth too) and is not the flight's own stone (the paving, the earth, a platform, a stone laid under it).
 * Where that comes up past the underside, the foot is in the ground. Returns the worst point.
 */
export function cheekGap(scene, f, sx) {
  const { count } = stairProfile(f.rise); if (count <= 2) return null;
  const c = cheekProfile(f.rise), base = c.base;
  // the side's footprint, in the flight's own frame, made a box in the world to gather what lies there
  const box = new THREE.Box3();
  for (const x of [sx * f.w / 2, sx * (f.w / 2 + CHEEK)]) for (const z of [0, c.foot + 0.06]) for (const y of [-5, f.rise + 1]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(f.world));
  const g = gather([scene], { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z, bottom: box.min.y, top: box.max.y });
  const ray = new THREE.Ray(), down = new THREE.Vector3(0, -1, 0).transformDirection(f.world);
  let worst = { gap: -Infinity, at: null };
  for (const d of [0.02, c.width / 2, c.width - 0.02]) for (let z = 0.02; z < c.foot; z += 0.05) {
    const zz = Math.min(z, c.foot - 0.003), under = base;   // the pier, the panel and the stone's square foot all go down to `base`
    const x = sx * (f.w / 2 + d), start = new THREE.Vector3(x, c.top(zz) + 0.5, zz).applyMatrix4(f.world), low = new THREE.Vector3(x, under, zz).applyMatrix4(f.world);
    ray.set(start, down);
    const hits = (g.bvh ? g.bvh.raycast(ray, THREE.DoubleSide) : []).filter((h) => h.face.normal.y > 0.05 && g.names[g.mat[(h.face.a / 3) | 0]] !== "steps").map((h) => h.point.y);
    const ground = hits.length ? Math.max(...hits) : -Infinity, gap = low.y - ground;
    if (gap > worst.gap) worst = { gap, at: [+low.x.toFixed(2), +low.y.toFixed(3), +low.z.toFixed(2)], ground: hits.length ? +ground.toFixed(3) : null };
  }
  return worst;
}

const drawn = buildDrawn(), flights = flightsOf(drawn.scene);

test("every flight of three steps or more is looked under", () => {
  const cheeked = flights.filter((f) => stairProfile(f.rise).count > 2);
  assert.ok(cheeked.length >= 16, `only ${cheeked.length} flights with cheeks were found`);
});

test("no cheek stone's foot stands over a slot of air: it comes down on the ground or on a stone under it", () => {
  const bad = [];
  for (const f of flights) for (const sx of f.sides) {
    const r = cheekGap(drawn.scene, f, sx); if (!r) continue;
    if (r.gap > GAP) bad.push(`${f.owner || "flight"} (w ${f.w}, rise ${f.rise.toFixed(2)}) side ${sx}: ${r.gap === Infinity ? "nothing under it" : (r.gap * 100).toFixed(1) + " cm of air"} at ${JSON.stringify(r.at)} over ${r.ground}`);
  }
  assert.deepEqual(bad, []);
});
