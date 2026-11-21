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
const WALK = STAIR.tread * STAIR.steps, SKIRT = ["robeFront", "robeBack", "robeLeft", "robeRight"], deg = THREE.MathUtils.radToDeg;

// A walk of `n` treads (0: level) at `speed`, frame by frame as yard.js moves him; `each(m, frame)` sees every frame after
// the first two metres, once the stride is under way.
function walk({ n = 0, dir = 1, speed = WALK, dt = 1 / 60, make = createMonk }, each) {
  const m = make(), fl = n ? flight(n, dir) : { lead: 4, run: 0, surface: () => 0, eye: () => 0 };
  let z = 0.2, t = 0, frame = 0;
  while (z < fl.lead + fl.run + 3) {
    z += speed * dt; t += dt; m.group.position.set(0, fl.surface(z), z);
    const on = n && z > fl.lead - 0.3 && z < fl.lead + fl.run + 0.3;
    m.update(dt, speed, false, t, (x, zz) => fl.surface(zz), { heightAt: (x, zz) => fl.eye(zz), stairs: !!on });
    m.group.updateMatrixWorld(true);
    if (z > 2) each(m, frame++);
  }
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
    for (let i = 0; i < rg.attributes.position.count; i++) { robe.getVertexPosition(i, v).applyMatrix4(robe.matrixWorld); P.set([v.x, v.y, v.z], i * 3); }
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
