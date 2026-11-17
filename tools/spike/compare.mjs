// Point by point, the walker of the written plan against the walker of the drawn meshes (#161 spike), over the trial
// region (the first court with the tea house's porch and the great hall's platform) and inside the great hall's room.
//   node tools/spike/compare.mjs [step=0.05] [outdir=tools/out/spike]
// Writes diff-court.png, diff-room.png and compare.json (counts by class, and for each class what the old plan and
// the meshes say is there).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import * as THREE from "three";
import { buildDrawn } from "./scene.mjs";
import { gather, createMeshWalker, MW } from "./meshwalker.mjs";
const { createWalker, SITE } = await import("../../app/src/site.js");
const { BODY } = await import("../../app/src/geo.js");

const STEP = +(process.argv[2] || 0.05), OUT = process.argv[3] || "tools/out/spike";
mkdirSync(OUT, { recursive: true });
export const REGION = { x0: -22, x1: 22, z0: -24, z1: 34, ceil: 3.0, floorY: 0 };

export async function makeWalkers() {
  const t0 = performance.now();
  const drawn = buildDrawn();
  const t1 = performance.now();
  const old = createWalker(drawn.site);
  const outdoors = gather(drawn.scene, new THREE.Box3(new THREE.Vector3(REGION.x0, -2, REGION.z0), new THREE.Vector3(REGION.x1, 20, REGION.z1)));
  const R = drawn.rooms.rooms.main.room;
  const roomData = gather(drawn.rooms.rooms.main.group, new THREE.Box3(new THREE.Vector3(R.x0, R.y - 1, R.z0), new THREE.Vector3(R.x1, R.y + 20, R.z1)));
  const t2 = performance.now();
  const fresh = createMeshWalker({ outdoors, region: REGION, room: { id: "main", data: roomData, ceil: R.y + 2.6, box: { x0: R.x0 - 0.3, x1: R.x1 + 0.3, z0: R.z0 - 0.3, z1: R.z1 + 0.3 } }, fallback: createWalker(drawn.site), earthZ: SITE.fore + 0.3 });
  const t3 = performance.now(), baked = fresh.bake(+(process.env.BAKE || 0.05)), t4 = performance.now();
  return { drawn, old, fresh, outdoors, roomData, R, baked, ms: { bake: Math.round(t4 - t3), build: Math.round(t1 - t0), bvh: Math.round(t2 - t1), outdoorsBVH: outdoors.ms, roomBVH: roomData.ms, parts: drawn.ms } };
}

// Why the old plan answers as it does at (x, z): which written thing.
function oldWhy(site, old, x, z) {
  const w = site.walk, inR = (r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  if (old.room) { const s = old.room.solids.find(inR); return s ? "room.solid" : x < old.room.x0 || x > old.room.x1 || z < old.room.z0 || z > old.room.z1 ? "room.wall" : "open"; }
  for (const p of w.posts) if (p.r !== undefined ? Math.hypot(x - p.x, z - p.z) < p.r + BODY : inR(p)) return p.r !== undefined ? "post.round" : "post.square";
  const carved = w.decks.some((d) => (d.r !== undefined ? Math.hypot(x - d.x, z - d.z) < d.r : inR(d))) || w.ramps.some(inR);
  if (carved) return "open.carved";
  for (const s of w.solids) if (inR(s)) return s.own ? "solid.building" : "solid.wall";
  return "open";
}

const PAL = { same: [214, 210, 200], bothShut: [70, 66, 62], oldOnly: [205, 60, 50], newOnly: [40, 110, 205], height: [235, 185, 40] };
// Where he can get to from `seed` by walking, cell to cell (eight ways, no corner cut), the floor stepping no more than
// route.js lets it: a flood over the same grid, for each walker.
function reach(nx, nz, shut, h, si, sj) {
  const seen = new Uint8Array(nx * nz), q = [sj * nx + si]; if (shut[q[0]]) return seen; seen[q[0]] = 1;
  while (q.length) { const k = q.pop(), i = k % nx, j = (k - i) / nx;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii;
      if (seen[kk] || shut[kk] || Math.abs(h[kk] - h[k]) > 0.34) continue;
      if (a && b && (shut[j * nx + ii] || shut[jj * nx + i])) continue;
      seen[kk] = 1; q.push(kk); } }
  return seen;
}
async function compareArea(name, W, site, box, enter, seed) {
  enter?.();
  const nx = Math.round((box.x1 - box.x0) / STEP), nz = Math.round((box.z1 - box.z0) / STEP), img = Buffer.alloc(nx * nz * 3);
  const count = { same: 0, bothShut: 0, oldOnly: 0, newOnly: 0, height: 0 }, why = {}, hd = [];
  const t0 = performance.now(), N = nx * nz, OB = new Uint8Array(N), NB = new Uint8Array(N), OH = new Float32Array(N), NH = new Float32Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = box.x0 + (i + 0.5) * STEP, z = box.z0 + (j + 0.5) * STEP, k = j * nx + i;
    const ob = W.old.blocked(x, z), nb = W.fresh.blocked(x, z), oh = W.old.heightAt(x, z), nh = W.fresh.heightAt(x, z);
    OB[k] = ob ? 1 : 0; NB[k] = nb ? 1 : 0; OH[k] = oh; NH[k] = nh;
    let c0 = ob && nb ? "bothShut" : ob ? "oldOnly" : nb ? "newOnly" : Math.abs(oh - nh) > 0.02 ? "height" : "same";
    count[c0]++;
    if (c0 === "oldOnly" || c0 === "newOnly" || c0 === "height") {
      const key = `${c0} | old: ${oldWhy(site, W.old, x, z)} | new: ${c0 === "height" ? `floor ${W.fresh.lastFloor?.mat ?? "none"} (${(nh - oh).toFixed(2)})` : W.fresh.why(x, z) ?? "open"}`;
      const e = (why[key] ||= { n: 0, x0: x, x1: x, z0: z, z1: z }); e.n++; e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.z0 = Math.min(e.z0, z); e.z1 = Math.max(e.z1, z);
      if (c0 === "height") hd.push(Math.abs(oh - nh));
    }
    const c = PAL[c0], o = (j * nx + i) * 3;   // north (−z, the great hall) at the top of the picture
    img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
  }
  const ms = performance.now() - t0, n = nx * nz;
  await sharp(img, { raw: { width: nx, height: nz, channels: 3 } }).png().toFile(`${OUT}/diff-${name}.png`);
  // What can be walked to from the seed: the difference that a visitor feels.
  const si = Math.floor((seed[0] - box.x0) / STEP), sj = Math.floor((seed[1] - box.z0) / STEP);
  const RO = reach(nx, nz, OB, OH, si, sj), RN = reach(nx, nz, NB, NH, si, sj), img2 = Buffer.alloc(N * 3), rc = { both: 0, oldOnly: 0, newOnly: 0, neither: 0 }, rwhy = {};
  const RP = { both: [214, 210, 200], neither: [70, 66, 62], oldOnly: [205, 60, 50], newOnly: [40, 110, 205] };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, c = RO[k] && RN[k] ? "both" : RO[k] ? "oldOnly" : RN[k] ? "newOnly" : "neither"; rc[c]++;
    if (c === "oldOnly" || c === "newOnly") { const x = box.x0 + (i + 0.5) * STEP, z = box.z0 + (j + 0.5) * STEP;
      if (W.old.room === null && name === "room") { W.old.setRoom(W.R); W.fresh.setRoom(W.R); }
      const key = `${c} | old: ${oldWhy(site, W.old, x, z)} | new: ${W.fresh.why(x, z) ?? (c === "newOnly" ? "open, reached" : "open, cut off")}`;
      const e = (rwhy[key] ||= { n: 0, x0: x, x1: x, z0: z, z1: z }); e.n++; e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.z0 = Math.min(e.z0, z); e.z1 = Math.max(e.z1, z); }
    const p = RP[c], o = (j * nx + i) * 3; img2[o] = p[0]; img2[o + 1] = p[1]; img2[o + 2] = p[2];
  }
  await sharp(img2, { raw: { width: nx, height: nz, channels: 3 } }).png().toFile(`${OUT}/reach-${name}.png`);
  const reachClasses = Object.entries(rwhy).sort((a, b) => b[1].n - a[1].n).map(([k, e]) => ({ class: k, points: e.n, m2: +(e.n * STEP * STEP).toFixed(2), box: [e.x0, e.z0, e.x1, e.z1].map((v) => +v.toFixed(2)) }));
  W.fresh.setRoom(null); W.old.setRoom(null);
  const classes = Object.entries(why).sort((a, b) => b[1].n - a[1].n).map(([k, e]) => ({ class: k, points: e.n, m2: +(e.n * STEP * STEP).toFixed(2), box: [e.x0, e.z0, e.x1, e.z1].map((v) => +v.toFixed(2)) }));
  return { name, box, step: STEP, points: n, count, share: Object.fromEntries(Object.entries(count).map(([k, v]) => [k, +(v / n * 100).toFixed(2)])), msPerPoint: +(ms / n / 2).toFixed(4), classes, reach: { seed, count: rc, m2: Object.fromEntries(Object.entries(rc).map(([k, v]) => [k, +(v * STEP * STEP).toFixed(1)])), classes: reachClasses } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const W = await makeWalkers();
  console.log("built", W.ms, W.baked, "tris outdoors", W.outdoors.tris, "room", W.roomData.tris);
  const court = await compareArea("court", W, W.drawn.site, REGION, null, [0, 20]);
  const R = W.R, room = await compareArea("room", W, W.drawn.site, { x0: R.x0 - 0.3, x1: R.x1 + 0.3, z0: R.z0 - 0.3, z1: R.z1 + 0.3 }, () => { W.old.setRoom(R); W.fresh.setRoom(R); }, [R.door[0], R.door[1] - 1.2]);
  const out = { commit: process.env.COMMIT || null, params: { ...MW, BODY }, ms: W.ms, tris: { outdoors: W.outdoors.tris, room: W.roomData.tris }, court, room };
  writeFileSync(`${OUT}/compare.json`, JSON.stringify(out, null, 1));
  for (const a of [court, room]) { console.log(`\n== ${a.name}: ${a.points} points, ${a.msPerPoint} ms per query`, a.share); console.log("reach", a.reach.m2); for (const c of a.reach.classes.slice(0, 20)) console.log("  R", String(c.points).padStart(7), c.m2.toFixed(2).padStart(8), "m²", c.class, JSON.stringify(c.box)); for (const c of a.classes.slice(0, 25)) console.log(String(c.points).padStart(7), c.m2.toFixed(2).padStart(8), "m²", c.class, JSON.stringify(c.box)); }
}
