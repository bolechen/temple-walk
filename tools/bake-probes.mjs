// Bakes the light probes (#592, trial A; app/src/probe.js): a lattice of points in the first court and in the great hall,
// from each of which rays are cast against the meshes the page draws, kept as the first four spherical harmonics of
//   alpha: how much of the sky the point sees in each direction (1 where the ray gets away, 0 where a surface stops it), and
//   rgb:   the light the surfaces it meets give back, once.
// Out of doors that is the sky's own light bounced (in units of the sky's level, which the hour sets on the page); in the
// room it is the lamps' light bounced (absolute, the lamps being the same at every hour). It is a one-bounce estimate: a
// surface's own light is its albedo times the light it is given, the sky's share of that estimated from two rays (along
// its normal and straight up); the sun's direct light, which moves with the hour, is not in it and stays the sun's.
//
//   node tools/bake-probes.mjs [--level=t00] [--out=app/shared/probes] [--rays=192]
//
// Not run by the build: the file is a small trial product kept in git (a few hundred kilobytes at most) until the trial
// is taken up or dropped (docs/REWIND02-TEARDOWN.md).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { buildDrawn } from "./walk/scene.mjs";
import { gather } from "./walk/bake.mjs";
import { levelArg, levelObject } from "./walk/level-arg.mjs";

const argv = process.argv.slice(2), opt = (k, d) => (argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] ?? d;
const LEVEL = levelArg(process.argv), RAYS = +opt("rays", 192), OUT = fileURLToPath(new URL(opt("out", "app/shared/probes") + "/", new URL("../", import.meta.url)));

/** A surface's colour, as light: what it gives back of what it is given, by the name of its material (the shaders paint it from the world, so the table is a reading of the pictures). */
const ALBEDO = {
  paving: [0.34, 0.33, 0.31], stone: [0.32, 0.31, 0.29], steps: [0.33, 0.32, 0.30], marble: [0.56, 0.55, 0.52], rubble: [0.27, 0.26, 0.24],
  plaster: [0.66, 0.63, 0.57], gable: [0.62, 0.59, 0.53], paper: [0.60, 0.56, 0.46], tile: [0.085, 0.09, 0.10], ridge: [0.08, 0.08, 0.09], glaze: [0.12, 0.2, 0.18],
  earth: [0.2, 0.17, 0.12], seep: [0.18, 0.16, 0.12], cedar: [0.09, 0.12, 0.07], bark: [0.12, 0.10, 0.08], barkGinkgo: [0.16, 0.14, 0.11],
  pillar: [0.30, 0.07, 0.05], woodV: [0.2, 0.13, 0.08], woodX: [0.2, 0.13, 0.08], woodZ: [0.2, 0.13, 0.08], beamX: [0.2, 0.13, 0.08], beamZ: [0.2, 0.13, 0.08],
  lattice: [0.2, 0.13, 0.08], rafters: [0.16, 0.11, 0.07], coffer: [0.22, 0.12, 0.07], fascia: [0.24, 0.1, 0.07], pingan: [0.2, 0.13, 0.08], passage: [0.2, 0.13, 0.08],
  lacquer: [0.22, 0.05, 0.04], gilt: [0.55, 0.42, 0.14], bronze: [0.2, 0.16, 0.1], iron: [0.12, 0.12, 0.12], tea: [0.2, 0.14, 0.09], hide: [0.3, 0.22, 0.15], straw: [0.42, 0.34, 0.2], monolith: [0.3, 0.3, 0.28], banner: [0.5, 0.15, 0.1],
};
const POROUS = /^(bark|barkGinkgo|cedar|MeshStandardMaterial)$/, GAPS = 0.55;
const albedoOf = (name) => ALBEDO[name.replace(/^(post|floor|land):/, "")] || [0.25, 0.24, 0.22];

// Directions: a golden-angle spiral, the same for every probe.
const DIRS = Array.from({ length: RAYS }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / RAYS, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); });
const SR = (4 * Math.PI) / RAYS, Y0 = 0.282095, Y1 = 0.488603;

function bakeGrid({ id, S, box, cell, lamps, hasSky }) {
  const bvh = S.bvh, ray = new THREE.Ray(), org = new THREE.Vector3(), nrm = new THREE.Vector3(), hp = new THREE.Vector3(), tmp = new THREE.Vector3();
  const dim = [Math.floor((box.x1 - box.x0) / cell) + 1, Math.floor((box.y1 - box.y0) / cell) + 1, Math.floor((box.z1 - box.z0) / cell) + 1];
  const N = dim[0] * dim[1] * dim[2], coef = new Float32Array(N * 16), valid = new Uint8Array(N);
  // A tree's boughs and sprays are not a wall: a ray that meets one goes on with the odds of a canopy's gaps (the sprays themselves are transparent and not gathered, so the wood stands for them).
  let seed = 1; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const first = (o, d, far = 1e4) => {
    const at = o.clone(); let left = far;
    for (let hops = 0; hops < 4; hops++) {
      ray.origin.copy(at); ray.direction.copy(d); const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, left); if (!h) return null;
      if (!POROUS.test(S.names[S.mat[h.faceIndex]] || "") || rnd() > GAPS) { h.distance += far - left; return h; }
      at.copy(h.point).addScaledVector(d, 0.02); left -= h.distance + 0.02; if (left <= 0) return null;
    }
    return null;
  };
  const shadowed = (o, d, far) => { ray.origin.copy(o); ray.direction.copy(d); const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, far); return !!h; };
  // The light a surface at `p` facing `n` is given, in the units the page lights by: the sky's share (out of doors), or the lamps' (in a room).
  const given = (p, n) => {
    if (hasSky) {
      org.copy(p).addScaledVector(n, 0.05); const up = new THREE.Vector3(0, 1, 0);
      const vN = shadowed(org, n, 30) ? 0 : 1, vU = shadowed(org, up, 30) ? 0 : 1;
      const share = 0.3 + 0.7 * (0.5 * vN + 0.5 * vU);
      return 0.5 * (1 + Math.max(n.y, -1) * 0.6) * share + 0.0;   // facing up gets the most, facing down the least
    }
    let e = 0, er = 0, eg = 0, eb = 0;
    for (const L of lamps) {
      tmp.set(L.x - p.x, L.y - p.y, L.z - p.z); const d = tmp.length(); if (d > L.dist || d < 1e-3) continue; tmp.multiplyScalar(1 / d);
      const nl = n.dot(tmp); if (nl <= 0) continue; org.copy(p).addScaledVector(n, 0.04); if (shadowed(org, tmp, d - 0.1)) continue;
      const w = Math.pow(Math.max(1 - Math.pow(d / L.dist, 4), 0), 2), k = (L.intensity * nl * w) / Math.pow(d, L.decay);
      er += k * L.r; eg += k * L.g; eb += k * L.b; e += k;
    }
    return [er, eg, eb];
  };
  let inside = 0;
  for (let k = 0; k < dim[2]; k++) for (let j = 0; j < dim[1]; j++) for (let i = 0; i < dim[0]; i++) {
    const idx = (k * dim[1] + j) * dim[0] + i, px = box.x0 + i * cell, py = box.y0 + j * cell, pz = box.z0 + k * cell;
    org.set(px, py, pz); let back = 0, total = 0;
    const c = coef.subarray(idx * 16, idx * 16 + 16);   // 4 harmonics x (r, g, b, alpha)
    for (const d of DIRS) {
      const h = first(org, d); let vis = 0, r = 0, g = 0, b = 0;
      if (!h) { vis = hasSky && d.y > -0.2 ? 1 : 0; if (hasSky && d.y <= -0.2) { r = g = b = 0.25 * 0.5; } }
      else {
        nrm.copy(h.face.normal); if (nrm.dot(d) > 0) { back++; nrm.negate(); }
        hp.copy(h.point); const al = albedoOf(S.names[S.mat[h.faceIndex]] || "");
        const gv = given(hp, nrm);
        if (Array.isArray(gv)) { r = al[0] * gv[0]; g = al[1] * gv[1]; b = al[2] * gv[2]; } else { r = al[0] * gv; g = al[1] * gv; b = al[2] * gv; }
      }
      total++;
      const y = [Y0, Y1 * d.y, Y1 * d.z, Y1 * d.x];
      for (let s = 0; s < 4; s++) { c[s * 4] += r * y[s] * SR; c[s * 4 + 1] += g * y[s] * SR; c[s * 4 + 2] += b * y[s] * SR; c[s * 4 + 3] += (hasSky ? vis : 1) * y[s] * SR; }
    }
    if (back / total > 0.4) { valid[idx] = 0; inside++; } else valid[idx] = 1;
  }
  // A point inside a wall or a roof's body takes what its neighbours have, so that a lookup beside a wall is not pulled toward nothing.
  const at = (i, j, k) => (k * dim[1] + j) * dim[0] + i;
  for (let pass = 0; pass < 6 && inside > 0; pass++) {
    const fill = [];
    for (let k = 0; k < dim[2]; k++) for (let j = 0; j < dim[1]; j++) for (let i = 0; i < dim[0]; i++) {
      const idx = at(i, j, k); if (valid[idx]) continue; let n = 0; const sum = new Float32Array(16);
      for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const x = i + a, y = j + b, z = k + c; if (x < 0 || y < 0 || z < 0 || x >= dim[0] || y >= dim[1] || z >= dim[2]) continue; const m = at(x, y, z); if (!valid[m]) continue; n++; for (let q = 0; q < 16; q++) sum[q] += coef[m * 16 + q]; }
      if (n) fill.push([idx, sum.map((v) => v / n)]);
    }
    for (const [idx, v] of fill) { coef.set(v, idx * 16); valid[idx] = 1; inside--; }
  }
  // What no neighbour reached is open sky and no bounce (out of doors), or no change (in a room).
  for (let idx = 0; idx < N; idx++) if (!valid[idx]) { const c = coef.subarray(idx * 16, idx * 16 + 16); c.fill(0); c[3] = 4 * Math.PI * Y0; }
  if (!hasSky) for (let idx = 0; idx < N; idx++) for (let s = 0; s < 4; s++) coef[idx * 16 + s * 4 + 3] = s ? 0 : 4 * Math.PI * Y0;   // a room's fill light stays as it is: only the lamps' bounce is added
  return { id, dim, cell, box: [box.x0, box.y0, box.z0], abs: !hasSky, coef, solid: inside };
}

// Float16 for the textures.
const f16 = (() => { const f = new Float32Array(1), u = new Uint32Array(f.buffer); return (v) => { f[0] = v; const x = u[0], s = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 127 + 15, m = x & 0x7fffff; if (e <= 0) return s; if (e >= 31) return s | 0x7bff; return s | (e << 10) | (m >> 13); }; })();

const L = await levelObject(LEVEL), D = buildDrawn(L), grids = [];
const t0 = Date.now();
// The court: the first court, the gate and the forecourt before it, and the terraces' feet; every height the roofs reach.
{
  const box = { x0: -26, x1: 26, z0: -40, z1: 70, y0: 0.8, y1: 13.3, bottom: -5, top: 40 };
  const S = gather([D.scene], { x0: box.x0 - 10, x1: box.x1 + 10, z0: box.z0 - 10, z1: box.z1 + 10, bottom: -10, top: 60 });
  console.log(`court: ${S.tris} triangles`);
  grids.push(bakeGrid({ id: "outdoors", S, box, cell: 2.5, hasSky: true }));
}
// The great hall's room (the trial's only one).
for (const id of ["main"]) {
  const r = D.rooms.rooms[id]; if (!r) continue; const R = r.room;
  const S = gather([r.group], { x0: R.x0 - 1, x1: R.x1 + 1, z0: R.z0 - 1, z1: R.z1 + 1, bottom: R.y - 3, top: R.y + 25 }, R.y);
  const lamps = r.lights.map((l) => { const w = l.getWorldPosition(new THREE.Vector3()); return { x: w.x, y: w.y, z: w.z, r: l.color.r, g: l.color.g, b: l.color.b, intensity: l.intensity, dist: l.distance, decay: l.decay }; });
  console.log(`room ${id}: ${S.tris} triangles, ${lamps.length} lamps`);
  const box = { x0: R.x0 + 0.5, x1: R.x1 - 0.5, z0: R.z0 + 0.5, z1: R.z1 - 0.5, y0: R.y + 0.6, y1: R.y + 9 };
  grids.push(bakeGrid({ id: "room:" + id, S, box, cell: 1.5, lamps, hasSky: false }));
}
// The file: "PRB1", the header's length, the header (JSON), padding to four, then for each grid its four harmonics as RGBA half floats.
const head = { version: 1, level: LEVEL, rays: RAYS, grids: grids.map((g) => ({ id: g.id, dim: g.dim, cell: g.cell, box: g.box, abs: g.abs })) };
const hb = Buffer.from(JSON.stringify(head)), pad = (4 - ((8 + hb.length) % 4)) % 4, parts = [Buffer.from("PRB1"), Buffer.alloc(4), hb, Buffer.alloc(pad)];
parts[1].writeUInt32LE(hb.length);
for (const g of grids) { const n = g.dim[0] * g.dim[1] * g.dim[2]; for (let s = 0; s < 4; s++) { const u = new Uint16Array(n * 4); for (let i = 0; i < n; i++) for (let q = 0; q < 4; q++) u[i * 4 + q] = f16(g.coef[i * 16 + s * 4 + q]); parts.push(Buffer.from(u.buffer)); } }
mkdirSync(OUT, { recursive: true });
const file = OUT + `${LEVEL}.bin`, out = Buffer.concat(parts); writeFileSync(file, out);
for (const g of grids) console.log(`${g.id}: ${g.dim.join("x")} at ${g.cell} m, ${g.solid} points inside something`);
console.log(`wrote ${file}: ${(out.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
