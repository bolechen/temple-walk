// The stele pavilion (#478): its platform stands 0.45 m, more than he steps, and it had no stair; and Space did not take him up.
// A stair of treads now rises on its front; the other three sides have none, and from the ground there he jumps up
// (the baked floor finds those edges; the written plan, which is being retired, never wrote them, so that half is held on the grid).
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { levelPlan } from "./level-plan.mjs";
import { findClimb } from "../../app/src/drop.js";

const M = new Proxy({}, { get(t, k) { return k === "plaster" || k === "interior" ? () => (t[k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial()); } });
const { walker } = await levelPlan(M);
const [cx, cz] = [-12.5, 50.5], STEP = 0.255;

test("a stair of treads leads up the front, no tread higher than he steps", () => {
  // The front faces +x (a quarter turn): from the path at x = -8 up onto the platform's floor, short of the stele's base (#520: 0.77 m deep, so it begins 0.385 m from
  // the stele's middle; the written plan keeps his width off it).
  let last = walker.heightAt(-8, cz);
  for (let x = -8; x >= -11.3; x -= 0.02) {
    assert.ok(!walker.blocked(x, cz), `the way up is open at x ${x.toFixed(2)}`);
    const h = walker.heightAt(x, cz);
    assert.ok(h - last < STEP + 1e-6, `a step of ${(h - last).toFixed(3)} m at x ${x.toFixed(2)}`);
    last = Math.max(last, h);
  }
  assert.ok(Math.abs(last - 0.45) < 0.03, `he arrives on the platform's floor, 0.45 m (${last})`);
});

test("from the ground on each side with no stair, facing the platform, Space takes him up", { skip: walker.mode !== "mesh" && "the written plan never wrote this edge" }, () => {
  const half = 2.8;
  for (const [name, nx, nz] of [["west", -1, 0], ["north", 0, -1], ["south", 0, 1]]) {
    let plan = null;
    for (const out of [0.5, 0.7, 1.0]) for (const along of [0, 0.5, -0.5, 1, -1]) {
      const x = cx + nx * (half + out) + (nz ? along : 0), z = cz + nz * (half + out) + (nx ? along : 0);
      if (walker.blocked(x, z)) continue;
      plan = findClimb(walker, walker.drops, x, z, -nx, -nz);
      if (plan) break;
    }
    assert.ok(plan, `facing the ${name} edge, Space finds a way up`);
    assert.ok(Math.abs(plan.rise - 0.45) < 0.05, `${name}: a ${plan.rise.toFixed(2)} m platform`);
  }
});
