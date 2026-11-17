// Every swing of the eye to an observance's shot (src/director.js), from twelve directions round each place, there and
// back: how long each takes, which route, the nearest it comes to any surface of the real meshes (rays in 26 directions),
// whether the 0.1 m near plane cuts into anything on a phone held upright or a wide screen, how many frames the eye waits
// while its way is worked out and the most one frame spent on it. About two minutes.  node tools/director-swings.mjs
// → tools/out/director-swings.json
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker } from "../app/src/site.js";
import { buildInteriors } from "../app/src/interior.js";
import { followEye } from "../app/src/eye.js";
import { createDirector } from "../app/src/director.js";
const named = (k) => Object.assign(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls), walker = createWalker(site);
site.places.incense = rooms.places.incense;
const scene = new THREE.Group(); scene.add(site.root); if (rooms.group) scene.add(rooms.group); else if (rooms.root) scene.add(rooms.root);
scene.updateMatrixWorld(true);
const meshes = []; scene.traverse((o) => { if (o.isMesh && o.visible && !o.userData.soft && !o.material.transparent) { o.geometry.computeBoundingBox(); meshes.push({ o, box: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) }); } });
const DT = 1 / 60, ray = new THREE.Raycaster();
const dirs = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) if (i || j || k) dirs.push(new THREE.Vector3(i, j, k).normalize());
function clearance(p, R = 1) {
  const near = meshes.filter((m) => m.box.distanceToPoint(p) < R).map((m) => m.o); if (!near.length) return R;
  let best = R; for (const d of dirs) { ray.set(p, d); ray.far = best; const h = ray.intersectObjects(near, false)[0]; if (h) best = h.distance; } return best;
}
const ncam = new THREE.PerspectiveCamera(50, 1, 0.1, 800);
function cut(c, aspect) {
  ncam.fov = c.fov; ncam.aspect = aspect; ncam.updateProjectionMatrix(); ncam.position.copy(c.position); ncam.quaternion.copy(c.quaternion); ncam.updateMatrixWorld();
  const eye = ncam.position.clone(), q = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([x, y]) => new THREE.Vector3(x, y, -1).unproject(ncam));
  const near = meshes.filter((m) => m.box.distanceToPoint(eye) < 0.35).map((m) => m.o); if (!near.length) return null;
  const seg = (a, b) => { const d = b.clone().sub(a), l = d.length(); ray.set(a, d.divideScalar(l)); ray.far = l; return ray.intersectObjects(near, false)[0] || null; };
  for (const p of q) { const h = seg(eye, p); if (h) return h; }
  for (let i = 0; i < 4; i++) { const h = seg(q[i], q[(i + 1) % 4]) || seg(q[i], q[(i + 2) % 4]); if (h) return h; }
  return null;
}
const stat = (a) => { const s = [...a].sort((x, y) => x - y); return { min: s[0], med: (s[5] + s[6]) / 2, max: s[s.length - 1] }; };
const out = {};
for (const id of ["bell", "incense", "tea", "sutra", "lamp", "sit"]) {
  const p = site.places[id]; walker.setRoom(p.room ? rooms.rooms[p.room].room : null);
  const foot = p.y ?? walker.heightAt(p.at[0], p.at[1]), centre = new THREE.Vector3(p.at[0], foot + 0.85, p.at[1]);
  const rows = [];
  for (let k = 0; k < 12; k++) {
    const yaw = (k / 12) * Math.PI * 2, e = followEye(walker, { x: p.at[0], z: p.at[1], foot, eyeY: walker.eyeAt(p.at[0], p.at[1]), yaw, pitch: 0.04, side: 1.2, reach: 6.2 });
    const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 800); cam.position.fromArray(e.at(e.d)); cam.rotation.set(0.04, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
    const base = { p: cam.position.clone(), q: cam.quaternion.clone() };
    const d = createDirector({ walker }); d.go(id, p, foot);
    let minC = 9, cuts = 0, planMs = 0, frames = 0, where = null;
    const step = (phase) => {
      cam.position.copy(base.p); cam.quaternion.copy(base.q); cam.fov = 50;
      const t0 = performance.now(); d.apply(cam, DT, centre, 50); const ms = performance.now() - t0; planMs = Math.max(planMs, ms);
      cam.updateMatrixWorld(); const st = d.state();
      if (st.w > 0.001 && st.w < 0.999) { frames++;
        const c = clearance(cam.position); if (c < minC) { minC = c; where = phase; }
        if (cut(cam, 9 / 16) || cut(cam, 21 / 9)) cuts++; }
    };
    let wait = 0; do { step("in"); wait++; } while (d.state().planning); const inS = d.state().in; for (let i = 0; i < Math.ceil((inS + 0.3) / DT); i++) step("in");
    d.back(); let wb = 0; do { step("out"); wb++; } while (d.state().planning); const outS = d.state().out; for (let i = 0; i < Math.ceil((outS + 0.3) / DT); i++) step("out");
    rows.push({ dir: k * 30, in: +inS.toFixed(2), out: +outS.toFixed(2), route: Object.entries(d.state().route || {}).filter(([k, v]) => v && k !== "curve").map(([k, v]) => (k === "via" ? `via${v.length}` : k)).join("+") || "short", minClear: +minC.toFixed(3), at: where, nearCuts: cuts, frames, wait, wb, planMs: +planMs.toFixed(1) });
  }
  out[id] = { in: stat(rows.map((r) => r.in)), out: stat(rows.map((r) => r.out)), minClear: Math.min(...rows.map((r) => r.minClear)), nearCuts: rows.reduce((a, r) => a + r.nearCuts, 0), planMsMax: Math.max(...rows.map((r) => r.planMs)), rows };
  const o = out[id]; console.log(id, "in", o.in, "out", o.out, "minClear", o.minClear, "nearCuts", o.nearCuts, "planMs", o.planMsMax);
  console.log("  ", rows.map((r) => `${r.dir}:${r.in}/${r.out} ${r.route} c${r.minClear} w${r.wait}/${r.wb} ${r.planMs}ms${r.nearCuts ? " CUT" + r.nearCuts : ""}`).join(" | "));
}
walker.setRoom(null);
(await import("fs")).mkdirSync(new URL("out/", import.meta.url), { recursive: true });
(await import("fs")).writeFileSync(new URL("out/director-swings.json", import.meta.url), JSON.stringify(out, null, 1));
