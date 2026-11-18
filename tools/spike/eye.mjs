// The eye's question, old and new (#161 spike): over the trial region, every 25 cm and at six heights over the floor,
// may the eye that follows him be here? Counts where the two agree, and where they do not, by height.
//   node tools/spike/eye.mjs [outdir]
import "../../tests/unit/dom-stub.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { namedMaterials } from "./mats.mjs";
import { drawnWalker, REGION } from "./drawn.mjs";
const { createWalker, buildSite } = await import("../../app/src/site.js?real");
const OUT = process.argv[2] || "tools/out/spike"; mkdirSync(OUT, { recursive: true });
const site = buildSite(namedMaterials()), old = createWalker(site), fresh = drawnWalker(site, createWalker(site));
const inR = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1, W = site.walk;
// Which of the written rules shut the eye there (the order createWalker asks them in).
function why(x, y, z) {
  for (const r of W.roofs) if (y < r.top && inR(r, x, z) && y > (inR(r.core, x, z) ? r.inner : r.bottom)) return inR(r.core, x, z) ? "within a building's walls, up to its ridge" : "among an eave's beams and tiles";
  if (W.posts.some((p) => (p.r !== undefined ? Math.hypot(x - p.x, z - p.z) < p.r + 0.15 : inR(p, x, z)))) return "a post";
  for (const s of W.solids) if (!s.open && inR(s, x, z)) return s.own ? "a building's platform or body" : "a wall, 5.5 m over his feet";
  return "a terrace's edge, or other";
}
const S = 0.25, rows = {}, whyOld = {}, t0 = performance.now(); let n = 0, tNew = 0, tOld = 0;
for (const dy of [0.4, 1.0, 1.8, 2.6, 3.6, 5.0, 7.0]) {
  const r = (rows[dy] = { both: 0, open: 0, oldShut: 0, newShut: 0 });
  for (let x = REGION.x0 + S / 2; x < REGION.x1; x += S) for (let z = REGION.z0 + S / 2; z < REGION.z1; z += S) {
    const foot = old.heightAt(x, z), y = foot + dy;
    let a = performance.now(); const o = !!old.eyeShut(x, y, z, foot); tOld += performance.now() - a;
    a = performance.now(); const f = !!fresh.eyeShut(x, y, z, foot); tNew += performance.now() - a; n++;
    const c = o && f ? "both" : o ? "oldShut" : f ? "newShut" : "open"; r[c]++;
    if (c === "oldShut") { const k = `${dy} m: ${why(x, y, z)}`; whyOld[k] = (whyOld[k] || 0) + 1; }
  }
}
const out = { step: S, queries: n, usPerQuery: { old: +(tOld / n * 1000).toFixed(2), new: +(tNew / n * 1000).toFixed(2) }, byHeight: rows, oldShutBecause: Object.fromEntries(Object.entries(whyOld).sort((a, b) => b[1] - a[1])) };
writeFileSync(`${OUT}/eye.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
