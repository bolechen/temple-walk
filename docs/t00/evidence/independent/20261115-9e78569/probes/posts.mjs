import fs from "node:fs";
const root = process.argv[2];
await import(root + "/tests/unit/dom-stub.mjs");
const THREE = await import(root + "/app/vendor/three/build/three.module.js");
const { buildSite, createWalker } = await import(root + "/app/src/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), w = createWalker(site);
const posts = site.walk.posts || [];
const cols = JSON.parse(fs.readFileSync(root + "/docs/reviews/2026-11-14-edges/current-contacts.json"));
const res = [];
for (const c of cols) {
  const [cx, cz] = c.at;
  const near = posts.filter(p => p.r != null).map(p => ({ ...p, d: Math.hypot(p.x - cx, p.z - cz) })).sort((a, b) => a.d - b.d).slice(0, 2);
  // for the nearest real post, find nearest free centre at its level
  const p = near[0]; let min = Infinity;
  for (let r = 0.1; r <= 1.2; r += 0.005) for (let a = 0; a < 360; a += 2) { const x = p.x + r * Math.cos(a * Math.PI / 180), z = p.z + r * Math.sin(a * Math.PI / 180); if (!w.blocked(x, z) && Math.abs(w.heightAt(x, z) - c.base) < 0.3) { min = Math.min(min, r); } }
  res.push({ id: c.id, oldAt: c.at, nearestPost: { x: +p.x.toFixed(3), z: +p.z.toFixed(3), r: p.r, dFromOld: +p.d.toFixed(3) }, nearestFreeCentre: +min.toFixed(3), postRadiusPlusReach: +(p.r + 0.377).toFixed(3), margin_cm: +((min - p.r - 0.377) * 100).toFixed(1) });
}
console.log(JSON.stringify({ roundPosts: posts.filter(p => p.r != null).length, res }, null, 1));
