// Snow on the courts (snowfall.js, mirrored in the paving shader in ground.js): down the middle of every court a lane
// swept that morning, a dusting on its stone and snow left in its joints, the swept snow banked along both sides; off
// the lane, deeper against walls and platforms and in long low waves out in the open; none under a roof.
import test from "node:test"; import assert from "node:assert/strict";
const { snowAt, LANE } = await import("../../app/src/snowfall.js");
const { underfoot } = await import("../../app/src/steps.js");
const grid = (x0, x1, z0, z1, step, f) => { const out = []; for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) out.push(f(x, z)); return out; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

test("the swept lane shows its stone through a dusting, with clean grainy edges and no half-strength haze", () => {
  const c = grid(-1.5, 1.5, 0, 40, 0.07, (x, z) => snowAt(x, z).cover);
  assert.ok(mean(c) > 0.12 && mean(c) < 0.6, `the lane is ${(mean(c) * 100).toFixed(0)}% covered: bare or buried, not dusted`);
  const haze = c.filter((v) => v > 0.12 && v < 0.88).length / c.length;
  assert.ok(haze < 0.15, `${(haze * 100).toFixed(0)}% of the lane is half-strength snow, which reads as fog over the stone`);
});

test("snow stays in the joints of the swept lane", () => {
  const open = mean(grid(-1.5, 1.5, 0, 20, 0.11, (x, z) => snowAt(x, z).cover)), joints = mean(grid(-1.5, 1.5, 0, 20, 0.11, (x, z) => snowAt(x, z, { joint: 1 }).cover));
  assert.ok(joints > open + 0.3 && joints > 0.75, `joints ${joints.toFixed(2)} against the slabs ${open.toFixed(2)}`);
});

test("what was swept lies in a bank along both sides, and the snow rises to it without a step", () => {
  const across = (x) => mean(grid(x, x, 0, 40, 0.13, (xx, z) => snowAt(xx, z).depth));
  for (const s of [1, -1]) {
    const lane = across(s * 1.0), bank = across(s * (LANE + 0.32)), open = across(s * (LANE + 2.5));
    assert.ok(bank > lane + 0.4 && bank > open + 0.15, `side ${s}: lane ${lane.toFixed(2)}, bank ${bank.toFixed(2)}, open ${open.toFixed(2)}`);
    let worst = 0, prev = across(s * 1.2);
    for (let x = 1.22; x <= 3.5; x += 0.02) { const d = across(s * x); worst = Math.max(worst, Math.abs(d - prev)); prev = d; }
    assert.ok(worst < 0.12, `side ${s}: the snow jumps ${worst.toFixed(2)} over two centimetres at the lane's edge (a ruled line)`);
  }
  const cover = mean(grid(LANE + 0.15, LANE + 0.6, 0, 40, 0.1, (x, z) => snowAt(x, z).cover));
  assert.ok(cover > 0.95, "the bank (and the kerb under it) is not white");
});

test("off the lane the snow is deeper by walls and platforms and uneven out in the open; none under a roof", () => {
  const open = grid(4, 24, 0, 20, 0.5, (x, z) => snowAt(x, z).depth), sd = Math.sqrt(mean(open.map((v) => (v - mean(open)) ** 2)));
  assert.ok(sd > 0.05, `the open snow varies by ${sd.toFixed(3)}: a flat white sheet`);
  assert.ok(mean(open.map((v, i) => v)) > 0.6, "the open courts are thinly covered");
  const byWall = mean(grid(4, 24, 0, 20, 0.5, (x, z) => snowAt(x, z, { dB: 0.15 }).depth));
  assert.ok(byWall > mean(open) + 0.15, `against a wall ${byWall.toFixed(2)}, in the open ${mean(open).toFixed(2)}`);
  assert.ok(grid(4, 10, 0, 6, 0.5, (x, z) => snowAt(x, z, { dB: -1 }).cover).every((v) => v < 0.01), "snow lies under a roof");
});

test("his steps agree: stone in the swept lane of any court, snow on the bank and beyond", () => {
  assert.equal(underfoot({ x: 0, z: 20, y: 0, floor: "paving", snow: 1 }), "stone");
  assert.equal(underfoot({ x: 0.5, z: -45, y: 2.4, floor: "paving", snow: 1 }), "stone", "the lane on a terrace is swept too");
  assert.equal(underfoot({ x: 2.0, z: 30, y: 0, floor: "paving", snow: 1 }), "snow", "the bank over the kerb is snow");
  assert.equal(underfoot({ x: 6.5, z: 20, y: 0, floor: "paving", snow: 1 }), "snow");
});
