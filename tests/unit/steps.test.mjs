// His steps: each kind a short sound that follows the foot from heel to ball, never clipped, ending in silence; snow
// bright, wet stone brighter than dry, a splash ringing with bubbles; played so that dry stone is the quietest and snow
// the loudest. And what each step comes down on: the plan's floors, the swept path, the puddles the paving draws.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { crunch, pat, splash, stepSound, press, underfoot, puddleAt, LEVEL } from "../../app/src/steps.js";
const { buildSite, createWalker } = await import("../../app/src/site.js");

const SR = 48000, KINDS = ["stone", "wet", "puddle", "snow"];
const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
// How much of the sound lies high: the energy left after a crude first difference, against the whole.
const brightness = (x) => { let d = 0, s = 0; for (let i = 1; i < x.length; i++) { d += (x[i] - x[i - 1]) ** 2; s += x[i] ** 2; } return d / s; };
// Loudness where it is loudest: the strongest 60 ms.
const loudest = (x) => { const w = Math.floor(SR * 0.06); let acc = 0, best = 0; for (let i = 0; i < x.length; i++) { acc += x[i] * x[i]; if (i >= w) acc -= x[i - w] * x[i - w]; best = Math.max(best, acc); } return Math.sqrt(best / w); };
const mean = (kind, f, opts = {}) => { let s = 0; for (let k = 1; k <= 12; k++) s += f(stepSound(kind, SR, { seed: k * 7919, wet: 1, ...opts })); return s / 12; };

test("every kind of step lasts a fraction of a second, peaks below clipping and ends in silence", () => {
  for (const kind of KINDS) for (const seed of [1, 7, 99]) {
    const x = stepSound(kind, SR, { seed });
    assert.ok(x.length > SR * 0.15 && x.length < SR * 0.45, `${kind}: length ${x.length / SR}s`);
    const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    assert.ok(peak > 0.85 && peak <= 0.9001, `${kind}: peak ${peak}`);
    assert.ok(x.every(Number.isFinite), `${kind}: a sample is not a number`);
    assert.ok(Math.abs(x[x.length - 1]) < 1e-3, `${kind}: the step stops with a click`);
  }
});

test("the heel lands first and the weight rolls onto the ball: two swells, and quiet after", () => {
  assert.ok(press(0.16) > 0.95 && press(0.52) > 0.8, "no heel or no ball");
  assert.ok(press(0.32) < press(0.16) && press(0.32) < press(0.52), "the press does not dip between heel and ball");
  assert.equal(press(-0.1), 0); assert.equal(press(1.2), 0);
  for (const kind of KINDS) {
    const x = stepSound(kind, SR, { seed: 3 }), n = x.length, part = (a, b) => rms(x, Math.floor(a * n), Math.floor(b * n));
    assert.ok(part(0.05, 0.6) > 4 * part(0.93, 1), `${kind}: the sound does not die away at the end of the step`);
  }
});

test("snow crunches: bright, not a low thud", () => {
  assert.ok(brightness(crunch(SR, { seed: 11 })) > 0.15);
});

test("after rain a step on stone is wetter (brighter) than on dry stone, and a puddle rings brighter still", () => {
  const dry = mean("stone", brightness), wet = mean("wet", brightness), puddle = mean("puddle", brightness);
  assert.ok(wet > dry * 1.1, `wet ${wet.toFixed(3)} is no brighter than dry ${dry.toFixed(3)}`);
  assert.ok(puddle > wet, `a splash ${puddle.toFixed(3)} is no brighter than wet stone ${wet.toFixed(3)}`);
  assert.deepEqual(pat(SR, { seed: 5, wet: 0 }), stepSound("stone", SR, { seed: 5 }));
});

test("played at their levels, dry stone is the quietest step and snow the loudest", () => {
  const heard = Object.fromEntries(KINDS.map((k) => [k, mean(k, loudest) * LEVEL[k]]));
  assert.ok(heard.stone < heard.wet && heard.wet < heard.puddle && heard.puddle < heard.snow, JSON.stringify(heard));
  assert.ok(heard.stone > 0.3 * heard.snow, "a step on stone is too faint to hear beside the snow: " + JSON.stringify(heard));
});

test("steps stay well under the music, as 小王子 keeps them: no step played behind him is louder than -42 dBFS", () => {
  // Measured 2026-11-16 from 小王子's shipped files (docs/t00/SOURCES.md): its stone steps sound about 26 dB under its
  // music, its grass about 22; ours were 12 and 7.5. Lowered by 10 dB, ours sit about 22 and 17.5 under the music: still
  // a little more present than his, for the bamboo's wind and because ours do not fade with the eye's distance.
  // As the page plays them outdoors in third person: LEVEL × 0.8 × walking speed 0.975 × the steps' dry send 0.8 × master 0.8.
  const chain = 0.8 * 0.975 * 0.8 * 0.8;
  for (const kind of KINDS) {
    const db = 20 * Math.log10(mean(kind, loudest) * LEVEL[kind] * chain);
    assert.ok(db <= -42, `${kind} is played at ${db.toFixed(1)} dBFS at its loudest`);
    assert.ok(db >= -50, `${kind} is played at ${db.toFixed(1)} dBFS: too faint to hear over the wind`);
  }
});

test("every step differs, the same step can be heard again, and a hurried step is shorter", () => {
  for (const kind of KINDS) {
    const a = stepSound(kind, SR, { seed: 1 }), b = stepSound(kind, SR, { seed: 2 });
    assert.deepEqual(a, stepSound(kind, SR, { seed: 1 }), `${kind} is not repeatable`);
    let diff = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) diff += Math.abs(a[i] - b[i]);
    assert.ok(diff > 20, `${kind}: two seeds made the same step`);
    assert.ok(stepSound(kind, SR, { seed: 5, speed: 3.4 }).length < stepSound(kind, SR, { seed: 5, speed: 1.2 }).length, `${kind}: hurrying does not shorten it`);
  }
  assert.ok(splash(SR, { seed: 1 }).length > 0);
});

test("water stands in some hollows of the paving after summer rain, fewer in spring, almost none in autumn, none in winter", () => {
  const share = (wet) => { let n = 0, w = 0; for (let x = -20; x <= 20; x += 0.5) for (let z = -1; z <= 53; z += 0.5) { n++; if (puddleAt(x, z, wet) > 0.5) w++; } return w / n; };
  const summer = share(1), spring = share(0.6), autumn = share(0.3);
  assert.ok(summer > 0.02 && summer < 0.4, `summer puddles cover ${(summer * 100).toFixed(1)}%`);
  assert.ok(spring < summer, "spring has more standing water than summer");
  assert.ok(autumn < 0.005, `autumn still has ${(autumn * 100).toFixed(2)}% standing water`); assert.equal(share(0), 0);
});

test("a step sounds as what it comes down on", () => {
  const dryPoint = (() => { for (let x = 5; x < 20; x += 0.25) if (puddleAt(x, 20, 1) < 0.01) return x; })();
  const wetPoint = (() => { for (let x = -20; x < 20; x += 0.1) for (let z = 0; z < 50; z += 0.5) if (puddleAt(x, z, 1) > 0.9) return [x, z]; })();
  assert.ok(wetPoint, "no puddle to step in");
  assert.equal(underfoot({ x: 0, z: 0, y: -60, floor: "room", snow: 1, wet: 1 }), "stone");                    // a hall's floor, whatever the weather
  assert.equal(underfoot({ x: 6.5, z: 20, y: 0, floor: "paving", snow: 1 }), "snow");
  assert.equal(underfoot({ x: 0, z: 20, y: 0, floor: "paving", snow: 1 }), "stone");                            // the swept axis path
  assert.equal(underfoot({ x: 1.9, z: 30, y: 0, floor: "paving", snow: 1 }), "snow");                           // its kerb lies under the bank of swept snow (snowfall.js)
  assert.equal(underfoot({ x: 0, z: 70, y: -3, floor: "path", snow: 1 }), "snow");                              // the approach is not swept
  assert.equal(underfoot({ x: 3, z: -2, y: 0.75, floor: "stone", snow: 1 }), "snow");                          // snow lies on the platforms too
  assert.equal(underfoot({ x: 3, z: -2, y: 0.75, floor: "stone", wet: 1 }), "stone");                          // a roofed platform stays dry in rain
  assert.equal(underfoot({ x: 21, z: 90, y: -14, floor: "path", wet: 1 }), "wet");
  assert.equal(underfoot({ x: 21, z: 90, y: -14, floor: "path", wet: 0.3 }), "stone");                          // autumn: dried out
  assert.equal(underfoot({ x: dryPoint, z: 20, y: 0, floor: "paving", wet: 1 }), "wet");
  assert.equal(underfoot({ x: wetPoint[0], z: wetPoint[1], y: 0, floor: "paving", wet: 1 }), "puddle");
  assert.equal(underfoot({ x: wetPoint[0], z: wetPoint[1], y: 0, floor: "paving", wet: 0.3 }), "stone");
});

test("the walker knows what each floor of the plan is made of", () => {
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const site = buildSite(M), w = createWalker(site);
  assert.equal(w.floorAt(6.5, 20), "paving");                       // the first court
  assert.equal(w.floorAt(5, 55), "paving");                         // the forecourt below the gate
  assert.equal(w.floorAt(site.start[0], site.start[1]), "path");    // the landing where the walk begins
  assert.equal(w.floorAt(0, -2), "stone");                          // the main hall's platform
  w.setRoom({ x0: -1, x1: 1, z0: -1, z1: 1, y: -60, solids: [] }); assert.equal(w.floorAt(0, 0), "room"); w.setRoom(null);
  // Every floor a shoe can find is one the sounds know.
  for (let x = -25; x <= 25; x += 1.3) for (let z = -140; z <= 110; z += 1.3) assert.ok(["paving", "path", "stone", "wood", "earth"].includes(w.floorAt(x, z)), `unknown floor at ${x}, ${z}`);
});
