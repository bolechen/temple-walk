import "../../tests/unit/dom-stub.mjs";
import { namedMaterials } from "./scene.mjs";
const { buildSite, createWalker } = await import("../../app/src/site.js");
const { gridWalkerFor } = await import("./grid-node.mjs");
const { planRoute } = await import("../../app/src/route.js");
const { stride } = await import("../../app/src/stride.js");
const site = buildSite(namedMaterials()); const w = gridWalkerFor(site, createWalker(site), "court");
const from = { x: -12.85, z: 5.98 };
console.log("from blocked", w.blocked(from.x, from.z));
for (const ang of [-0.765, -0.5, -1.0, -0.3]) for (const d of [2, 3, 4, 5, 6, 8]) {
  const to = { x: from.x + Math.sin(ang) * d, z: from.z - Math.cos(ang) * d };
  const r = planRoute(w, w.drops, from, to);
  const last = r.points[r.points.length - 1];
  const bad = r.points.filter((p) => w.blocked(p.x, p.z) && !p.drop);
  if (bad.length || (last && w.blocked(last.x, last.z))) console.log(ang, d, JSON.stringify(to), r.reached, JSON.stringify(r.points.map(p => [+p.x.toFixed(2), +p.z.toFixed(2), p.drop ? "drop" : p.landed ? "landed" : ""])));
}
console.log("end blocked", w.blocked(-12.22, 4.2), w.heightAt(-12.22, 4.2), w.answers(-12.22,4.2));
for (const [x,z] of [[-12.22,4.2],[-12.3,4.82],[-12.0,4.0],[-12.22,4.0]]) { const r = planRoute(w, w.drops, from, {x,z}); console.log(x,z,r.reached, JSON.stringify(r.points.map(p => [+p.x.toFixed(2), +p.z.toFixed(2), p.drop ? "drop" : p.landed ? "landed" : ""]))); }
