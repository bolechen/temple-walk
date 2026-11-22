// #607: the Tripo body blinks, and shuts his eyes to sit; the figure built in code never does.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { blinkTimes, blinkShape, createBlink, BLINK, EYES } = await import("../../app/src/blink.js");
const { createMonk } = await import("../../app/src/monk.js");
const { dressed } = await import("./novice-glb.mjs");

test("the same seed gives the same blinks, three to six seconds apart, one in five doubled", () => {
  const a = blinkTimes(607, 3000), b = blinkTimes(607, 3000); assert.deepEqual(a, b);
  assert.notDeepEqual(a.slice(0, 20), blinkTimes(608, 3000).slice(0, 20));
  const gaps = [], singles = []; for (let i = 1; i < a.length; i++) { const g = a[i] - a[i - 1]; (Math.abs(g - BLINK.again) < 1e-9 ? singles : gaps).push(g); }
  assert.ok(gaps.every((g) => g >= BLINK.gapMin - 1e-9 && g <= BLINK.gapMax + 1e-9), "gaps within 3 to 6 s");
  const pairs = singles.length, groups = pairs + gaps.length + 1; assert.ok(pairs / groups > 0.12 && pairs / groups < 0.3, `about one in five doubled (${pairs} of ${groups})`);
  assert.ok(Math.abs(gaps.reduce((s, g) => s + g, 0) / gaps.length - 4.5) < 0.4, "the gap is 4.5 s on average");
});
test("one blink is shut for about 0.12 s", () => {
  assert.equal(blinkShape(0), 0); assert.equal(blinkShape(BLINK.shut), 0); assert.ok(blinkShape(BLINK.close) > 0.99);
  let shut = 0; for (let t = 0; t < 0.2; t += 0.001) if (blinkShape(t) > 0.01) shut += 0.001; assert.ok(Math.abs(shut - 0.12) < 0.01, `${shut}`);
});
test("stepped frame by frame it blinks at those times, and not at all when held", () => {
  const dt = 1 / 60, c = createBlink(7), times = blinkTimes(7, 40); let t = 0, seen = [], was = 0;
  for (; t < 40; t += dt) { const v = c.step(dt, false); if (v > 0.5 && was <= 0.5) seen.push(t); was = v; }
  assert.equal(seen.length, times.length, `${seen.length} blinks seen of ${times.length}`);
  seen.forEach((s, i) => assert.ok(Math.abs(s - times[i]) < 0.1, `blink ${i} at ${s} not ${times[i]}`));
  const h = createBlink(7); for (let i = 0; i < 60 * 40; i++) assert.equal(h.step(dt, false, false), 0, "held, his eyes stay open");
});
test("on a cushion his eyes are shut, and open within 0.3 s of getting up; on a stool he blinks as usual", () => {
  const m = dressed(createMonk), dt = 1 / 30; let t = 0;
  const run = (pose, secs) => { for (let i = 0; i < secs * 30; i++) { m.update(dt, 0, pose, t += dt, () => 0, {}); } };
  run(false, 1); assert.ok(m.lid.value < 0.01 || m.lid.value > 0, "stands");
  run("sit", 1); assert.equal(m.lid.value, 1, "shut sitting"); run("sit", 5); assert.equal(m.lid.value, 1);
  for (let i = 0; i < Math.ceil(0.3 / dt); i++) m.update(dt, 0, false, t += dt, () => 0, {}); assert.ok(m.lid.value < 0.2, `open again within 0.3 s (${m.lid.value})`);
  let blinked = false; for (let i = 0; i < 30 * 20; i++) { m.update(dt, 0, "chair", t += dt, () => -0.44, {}); if (m.lid.value > 0.5) blinked = true; } assert.ok(blinked, "blinks on a stool");
  m.blinking = false; let most = 0; for (let i = 0; i < 30 * 20; i++) { m.update(dt, 0, false, t += dt, () => 0, {}); most = Math.max(most, m.lid.value); } assert.equal(most, 0, "with blinking off (?shot) his eyes are open");
  m.update(dt, 0, "sit", t += dt, () => 0, {}); for (let i = 0; i < 20; i++) m.update(dt, 0, "sit", t += dt, () => 0, {}); assert.equal(m.lid.value, 1, "but he still shuts them to sit");
});
test("the figure built in code never blinks, and its lid stays 0 even sitting", () => {
  const m = createMonk(); let t = 0; for (let i = 0; i < 30 * 20; i++) m.update(1 / 30, 0, i > 300 ? "sit" : false, t += 1 / 30, () => 0, {}); assert.equal(m.lid.value, 0);
});
test("the eyes are where the body's face has them", async () => {
  const { readNovice, TRIPO } = await import("./novice-glb.mjs"); const { geometries } = readNovice(TRIPO), p = geometries.skin.attributes.position;
  let n = 0; for (let i = 0; i < p.count; i++) { const x = Math.abs(p.getX(i)), y = p.getY(i), z = p.getZ(i); if (z > EYES.zMin && Math.abs(x - EYES.x) < EYES.rx && Math.abs(y - EYES.y) < EYES.ry) n++; }
  assert.ok(n > 10, `${n} head points in the eye ellipses`);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (z > EYES.zMin && Math.abs(Math.abs(p.getX(i)) - EYES.x) < EYES.rx && Math.abs(y - EYES.y) < EYES.ry) assert.ok(y > 0.9, "only the face is in them (not a hand)"); }
});
