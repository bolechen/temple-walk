// Independent re-probe of EDGE-001/002 positions recorded in docs/reviews/2026-11-14-edges against the locked plan.
import fs from "node:fs";
const root = process.argv[2];
await import(root + "/tests/unit/dom-stub.mjs");
const THREE = await import(root + "/app/vendor/three/build/three.module.js");
const { buildSite, createWalker } = await import(root + "/app/src/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), w = createWalker(site);
const cols = JSON.parse(fs.readFileSync(root + "/docs/reviews/2026-11-14-edges/current-contacts.json"));
const props = JSON.parse(fs.readFileSync(root + "/docs/reviews/2026-11-14-edges/current-props.json"));
const out = { columns: [], tables: [] };
for (const c of cols) {
  const [cx, cz] = c.at; let min = Infinity, at = null;
  for (let r = 0.2; r <= 1.2; r += 0.005) for (let a = 0; a < 360; a += 3) {
    const x = cx + r * Math.cos(a * Math.PI / 180), z = cz + r * Math.sin(a * Math.PI / 180);
    if (!w.blocked(x, z) && Math.abs(w.heightAt(x, z) - c.base) < 0.3 && r < min) { min = r; at = [x, z]; }
  }
  const need = c.shaftConservativeRadius + 0.377;
  out.columns.push({ id: c.id, at: c.at, conservativeRadius: c.shaftConservativeRadius, nearestFreeCentre: +min.toFixed(3), requiredForReach0377: +need.toFixed(3), gap_cm: +((min - need) * 100).toFixed(1) });
}
for (const p of props) {
  const [x, z] = p.at; const ring = [];
  for (let r = 0; r <= 0.8; r += 0.05) { let free = 0; for (let a = 0; a < 360; a += 15) if (!w.blocked(x + r * Math.cos(a * Math.PI / 180), z + r * Math.sin(a * Math.PI / 180))) free++; ring.push([+r.toFixed(2), free]); }
  out.tables.push({ id: p.id, at: p.at, centreBlocked: w.blocked(x, z), freeOf24ByRadius: ring });
}
console.log(JSON.stringify(out, null, 1));
