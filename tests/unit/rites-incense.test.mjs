// Incense in each of the three halls that keep a Buddha (#146), done as rites.js does it, on a fake clock: every hall's sticks
// are set where its own bowl is, burn from the time set there and go out five minutes after, may be offered again only once
// out, are kept per hall (and an older one-number save is the great hall's), and his hands and the sticks keep out of the
// offering table, the censer and the dais on the way.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createMonk } = await import("../../app/src/monk.js");
const { createRites } = await import("../../app/src/rites.js");
const { planRoute, nearestOpen } = await import("../../app/src/route.js");
const { CUSHION } = await import("../../app/src/geo.js");
const { INCENSE_HALLS, incenseId, readIncense, writeIncense } = await import("../../app/src/incense.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls);
for (const h of INCENSE_HALLS) site.places[incenseId(h)] = rooms.places[incenseId(h)];

let now = 0, wall = 1_800_000_000_000; performance.now = () => now; Date.now = () => wall + now;
const BURN = 300;
const monk = createMonk(), G = monk.group, scene = new THREE.Scene(), ticks = []; scene.add(G);
const planted = [];
const y = { monk, scene, site, M, onTick: (f) => ticks.push(f), strike: () => {}, direct: () => {}, directed: () => false, directArrived: () => false, directOut: () => 1, put: (x, z) => G.position.set(x, G.position.y, z) };
const rites = createRites(y, 1, { burn: BURN, onPlant: (at, hall) => planted.push([hall, at]) });
const frame = (speed = 0) => { now += 1000 / 30; for (const f of ticks) f(); G.updateMatrixWorld(true); monk.update(1 / 30, speed, "pray", now / 1000, () => G.position.y, { act: rites.act }); G.updateMatrixWorld(true); };
const idle = (secs) => { now += secs * 1000; for (const f of ticks) f(); };

/** Stand him at a hall's cushion and make the offering frame by frame; `each` after every frame. */
async function offer(hall, each = () => {}) {
  const p = rooms.places[incenseId(hall)], room = rooms.rooms[hall].room;
  G.position.set(p.at[0], room.y, p.at[1]); G.rotation.y = p.face;
  const st = { seat: null, speed: null }; let done = false, result;
  const run = rites.offerIncense(() => true, st, () => {}, hall).then((r) => { done = true; result = r; });
  for (let i = 0; i < 30 * 40 && !done; i++) { frame(st.speed ?? 0); each(st); await Promise.resolve(); await Promise.resolve(); }
  await run; return result;
}
const left = (hall) => rites.state().incense.halls[hall];

test("each hall's sticks are set in its own bowl and burn out five minutes after they were set there, whatever is done in the others", async () => {
  assert.deepEqual(Object.keys(rites.state().incense.halls).sort(), [...INCENSE_HALLS].sort());
  assert.equal(await offer("main"), true);
  idle(60); assert.equal(await offer("yaoshi"), true);
  idle(90); assert.equal(await offer("guanyin"), true);
  assert.deepEqual(planted.map(([h]) => h), ["main", "yaoshi", "guanyin"]);
  const t = Object.fromEntries(planted.map(([h, at]) => [h, at - wall]));   // the moments they were set, on the fake clock
  for (const h of INCENSE_HALLS) {
    const p = rooms.places[incenseId(h)], s = left(h);
    assert.ok(s.planted && s.smoke && !s.burnt, `${h}: the sticks are in the ash, smoking`);
    assert.ok(Math.hypot(s.at[0] - p.bowl[0], s.at[2] - p.bowl[2]) < 0.02 && Math.abs(s.at[1] - (p.bowl[1] - 0.035)) < 0.02, `${h}: the sticks are not in its own bowl: ${s.at}`);
    assert.ok(Math.abs(s.left - (BURN - (now - t[h]) / 1000)) <= 1, `${h}: ${s.left} s left`);
  }
  // None of them may be offered again while it burns; each is out five minutes after its own time.
  for (const h of INCENSE_HALLS) assert.equal(await offer(h), false, `${h}: offered again while it burns`);
  assert.ok(INCENSE_HALLS.every((h) => rites.incenseLit(h)));
  idle(BURN - (now - t.main) / 1000 + 1); frame();
  assert.ok(!rites.incenseLit("main") && left("main").burnt && !left("main").smoke, "the great hall's are out, cold stubs");
  assert.ok(rites.incenseLit("yaoshi") && rites.incenseLit("guanyin"), "the others, set later, are still burning");
  idle(BURN - (now - t.yaoshi) / 1000 + 1); frame();
  assert.ok(!rites.incenseLit("yaoshi") && rites.incenseLit("guanyin"), "the Medicine hall's are out on their own time; the Guanyin hall's still burn");
  idle(BURN - (now - t.guanyin) / 1000 + 1); frame();
  assert.ok(INCENSE_HALLS.every((h) => !rites.incenseLit(h) && left(h).burnt), "all three out");
  // Out, each may be offered again, and the offering is the same one.
  for (const h of INCENSE_HALLS) { assert.equal(await offer(h), true, `${h}: cannot be offered again once out`); assert.ok(rites.incenseLit(h), `${h}: lit again`); }
});

test("a reload finds each hall's sticks as far burnt as its own time says; an older one-number save is the great hall's", () => {
  const at = Date.now(), store = writeIncense(String(at - 100_000), "guanyin", at - 400_000);   // main set 100 s ago (old save), guanyin 400 s ago (out); the first write migrates
  const r2 = (() => {
    const y2 = { ...y, onTick: () => {} }, r = createRites(y2, 1, { burn: BURN });
    r.restore({ incense: readIncense(store) }); return r;
  })();
  const s = r2.state().incense.halls;
  assert.ok(s.main.planted && Math.abs(s.main.left - 200) <= 1, `main: ${JSON.stringify(s.main)}`);
  assert.ok(s.guanyin.burnt && !s.guanyin.planted, "guanyin: out");
  assert.ok(!s.yaoshi.shown && !s.yaoshi.planted && !s.yaoshi.burnt, "yaoshi: never offered, nothing in its ash");
});

test("his hands and the sticks keep out of the offering table, the censer and the dais, in every hall", async () => {
  idle(BURN + 10); frame();   // all out first
  for (const hall of INCENSE_HALLS) {
    const p = rooms.places[incenseId(hall)], room = rooms.rooms[hall].room, big = hall === "main", ox = room.cx, tz = -room.z1 + 0 - 0, Y = room.y;
    const tzh = room.z0 + 5.4, tw = big ? 2.6 : 1.8;   // the offering table's centre and width (interior.js)
    const table = new THREE.Box3(new THREE.Vector3(ox - tw / 2, Y + 0.0, tzh - 0.35), new THREE.Vector3(ox + tw / 2, Y + 0.93, tzh + 0.35));
    const censer = new THREE.Box3(new THREE.Vector3(ox - 0.2, Y + 0.89, tzh - 0.2), new THREE.Vector3(ox + 0.2, Y + 1.15, tzh + 0.2));
    const bowlBox = (x, yy, z) => Math.hypot(x - p.bowl[0], z - p.bowl[2]) < 0.13 && yy < p.bowl[1] - 0.07;   // the bronze bowl's belly under the ash
    let least = Infinity; const bad = [];
    await offer(hall, () => {
      for (const n of ["leftHand", "rightHand"]) { const w = monk.bones[n].getWorldPosition(new THREE.Vector3()); for (const [name, b] of [["table", table], ["censer", censer]]) if (b.containsPoint(w)) bad.push(`${n} in the ${name} at ${w.toArray().map((v) => v.toFixed(2))}`); if (bowlBox(w.x, w.y, w.z)) bad.push(`${n} in the bowl`); least = Math.min(least, w.z); }
    });
    assert.deepEqual(bad.slice(0, 3), [], `${hall}: his hand went into something`);
    assert.ok(least > room.z0, `${hall}: a hand left the room`);
    idle(BURN + 10); frame();
  }
});

test("the step up to the incense stand matches the true smoothstep speed and clears on finish or cancel (#661)", async () => {
  idle(BURN + 10); frame();
  const p = rooms.places[incenseId("main")], dist = Math.hypot(p.front[0] - p.at[0], p.front[1] - p.at[1]);
  const expectedPeak = (dist / 1.3) * 1.5;
  const speeds = [];
  let footfalls = 0;
  monk.steps.splice(0);
  await offer("main", (st) => {
    if (st.speed !== null) {
      speeds.push(st.speed);
      footfalls += monk.steps.splice(0).length;
    } else {
      monk.steps.splice(0);
    }
  });
  assert.ok(speeds.length >= 30, `expected ~39 frames during 1.3s step, got ${speeds.length}`);
  const peak = Math.max(...speeds), first = speeds[0], last = speeds[speeds.length - 1];
  const integral = speeds.reduce((s, v) => s + v / 30, 0);
  assert.ok(Math.abs(peak - expectedPeak) < 0.015, `peak speed ${peak.toFixed(4)} should match true peak ${expectedPeak.toFixed(4)} (not hardcoded 0.5)`);
  assert.ok(first < expectedPeak * 0.25 && last === 0, `speed should ease in and settle to 0 (first=${first.toFixed(4)}, last=${last.toFixed(4)})`);
  assert.ok(Math.abs(integral - dist) < 0.02, `integrated distance ${integral.toFixed(3)} m should match true distance ${dist.toFixed(3)} m`);
  assert.ok(footfalls <= 2, `a 0.25 m step should take at most 1–2 calm steps (${footfalls} footfalls)`);

  // Interrupting mid-step clears st.speed to null.
  idle(BURN + 10); frame();
  const room = rooms.rooms.main.room;
  G.position.set(p.at[0], room.y, p.at[1]); G.rotation.y = p.face;
  const st = { seat: null, speed: null };
  let active = true, sawMove = false, done = false;
  const run = rites.offerIncense(() => active, st, () => {}, "main").then(() => { done = true; });
  for (let i = 0; i < 30 * 20 && !done; i++) {
    frame(st.speed ?? 0);
    if (st.speed !== null && st.speed > 0.05) { sawMove = true; active = false; }
    await Promise.resolve(); await Promise.resolve();
  }
  await run;
  assert.ok(sawMove, "should have entered the step-up passage before cancelling");
  assert.equal(st.speed, null, "cancelling mid-step must clear st.speed to null");
});

// #638: the cushions before the altar are sat on, not crossed. From the door and from either side, the way to the stand where the
// sticks are set, and the places he stands to bow and to set them, keep his soles outside every cushion's outline.
test("the way to the incense stand never puts his shoes on a cushion", () => {
  const walker = createWalker(site), reach = Math.max(...CUSHION.map((c) => c[0]));
  for (const h of INCENSE_HALLS) {
    const room = rooms.rooms[h].room, p = rooms.places[incenseId(h)], cushions = rooms.seats.filter((s) => s.room === h && s.kind === "cushion");
    assert.ok(cushions.length >= 2, `${h}: the cushions are there`);
    walker.setRoom(room);
    const starts = [room.door, [p.front[0] - 2.4, p.front[1] + 1.2], [p.front[0] + 2.4, p.front[1] + 1.2]];
    const clear = (x, z, what) => { for (const c of cushions) assert.ok(Math.hypot(x - c.at[0], z - c.at[1]) >= reach, `${h}: ${what} (${x.toFixed(2)}, ${z.toFixed(2)}) is on the cushion at ${c.at.map((v) => v.toFixed(2))}`); };
    clear(p.at[0], p.at[1], "where he bows"); clear(p.front[0], p.front[1], "the stand's front");
    for (const s of starts) {
      const a = nearestOpen(walker, s[0], s[1], 3) || { x: s[0], z: s[1] };
      const r = planRoute(walker, walker.drops || [], a, { x: p.front[0], z: p.front[1] });
      assert.ok(r.reached, `${h}: the stand cannot be reached from ${s}`);
      for (let i = 1; i < r.points.length; i++) {
        const u = r.points[i - 1], v = r.points[i], n = Math.max(1, Math.ceil(Math.hypot(v.x - u.x, v.z - u.z) / 0.02));
        for (let k = 0; k <= n; k++) clear(u.x + ((v.x - u.x) * k) / n, u.z + ((v.z - u.z) * k) / n, "the way");
      }
    }
    walker.setRoom(null);
  }
});
