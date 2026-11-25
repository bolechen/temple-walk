// The great hall's roof as a Liao hall carries it (docs/t05/ARCHITECTURE.md §4.1): one hipped roof of four slopes and five
// ridges, laid in grey cover and pan tiles, not glazed. It is folded, not straight: from the eave purlin to the ridge each
// fall is steeper than the one below, as the Yingzao Fashi raises and folds a roof (juan 5, on raising and folding a roof), so that from the court it
// hollows up to the ridge instead of standing as one flat board; its four corners lift and its main ridge rises a
// little toward its two ends. Under the tiles the eave is two layers of rafters, round ones below and square flying
// rafters over them reaching further out, fanned at the corners about the corner beam; along the edge a board and a row of
// round end tiles with drip tiles between. On the main ridge's two ends stand the ornaments, curled like a new moon (ART.md;
// the Yingzao Fashi, juan 13, gives only their height; the form is the Liao halls' as photographed, reworked, no one copied).
//
// Everything is worked from one surface, `heightAt(x, z)`: the tiles lie on it, the boards a hand under it, and what the
// hall's walls, gongyan boards and frames rise to is `underAt`, so the roof can never part from what holds it up.
// Sizes and how far each is sourced: docs/t05/SOURCES.md §11.
import * as THREE from "three";
import { box, smooth, plain } from "../../src/geo.js";

/**
 * The roof's numbers (metres). `purlin`: how far in from the eave's edge the eave purlin lies, on the outermost tier of the
 * bracket sets; `fold`: the Yingzao Fashi's folding (1: a tenth of the rise under the first purlin, then halved down each
 * one); `lift`/`liftLen`/`liftIn`: how far the corner rises, how far along the eave from the corner the rise begins, how far
 * up the slope it fades; `ridgeRise`: how much higher the main ridge stands at its ends; `tile`: the cover tiles' spacing,
 * `course`: how long a course is; `deck`: tiles, bed and boards between the tiles' face and the boards' underside;
 * `flyer`: the flying rafters (how far in from the edge they reach, their section); `rafter`: the round eave rafters (radius,
 * spacing); `ridge`: the main ridge's courses; `hip`: the hip ridges'; `orn`: the end ornaments (how high their tips stand over
 * the ridge's line at the middle, which cam07 frames under the archway's beam, t05-cam07.test; their thickness). An ornament
 * stands from the tiles at the ridge's end, its mouth taking the ridge.
 */
export const ROOF = Object.freeze({
  purlin: 1.2, fold: 1,
  lift: 0.85, liftLen: 9.0, liftIn: 3.6,
  ridgeRise: 0.2,
  tile: 0.4, course: 0.5,
  deck: 0.34,
  flyer: { reach: 1.25, w: 0.13, h: 0.15 },
  rafter: { r: 0.105, gap: 0.4 },
  ridge: { foot: 0.34, body: 0.4, cap: 0.5, h: 0.75, capH: 0.1 },
  hip: { w: 0.42, h: 0.5, bury: 0.35 },
  orn: { top: 2.3, t: 0.62 },
});
// The tile shader lays its cover tiles 0.25 apart and its courses 0.33 long in its own units (materials.js, `tile`): the
// great hall's are larger, so its texture coordinates are scaled to them.
const UVK = 0.25 / ROOF.tile, UVC = 0.33 / ROOF.course;

/**
 * The roof over the eave's rectangle: x within ±EX, z from EB (back) to EF (front); the eave's edge at `eave` (along the
 * middle of each side, before the corners lift) and the ridge at `ridge`. Returns the surface, what lies under it, and the
 * meshes by material.
 * @param {{ EX: number, EF: number, EB: number, eave: number, ridge: number, columns: { X: number, zF: number, zB: number }, inner?: number }} o
 */
export function buildRoof(o) {
  const R = ROOF, { EX, EF, EB } = o, half = (EF - EB) / 2, zm = (EF + EB) / 2, rx = EX - half;
  // The fold: from the eave purlin to the ridge in n falls about a rafter long, each purlin let down below the straight line
  // from the one above to the eave purlin (a tenth of the rise for the first, then half as much each one down); outside the
  // eave purlin the rafters run on at the lowest fall. The rise is what makes the ridge come out at `ridge` with the eave's edge at `eave`.
  const run = half - R.purlin, n = Math.max(2, Math.round(run / 2.9)), seg = run / n, f = new Array(n + 1).fill(0); f[n] = 1;
  for (let k = n - 1; k >= 1; k--) f[k] = (f[k + 1] * k) / (k + 1) - (R.fold * 1) / (10 * 2 ** (n - 1 - k));
  const s0n = f[1] / seg, rise = (o.ridge - o.eave) / (1 + s0n * R.purlin), s0 = s0n * rise;
  /** Height over the eave's edge at d metres in from it, before the corners lift. */
  const profile = (d) => { d = Math.min(Math.max(d, 0), half); if (d <= R.purlin) return s0 * d; const u = Math.min(n - 1e-9, (d - R.purlin) / seg), k = Math.floor(u); return s0 * R.purlin + rise * (f[k] + (f[k + 1] - f[k]) * (u - k)); };
  const breaks = [R.purlin, ...Array.from({ length: n - 1 }, (_, k) => R.purlin + (k + 1) * seg)];
  /** How far in from the eave's edge a point lies, from the front, the back and either end (the plan of a hipped roof). */
  const dists = (x, z) => [EF - z, z - EB, EX - Math.abs(x)];
  const liftAt = (x, z) => {
    const dz = Math.min(EF - z, z - EB), dx = EX - Math.abs(x), t = Math.max(0, 1 - Math.max(dz, dx) / R.liftLen);
    return R.lift * t * t * (1 - smooth(0, R.liftIn, Math.min(dz, dx)));
  };
  const heightAt = (/** @type {number} */ x, /** @type {number} */ z) => {
    const d = Math.min(...dists(x, z)), ux = Math.min(1, Math.abs(x) / rx);
    return o.eave + profile(d) + liftAt(x, z) + R.ridgeRise * ux * ux * Math.min(1, Math.max(0, d) / half) ** 3;   // (cubed: the rise is the ridge's, and the slope's foot, where the walls meet it, keeps level)
  };
  // Under the tiles: the boards a deck under them; inside the line where the flying rafters stop, the boards lie on the
  // round rafters, a flying rafter's depth lower (the small eave board closes the step between the two).
  const underAt = (/** @type {number} */ x, /** @type {number} */ z) => heightAt(x, z) - R.deck - (Math.min(...dists(x, z)) > R.flyer.reach ? R.flyer.h : 0);
  const dPlan = (x, z) => Math.min(...dists(x, z));
  /** The shade under the eaves: deep under the roof, lighter toward its edge, where the court's light reaches up. */
  const ao = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => 0.42 + 0.45 * (1 - smooth(0, 2.2, dPlan(x, z))) + 0.13 * smooth(o.eave - 3, o.eave + 0.5, -y + 2 * o.eave);

  // ---- The tiled slopes: four of them, each a grid of rows up the slope and columns along it, sharing the hips. ----
  // Rows: finely near the eave where the corners curl, at every fold, and every 0.8 m between.
  const rowsAt = () => {
    const v = new Set([0, half]);
    for (let d = 0; d < R.liftIn + 0.6; d += 0.4) v.add(+d.toFixed(3));
    for (let d = 0; d < half; d += 0.8) v.add(+d.toFixed(3));
    for (const b of breaks) v.add(+b.toFixed(4));
    v.add(R.flyer.reach);
    return [...v].filter((d) => d >= 0 && d <= half).sort((a, b) => a - b);
  };
  const rows = rowsAt();
  // Columns, as a share of the row's own width: finely within the corners' lift, coarsely along the straight middle.
  const colsFor = (E, fineStep = 0.45) => { const out = [], fine = R.liftLen + 0.6; let t = -E; while (t < E - 1e-6) { out.push(t); t += Math.abs(t) > E - fine - 1e-6 || Math.abs(t + 1.5) > E - fine ? fineStep : 1.5; } out.push(E); return out.map((t) => t / E); };
  const tiles = [], under = [];
  // side: [along-eave length at the edge, a point on the slope by (s in -1..1, v in from the edge), its texture's along]
  const sides = [
    { E: EX, at: (s, v) => [s * (EX - v), EF - v], along: (x, z) => x },
    { E: EX, at: (s, v) => [-s * (EX - v), EB + v], along: (x, z) => -x },
    { E: half, at: (s, v) => [EX - v, zm + s * (half - v)], along: (x, z) => z },
    { E: half, at: (s, v) => [-(EX - v), zm - s * (half - v)], along: (x, z) => -z },
  ];
  const wind = (pos, idx, up) => { for (let i = 0; i < idx.length; i += 3) { const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3, ny = (pos[b + 2] - pos[a + 2]) * (pos[c] - pos[a]) - (pos[b] - pos[a]) * (pos[c + 2] - pos[a + 2]); if (ny > 0 !== up) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } } return idx; };
  for (const sd of sides) {
    const cols = colsFor(sd.E);
    // the tiles
    {
      const pos = [], uv = [], idx = [], nc = cols.length;
      for (const v of rows) for (const s of cols) { const [x, z] = sd.at(s, v); pos.push(x, heightAt(x, z), z); uv.push(sd.along(x, z) * UVK, v * UVC); }
      for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nc - 1; i++) { const a = j * nc + i, b = a + nc; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(wind(pos, idx, true)); g.computeVertexNormals(); tiles.push(g);
    }
    // the boards under them, the row at the flying rafters' end taken twice, once on each side of the step (more coarsely across: seen only from under the eave)
    {
      const cols = colsFor(sd.E, 0.9), pos = [], idx = [], nc = cols.length, ur = [];
      for (const v of rows) { if (v === R.flyer.reach) ur.push([v, 0], [v, R.flyer.h]); else ur.push([v, v > R.flyer.reach ? R.flyer.h : 0]); }
      for (const [v, drop] of ur) for (const s of cols) { const [x, z] = sd.at(s, v); pos.push(x, heightAt(x, z) - R.deck - drop, z); }
      for (let j = 0; j < ur.length - 1; j++) { if (ur[j][0] === ur[j + 1][0]) continue;   // (the step itself is the small eave board, `step` below)
        for (let i = 0; i < nc - 1; i++) { const a = j * nc + i, b = a + nc; idx.push(a, a + 1, b, b, a + 1, b + 1); } }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(wind(pos, idx, false)); g.computeVertexNormals(); under.push(g);
    }
  }

  // ---- The eave's edge: the board on the flying rafters' ends, and under it nothing open (the board reaches the boards). ----
  const ring = [];   // round the edge, corner to corner, with every corner once
  const STEP = 0.3;
  for (let x = -EX; x < EX - 1e-6; x += STEP) ring.push([x, EF]); for (let z = EF; z > EB + 1e-6; z -= STEP) ring.push([EX, z]);
  for (let x = EX; x > -EX + 1e-6; x -= STEP) ring.push([x, EB]); for (let z = EB; z < EF - 1e-6; z += STEP) ring.push([-EX, z]); ring.push([-EX, EF]);
  const fascia = (() => {
    const p = [], ix = [];
    ring.forEach(([x, z], i) => { const y = heightAt(x, z); p.push(x, y + 0.03, z, x, y - R.deck - 0.02, z); if (i) { const a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals(); return g;
  })();
  // The small eave board closing the step between the flying rafters' boards and the round rafters' (seen only from under the eave).
  const step = (() => {
    const p = [], ix = [], r = R.flyer.reach, ring2 = ring.map(([x, z]) => [Math.max(-EX + r, Math.min(EX - r, x)), Math.max(EB + r, Math.min(EF - r, z))]);
    ring2.forEach(([x, z], i) => { const y = heightAt(x, z) - R.deck; p.push(x, y + 0.01, z, x, y - R.flyer.h - 0.01, z); if (i) { const a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals(); return g;
  })();

  // ---- Rafters: round ones from the bracket sets out under the boards, square flying rafters over their ends. ----
  // Along each side they run straight out; past the corner column they fan, each aimed back at the corner column and
  // stopped where it meets the hip's line in plan, so that the two sides' fans meet along the corner beam.
  const { X, zF, zB } = o.columns, raf = [], fly = [], beams = [];
  const zAxis = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), mid = new THREE.Vector3(), dv = new THREE.Vector3();
  const stick = (out, a, b, mk) => { dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = dv.length(); if (L < 0.25) return; q.setFromUnitVectors(zAxis, dv.normalize()); out.push(mk(L).applyMatrix4(m4.compose(mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, one))); };
  const round = (L) => new THREE.CylinderGeometry(R.rafter.r, R.rafter.r, L, 6, 1, true).rotateX(Math.PI / 2);
  const square = (L) => new THREE.BoxGeometry(R.flyer.w, R.flyer.h, L);
  // A rafter in plan from a point on the edge (ex, ez) running in by the unit direction (ux, uz) to length `len`, cut at the hip.
  const inn = o.inner ?? 2.4;   // how far in from the edge the round rafters start (over the outermost bracket arm)
  const lay = (ex, ez, ux, uz, len, cut) => {
    const toward = (t) => [ex + ux * t, ez + uz * t];
    let L = len; if (cut) L = Math.min(L, cut);
    // flying rafter: from the edge to the flyer's reach (plus a lap over the round rafter), under the outer boards
    const fl = Math.min(L, R.flyer.reach + 0.7);
    const f0 = toward(0.02), f1 = toward(fl), fy = (p) => heightAt(p[0], p[1]) - R.deck - R.flyer.h / 2;
    stick(fly, [f0[0], fy(f0), f0[1]], [f1[0], fy(f1), f1[1]], square);
    // round rafter: from a little inside the edge, under the flying rafter's lap, in to its foot
    const r0 = toward(Math.min(L, R.flyer.reach - 0.15)), r1 = toward(L), ry = (p) => heightAt(p[0], p[1]) - R.deck - R.flyer.h - R.rafter.r;
    if (L > R.flyer.reach) stick(raf, [r0[0], ry(r0), r0[1]], [r1[0], ry(r1), r1[1]], round);
  };
  const gap = R.rafter.gap;
  // fronts and backs: straight between the corner columns
  for (let x = -X + gap / 2; x <= X - gap / 2 + 1e-6; x += gap) { lay(x, EF, 0, -1, inn, null); lay(x, EB, 0, 1, inn, null); }
  for (let z = zB + gap / 2; z <= zF - gap / 2 + 1e-6; z += gap) { lay(EX, z, -1, 0, inn, null); lay(-EX, z, 1, 0, inn, null); }
  // the corner fans
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * X, cz = sz > 0 ? zF : zB, ex = sx * EX, ez = sz > 0 ? EF : EB;
    const fan = (px, pz) => {
      let ux = cx - px, uz = cz - pz; const l = Math.hypot(ux, uz); ux /= l; uz /= l;
      // where the line in plan meets the hip's diagonal through the eave's corner (ex, ez), direction (-sx, -sz)
      const dx = -sx, dz = -sz, den = ux * dz - uz * dx, t = den ? ((ex - px) * dz - (ez - pz) * dx) / den : l;
      lay(px, pz, ux, uz, Math.min(inn * 1.6, l), t > 0.05 ? t - 0.06 : 0.05);
    };
    for (let x = cx + sx * gap / 2; Math.abs(x) < EX - 0.12; x += sx * gap) fan(x, ez);
    for (let z = cz + sz * gap / 2; Math.abs(z - zm) < half - 0.12; z += sz * gap) fan(ex, z);
    // The corner beam: out along the diagonal from over the corner column to past the eave's corner, its head turned up.
    const a = [cx, 0, cz], b = [ex + sx * 0.35, 0, ez + sz * 0.35];
    a[1] = heightAt(cx, cz) - R.deck - R.flyer.h - 0.35; b[1] = heightAt(ex, ez) - R.deck + 0.1;
    stick(beams, a, b, (L) => new THREE.BoxGeometry(0.3, 0.42, L));
    const tip = [b[0] + sx * 0.32, b[1] + 0.32, b[2] + sz * 0.32];
    stick(beams, [b[0] - sx * 0.2, b[1] + 0.05, b[2] - sz * 0.2], tip, (L) => new THREE.BoxGeometry(0.24, 0.3, L));
  }

  // ---- Round end tiles along the edge at every cover row, drip tiles between them. ----
  const ends = [], drips = [], disc = new THREE.CircleGeometry(0.115, 8);   // (a face only: it is seen from outside and below, never edge on from near)
  const drip = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.13, 0.02, 0), new THREE.Vector3(0.13, 0.02, 0), new THREE.Vector3(0, -0.13, 0)]);
  const edgeRow = (len, place) => { for (let k = Math.ceil(-len / R.tile - 0.5); (k + 0.5) * R.tile < len - 0.25; k++) { const u = (k + 0.5) * R.tile; if (Math.abs(u) > len - 0.25) continue; place(u, true); if (Math.abs(u + R.tile / 2) < len - 0.3) place(u + R.tile / 2, false); } };
  const put = (u, cover, x, z, rot, nx, nz) => {
    const y = heightAt(x, z);
    if (cover) ends.push(disc.clone().rotateY(rot).translate(x + nx * 0.035, y + 0.07, z + nz * 0.035));
    else drips.push(drip.clone().rotateY(rot).translate(x + nx * 0.03, y - 0.0, z + nz * 0.03));
  };
  edgeRow(EX, (u, c) => put(u, c, u, EF, 0, 0, 1)); edgeRow(EX, (u, c) => put(u, c, -u, EB, Math.PI, 0, -1));
  edgeRow(half, (u, c) => put(u, c, EX, zm + u, Math.PI / 2, 1, 0)); edgeRow(half, (u, c) => put(u, c, -EX, zm - u, -Math.PI / 2, -1, 0));

  // ---- The ridges: a section swept along a line, standing upright whatever the line's slope. ----
  /** @param {THREE.Vector3[]} path @param {[number, number][]} sec the section, (across, up), counter-clockwise seen down the path */
  const sweep = (path, sec) => {
    const p = [], ix = [], ns = sec.length;
    path.forEach((P, i) => {
      const T = (i === 0 ? path[1].clone().sub(P) : i === path.length - 1 ? P.clone().sub(path[i - 1]) : path[i + 1].clone().sub(path[i - 1])); T.y = 0; T.normalize();
      const side = new THREE.Vector3(-T.z, 0, T.x);
      for (const [a, u] of sec) p.push(P.x + side.x * a, P.y + u, P.z + side.z * a);
    });
    for (let i = 0; i < path.length - 1; i++) for (let j = 0; j < ns; j++) { const a = i * ns + j, b = i * ns + ((j + 1) % ns), c = a + ns, d = b + ns; ix.push(a, c, b, b, c, d); }
    // the two ends closed
    const cap = (base, flip) => { for (let j = 1; j < ns - 1; j++) flip ? ix.push(base, base + j + 1, base + j) : ix.push(base, base + j, base + j + 1); };
    cap(0, true); cap((path.length - 1) * ns, false);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix);
    return plain(g.toNonIndexed());   // (flat normals: a ridge is courses of tile with hard edges)
  };
  const RG = R.ridge, ridgeParts = [];
  // The main ridge: a broad foot bedded into the tiles, a body of courses, a cap course over it; it follows the ridge's rise to its ends.
  const ridgeSec = /** @type {[number, number][]} */ ([[-RG.foot / 2, -0.55], [RG.foot / 2, -0.55], [RG.foot / 2, 0.22], [RG.body / 2, 0.3], [RG.body / 2, RG.h - RG.capH], [RG.cap / 2, RG.h - RG.capH], [RG.cap / 2, RG.h], [-RG.cap / 2, RG.h], [-RG.cap / 2, RG.h - RG.capH], [-RG.body / 2, RG.h - RG.capH], [-RG.body / 2, 0.3], [-RG.foot / 2, 0.22]]);
  const ridgeTop = (x) => heightAt(x, zm);
  {
    const path = []; for (let x = -rx - 0.2; x <= rx + 0.2 + 1e-6; x += (2 * rx + 0.4) / 40) path.push(new THREE.Vector3(x, ridgeTop(Math.max(-rx, Math.min(rx, x))), zm));
    ridgeParts.push(sweep(path, ridgeSec));
  }
  // The hip ridges: from the main ridge's end down the hip to the corner, riding its lift, a little beyond the edge.
  const HP = R.hip, hipSec = /** @type {[number, number][]} */ ([[-HP.w / 2, -HP.bury], [HP.w / 2, -HP.bury], [HP.w / 2, HP.h - 0.1], [HP.w / 2 + 0.04, HP.h - 0.1], [HP.w / 2 + 0.04, HP.h], [-HP.w / 2 - 0.04, HP.h], [-HP.w / 2 - 0.04, HP.h - 0.1], [-HP.w / 2, HP.h - 0.1]]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const path = [];
    for (let t = 0; t <= 1.0001; t += 1 / 36) { const d = half * (1 - t) - 0.15 * t, x = sx * (EX - Math.max(0, d)) + sx * Math.max(0, -d) * 0.7, z = zm + sz * (half - Math.max(0, d)) + sz * Math.max(0, -d) * 0.7; path.push(new THREE.Vector3(x, heightAt(sx * (EX - Math.max(d, 0)), zm + sz * (half - Math.max(d, 0))) + (d < 0 ? 0.06 : 0), z)); }
    ridgeParts.push(sweep(path, hipSec));
  }
  // The end ornaments, curled like a new moon: the mouth low on the inner side taking the ridge, the body rising and its tail
  // turned in toward the ridge's middle over it, a row of fins down its outer back. Drawn as an outline in (in, up), the
  // height 1, thickened and bevelled.
  const OR = R.orn, shape = new THREE.Shape(([
    [-0.46, 0], [-0.5, 0.2], [-0.5, 0.4], [-0.45, 0.58], [-0.35, 0.74], [-0.2, 0.87], [0, 0.96], [0.18, 1.0], [0.32, 0.97], [0.42, 0.88], [0.44, 0.78],
    [0.34, 0.8], [0.22, 0.83], [0.08, 0.79], [-0.04, 0.7], [-0.1, 0.58], [-0.1, 0.46],
    [0.04, 0.4], [0.26, 0.36], [0.34, 0.3], [0.2, 0.25], [0.08, 0.22], [0.24, 0.16], [0.34, 0.1], [0.34, 0],
  ]).map(([u, y]) => new THREE.Vector2(u, y)));
  const fins = [[-0.5, 0.3], [-0.475, 0.5], [-0.41, 0.66], [-0.29, 0.8]];   // where on the back's line (in, up) a fin stands
  for (const s of [-1, 1]) {
    const x0 = s * rx, y0 = ridgeTop(rx) - 0.15, H = o.ridge + OR.top - y0;
    const body = new THREE.ExtrudeGeometry(shape, { depth: OR.t / H, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.025, bevelSegments: 2, curveSegments: 4 });
    body.translate(0, 0, -OR.t / H / 2).scale(H, H, H);
    // turned so that "in" points to the ridge's middle: on the east end in is -x
    if (s > 0) body.rotateY(Math.PI);
    ridgeParts.push(plain(body.translate(x0, y0, zm)));
    fins.forEach(([u, k], i) => {
      const fin = new THREE.ConeGeometry(0.045 * H, 0.09 * H, 4).rotateZ(s * (0.9 + 0.25 * i));   // leaning out and up, more so higher on the back
      ridgeParts.push(plain(fin.translate(x0 - s * u * H + s * 0.03, y0 + k * H, zm)));
    });
  }

  return {
    heightAt, underAt, profile, ao,
    parts: { tiles, underside: under, fascia: [fascia], step: [step], rafters: raf, flyers: fly, beams, ends, drips, ridge: ridgeParts },
    ridge: { rx, zm, top: ridgeTop(0) + RG.h, endTop: ridgeTop(rx) + RG.h, ornamentTop: o.ridge + OR.top },
    fold: { n, seg, rise, s0, breaks },
  };
}
