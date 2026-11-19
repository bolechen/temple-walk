// How he goes over a flight (issue #270): measured by tools/gait-stairs.mjs, frame by frame as yard.js moves him.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { measure } = await import("../../tools/gait-stairs.mjs");
const { STAIR } = await import("../../app/src/geo.js");
const WALK = STAIR.tread * STAIR.steps, HURRY = STAIR.tread * STAIR.hurry;

test("on a flight he takes no more than 2.2 steps a second, 3 when he hurries", () => {
  for (const dir of [1, -1]) {
    assert.ok(measure({ dir, speed: WALK }).cadence <= 2.2, "walking");
    assert.ok(measure({ dir, speed: HURRY }).cadence <= 3, "hurrying");
  }
});
test("going down, a shoe never rises more than a centimetre over the tread it leaves, at 60 and 30 frames a second", () => {
  for (const fps of [60, 30]) for (const speed of [WALK, HURRY]) assert.ok(measure({ dir: -1, speed, fps }).lift <= 0.01, `${speed} m/s at ${fps}`);
});
test("going up, a shoe comes over a nosing without lifting more than 3 cm over it and never goes into the stone", () => {
  for (const fps of [60, 30]) { const r = measure({ dir: 1, speed: WALK, fps }); assert.ok(r.clear >= -0.01 && r.clear <= 0.03, `clear ${r.clear}`); }
});
test("the pelvis rises and falls by no more than 4 cm about the line of the flight, and never jumps between frames", () => {
  for (const fps of [60, 30]) for (const dir of [1, -1]) {
    const r = measure({ dir, speed: WALK, fps });
    assert.ok(r.pelvisAmp <= 0.04, `${dir > 0 ? "up" : "down"} ${fps} fps: ±${r.pelvisAmp}`);
    assert.ok(r.pelvisJump <= 0.02 * 60 / fps * 1.5, `${dir > 0 ? "up" : "down"} ${fps} fps: ${r.pelvisJump} m in a frame`);
  }
});
test("going up, the knee of the leg that bears him is bent less than before (it folded to 59° at this pace)", () => {
  assert.ok(measure({ dir: 1, speed: WALK }).kneeStance > 70);
});
test("the eye's height, which follows the slope and not him, does not shake more than at the old pace", () => {
  for (const dir of [1, -1]) { const now = measure({ dir, speed: WALK }), was = measure({ dir, speed: 1.25 }); assert.ok(now.eye3Acc <= was.eye3Acc && now.eye1Acc <= was.eye1Acc); }
});
