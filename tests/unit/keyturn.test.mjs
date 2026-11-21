// Turning by the keys (#295, group C): A and D turn him and the view with him, so that W walks on the way he looks and the
// mouse is not needed; the old way (A and D step sideways) is a setting. Held here: which key does what in each way, how
// fast he turns, that the turn gathers and lets go rather than starting and stopping dead, and that the stick is untouched.
import test from "node:test";
import assert from "node:assert/strict";
const { KEY_TURN, keyAxes, createKeyTurn } = await import("../../app/src/keyturn.js");

const dt = 1 / 60, deg = 180 / Math.PI;
const K = (...ks) => Object.fromEntries(ks.map((k) => [k, true])), still = { x: 0, y: 0 };

test("in the default way A and D turn, W and S walk, the side arrows step sideways", () => {
  assert.deepEqual(keyAxes(K("a"), still, "turn"), { f: 0, s: 0, turn: -1 });
  assert.deepEqual(keyAxes(K("d"), still, "turn"), { f: 0, s: 0, turn: 1 });
  assert.deepEqual(keyAxes(K("w", "d"), still, "turn"), { f: 1, s: 0, turn: 1 });
  assert.deepEqual(keyAxes(K("s"), still, "turn"), { f: -1, s: 0, turn: 0 });
  assert.deepEqual(keyAxes(K("arrowleft"), still, "turn"), { f: 0, s: -1, turn: 0 });
  assert.deepEqual(keyAxes(K("arrowright", "arrowup"), still, "turn"), { f: 1, s: 1, turn: 0 });
});

test("in the old way A and D step sideways as before, and nothing turns", () => {
  assert.deepEqual(keyAxes(K("a"), still, "strafe"), { f: 0, s: -1, turn: 0 });
  assert.deepEqual(keyAxes(K("d", "w"), still, "strafe"), { f: 1, s: 1, turn: 0 });
  assert.deepEqual(keyAxes(K("arrowleft"), still, "strafe"), { f: 0, s: -1, turn: 0 });
});

test("the stick walks where it is pushed in either way, and never turns", () => {
  for (const mode of ["turn", "strafe"]) assert.deepEqual(keyAxes({}, { x: 0.6, y: -0.8 }, mode), { f: 0.8, s: 0.6, turn: 0 });
});

test("held, the turn gathers to its rate and no faster; let go, it stops within a moment, never past", () => {
  const t = createKeyTurn(); let yaw = 0, most = 0, prev = 0;
  for (let i = 0; i < 120; i++) { yaw = t.step(dt, yaw, 1); most = Math.max(most, Math.abs(yaw - prev) / dt * deg); prev = yaw; }
  assert.ok(most <= KEY_TURN.rate + 1e-6, `${most.toFixed(1)}°/s`);
  assert.ok(most >= KEY_TURN.rate - 1, "it should reach its rate when held");
  const first = createKeyTurn(), y1 = first.step(dt, 0, 1);
  assert.ok(Math.abs(y1) * deg / dt < KEY_TURN.rate * 0.5, "it should not start at full rate");
  let after = 0, y = yaw; for (let i = 0; i < 60; i++) { const n = t.step(dt, y, 0); after = Math.abs(n - y) * deg / dt; y = n; }
  assert.equal(after, 0, "let go, it should have stopped");
  assert.ok(Math.abs(y - yaw) * deg < KEY_TURN.rate * KEY_TURN.ease, "and stopped soon");
});

test("the visitor's own speed setting scales the rate", () => {
  const t = createKeyTurn(); let yaw = 0, prev = 0, most = 0;
  for (let i = 0; i < 120; i++) { yaw = t.step(dt, yaw, 1, 1.5); most = Math.max(most, Math.abs(yaw - prev) / dt * deg); prev = yaw; }
  assert.ok(Math.abs(most - KEY_TURN.rate * 1.5) < 1, `${most.toFixed(1)}°/s`);
});
