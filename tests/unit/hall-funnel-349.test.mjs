// #349, hallexit sometimes red ("he went back in"): coming out of a hall he taps the ground near its door, and the walk to a spot that is not the door
// must end at that spot. The door's funnel (gridwalker.js) bends a step that heads toward the door, so it must not carry him over its sill when the way he was sent is to a place before it.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { levelPlan } from "./level-plan.mjs";
import { stride } from "../../app/src/stride.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const { site, walker } = await levelPlan(M);
const grid = walker.kind === "grid";

// His walk to a tapped spot, as yard.js takes it: toward the spot, a step of at most 2.1 m/s, stopping within 2 cm of it.
function walkTo(from, target, h) {
  const pos = { x: from[0], z: from[1] }; let entered = false;
  for (let i = 0; i < 1200; i++) {
    const vx = target[0] - pos.x, vz = target[1] - pos.z, len = Math.hypot(vx, vz);
    if (len < 0.02) return { pos, entered, reached: true };
    const k = Math.min(len, 2.1 / 60) / len;
    if (!stride(walker, pos, vx * k, vz * k)) return { pos, entered, reached: false };
    if (h.inside(pos.x, pos.z)) { entered = true; return { pos, entered, reached: false }; }
  }
  return { pos, entered, reached: false };
}

test("a walk from a hall's porch to a spot that is not its door never carries him back in", { skip: !grid && "the funnel is the baked floor's" }, () => {
  const bad = [];
  for (const h of site.halls) {
    const ix = h.door[0] - h.out[0], iz = h.door[1] - h.out[1], d = Math.hypot(ix, iz), ux = ix / d, uz = iz / d, lx = -uz, lz = ux;
    for (let r = 0.6; r <= 3.01; r += 0.3) for (let a = 0; a < 360; a += 15) {
      const th = (a * Math.PI) / 180, t = [h.out[0] + (Math.cos(th) * ux + Math.sin(th) * lx) * r, h.out[1] + (Math.cos(th) * uz + Math.sin(th) * lz) * r];
      if (Math.hypot(t[0] - h.door[0], t[1] - h.door[1]) < 0.5 || walker.blocked(t[0], t[1]) || h.inside(t[0], t[1])) continue;
      const w = walkTo(h.out, t, h);
      if (w.entered) bad.push(`${h.id}: to (${t[0].toFixed(2)}, ${t[1].toFixed(2)}) r ${r.toFixed(1)} a ${a}`);
    }
  }
  assert.deepEqual(bad.slice(0, 12), [], `${bad.length} walks went in`);
});
