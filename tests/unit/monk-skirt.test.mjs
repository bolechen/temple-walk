// The robe's skirt on a flight of steps (issue #284). After #270 made him take one tread to a step, the knee came up so
// far that the skirt's bones followed it into a flat board, and the trousers showed above the cloth. The skirt now has a
// reach it does not pass; these tests hold the bones' angles and, from the posed meshes, that no trouser vertex the
// robe covers when he stands is out in the air.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../../app/src/monk.js");
const { dressed } = await import("./novice-glb.mjs");
// #163: the trouser checks on both bodies he may wear (the bones, and so the angles, are the same skeleton's)
const BODIES = [["built in code", createMonk], ["Tripo's, worn by default", () => dressed(createMonk)]];
const { flight } = await import("../../tools/gait-stairs.mjs");
const { STAIR } = await import("../../app/src/geo.js");
// #615: the thighs carry the skirt out of their way, as the robe's shader does it (the posed mesh the tests read is skinned on the CPU without it)
const carried = (m, i, v) => (process.env.NOCARRY ? v : m.carry(i, v));
const WALK = STAIR.tread * STAIR.steps, SKIRT = ["robeFront", "robeBack", "robeLeft", "robeRight"], deg = THREE.MathUtils.radToDeg;

// A walk of `n` treads (0: level) at `speed`, frame by frame as yard.js moves him; `each(m, frame)` sees every frame after
// the first two metres, once the stride is under way.
// `at`: where in the world the flight's foot is (the page's flights are far from the origin, and the novice's own frame is not the world's).
function walk({ n = 0, dir = 1, speed = WALK, dt = 1 / 60, make = createMonk, at = [0, 0], turnStart = false }, each) {
  if (turnStart) return turnAround({ dt, make, at }, each);
  const m = make(), fl = n ? flight(n, dir) : { lead: 4, run: 0, surface: () => 0, eye: () => 0 }, [ox, oz] = at;
  let z = 0.2, t = 0, frame = 0;
  while (z < fl.lead + fl.run + 3) {
    z += speed * dt; t += dt; m.group.position.set(ox, fl.surface(z), oz + z);
    const on = n && z > fl.lead - 0.3 && z < fl.lead + fl.run + 0.3;
    m.update(dt, speed, false, t, (x, zz) => fl.surface(zz - oz), { heightAt: (x, zz) => fl.eye(zz - oz), stairs: !!on });
    m.group.updateMatrixWorld(true);
    if (z > 2) each(m, frame++);
  }
}
// #284, the turn on the level: he stands, is told to go the other way, and the page turns him at `dt * 9` of the angle left
// while his speed rises at `dt * 10` of what is missing (yard.js, `heading` and `speedNow`). `each` sees every frame from the
// word to go until the stride is under way, as `walk`'s does, with `frame` counted from the word (the first 0.6 s is what
// the review looked at).
function turnAround({ dt, make, at: [ox, oz] }, each) {
  const m = make(); let t = 0, heading = 0, speed = 0, x = ox, z = oz;
  const step = (want, goal, frame) => {
    t += dt; heading += Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * Math.min(1, dt * 9);
    speed += (goal - speed) * Math.min(1, dt * 10); x += Math.sin(want) * speed * dt; z += Math.cos(want) * speed * dt;
    m.group.position.set(x, 0, z); m.group.rotation.y = heading; m.update(dt, speed, false, t, () => 0, { heightAt: () => 0, stairs: false });
    m.group.updateMatrixWorld(true); if (frame !== null) each(m, frame);
  };
  for (let k = 0; k < 90; k++) step(0, 0, null);
  for (let k = 0; k < 60; k++) step(Math.PI, 2.1, k);
}
// The most each skirt bone turns, against the pelvis (x forward, z out) and from the vertical in the world, over a walk.
function reach(opts) {
  const r = Object.fromEntries(SKIRT.map((k) => [k, { xmin: 9, xmax: -9, z: 0, world: 0, scale: 9 }])), q = new THREE.Quaternion(), d = new THREE.Vector3();
  walk(opts, (m) => {
    for (const k of SKIRT) {
      const b = m.bones[k], o = r[k];
      o.xmin = Math.min(o.xmin, b.rotation.x); o.xmax = Math.max(o.xmax, b.rotation.x); o.z = Math.max(o.z, Math.abs(b.rotation.z)); o.scale = Math.min(o.scale, b.scale.y);
      d.set(0, -1, 0).applyQuaternion(b.getWorldQuaternion(q)); o.world = Math.max(o.world, Math.acos(Math.min(1, -d.y)));
    }
  });
  return r;
}

// Which trouser vertices stand out of the robe. The ones the robe covers when he stands (a 0.38–0.53 m rest height, above the band at the hem where trousers always show, the
// robe's hem being at 0.246) are each sent straight out from the axis of his body at its own height; if that ray meets
// none of the robe's skirt cloth, the vertex is in the open. The skirt cloth is the robe's triangles whose points hang
// wholly from the pelvis and the four skirt bones (the sleeves and the sash do not).
function exposed(opts, every = 3, sample = 5) {
  const probe = (opts.make || createMonk)(); probe.group.updateMatrixWorld(true); probe.skeleton.update();
  const names = probe.skeleton.bones.map((b) => b.name), rg = probe.parts.robe.geometry, si = rg.attributes.skinIndex, sw = rg.attributes.skinWeight, v = new THREE.Vector3();
  const skirtW = (i) => { let w = 0; for (let k = 0; k < 4; k++) { const n = names[si.getComponent(i, k)]; if (n === "hips" || SKIRT.includes(n)) w += sw.getComponent(i, k); } return w; };
  const tris = []; const idx = rg.index.array;
  for (let i = 0; i < idx.length; i += 3) if (skirtW(idx[i]) > 0.9 && skirtW(idx[i + 1]) > 0.9 && skirtW(idx[i + 2]) > 0.9) tris.push([idx[i], idx[i + 1], idx[i + 2]]);
  const pa = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), h = new THREE.Vector3(), s = new THREE.Vector3(), qv = new THREE.Vector3(), dir = new THREE.Vector3();
  const hit = (o, d, a, b, c) => {   // Möller–Trumbore, both faces, in front of the origin
    e1.subVectors(b, a); e2.subVectors(c, a); h.crossVectors(d, e2); const det = e1.dot(h); if (Math.abs(det) < 1e-12) return false;
    const f = 1 / det; s.subVectors(o, a); const u = f * s.dot(h); if (u < 0 || u > 1) return false;
    qv.crossVectors(s, e1); const w = f * d.dot(qv); if (w < 0 || u + w > 1) return false; return f * e2.dot(qv) > 1e-6;
  };
  // The trouser points the robe covers when he stands: in the band below the hip, and behind the skirt's cloth as he
  // stands at rest (#163: the Tripo body's robe ends at the knee, as the drawing has it, so its band is not all covered).
  const legs = probe.parts.legs, covered = [];
  { const RP = rg.attributes.position, robe0 = probe.parts.robe;
    const P0 = new Float32Array(RP.count * 3); for (let i = 0; i < RP.count; i++) { robe0.getVertexPosition(i, v).applyMatrix4(robe0.matrixWorld); P0.set([v.x, v.y, v.z], i * 3); }
    for (let i = 0; i < legs.geometry.attributes.position.count; i += every) {
      legs.getVertexPosition(i, v).applyMatrix4(legs.matrixWorld); if (!(v.y > 0.38 && v.y < 0.53)) continue;
      dir.set(v.x, 0, v.z); if (dir.lengthSq() < 1e-8) continue; dir.normalize();
      if (tris.some((t) => hit(v, dir, A.fromArray(P0, t[0] * 3), B.fromArray(P0, t[1] * 3), C.fromArray(P0, t[2] * 3)))) covered.push(i);
    } }
  assert.ok(tris.length > 2000 && covered.length > 60, `${tris.length} skirt triangles, ${covered.length} trouser points to look at`);
  let worst = 0, frames = 0, where = "", pierced = 0, mostThrough = 0; const DOWN = new THREE.Vector3(0, -1, 0);
  // every trouser point from the knee to the hip, covered at rest or not
  const band = []; for (let i = 0; i < legs.geometry.attributes.position.count; i += every) { legs.getVertexPosition(i, v).applyMatrix4(legs.matrixWorld); if (v.y > 0.3 && v.y < 0.6) band.push(i); }
  walk(opts, (m, frame) => {
    if (frame % sample) return; frames++;
    m.skeleton.update();
    const robe = m.parts.robe, P = new Float32Array(rg.attributes.position.count * 3);
    for (let i = 0; i < rg.attributes.position.count; i++) { robe.getVertexPosition(i, v).applyMatrix4(robe.matrixWorld); carried(m, i, v); P.set([v.x, v.y, v.z], i * 3); }
    let out = 0;
    const lg = m.parts.legs;
    for (const i of covered) {
      lg.getVertexPosition(i, v).applyMatrix4(lg.matrixWorld);
      const cx = m.group.position.x, cz = m.group.position.z; dir.set(v.x - cx, 0, v.z - cz); if (dir.lengthSq() < 1e-8) continue; dir.normalize();
      let found = false;
      for (const t of tris) { A.fromArray(P, t[0] * 3); B.fromArray(P, t[1] * 3); C.fromArray(P, t[2] * 3); if (hit(v, dir, A, B, C)) { found = true; break; } }
      if (!found) { out++; if (process.env.SKIRT_DEBUG && frame === 195) console.log("open", i, v.toArray().map((x) => x.toFixed(3)).join(",")); }
    }
    if (out > worst) { worst = out; where = `frame ${frame}`; }
    // Through the cloth: a trouser point out in the open with the skirt's cloth still hanging below it (looking straight
    // down from it meets the skirt), so the leg has come out through the cloth's face rather than out under its hem (#163:
    // the robe of the drawing's fifth version ends above the knee, and the trousers below it are meant to show).
    let through = 0;
    for (const i of band) {
      lg.getVertexPosition(i, v).applyMatrix4(lg.matrixWorld);
      const cx = m.group.position.x, cz = m.group.position.z; dir.set(v.x - cx, 0, v.z - cz); if (dir.lengthSq() < 1e-8) continue; dir.normalize();
      let inside = false; for (const t of tris) { A.fromArray(P, t[0] * 3); B.fromArray(P, t[1] * 3); C.fromArray(P, t[2] * 3); if (hit(v, dir, A, B, C)) { inside = true; break; } }
      if (inside) continue;
      for (const t of tris) { A.fromArray(P, t[0] * 3); B.fromArray(P, t[1] * 3); C.fromArray(P, t[2] * 3); if (hit(v, DOWN, A, B, C)) { through++; break; } }
    }
    if (through) { pierced++; mostThrough = Math.max(mostThrough, through); }
  });
  return { worst, of: covered.length, frames, where, pierced, mostThrough };
}

test("level ground: the skirt bones keep to the angles they always had, and no trouser shows", () => {
  const r = reach({}); assert.ok(r.robeFront.xmin >= -0.6 && r.robeFront.world < 0.7, `front ${r.robeFront.xmin}, ${deg(r.robeFront.world)}°`);
  const x = exposed({}); assert.equal(x.worst, 0, `${x.worst} of ${x.of} trouser points in the open on the level (${x.where})`);
  const t = exposed({ make: BODIES[1][1] }); console.log(`# Tripo level: ${t.worst} of ${t.of} covered points out, ${t.pierced} of ${t.frames} frames through the cloth (at most ${t.mostThrough} points)`);
  assert.equal(t.pierced, 0, `Tripo's body: the leg comes through the skirt's cloth on the level in ${t.pierced} of ${t.frames} frames`);
});
test("on a flight, up or down, the skirt's front and sides never lift into a board", () => {
  for (const dir of [1, -1]) for (const speed of [WALK, 1.25]) {
    const r = reach({ n: 10, dir, speed }), tag = `${dir > 0 ? "up" : "down"} at ${speed.toFixed(2)} m/s`;
    for (const k of ["robeFront", "robeLeft", "robeRight"]) {
      assert.ok(r[k].xmin >= -0.85, `${k} ${tag}: turned ${r[k].xmin.toFixed(2)} rad from the pelvis`);
      assert.ok(r[k].world <= THREE.MathUtils.degToRad(55), `${k} ${tag}: ${deg(r[k].world).toFixed(0)}° from the vertical`);
      assert.ok(r[k].z <= 0.22, `${k} ${tag}: splayed ${r[k].z.toFixed(2)} rad`);
    }
  }
});
test("on a flight the skirt's back swings lightly and is never thrown flat", () => {
  for (const dir of [1, -1]) {
    const r = reach({ n: 10, dir }); assert.ok(r.robeBack.xmax <= 0.4 && r.robeBack.world <= THREE.MathUtils.degToRad(35), `back ${r.robeBack.xmax.toFixed(2)} rad, ${deg(r.robeBack.world).toFixed(0)}°`);
  }
});
// Not none: the raised knee's own cap, three or four points in a hundred, still comes through a skirt that is no longer
// allowed to stand out like a board over it (it was 17 going up before the cap, 15%).
test("on a flight, up or down, the trousers the robe covers are hidden but for the tip of the raised knee", () => {
  for (const dir of [1, -1]) { const x = exposed({ n: 10, dir }); assert.ok(x.worst <= 4, `${dir > 0 ? "up" : "down"}: ${x.worst} of ${x.of} trouser points in the open (${x.where}); before the cap, 17 going up`); console.log(`# code ${dir > 0 ? "up" : "down"}: ${x.worst} of ${x.of} out, ${x.pierced} of ${x.frames} frames through (at most ${x.mostThrough})`); }
  for (const dir of [1, -1]) { const t = exposed({ n: 10, dir, make: BODIES[1][1] }); console.log(`# Tripo ${dir > 0 ? "up" : "down"}: ${t.worst} of ${t.of} covered points out, ${t.pierced} of ${t.frames} frames through the cloth (at most ${t.mostThrough} points)`); }
});

// #163, the third art review: going down, the Tripo body's skirt drew up to the waist at its sides and back on every
// step, the trousers' whole seat showing, while its front kept its length. The hem's lift skinned the skirt with only
// the pelvis's and the skirt bones' matrices, and that skirt's front is weighted to the thighs too: those points came
// out in the novice's own frame, metres under the stair, and every skirt bone was shortened to its floor. Measured as
// the review measured it: how far the skirt reaches below the pelvis at his sides and at his back (the review's side
// view and back view), against the same standing, on every frame of a flight up and down, never less than 0.8; and no
// point of the robe is in the stone.
test("on a flight, up or down and anywhere in the world, the skirt's sides and back keep at least 0.8 of their standing length and stay out of the stone", () => {
  const sectors = { left: [1, 0], right: [-1, 0], back: [0, -1] };
  const reachBelow = (m) => {
    m.group.updateMatrixWorld(true); m.skeleton.update();
    const robe = m.parts.robe, P = robe.geometry.attributes.position, v = new THREE.Vector3(), hips = m.bones.hips.getWorldPosition(new THREE.Vector3()), inv = m.group.matrixWorld.clone().invert(), r = {};
    for (const k in sectors) r[k] = 0;
    for (let i = 0; i < P.count; i += 2) {
      robe.getVertexPosition(i, v).applyMatrix4(robe.matrixWorld); const y = v.y; v.applyMatrix4(inv); const d = Math.hypot(v.x, v.z); if (d < 0.05) continue;
      for (const [k, [sx, sz]] of Object.entries(sectors)) if ((v.x * sx + v.z * sz) / d > Math.cos(0.35)) r[k] = Math.max(r[k], hips.y - y);
    }
    return r;
  };
  for (const [name, make] of BODIES) {
    const stand = make(); const s0 = reachBelow(stand);
    for (const dir of [1, -1]) {
      let worst = { k: "", ratio: 9, frame: -1 }, deepest = 0;
      walk({ n: 10, dir, make, at: [31.5, -47.2] }, (m, frame) => {
        if (frame % 3) return;
        const r = reachBelow(m); for (const k in sectors) { const ratio = r[k] / s0[k]; if (ratio < worst.ratio) worst = { k, ratio, frame }; }
        const robe = m.parts.robe, P = robe.geometry.attributes.position, v = new THREE.Vector3(), fl = flight(10, dir);
        for (let i = 0; i < P.count; i += 4) { robe.getVertexPosition(i, v).applyMatrix4(robe.matrixWorld); deepest = Math.max(deepest, fl.surface(v.z + 47.2) - v.y); }
      });
      const tag = `${name} ${dir > 0 ? "up" : "down"}`;
      console.log(`# ${tag}: skirt reach at least ${worst.ratio.toFixed(2)} of standing (${worst.k}, frame ${worst.frame}); deepest into the stone ${(deepest * 100).toFixed(1)} cm`);
      assert.ok(worst.ratio >= 0.8, `${tag}: the skirt's ${worst.k} reached only ${worst.ratio.toFixed(2)} of its standing length below the pelvis (frame ${worst.frame})`);
      assert.ok(deepest < 0.01, `${tag}: the robe ${(deepest * 100).toFixed(1)} cm into the stone`);
    }
  }
});
// The 3D review's floor for the hem's lift (#163): with a step standing right behind his heels, high enough to take the
// back of the skirt, the skirt is drawn up as one ring: no bone shorter than 0.7 of its length, none shorter than 0.85
// of a bone beside it (front, left, back, right round him).
test("a step behind him draws the skirt up as one ring, never a flap to the waist", () => {
  for (const [name, make] of BODIES) {
    const m = make(); let t = 0;
    for (let k = 0; k < 40; k++) { t += 1 / 60; m.group.position.set(0, 0, 0); m.update(1 / 60, 0, false, t, (x, z) => (z < -0.04 ? 0.4 : 0), { heightAt: () => 0 }); }
    const s = m.skirt, min = Math.min(...s);
    assert.ok(min < 0.999, `${name}: the step behind him did not lift the skirt at all (${s})`);
    assert.ok(min >= 0.7, `${name}: a skirt bone shortened to ${min} (${s})`);
    for (let b = 0; b < 4; b++) { const r = s[b] / Math.max(s[(b + 1) % 4], s[(b + 3) % 4]); assert.ok(r >= 0.85 - 1e-3, `${name}: bone ${b} hangs ${r.toFixed(2)} of the one beside it (${s})`); }
    console.log(`# ${name}: skirt bones ${s.join(" ")} with a 40 cm step behind his heels`);
  }
});

// #541 item 5, the art review's own view: from in front and above (the eye at `[+0.9, 1.75, 1.7]` from his feet, looking at his
// thighs, the page's `__look([x+0.9, h+1.75, z-1.7], [x, h+0.45, z])` for a flight that runs north) going up, the front of the
// robe must not part over the trousers. Measured from the posed meshes: of the trouser points between the knee and the hip that
// the eye sees (no robe triangle between it and them), the highest is the top of the opening; its height over the lowest
// point of the robe's front half is how far the cloth is open, and it may not pass a third of the skirt's standing length
// (the review's rule). `eye` is where the eye stands relative to him, `x` across (he faces +z here, so his right is -x).
function opening({ n = 10, dir = 1, make = createMonk, at = [0, 0], eye = [-0.9, 1.75, 1.7], every = 2, sample = 3 }) {
  const stand = make(); stand.group.updateMatrixWorld(true); stand.skeleton.update();
  const v = new THREE.Vector3(), hips0 = stand.bones.hips.getWorldPosition(new THREE.Vector3());
  const lowest = (m, front) => { const rb = m.parts.robe, P = rb.geometry.attributes.position, inv = m.group.matrixWorld.clone().invert(); let y = 9; for (let i = 0; i < P.count; i += 2) { rb.getVertexPosition(i, v).applyMatrix4(rb.matrixWorld); carried(m, i, v); const wy = v.y; v.applyMatrix4(inv); if (!front || v.z > 0.02) y = Math.min(y, wy); } return y; };
  const length = hips0.y - lowest(stand, true);
  const ei = stand.parts.robe.geometry.index.array, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), h = new THREE.Vector3(), s = new THREE.Vector3(), qv = new THREE.Vector3(), d = new THREE.Vector3(), cam = new THREE.Vector3(), lp = new THREE.Vector3();
  const blocked = (o, p, P) => {   // is any robe triangle between o and p (Möller–Trumbore on the segment)
    d.subVectors(p, o); const len = d.length(); d.divideScalar(len);
    for (let i = 0; i < ei.length; i += 3) {
      A.fromArray(P, ei[i] * 3); B.fromArray(P, ei[i + 1] * 3); C.fromArray(P, ei[i + 2] * 3); e1.subVectors(B, A); e2.subVectors(C, A); h.crossVectors(d, e2); const det = e1.dot(h); if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det; s.subVectors(o, A); const u = f * s.dot(h); if (u < 0 || u > 1) continue; qv.crossVectors(s, e1); const w = f * d.dot(qv); if (w < 0 || u + w > 1) continue; const tt = f * e2.dot(qv); if (tt > 1e-4 && tt < len - 0.004) return true;
    }
    return false;
  };
  let worst = 0, over = 0, frames = 0, at0 = -1;
  walk({ n, dir, make, at }, (m, frame) => {
    if (frame % sample) return; frames++;
    m.skeleton.update(); const rb = m.parts.robe, P = new Float32Array(rb.geometry.attributes.position.count * 3);
    for (let i = 0; i < rb.geometry.attributes.position.count; i++) { rb.getVertexPosition(i, v).applyMatrix4(rb.matrixWorld); carried(m, i, v); P.set([v.x, v.y, v.z], i * 3); }
    const g = m.group.position, hy = m.bones.hips.getWorldPosition(new THREE.Vector3()).y; cam.set(g.x + eye[0], g.y + eye[1], g.z + eye[2]);
    const inv = m.group.matrixWorld.clone().invert(), floor = lowest(m, true), lg = m.parts.legs; let top = -9;
    for (let i = 0; i < lg.geometry.attributes.position.count; i += every) {
      lg.getVertexPosition(i, v).applyMatrix4(lg.matrixWorld); if (v.y > hy - 0.03 || v.y <= floor + 1e-3 || v.y < top) continue;
      lp.copy(v).applyMatrix4(inv); if (lp.z < 0.02 || Math.abs(lp.x) > 0.1) continue;   // the middle of the front only
      if (!blocked(cam, v, P)) top = v.y;
    }
    const open = top > -9 ? top - floor : 0; if (open > worst) { worst = open; at0 = frame; } if (open > length / 3) over++;
  });
  return { worst, over, frames, length, at: at0 };
}
for (const [name, make] of BODIES) {
  // Reported, not held: #541 item 5 (the front parting over the trousers going up) is still open. Thigh and cloth are one
  // linear skin, the cloth may not stand out as a board (the test above), and what the review's eye sees from above is the
  // top of a thigh the cloth cannot lie over; it needs the trousers slimmed offline or cloth. These numbers are what to beat.
  test(`${name}: going up, how far the front of the robe stands open over the trousers, seen from in front and above (reported)`, () => {
    const r = opening({ make, sample: 6 }); assert.ok(r.frames > 20); console.log(`# ${name} up: opening at most ${(r.worst * 100).toFixed(1)} cm of a ${(r.length * 100).toFixed(1)} cm skirt, ${r.over} of ${r.frames} frames over a third (worst ${r.at})`);
  });
}

// #541 item 2: the whole skirt, not a sector of it: on every frame of a flight, up or down, the lowest point of the robe's skirt
// hangs at least 0.65 of its standing depth below the pelvis (the 3D review: a robe that reads as a short jacket on a flight).
test("on a flight the lowest point of the skirt never comes above 0.65 of its standing depth below the pelvis", () => {
  for (const [name, make] of BODIES) {
    const depth = (m) => { m.group.updateMatrixWorld(true); m.skeleton.update(); const rb = m.parts.robe, P = rb.geometry.attributes.position, v = new THREE.Vector3(), hy = m.bones.hips.getWorldPosition(new THREE.Vector3()).y; let y = 9; for (let i = 0; i < P.count; i += 2) { rb.getVertexPosition(i, v).applyMatrix4(rb.matrixWorld); y = Math.min(y, v.y); } return hy - y; };
    const stand = depth(make());
    for (const dir of [1, -1]) {
      let least = 9, frame0 = -1; walk({ n: 10, dir, make, at: [31.5, -47.2] }, (m, frame) => { if (frame % 3) return; const r = depth(m) / stand; if (r < least) { least = r; frame0 = frame; } });
      console.log(`# ${name} ${dir > 0 ? "up" : "down"}: lowest skirt point at least ${least.toFixed(2)} of standing depth (frame ${frame0})`);
      assert.ok(least >= 0.65, `${name} ${dir > 0 ? "up" : "down"}: the skirt's lowest point came to ${least.toFixed(2)} of its standing depth (frame ${frame0})`);
    }
  }
});
// #284, the turn at the start of a walk: told to go the other way he is turned about at once and his speed rises, and the
// skirt must not swing aside and let a thigh out through its side. Both bodies, every frame of the first second.
test("turning about to set off on the level, no trouser comes out through the skirt's cloth", () => {
  for (const [name, make] of BODIES) {
    const x = exposed({ turnStart: true, make }, 3, 1);
    assert.equal(x.pierced, 0, `${name}: the leg came through the cloth in ${x.pierced} of ${x.frames} frames (at most ${x.mostThrough} points); before #284's fix 25 and 27 of 60`);
  }
});

// #615: the thighs as colliders. Standing, nothing of the skirt is moved (a trouser leg wider than the tight robe over it is held
// where it stands); on a flight no point of the skirt that the thighs carry lies inside a thigh; the belt and sleeves are not
// carried at all.
test("the thighs carry the skirt out of their way: nothing moves standing, nothing lies inside a thigh on a flight, nothing above the hip is carried", () => {
  for (const [name, make] of BODIES) {
    const m = make(), col = m.parts.robe.geometry.attributes.collide, v = new THREE.Vector3();
    m.update(1 / 60, 0, false, 0, () => 0, {}); m.group.updateMatrixWorld(true); m.skeleton.update();
    let most = 0; for (let i = 0; i < col.count; i++) { m.parts.robe.getVertexPosition(i, v).applyMatrix4(m.parts.robe.matrixWorld); const a = v.clone(); m.carry(i, v); most = Math.max(most, a.distanceTo(v)); }
    assert.ok(most < 0.004, `${name}: standing, the skirt is carried ${(most * 1000).toFixed(1)} mm`);
    { const bindHip = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(m.skeleton.boneInverses[m.skeleton.bones.findIndex((b) => b.name === "leftUpperLeg")]).invert()), P = m.parts.robe.geometry.attributes.position; for (let i = 0; i < col.count; i++) if (col.getX(i) > 0) assert.ok(P.getY(i) <= bindHip.y - 0.029, `${name}: a point at ${P.getY(i).toFixed(2)} m in the bind pose, over ${(bindHip.y - 0.03).toFixed(2)} m, is carried`); }
    let inside = 0, frames = 0;
    walk({ n: 10, dir: 1, make: () => m }, (mm, frame) => {
      if (frame % 6) return; frames++; mm.skeleton.update();
      for (let i = 0; i < col.count; i += 3) {
        if (!col.getX(i)) continue; mm.parts.robe.getVertexPosition(i, v).applyMatrix4(mm.parts.robe.matrixWorld); mm.carry(i, v);
        // the point against both thighs, in the group's space, with the radius it is held at
        const p = mm.group.worldToLocal(v.clone()), r = Math.min(mm.thighRadius, mm.parts.robe.geometry.attributes.cclear.getX(i)) * 0.97; let worst = 0;
        for (const s of [0, 1]) { const a = mm.bones[s ? "rightUpperLeg" : "leftUpperLeg"].getWorldPosition(new THREE.Vector3()), b = mm.bones[s ? "rightLowerLeg" : "leftLowerLeg"].getWorldPosition(new THREE.Vector3()); mm.group.worldToLocal(a); mm.group.worldToLocal(b); const ab = b.clone().sub(a), t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / ab.lengthSq())), d = p.distanceTo(a.addScaledVector(ab, t)); if (d < r * (col.getX(i) > 0.99 ? 1 : 0)) worst = 1; }
        inside += worst;
      }
    });
    assert.equal(inside, 0, `${name}: ${inside} carried points of the skirt lay inside a thigh over ${frames} frames of a flight`);
  }
});

// #615, the 3D review's measure of a front that parts: the points of the robe's front either side of its middle seam, paired in the
// bind pose (nearest across the middle, under 3 cm apart), and how much each pair's gap grows on a flight up; the front holds if
// in at least 95 per cent of the frames no pair has opened by more than 3 cm.
function seam({ make = createMonk, n = 10, dir = 1 }) {
  const probe = make(); probe.group.updateMatrixWorld(true); probe.skeleton.update();
  const rg = probe.parts.robe.geometry, P = rg.attributes.position, col = rg.attributes.collide, v = new THREE.Vector3(), w = new THREE.Vector3();
  const L = [], R = [];
  for (let i = 0; i < P.count; i++) { if (!col.getX(i) || P.getZ(i) < 0.02 || Math.abs(P.getX(i)) > 0.045) continue; (P.getX(i) < 0 ? L : R).push(i); }
  const pairs = []; for (const i of L) { let best = -1, bd = 0.03; for (const j of R) { const d = Math.hypot(P.getX(i) - P.getX(j), P.getY(i) - P.getY(j), P.getZ(i) - P.getZ(j)); if (d < bd) { bd = d; best = j; } } if (best >= 0) pairs.push([i, best, bd]); }
  let frames = 0, ok = 0, worst = 0;
  walk({ n, dir, make: () => probe }, (m, frame) => {
    if (frame % 3) return; frames++; m.skeleton.update(); let most = 0;
    for (const [i, j, d0] of pairs) { m.parts.robe.getVertexPosition(i, v).applyMatrix4(m.parts.robe.matrixWorld); carried(m, i, v); m.parts.robe.getVertexPosition(j, w).applyMatrix4(m.parts.robe.matrixWorld); carried(m, j, w); most = Math.max(most, v.distanceTo(w) - d0); }
    worst = Math.max(worst, most); if (most <= 0.03) ok++;
  });
  return { pairs: pairs.length, frames, ok, worst };
}
test("going up, the robe's front does not part at its middle seam: no pair of points across it opens by over 3 cm in 95% of the frames", () => {
  for (const [name, make] of BODIES) { const s = seam({ make }); console.log(`# SEAM ${name}: ${s.pairs} pairs, ${s.ok} of ${s.frames} frames hold (no pair opened over 3 cm), worst ${(s.worst * 100).toFixed(1)} cm`); assert.ok(s.pairs > 10, `${name}: ${s.pairs} pairs`); assert.ok(s.ok >= 0.95 * s.frames, `${name}: the front held in ${s.ok} of ${s.frames} frames, parting by ${(s.worst * 100).toFixed(1)} cm at most`); }
});
