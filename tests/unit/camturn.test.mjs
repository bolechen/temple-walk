// Turning the view back behind him (#295, group B): a key that swings it round to the way he faces, and, while he walks
// and the visitor's hand has been off the view a while, the view drifting round behind the way he goes. Both are turns of
// the view's yaw only, made on the clock, and held here frame by frame: how fast the view turns, that it never overshoots,
// that a hand on the view stops it at once, and that walking sideways never sets it turning round and round.
import test from "node:test";
import assert from "node:assert/strict";
const { RECENTER, FOLLOW_TURN, planRecenter, recenterYaw, createFollowTurn, yawBehind } = await import("../../app/src/camturn.js");

const dt = 1 / 60, deg = 180 / Math.PI, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test("the key swings the view behind him by the short way, no faster than the director's 144° a second, and stops there", () => {
  for (const [from, face] of [[0, Math.PI], [0.3, -2.9], [-1.2, 1.4], [2.0, 2.05], [0, 0]]) {
    const to = yawBehind(face), plan = planRecenter(from, to);
    let prev = from, most = 0, t = 0;
    for (; t <= plan.dur + 1e-9; t += dt) { const y = recenterYaw(plan, t); most = Math.max(most, Math.abs(wrap(y - prev)) * deg / dt); prev = y; }
    assert.ok(most <= RECENTER.rate + 1e-6, `from ${from} to face ${face}: ${most.toFixed(1)}°/s`);
    assert.ok(Math.abs(wrap(recenterYaw(plan, plan.dur) - to)) < 1e-6, "it should end behind him");
    assert.ok(Math.abs(wrap(to - from)) * deg <= 180 + 1e-6 && Math.abs(plan.to - plan.from) <= Math.PI + 1e-9, "the short way round");
    assert.ok(plan.dur >= RECENTER.min - 1e-9 && plan.dur <= 2.5, `took ${plan.dur.toFixed(2)} s`);
  }
});

test("behind him is looking the way he faces", () => {
  // yard.js: his heading is atan2(sin yaw, -cos yaw) when the view looks along his back
  for (const h of [0, 1, -2, 3]) { const y = yawBehind(h); assert.ok(Math.abs(wrap(Math.atan2(Math.sin(y), -Math.cos(y)) - h)) < 1e-9); }
});

test("walking on, the view drifts round behind the way he goes only after the hand has left it a while, and slowly", () => {
  const f = createFollowTurn(); let yaw = 0, most = 0, t = 0;
  const go = Math.PI / 2;   // he walks a tapped way off to the right of the view
  f.hand();                 // the visitor has just turned the view
  for (; t < FOLLOW_TURN.wait - 0.05; t += dt) { const y = f.step(dt, yaw, { going: go, by: "route" }); assert.equal(y, yaw, "it must wait"); }
  for (let i = 0; i < 600; i++) { const y = f.step(dt, yaw, { going: go, by: "route" }); most = Math.max(most, Math.abs(wrap(y - yaw)) * deg / dt); yaw = y; }
  assert.ok(most <= FOLLOW_TURN.speed + 1e-6, `${most.toFixed(1)}°/s`);
  assert.ok(Math.abs(wrap(yaw - yawBehind(go))) < 0.02, `it should have come round behind the way he goes: ${(wrap(yaw - yawBehind(go)) * deg).toFixed(1)}°`);
});

test("a hand on the view stops the drift at once and starts the wait again; standing still it does not turn", () => {
  const f = createFollowTurn(); let yaw = 0;
  for (let i = 0; i < 300; i++) yaw = f.step(dt, yaw, { going: 1.5, by: "route" });
  assert.ok(Math.abs(yaw) > 0.05, "it should have begun to turn");
  f.hand(); const held = yaw;
  for (let i = 0; i < 30; i++) yaw = f.step(dt, yaw, { going: 1.5, by: "route" });
  assert.equal(yaw, held, "a hand stops it");
  const g = createFollowTurn(); let y2 = 0.4;
  for (let i = 0; i < 600; i++) y2 = g.step(dt, y2, { going: null, by: null });
  assert.equal(y2, 0.4, "standing, it stays");
});

test("walking by keys or the stick it does not turn: they walk by the view, and it would chase the way he goes round and round", () => {
  for (const rel of [0, 0.15, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 3, Math.PI]) {
    const f = createFollowTurn(); let yaw = 0.7;
    for (let i = 0; i < 900; i++) yaw = f.step(dt, yaw, { going: yawToHeading(yaw) + rel, by: "keys" });
    assert.ok(Math.abs(wrap(yaw - 0.7)) < 1e-9, `keys at ${(rel * deg).toFixed(0)}° to the view turned it ${(wrap(yaw - 0.7) * deg).toFixed(1)}°`);
  }
});
const yawToHeading = (y) => Math.atan2(Math.sin(y), -Math.cos(y));
