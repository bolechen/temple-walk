// #349's second find: `keywalk` (the way walked by the keys alone, tests/e2e/keywalk-way.cjs) went across the court at z = 1, straight through the shut ground round the
// young evergreen on each side before the great hall (site.closed, #288), and stood there pressing W. Every leg of it must keep clear of whatever the floor is shut for,
// his width included.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { levelPlan } from "./level-plan.mjs";
import way from "../e2e/keywalk-way.cjs";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const { site } = await levelPlan(M);

test("no leg of the keys' way crosses the ground that is shut round a young evergreen", () => {
  const shut = site.closed.filter((c) => /young evergreen/.test(c.why || "")), BODY = 0.4, hit = [];
  assert.ok(shut.length >= 2, "the pair before the great hall is shut");
  for (let i = 0; i < way.length - 1; i++) {
    const [ax, az] = way[i], [bx, bz] = way[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      for (const c of shut) if (x > c.x0 - BODY && x < c.x1 + BODY && z > c.z0 - BODY && z < c.z1 + BODY) { hit.push(`leg ${i} at (${x.toFixed(2)}, ${z.toFixed(2)})`); break; }
    }
  }
  assert.deepEqual(hit.slice(0, 4), [], "the way crosses shut ground");
});
