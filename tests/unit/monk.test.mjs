// The novice stands on a skeleton: named bones in a hierarchy, each part of him bound to one, posed by `update`.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "../../app/v/build/three.module.js";
const { createMonk } = await import("../../app/src/monk.js");

test("he has the bones a figure needs, in a hierarchy under the root", () => {
  const m = createMonk(), names = m.skeleton.bones.map((b) => b.name).sort();
  assert.deepEqual(names, ["armL", "armR", "handL", "handR", "hat", "head", "legL", "legR", "spine"]);
  for (const b of m.skeleton.bones) { assert.ok(b.isBone, b.name); let o = b; while (o.parent) o = o.parent; assert.equal(o, m.group, `${b.name} is not under the root`); }
  assert.equal(m.bones.handL.parent, m.bones.armL); assert.equal(m.bones.head.parent, m.bones.spine); assert.equal(m.bones.hat.parent, m.bones.spine);
  assert.equal(m.skeleton.boneInverses.length, 9, "the resting pose should be recorded");
});
test("every drawn part of him hangs from a bone, so posing the bones moves all of him", () => {
  const m = createMonk(); let loose = 0, bound = 0;
  m.group.traverse((o) => { if (!o.isMesh) return; let p = o.parent, on = false; while (p) { if (p.isBone) on = true; p = p.parent; } if (on) bound++; else loose++; });
  assert.ok(bound >= 8, `only ${bound} parts are bound to bones`); assert.ok(loose <= 2, `${loose} parts hang from no bone (only his shadow and his seated lap may)`);
});
test("walking swings the leg and arm bones; praying brings the arms forward", () => {
  const m = createMonk(); for (let i = 0; i < 40; i++) m.update(1 / 30, 2.1, false, i / 30);
  assert.ok(Math.abs(m.bones.legL.rotation.x) + Math.abs(m.bones.legR.rotation.x) > 0.05, "the legs did not swing");
  const still = createMonk(); for (let i = 0; i < 60; i++) still.update(1 / 30, 0, "pray", i / 30);
  assert.ok(still.bones.armL.rotation.x < -0.5 && still.bones.armR.rotation.x < -0.5, "the arms did not come forward to pray");
});
