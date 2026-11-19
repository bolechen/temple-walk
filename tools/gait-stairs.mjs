// How the novice goes up and down a flight, measured (issue #270). It drives monk.update frame by frame exactly as yard.js
// does on a stair (group on the tread under him, `heightAt` the smooth slope the eye follows, `surfaceAt` the treads) and
// reports, for ten treads up or down:
//   cadence      steps a second (one shoe coming down is one step)
//   lift         the most any shoe's lowest point stands over the tread it left (m)
//   clear        the closest any swinging shoe's lowest vertex comes to the stair under that vertex (m; < 0 is in the stone)
//   kneeStance   the smallest angle between thigh and shin of a leg that is on the stair (degrees; 180 is straight)
//   kneeSwing    the same for the leg in the air
//   pelvis       how far the hips depart from the straight line of the flight (± m), and the largest step of it between frames
//   eye          the peak vertical acceleration of the smoothed eye heights (third person 0.14 s, first 0.08 s), as yard.js works them
// Run `node tools/gait-stairs.mjs [--speed=1.25] [--dt=60] [--csv=<file>]`; tests/unit/stairs-gait.test.mjs holds the numbers.
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "three";
const { createMonk } = await import("../app/src/monk.js");
const { STAIR } = await import("../app/src/geo.js");

const RISE = STAIR.rise, TREAD = STAIR.tread, NOSING = STAIR.nosing;
const ANKLE_Y = 0.06;
// A flight of `n` treads going up (+1) or down (-1) along +z, with 4 m of level ground each end. Mirrors site.js's `carved`:
// a stair is steps for the feet (`surface`) and a slope for the eye (`eye`).
export function flight(n, dir) {
  const lead = 4, run = n * TREAD, top = n * RISE, base = dir > 0 ? 0 : top;
  const f = (z) => Math.min(1, Math.max(0, (z - lead) / run + NOSING / run));
  return {
    lead, run, length: lead * 2 + run,
    surface: (z) => base + dir * top * (Math.ceil(f(z) * n - 1e-6) / n),
    eye: (z) => base + dir * top * f(z),
  };
}
const interior = (b) => 180 - THREE.MathUtils.radToDeg(b.rotation.x);
const sk = (mesh, i, v) => mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);

export function measure({ n = 10, dir = 1, speed = 1.25, fps = 60, body = createMonk } = {}) {
  const m = body(), fl = flight(n, dir), dt = 1 / fps, shoes = m.parts.shoes, count = shoes.geometry.attributes.position.count, v = new THREE.Vector3();
  const z0 = 0.2;   // start a little way in so that the stride has begun by the foot of the flight
  let z = z0, t = 0, eye3 = fl.eye(z), eye1 = eye3;
  const rows = [], landings = [], planted = [false, false], takeoffY = [null, null], lastClear = [Infinity, Infinity];
  const lifts = [], clears = [], stanceK = [], swingK = [], hipY = [], eye3s = [], eye1s = [], hipT = [];
  const legs = [["left", 0], ["right", 1]];
  // The shoes are told apart by x in his frame: left is +x (he faces +z at yaw 0).
  const sole = (side) => {
    let low = Infinity, closest = Infinity, maxSurf = -Infinity, k = 0;
    for (let i = 0; i < count; i += 3) {
      sk(shoes, i, v); if ((v.x > 0) !== (side === 0)) continue;
      const s = fl.surface(v.z); low = Math.min(low, v.y); closest = Math.min(closest, v.y - s); maxSurf = Math.max(maxSurf, s); k++;
    }
    return { low, closest, maxSurf };
  };
  const end = fl.lead + fl.run + 3;
  for (let frame = 0; z < end; frame++) {
    z += speed * dt; t += dt;
    m.group.position.set(0, fl.surface(z), z);
    const onStair = z > fl.lead - 0.3 && z < fl.lead + fl.run + 0.3;
    m.update(dt, speed, false, t, (x, zz) => fl.surface(zz), { heightAt: (x, zz) => fl.eye(zz), stairs: onStair });
    m.group.updateMatrixWorld(true);
    for (const s of m.steps.splice(0)) landings.push({ t, z: s.z });
    eye3 += (fl.eye(z) - eye3) * (1 - Math.exp(-dt / 0.14)); eye1 += (fl.eye(z) - eye1) * (1 - Math.exp(-dt / 0.08));
    if (z < fl.lead + 0.5 || z > fl.lead + fl.run - 0.5) continue;   // only the flight itself, with half a metre either side dropped
    const hip = m.bones.hips.getWorldPosition(v).y;
    hipY.push(hip); hipT.push(z); eye3s.push(eye3); eye1s.push(eye1);
    legs.forEach(([name, side]) => {
      const sl = sole(side), isOn = sl.low - sl.maxSurf < 0.004;
      const knee = interior(m.bones[name + "LowerLeg"]);
      if (isOn) { stanceK.push(knee); planted[side] = true; takeoffY[side] = sl.low; }
      else {
        planted[side] = false;
        swingK.push(knee); clears.push(sl.closest); if (takeoffY[side] !== null) lifts.push(sl.low - takeoffY[side]);
      }
    });
    rows.push([t, z, hip, eye3, eye1, ...legs.map(([, side]) => sole(side).low), interior(m.bones.leftLowerLeg), interior(m.bones.rightLowerLeg)]);
  }
  // The straight line of the flight is the hips' own trend; what is left of it is the oscillation.
  const nPts = hipY.length, mx = hipT.reduce((a, b) => a + b, 0) / nPts, my = hipY.reduce((a, b) => a + b, 0) / nPts;
  let sxy = 0, sxx = 0; hipT.forEach((x, i) => { sxy += (x - mx) * (hipY[i] - my); sxx += (x - mx) ** 2; });
  const slope = sxy / sxx, resid = hipY.map((y, i) => y - (my + slope * (hipT[i] - mx)));
  const accPeak = (a) => { let p = 0; for (let i = 2; i < a.length; i++) p = Math.max(p, Math.abs(a[i] - 2 * a[i - 1] + a[i - 2]) / (dt * dt)); return p; };
  const inFlight = landings.filter((l) => l.z > fl.lead && l.z < fl.lead + fl.run);
  const span = inFlight.length > 1 ? inFlight[inFlight.length - 1].t - inFlight[0].t : NaN;
  let jump = 0; for (let i = 1; i < hipY.length; i++) jump = Math.max(jump, Math.abs(hipY[i] - hipY[i - 1]));
  return {
    n, dir, speed, fps,
    cadence: inFlight.length > 1 ? (inFlight.length - 1) / span : NaN,
    lift: Math.max(...lifts), clear: Math.min(...clears),
    kneeStance: Math.min(...stanceK), kneeSwing: Math.min(...swingK),
    pelvisAmp: (Math.max(...resid) - Math.min(...resid)) / 2, pelvisJump: jump,
    eye3Acc: accPeak(eye3s), eye1Acc: accPeak(eye1s),
    rows,
  };
}

const fmt = (r) => `${r.dir > 0 ? "up  " : "down"} ${r.speed.toFixed(2)} m/s ${r.fps}fps  cadence ${r.cadence.toFixed(2)}/s  lift ${(r.lift * 100).toFixed(1)} cm  clear ${(r.clear * 100).toFixed(1)} cm  knee stance ${r.kneeStance.toFixed(0)}° swing ${r.kneeSwing.toFixed(0)}°  pelvis ±${(r.pelvisAmp * 100).toFixed(1)} cm (jump ${(r.pelvisJump * 100).toFixed(2)} cm/frame)  eye accel ${r.eye3Acc.toFixed(2)} / ${r.eye1Acc.toFixed(2)} m/s²`;
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const speeds = arg("speed", "1.25,1.6").split(",").map(Number), fps = +arg("fps", 60), csv = arg("csv", null);
  const out = [];
  for (const speed of speeds) for (const dir of [1, -1]) { const r = measure({ dir, speed, fps }); console.log(fmt(r)); out.push(r); }
  if (csv) fs.writeFileSync(csv, "run,t,z,hipY,eye3,eye1,leftSoleY,rightSoleY,leftKnee,rightKnee\n" + out.flatMap((r) => r.rows.map((x) => [`${r.dir > 0 ? "up" : "down"}@${r.speed}`, ...x.map((q) => q.toFixed(4))].join(","))).join("\n"));
}
