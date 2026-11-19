// How long every flight of the plan takes to climb or descend at the walking and hurrying step rates (issue #270):
// the run of each ramp over the pace, old and new. `node tools/stair-time.mjs`
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../app/src/site.js");
const { STAIR } = await import("../app/src/geo.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), OLD = { walk: 1.25, hurry: 1.6 }, NEW = { walk: STAIR.tread * STAIR.steps, hurry: STAIR.tread * STAIR.hurry };
let runs = 0, n = 0, long = [];
for (const r of site.walk.ramps) {
  const run = Math.hypot(r.high[0] - r.low[0], r.high[1] - r.low[1]); if (r.h < 0.5) continue;
  runs += run; n += Math.round(r.h / STAIR.rise); long.push({ rise: r.h, run });
}
const sec = (v) => runs / v;
console.log(`${long.length} flights of 0.5 m or more, ${n} treads, ${runs.toFixed(1)} m of run`);
console.log(`walk:   ${sec(OLD.walk).toFixed(1)} s -> ${sec(NEW.walk).toFixed(1)} s (+${(sec(NEW.walk) - sec(OLD.walk)).toFixed(1)} s)`);
console.log(`hurry:  ${sec(OLD.hurry).toFixed(1)} s -> ${sec(NEW.hurry).toFixed(1)} s (+${(sec(NEW.hurry) - sec(OLD.hurry)).toFixed(1)} s)`);
for (const f of long.sort((a, b) => b.run - a.run).slice(0, 8)) console.log(`  rise ${f.rise.toFixed(2)} m run ${f.run.toFixed(1)} m: walk +${(f.run / NEW.walk - f.run / OLD.walk).toFixed(1)} s`);
