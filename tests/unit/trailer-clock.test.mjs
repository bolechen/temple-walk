// The trailer mode's clock (#610): the film's time is the film's. Every frame is the same step after the one before it, the
// page's own time and frames are replaced by it, and nothing but the workbench may ask for it.
import test from "node:test";
import assert from "node:assert/strict";
import { createFixedClock, installClock } from "../../app/src/trailer-clock.js";
import { trailerGate } from "../../app/src/trailer-gate.js";

test("a frame is a sixtieth of a second, whatever the machine took to draw it", () => {
  const c = createFixedClock({ fps: 60, start: 1000 }), seen = [];
  const loop = (t) => { seen.push(t); if (seen.length < 5) c.request(loop); };
  c.request(loop);
  while (c.pending()) c.step();
  assert.equal(seen.length, 5);
  for (let i = 1; i < seen.length; i++) assert.ok(Math.abs(seen[i] - seen[i - 1] - 1000 / 60) < 1e-9, `step ${i}: ${seen[i] - seen[i - 1]}`);
  assert.equal(c.frame(), 5);
});

test("two clocks stepped the same way read the same times, and a frame asked for twice is the same frame", () => {
  const run = () => { const c = createFixedClock({ fps: 12 }), at = []; c.request(function f(t) { at.push(t); c.request(f); }); for (let i = 0; i < 100; i++) c.step(); return at; };
  assert.deepEqual(run(), run());
});

test("only the callbacks waiting for this frame run in it; those asked for meanwhile wait for the next", () => {
  const c = createFixedClock(), order = [];
  c.request(() => { order.push("a"); c.request(() => order.push("c")); });
  c.request(() => order.push("b"));
  c.step(); assert.deepEqual(order, ["a", "b"]);
  c.step(); assert.deepEqual(order, ["a", "b", "c"]);
});

test("a cancelled frame does not run", () => {
  const c = createFixedClock(), ran = []; const id = c.request(() => ran.push(1)); c.cancel(id); c.step(); assert.deepEqual(ran, []);
});

test("the clock only goes on: a jump back would draw a frame a negative time after the last", () => {
  const c = createFixedClock({ start: 100 }); c.jump(5000); assert.equal(c.now(), 5000);
  assert.throws(() => c.jump(4000), /only goes on/);
});

test("installed in a window it replaces the page's time and frames, and gives them back", () => {
  let real = 123; const perf = { now: () => real };
  const win = { performance: perf, requestAnimationFrame: () => -1, cancelAnimationFrame: () => {} };
  const c = createFixedClock({ start: 50 }), undo = installClock(win, c), got = [];
  assert.equal(win.performance.now(), 50);
  win.requestAnimationFrame((t) => got.push(t)); c.step();
  assert.deepEqual(got, [50 + 1000 / 60]); assert.equal(win.performance.now(), 50 + 1000 / 60);
  undo(); assert.equal(win.performance.now(), 123);
});

test("only the workbench may ask for it: the dev server, and a build made for a preview or a local run", () => {
  const q = "?trailer=1";
  assert.equal(trailerGate({ dev: true, deploy: "preview", search: q }), true);
  assert.equal(trailerGate({ dev: false, deploy: "preview", search: q }), true);
  assert.equal(trailerGate({ dev: false, deploy: "production", search: q }), false, "the public page does not read it");
  assert.equal(trailerGate({ dev: false, deploy: "canary", search: q }), false, "nor does the canary");
  assert.equal(trailerGate({ dev: true, deploy: "production", search: "" }), false, "it has to be asked for");
});
