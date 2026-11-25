// The great hall's roof as a Liao hall carries it (docs/t05/ARCHITECTURE.md §4.1): one hipped roof of four slopes and five
// ridges, laid in grey cover and pan tiles, not glazed. It is folded, not straight: from the eave purlin to the ridge each
// fall is steeper than the one below, as the Yingzao Fashi raises and folds a roof (juan 5, on raising and folding a roof), so that from the court it
// hollows up to the ridge instead of standing as one flat board; its four corners lift and its main ridge rises a
// little toward its two ends. Under the tiles the eave is two layers of rafters, round ones below and square flying
// rafters over them reaching further out, fanned at the corners about the corner beam; along the edge a board and a row of
// round end tiles with drip tiles between. On the main ridge's two ends stand the ornaments, solid and curled in at the top like a new moon (ART.md;
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
// How far short of the corner the row of end tiles along each edge stops: the last one sits under the hip ridge's foot.
const END_IN = 0.12;
// The corner fans' rafters lie this much closer along the eave than the straight runs' do.
const FAN = 0.7;

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
  // A straight piece of timber from a to b; given `square`, turned about its own length so that its top lies flat to the boards
  // over its middle (a flying rafter in the corner's fan, where the eave lifts, then hangs under the boards evenly instead of
  // level, and from the court the fan reads as one rising curve rather than a flight of steps: #742's art review, point 5).
  const normalAt = (/** @type {number} */ x, /** @type {number} */ z) => new THREE.Vector3(-(heightAt(x + 0.05, z) - heightAt(x - 0.05, z)) / 0.1, 1, -(heightAt(x, z + 0.05) - heightAt(x, z - 0.05)) / 0.1).normalize();
  const xb = new THREE.Vector3(), yb = new THREE.Vector3();
  const stick = (out, a, b, mk, square = false) => {
    dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = dv.length(); if (L < 0.25) return; dv.normalize(); mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    if (square) { const n = normalAt(mid.x, mid.z); yb.copy(n).addScaledVector(dv, -n.dot(dv)).normalize(); xb.crossVectors(yb, dv); m4.makeBasis(xb, yb, dv).setPosition(mid); }
    else m4.compose(mid, q.setFromUnitVectors(zAxis, dv), one);
    out.push(mk(L).applyMatrix4(m4));
  };
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
    stick(fly, [f0[0], fy(f0), f0[1]], [f1[0], fy(f1), f1[1]], square, true);
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
    // (closer than along the sides, as a corner's rafters crowd together: with fewer, each lifted a little above the last, the fan
    // read from the court as a flight of steps)
    const fg = gap * FAN;
    for (let x = cx + sx * fg / 2; Math.abs(x) < EX - 0.12; x += sx * fg) fan(x, ez);
    for (let z = cz + sz * fg / 2; Math.abs(z - zm) < half - 0.12; z += sz * fg) fan(ex, z);
    // The corner beam: out along the diagonal from over the corner column to past the eave's corner, its head turned up.
    const a = [cx, 0, cz], b = [ex + sx * 0.12, 0, ez + sz * 0.12];
    a[1] = heightAt(cx, cz) - R.deck - R.flyer.h - 0.35; b[1] = heightAt(ex, ez) - R.deck + 0.1;
    stick(beams, a, b, (L) => new THREE.BoxGeometry(0.3, 0.42, L));
    const tip = [b[0] + sx * 0.16, b[1] + 0.22, b[2] + sz * 0.16];   // (short: from the court a longer one read as a spike past the eave)
    stick(beams, [b[0] - sx * 0.2, b[1] + 0.05, b[2] - sz * 0.2], tip, (L) => new THREE.BoxGeometry(0.24, 0.3, L));
  }

  // ---- Round end tiles along the edge at every cover row, drip tiles between them. ----
  // An end tile is the head of the last cover tile: a short round tube lying up the slope with its face closed, so that from the
  // court it reads as a tile ending, not as a disc stuck on the board (its back runs in under the tiles, never seen).
  const ends = [], drips = [], ER = 0.115, EL = 0.16;
  const tube = new THREE.CylinderGeometry(ER, ER, EL, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, -EL / 2), face = new THREE.CircleGeometry(ER, 8);
  const drip = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.13, 0.02, 0), new THREE.Vector3(0.13, 0.02, 0), new THREE.Vector3(0, -0.13, 0)]);
  // Along each edge to just short of the corner, where the hip ridge's foot comes down over the last of them.
  const edgeRow = (len, place) => { for (let k = Math.ceil(-len / R.tile - 0.5); (k + 0.5) * R.tile < len - END_IN; k++) { const u = (k + 0.5) * R.tile; if (Math.abs(u) > len - END_IN) continue; place(u, true); if (Math.abs(u + R.tile / 2) < len - END_IN - 0.05) place(u + R.tile / 2, false); } };
  const put = (u, cover, x, z, rot, nx, nz) => {
    const y = heightAt(x, z);
    if (cover) {
      // lying as the slope lies there (steeper where the corner lifts)
      const tilt = Math.atan2(heightAt(x - nx * 0.25, z - nz * 0.25) - y, 0.25);
      for (const g of [tube, face]) ends.push(g.clone().rotateX(tilt).rotateY(rot).translate(x + nx * 0.035, y + 0.07, z + nz * 0.035));
    } else drips.push(drip.clone().rotateY(rot).translate(x + nx * 0.03, y - 0.0, z + nz * 0.03));
  };
  edgeRow(EX, (u, c) => put(u, c, u, EF, 0, 0, 1)); edgeRow(EX, (u, c) => put(u, c, -u, EB, Math.PI, 0, -1));
  edgeRow(half, (u, c) => put(u, c, EX, zm + u, Math.PI / 2, 1, 0)); edgeRow(half, (u, c) => put(u, c, -EX, zm - u, -Math.PI / 2, -1, 0));

  // ---- The ridges: a section swept along a line, standing upright whatever the line's slope. ----
  /** @param {THREE.Vector3[]} path @param {[number, number][]} sec the section, (across, up), counter-clockwise seen down the path
   *  @param {((i: number) => [number, number][])} [secAt] the section at each point of the path, if it changes along it (the same number of points) */
  const sweep = (path, sec, secAt) => {
    const p = [], ix = [], ns = sec.length;
    path.forEach((P, i) => {
      const T = (i === 0 ? path[1].clone().sub(P) : i === path.length - 1 ? P.clone().sub(path[i - 1]) : path[i + 1].clone().sub(path[i - 1])); T.y = 0; T.normalize();
      const side = new THREE.Vector3(-T.z, 0, T.x);
      for (const [a, u] of secAt ? secAt(i) : sec) p.push(P.x + side.x * a, P.y + u, P.z + side.z * a);
    });
    for (let i = 0; i < path.length - 1; i++) for (let j = 0; j < ns; j++) { const a = i * ns + j, b = i * ns + ((j + 1) % ns), c = a + ns, d = b + ns; ix.push(a, c, b, b, c, d); }
    // the two ends closed
    // (triangulated as the outline it is: a fan from one corner laid slivers outside the cap's lips, seen as fine lines past the
    // hips' ends; and turned to face out of each end, the start back up the path and the end on down it, which before they did not,
    // so that a hip's end seen from the court showed its hollow inside)
    const area = (/** @type {number[]} */ t) => { let A = 0; for (let k = 0; k < t.length; k++) { const [a0, u0] = sec[t[k]], [a1, u1] = sec[t[(k + 1) % t.length]]; A += a0 * u1 - a1 * u0; } return A; };
    const turn = Math.sign(area(sec.map((_, k) => k))), tri = THREE.ShapeUtils.triangulateShape(sec.map(([a, u]) => new THREE.Vector2(a, u)), []);
    const cap = (base, flip) => { for (const t of tri) { const [i, j, k] = Math.sign(area(t)) === turn ? t : [t[0], t[2], t[1]]; flip ? ix.push(base + i, base + j, base + k) : ix.push(base + i, base + k, base + j); } };
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
  // The hip ridges: from the main ridge's end down the hip, riding its lift, all the way to the corner, where each ends in a
  // head a little broader and taller than its body, its nose turned up over the corner, with the last end tiles under its foot
  // (no hip stops short of the corner as a flat cut: the art review of #742).
  const HP = R.hip, hipSec = (/** @type {number} */ w, /** @type {number} */ h, bury = HP.bury) => /** @type {[number, number][]} */ ([[-w / 2, -bury], [w / 2, -bury], [w / 2, h - 0.1], [w / 2 + 0.04, h - 0.1], [w / 2 + 0.04, h], [-w / 2 - 0.04, h], [-w / 2 - 0.04, h - 0.1], [-w / 2, h - 0.1]]);
  const HEAD = 0.75;   // how long the head is along the hip, in plan, back from the corner
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // d: how far in from the corner, on the hip's line in plan (45°, so both ways by the same)
    const at = (/** @type {number} */ d, lift = 0) => new THREE.Vector3(sx * (EX - d), heightAt(sx * (EX - Math.max(d, 0)), zm + sz * (half - Math.max(d, 0))) + lift, zm + sz * (half - d));
    // one sweep from the main ridge down to the corner; over the last HEAD metres the section swells by a course each way and its
    // top rises into the nose (the head grows out of the hip, no shoulder where one meets the other)
    const path = [];
    for (let i = 0; i < 36; i++) path.push(at(half + (HEAD - half) * (i / 36)));
    const nose = (/** @type {number} */ k) => 0.1 * smooth(0.35, 1, k / 10) ** 2;   // (the nose's rise; the foot stays where it was)
    // the head ends a little in from the corner's point, so that its square end hangs no more than a hand past the two eaves; its
    // foot comes up toward the end, as far as the tiles falling away either side of the hip allow (buried deep it showed past the eave as a slab a metre tall), and its last
    // course is bevelled back, the nose narrower and lower than the head
    const END = 0.08;
    for (let k = 0; k <= 10; k++) path.push(at(HEAD - (HEAD - END) * (k / 10), nose(k)));
    const headSec = (/** @type {number} */ k) => { const g = smooth(0, 0.45, k / 10), bev = k === 10 ? 1 : k === 9 ? 0.25 : 0;
      return hipSec((HP.w + 0.08 * g) * (1 - 0.2 * bev), HP.h + 0.1 * g - 0.08 * bev, HP.bury + (0.25 - HP.bury) * smooth(0.3, 1, k / 10) + nose(k)); };
    ridgeParts.push(sweep(path, hipSec(HP.w, HP.h), (i) => (i < 36 ? hipSec(HP.w, HP.h) : headSec(i - 36))));
  }
  // The end ornaments (鸱尾), as the Liao halls carry them: one solid piece, broad where it stands on the ridge's end (about
  // eight tenths of its height across) and narrowing as it rises, its back a smooth curve set with a row of teeth like a fin,
  // its top turned in toward the ridge's middle in one short curled point; low on the inner side two jaws, the upper over the
  // ridge's cap and the lower at the tiles, take the ridge's end between them (the ridge's top is about four tenths of the way
  // up). Drawn as an outline in (in, up), the height 1, then thickened, with a deep rounded bevel so that its sides swell.
  const OR = R.orn, BEV = { t: 0.075, s: 0.03 };
  /** A smooth curve through points, sampled. @param {number[][]} pts @param {number} n */
  const curve = (pts, n) => new THREE.SplineCurve(pts.map(([u, y]) => new THREE.Vector2(u, y))).getPoints(n);
  // the back, from the foot on the outer side up over the top: teeth from a third of the way up to just under the curl,
  // each leaning up the back, as scales or a fin's rays do
  const back = curve([[-0.42, 0], [-0.45, 0.2], [-0.42, 0.42], [-0.35, 0.62], [-0.24, 0.8], [-0.08, 0.94], [0.08, 0.99]], 60);
  const toothed = []; back.forEach((P, i) => {
    toothed.push(P);
    if (i >= 14 && i <= 50 && i % 4 === 2) { const T = back[i + 1].clone().sub(back[i - 1]).normalize(), Nn = new THREE.Vector2(T.y, -T.x); toothed.push(P.clone().addScaledVector(Nn, -0.032).addScaledVector(T, 0.022)); }
  });
  const outline = [
    ...toothed,
    // the curl: over the top and down into a short point turned in and down, over a small notch
    ...curve([[0.08, 0.99], [0.21, 0.97], [0.3, 0.9], [0.31, 0.8]], 8).slice(1),
    ...curve([[0.31, 0.8], [0.26, 0.83], [0.21, 0.79], [0.19, 0.72]], 6).slice(1),
    // the inner edge, all but straight, widening down to the upper jaw
    ...curve([[0.19, 0.72], [0.21, 0.64], [0.27, 0.57]], 5).slice(1),
    // the upper jaw out over the ridge's cap and resting on it, its lip turned down; the mouth's corner deep in under it, where
    // the ridge goes in; the lower jaw out at the tiles
    ...[[0.36, 0.55], [0.4, 0.5], [0.4, 0.43], [0.34, 0.405], [0.16, 0.405], [0.12, 0.3], [0.14, 0.16], [0.3, 0.12], [0.4, 0.09], [0.4, 0]].map(([u, y]) => new THREE.Vector2(u, y)),
  ];
  // the outline drawn so that, with its bevel, it stands exactly at the height cam07 holds (ROOF.orn.top)
  const top = Math.max(...outline.map((P) => P.y));
  for (const s of [-1, 1]) {
    const x0 = s * rx, y0 = ridgeTop(rx) - 0.15, H = o.ridge + OR.top - y0, k = (1 - BEV.s / H) / top;
    const shape = new THREE.Shape(outline.map((P) => new THREE.Vector2(P.x * k * H, P.y * k * H)));
    const body = new THREE.ExtrudeGeometry(shape, { depth: OR.t - 2 * BEV.t, bevelEnabled: true, bevelThickness: BEV.t, bevelSize: BEV.s, bevelSegments: 3, curveSegments: 4 });
    body.translate(0, 0, -(OR.t - 2 * BEV.t) / 2);
    // turned so that "in" points to the ridge's middle: on the east end in is -x
    if (s > 0) body.rotateY(Math.PI);
    ridgeParts.push(plain(body.translate(x0, y0, zm)));
  }

  return {
    heightAt, underAt, profile, ao,
    parts: { tiles, underside: under, fascia: [fascia], step: [step], rafters: raf, flyers: fly, beams, ends, drips, ridge: ridgeParts },
    ridge: { rx, zm, top: ridgeTop(0) + RG.h, endTop: ridgeTop(rx) + RG.h, ornamentTop: o.ridge + OR.top },
    fold: { n, seg, rise, s0, breaks },
  };
}
