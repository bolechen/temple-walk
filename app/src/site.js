// The temple as a plan. It takes its spirit from Jingshan, the mountain-top Zen monastery above the bamboo
// sea, without copying it. What is kept is the order in which that place is met (docs/JINGSHAN.md):
// a stair climbing out of the bamboo; a screen wall where two paths meet; a two-storey gate with its bell
// and drum; a double-eaved hall across a wet court, a meditation hall and a tea house facing each other;
// a library and a dragon well on the terrace behind; and a last stair between rows of tea to a pavilion
// at the summit, from which every roof lies below. 1 unit = 1 m. North is -z and uphill; you arrive from the south.
import * as THREE from "../v/build/three.module.js";
import { box, merge, mesh, smooth, stairGeo } from "./geo.js";
import { buildHall } from "./building.js";
import { makePlaque } from "./plaque.js";

export const SITE = { x: 22, zS: 40, zN: -142, fore: 64, apron: 96, wallH: 3.0 };
// Terraces above the entrance court, as on the mountain: each hall stands higher than the one before.
// zS is the front edge, where the stairs arrive.
export const LEVELS = [
  { y: 2.4, x: 22, zS: -34, zN: -67.9, stair: 6 },      // the library
  { y: 5.2, x: 22, zS: -67.9, zN: -90.5, stair: 5 },    // the Guanyin hall
  { y: 20, x: 14, zS: -118.4, zN: -142, stair: 4 },     // the summit: high enough to look back over every roof
];
const [T1, T2, TOP] = LEVELS;
const HILL = { zS: T2.zN, zN: TOP.zS };   // the slope below the summit, crossed only by the stair between the tea rows
// The way in: a zigzag up through the grove. You start on the lower landing, climb west to the half-way
// pavilion, turn, and climb north to the forecourt in front of the gate.
const steps = (rise) => 0.34 * Math.round(rise / 0.18);
export const APPROACH = { top: SITE.fore, w: 4, rise: 6, rise2: 4.5, run: steps(6), run2: steps(4.5), zA0: SITE.fore + steps(6), zA1: SITE.fore + steps(6) + 4.6, xTurn: 10, end: 90 };
APPROACH.zMid = (APPROACH.zA0 + APPROACH.zA1) / 2; APPROACH.xB0 = APPROACH.xTurn + APPROACH.run2; APPROACH.xB1 = APPROACH.xB0 + 5.6;

// Height of the land outside the walls, under the approach, and on the hill.
export function terrain(x, z) {
  const ax = Math.abs(x), A = APPROACH;
  if (z > A.top - 0.5) {
    const down = A.rise * Math.min(1, Math.max(0, (z - A.top) / A.run)) + A.rise2 * Math.min(1, Math.max(0, (x - A.xTurn) / A.run2)) * smooth(A.top + 3, A.zA0, z);
    return -down - 0.14 - Math.max(0, z - A.zA1 - 1) * 0.35 + Math.max(0, -x - 3) * 0.05;
  }
  if (ax < SITE.x + 0.2 && z > HILL.zS + 0.05 && z < SITE.zS) return -0.8;                 // inside: the courts cover it
  if (ax < TOP.x && z < HILL.zN && z > SITE.zN) return TOP.y - 0.4;                          // under the summit terrace
  const climb = Math.min(1, Math.max(0, (HILL.zS - z) / (HILL.zS - HILL.zN)));
  return T1.y * smooth(T1.zS + 7, T1.zS - 2, z) + (T2.y - T1.y) * smooth(T2.zS + 7, T2.zS - 2, z) + (TOP.y - T2.y) * climb - 0.12
    + Math.max(0, HILL.zN - z) * 0.3 + Math.max(0, ax - (z < HILL.zN ? TOP.x : SITE.x)) * 0.09;
}

// Turn a local point / rect by a quarter-turn count and move it to its place.
const turn = (x, z, q) => (q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x]);
function place(r, at, q) {
  const [ax, az] = turn(r.x0, r.z0, q), [bx, bz] = turn(r.x1, r.z1, q);
  const out = { ...r, x0: Math.min(ax, bx) + at[0], x1: Math.max(ax, bx) + at[0], z0: Math.min(az, bz) + at[1], z1: Math.max(az, bz) + at[1] };
  for (const k of ["low", "high"]) if (r[k]) { const [x, z] = turn(r[k][0], r[k][1], q); out[k] = [x + at[0], z + at[1]]; }
  return out;
}
const tiles = (pos, uv, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };

export function buildSite(M) {
  const root = new THREE.Group();
  // carve: floors and stairs you can stand on, which override what would block. shade[i]: what darkens the paving of level i.
  const walk = { solids: [], decks: [], ramps: [] }, shade = [[], [], [], []];
  const put = (opts, at, q = 0, lvl = 0, base) => {
    const y = base !== undefined ? base : lvl ? LEVELS[lvl - 1].y : 0, b = buildHall(M, { ...opts, ground: y });
    b.group.position.set(at[0], y, at[1]); b.group.rotation.y = (q * Math.PI) / 2; root.add(b.group);
    for (const r of b.walk.solids) walk.solids.push(place(r, at, q));
    for (const r of b.walk.decks) walk.decks.push({ ...place(r, at, q), h: r.h + y });
    for (const r of b.walk.ramps) walk.ramps.push({ ...place(r, at, q), base: y });
    if (base === undefined) shade[lvl].push(place(b.plat, at, q));
    return b;
  };
  // A building of two storeys: the lower roof is a skirt whose ridge hides inside the upper storey,
  // and the upper storey starts where that skirt meets its walls.
  const putTwo = (lower, upper, at, q = 0, lvl = 0) => {
    const lo = { overhang: 2.4, ...lower }, X = lo.xs[lo.xs.length - 1], uX = upper.xs[upper.xs.length - 1], uZ = upper.zs[0];
    const b = put({ ...lo, G: X + lo.overhang - uX + 0.4 }, at, q, lvl), foot = b.roofAt(b.EZ - uZ);
    put({ platOut: 0.05, dark: false, steps: 0, ...upper, platH: foot - 0.08, platBase: foot - 0.4 }, at, q, lvl);
    return b;
  };

  // ---- Buildings, from the gate uphill ----
  putTwo({   // the gate: you pass through its middle bay, under an upper storey
    xs: [-9.6, -6.0, -2.2, 2.2, 6.0, 9.6], zs: [3, -3], platH: 0.5, platOut: 1.2, colTop: 4.3, overhang: 2.0, rise: 2.2,
    front: "pass", back: "pass", dark: false, steps: 4.0, stepsBack: 4.0,
  }, { xs: [-7.0, -2.2, 2.2, 7.0], zs: [1.8, -1.8], colTop: 3.0, overhang: 2.1, rise: 3.9, G: 2.6, plaque: "云径禅寺" }, [0, SITE.zS]);

  const strikers = [];
  for (const sx of [-1, 1]) {   // bell pavilion (east) and drum pavilion (west), just inside the gate, open on all sides
    const t = put({
      xs: [-1.7, 1.7], zs: [1.7, -1.7], platH: 0.6, platOut: 0.9, colTop: 4.4, overhang: 1.5, rise: 3.0, G: 9, lift: 0.6, liftLen: 2.6,
      front: "open", back: "open", sides: "open", dark: false, steps: 0, plaque: sx > 0 ? "钟楼" : "鼓楼",
    }, [sx * 15.5, 31.5], sx > 0 ? 3 : 1);
    const thing = sx > 0 ? bell(M, t) : drum(M, t);
    t.group.add(thing.group); strikers.push({ kind: sx > 0 ? "bell" : "drum", mesh: thing.hit, swing: thing.swing });
  }
  // Facing each other across the court: the meditation hall, and the tea house.
  const side = { xs: [-8, -4.8, -1.6, 1.6, 4.8, 8], zs: [2.4, -2.4], platH: 0.45, platOut: 1.0, colTop: 3.6, overhang: 1.7, rise: 3.0, G: 2.2, lamps: false, steps: 3.0 };
  put({ ...side, plaque: "禅堂" }, [16.6, 14], 3);
  put({ ...side, plaque: "吃茶去" }, [-16.6, 14], 1);

  const mz = -14.6;   // the main hall: double-eaved, seven bays, the largest roof in the temple
  const main = putTwo({
    xs: [-14.4, -10.2, -6.2, -2.3, 2.3, 6.2, 10.2, 14.4], zs: [8.6, 4.3, 0, -4.3, -8.6], platH: 1.5, platOut: 2.4, colTop: 4.8, overhang: 2.6, rise: 3.4, steps: 6.4,
  }, { xs: [-10.2, -6.2, -2.3, 2.3, 6.2, 10.2], zs: [5.0, 0, -5.0], colTop: 3.4, overhang: 2.8, rise: 6.2, G: 3.6, plaque: "大雄宝殿" }, [0, mz]);

  putTwo({   // on the first terrace: the sutra library
    xs: [-9.4, -5.4, -1.9, 1.9, 5.4, 9.4], zs: [4.2, 0, -4.2], platH: 1.26, platOut: 1.7, colTop: 5.0, overhang: 2.6, rise: 3.0, steps: 5.2, lamps: false,
  }, { xs: [-6.4, -2.2, 2.2, 6.4], zs: [2.6, -2.6], colTop: 3.1, overhang: 2.3, rise: 4.4, G: 2.9, plaque: "藏经楼" }, [0, T1.zS - 15], 0, 1);
  const wellAt = [17.6, T1.zS - 9];   // and the dragon well under its own small roof
  const wp = put({
    xs: [-1.5, 1.5], zs: [1.5, -1.5], platH: 0.3, platOut: 0.8, colTop: 3.0, overhang: 1.3, rise: 2.3, G: 9, lift: 0.5, liftLen: 2.2,
    brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 0, plaque: "龙井",
  }, wellAt, 3, 1);
  wp.group.add(mesh(merge([
    new THREE.CylinderGeometry(0.62, 0.7, 0.62, 8, 1, true).translate(0, 0.61, 0), new THREE.TorusGeometry(0.62, 0.09, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8).translate(0, 0.92, 0),
  ]), M.stone));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.58, 16).rotateX(-Math.PI / 2).translate(0, 0.56, 0), M.dark.clone()); water.material.side = THREE.FrontSide; wp.group.add(water);

  put({   // on the second terrace: the Guanyin hall, single-eaved and quieter
    xs: [-9, -5.2, -1.8, 1.8, 5.2, 9], zs: [5, 1.7, -1.7, -5], platH: 0.9, platOut: 1.6, colTop: 4.2, overhang: 2.4, rise: 5.0, G: 3.2, steps: 4.6, plaque: "观音殿",
  }, [0, T2.zS - 12.2], 0, 2);

  const topZ = TOP.zS - 12.9;   // at the summit: the pavilion that looks back over everything below
  putTwo({
    xs: [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5], zs: [7.5, 4.5, 1.5, -1.5, -4.5, -7.5], platH: 0.9, platOut: 1.4, colTop: 3.9, overhang: 2.0, rise: 2.6, steps: 3.6, lamps: false,
  }, { xs: [-4.5, -1.5, 1.5, 4.5], zs: [4.5, 1.5, -1.5, -4.5], colTop: 3.1, overhang: 2.1, rise: 4.2, G: 9, lift: 0.65, liftLen: 3.2, plaque: "凌霄阁" }, [0, topZ], 0, 3);

  // The stele pavilion beside the approach, at the end of the old path up the mountain.
  const sp = put({
    xs: [-1.6, 1.6], zs: [1.6, -1.6], platH: 0.45, platOut: 0.8, colTop: 3.4, overhang: 1.4, rise: 2.5, G: 9, lift: 0.5, liftLen: 2.4,
    front: "open", back: "open", sides: "open", dark: false, steps: 0, plaque: "御碑",
  }, [-12.5, 50.5], 1);
  sp.group.add(mesh(merge([box(1.5, 0.5, 0.9, 0, 0.7, 0), box(1.05, 2.3, 0.26, 0, 2.1, 0), box(1.25, 0.45, 0.4, 0, 3.4, 0)]), M.stone));

  // ---- Terraces: a stone mass, paving on top, a parapet along the front, stairs on the axis ----
  const stone = [], paving = [];
  LEVELS.forEach((L, i) => {
    const y0 = i ? LEVELS[i - 1].y : 0, rise = L.y - y0, st = stairGeo(L.stair, rise);
    const bottom = i === 2 ? 4 : y0 - 0.2 < 0 ? 0 : y0 - 0.2;
    stone.push(box(L.x * 2, L.y - bottom, L.zS - L.zN, 0, (L.y + bottom) / 2, (L.zS + L.zN) / 2), st.geo.translate(0, y0, L.zS));
    for (const sx of [-1, 1]) { const w = L.x - L.stair / 2 - 0.42; stone.push(box(w, 0.95, 0.26, sx * (L.x - w / 2), L.y + 0.475, L.zS - 0.13)); }
    paving.push({ level: i + 1, y: L.y + 0.012, x: L.x, zS: L.zS, zN: L.zN });
    walk.ramps.push({ x0: -L.stair / 2 + 0.3, x1: L.stair / 2 - 0.3, z0: L.zS - 0.4, z1: L.zS + st.run, base: y0, h: rise, low: [0, L.zS + st.run], high: [0, L.zS] });
    walk.solids.push({ x0: -60, x1: 60, z0: L.zS - 0.3, z1: L.zS + 0.5 });
    if (i < 2) for (const sx of [-1, 1]) walk.solids.push({ x0: sx > 0 ? L.stair / 2 - 0.3 : -L.stair / 2 - 0.9, x1: sx > 0 ? L.stair / 2 + 0.9 : -L.stair / 2 + 0.3, z0: L.zS, z1: L.zS + st.run });
    shade[i].push({ x0: -L.x, x1: L.x, z0: L.zN, z1: L.zS });
  });
  walk.solids.push({ x0: -60, x1: 60, z0: HILL.zN, z1: HILL.zS - 0.05 });   // the hillside itself
  {   // the approach: lower landing, a flight west to the half-way pavilion, a turn, a flight north to the forecourt
    const A = APPROACH, yA = -A.rise, yB = -A.rise - A.rise2, pad = 0.3;
    stone.push(stairGeo(A.w, A.rise).geo.translate(0, yA, A.top),
      stairGeo(A.zA1 - A.zA0 - 0.6, A.rise2).geo.rotateY(Math.PI / 2).translate(A.xTurn, yB, A.zMid),
      box(A.xTurn + A.w / 2 + 0.4, 0.4, A.zA1 - A.zA0, (A.xTurn - A.w / 2 - 0.4) / 2 + 0.2, yA - 0.2, A.zMid),
      box(A.xB1 - A.xB0, 0.4, A.zA1 - A.zA0, (A.xB0 + A.xB1) / 2, yB - 0.2, A.zMid));
    walk.ramps.push({ x0: -A.w / 2 + pad, x1: A.w / 2 - pad, z0: A.top - 0.4, z1: A.zA0, base: yA, h: A.rise, low: [0, A.zA0], high: [0, A.top] },
      { x0: A.xTurn - 0.2, x1: A.xB0, z0: A.zA0 + 0.6, z1: A.zA1 - 0.6, base: yB, h: A.rise2, low: [A.xB0, A.zMid], high: [A.xTurn, A.zMid] });
    walk.decks.push({ x0: -A.w / 2 + pad, x1: A.xTurn - 0.2, z0: A.zA0 - 0.5, z1: A.zA1 - pad, h: yA }, { x0: A.xB0, x1: A.xB1 - pad, z0: A.zA0 + pad, z1: A.zA1 - pad, h: yB });
    walk.solids.push({ x0: -80, x1: 80, z0: A.top + 0.3, z1: A.end + 6 });
    // The half-way pavilion, open on all sides: somewhere to stop and look back down through the grove.
    put({
      xs: [-1.5, 1.5], zs: [1.5, -1.5], platH: 0.3, platOut: 0.8, colTop: 3.0, overhang: 1.3, rise: 2.3, G: 9, lift: 0.5, liftLen: 2.2,
      brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 0, walkAll: true, plaque: "半山亭",
    }, [6.6, A.zA0 - 2.75], 0, 0, yA);
  }
  root.add(mesh(merge(stone), M.stone));

  // Rows of tea across the last slope, following the hill, as they do beside the highest hall.
  {
    const rows = [], w = 21; let s = 31; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let z = HILL.zS - 2.0; z > HILL.zN + 0.8; z -= 1.45) for (const sx of [-1, 1]) {
      const x = sx * (TOP.stair / 2 + 1.6 + w / 2);
      const g = new THREE.CapsuleGeometry(0.5, w, 4, 10, 40).rotateZ(Math.PI / 2).scale(1, 0.82, 1.1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), p.getY(i) + (rnd() - 0.5) * 0.12, p.getZ(i) + (rnd() - 0.5) * 0.12);   // clipped by hand, not by machine
      rows.push(g.translate(x, terrain(x, z) + 0.33, z));
    }
    root.add(mesh(merge(rows), M.tea, { cast: false }));
  }

  // ---- Walls ----
  const body = [[], [], [], []], ridge = [], capPos = [], capUv = [], capIdx = [], T = 0.42;
  function wall(x0, z0, x1, z1, lvl = 0, H = SITE.wallH) {
    const y = lvl ? LEVELS[lvl - 1].y : 0, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    body[lvl].push(box(alongX ? len : T, H, alongX ? T : len, (x0 + x1) / 2, y + H / 2, (z0 + z1) / 2));
    ridge.push(box(alongX ? len : 0.16, 0.14, alongX ? 0.16 : len, (x0 + x1) / 2, y + H + 0.5, (z0 + z1) / 2));
    for (const s of [-1, 1]) {   // two tiled slopes
      const b = capPos.length / 3;
      for (const [l, yy, o] of [[0, H + 0.46, 0], [len, H + 0.46, 0], [len, H + 0.1, s * 0.62], [0, H + 0.1, s * 0.62]]) {
        capPos.push(alongX ? Math.min(x0, x1) + l : x0 + o, y + yy, alongX ? z0 + o : Math.min(z0, z1) + l); capUv.push(l, o === 0 ? 0.72 : 0);
      }
      capIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const r = { x0: Math.min(x0, x1) - (alongX ? 0 : T / 2), x1: Math.max(x0, x1) + (alongX ? 0 : T / 2), z0: Math.min(z0, z1) - (alongX ? T / 2 : 0), z1: Math.max(z0, z1) + (alongX ? T / 2 : 0) };
    shade[lvl].push(r);
    walk.solids.push({ x0: r.x0 - 0.45, x1: r.x1 + 0.45, z0: r.z0 - 0.45, z1: r.z1 + 0.45 });
  }
  const X = SITE.x;
  wall(-X, SITE.zS, -10.9, SITE.zS); wall(10.9, SITE.zS, X, SITE.zS);
  for (const sx of [-1, 1]) {
    wall(sx * X, T1.zS, sx * X, SITE.zS); wall(sx * X, T1.zN, sx * X, T1.zS, 1); wall(sx * X, T2.zN, sx * X, T2.zS, 2);
    wall(sx * X, T2.zN, sx * (TOP.stair / 2 + 0.6), T2.zN, 2);                      // the back of the terrace, open where the stair climbs
    wall(sx * TOP.x, TOP.zN, sx * TOP.x, TOP.zS, 3, 1.15); wall(sx * TOP.x, TOP.zS, sx * (TOP.stair / 2 + 0.6), TOP.zS, 3, 1.15);   // a low wall round the summit
  }
  wall(-TOP.x, TOP.zN, TOP.x, TOP.zN, 3, 1.15);
  body.forEach((b, i) => { if (b.length) root.add(mesh(merge(b), M.plaster(i ? LEVELS[i - 1].y : 0))); });
  root.add(mesh(tiles(capPos, capUv, capIdx), M.tile), mesh(merge(ridge), M.stone));

  // The screen wall facing the gate, where the two old paths up the mountain meet.
  {
    const z = 55, w = 11, h = 4.2;
    root.add(mesh(merge([box(w, h, 0.7, 0, h / 2, z)]), M.plaster(0)), mesh(merge([box(w + 0.5, 0.5, 1.0, 0, 0.25, z), box(w + 0.7, 0.16, 1.2, 0, h + 0.5, z)]), M.stone));
    const cp = [], cu = [], ci = [];
    for (const s of [-1, 1]) { const b = cp.length / 3; for (const [l, yy, o] of [[0, h + 0.5, 0], [w + 0.8, h + 0.5, 0], [w + 0.8, h + 0.05, s * 0.85], [0, h + 0.05, s * 0.85]]) { cp.push(-w / 2 - 0.4 + l, yy, z + o); cu.push(l, o === 0 ? 0.95 : 0); } ci.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    root.add(mesh(tiles(cp, cu, ci), M.tile));
    for (const s of [-1, 1]) { const p = makePlaque("双径归堂"); p.scale.setScalar(2.3); p.position.set(0, 2.3, z + s * 0.39); if (s > 0) p.rotation.y = Math.PI; root.add(p); }
    walk.solids.push({ x0: -w / 2 - 0.7, x1: w / 2 + 0.7, z0: z - 0.9, z1: z + 0.9 });
    shade[0].push({ x0: -w / 2, x1: w / 2, z0: z - 0.35, z1: z + 0.35 });
  }

  // Stone lanterns in pairs along the axis, each with a flame.
  const lanternStone = [];
  for (const [lx, lz, lvl] of [[3.2, 46.5, 0], [3.4, 27, 0], [5.0, 1.2, 0], [3.9, T1.zS - 4.5, 1], [3.6, T2.zS - 2.4, 2], [3.0, TOP.zS - 1.7, 3]]) for (const sx of [-1, 1]) {
    const y = lvl ? LEVELS[lvl - 1].y : 0;
    lanternStone.push(lantern().translate(sx * lx, y, lz));
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.flame); f.position.set(sx * lx, y + 1.36, lz); root.add(f);
    walk.solids.push({ x0: sx * lx - 0.5, x1: sx * lx + 0.5, z0: lz - 0.5, z1: lz + 0.5 });
    shade[lvl].push({ x0: sx * lx - 0.3, x1: sx * lx + 0.3, z0: lz - 0.3, z1: lz + 0.3 });
  }
  root.add(mesh(merge(lanternStone), M.stone));

  // ---- The main hall can be entered ----
  const doorZ = mz + main.frontZ + 0.55;
  const hall = {
    box: new THREE.Box3(new THREE.Vector3(-main.plat.x1, 0, mz + main.zB), new THREE.Vector3(main.plat.x1, 16, mz + main.zF + main.run)),
    foot: new THREE.Vector3(0, 0, mz + main.zF + main.run + 0.4),
    door: new THREE.Vector3(0, 0, doorZ),
    inside: (x, z) => Math.abs(x) < 1.35 && z < doorZ + 0.25 && z > doorZ - 0.6,
    out: [0, doorZ + 0.6],
  };

  // ---- Named views: one per thing worth looking at. The screenshot tool renders each of them. ----
  const A = APPROACH;
  const views = {
    arrive: [A.xB1 - 1.6, A.zMid, -Math.PI / 2, 0.2], halfway: [1.5, A.zMid + 0.6, 0.9, 0.12], stair: [0, A.zA0 - 0.6, 0, 0.3],
    forecourt: [10.5, 60, -0.42, 0.07], screen: [3, 47.5, Math.PI - 0.3, 0.1], stele: [-4, 52, -1.25, 0.12], gate: [0, 49.5, 0, 0.2],
    court: [0, 33, 0, 0.1], bell: [10, 34, 1.15, 0.2], drum: [-10, 34, -1.15, 0.2], hall: [9.5, 17, -0.5, 0.14], plaque: [0, 6, 0, 0.5],
    teahouse: [-5, 16, -1.35, 0.1], chan: [5, 16, 1.35, 0.1], behind: [19, -22, 0.4, 0.14], terrace: [0, T1.zS + 5.6, 0, 0.25],
    library: [0, T1.zS - 2.5, 0, 0.22], well: [9.5, T1.zS - 5.5, 1.15, 0.08], guanyin: [0, T2.zS + 5, 0, 0.22], climb: [0, T2.zN + 1, 0, 0.45],
    tea: [0, HILL.zS - 12, 0.6, 0.12], summit: [0, TOP.zS + 9, 0, 0.42], lookback: [0, topZ + 7.5 + 0.8, Math.PI, -0.2],
  };

  return { root, walk, shade, paving, hall, views, strikers, start: views.arrive, censer: new THREE.Vector3(0, 0, 13), sunFocus: [0, -25], summitPorch: [0, topZ + 7.5 + 0.8] };
}

// ---- Furnishings ----
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// A stone lantern: lotus base, shaft, an open chamber for the flame, a hexagonal cap.
function lantern() {
  const parts = [
    lathe([[0, 0], [0.42, 0], [0.42, 0.12], [0.3, 0.2], [0.16, 0.3], [0.14, 0.95], [0.2, 1.02], [0.36, 1.1], [0.38, 1.18], [0, 1.18]], 12),
    lathe([[0, 1.56], [0.46, 1.56], [0.5, 1.61], [0.3, 1.82], [0.1, 1.95], [0.07, 2.1], [0, 2.17]], 6),
  ];
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(0.06, 0.4, 0.06, a * 0.2, 1.37, b * 0.2));
  return merge(parts);
}

// A bronze bell hung from a cross beam, with the log that strikes it slung beside it.
function bell(M, t) {
  const g = new THREE.Group(), y0 = t.platH + 1.1, beamY = t.colTop - 0.55;
  const body = mesh(merge([
    lathe([[0.64, 0], [0.61, 0.07], [0.53, 0.3], [0.48, 0.8], [0.46, 1.25], [0.41, 1.5], [0.26, 1.68], [0.08, 1.75], [0, 1.75]], 28).translate(0, y0, 0),
    new THREE.TorusGeometry(0.12, 0.035, 8, 14).translate(0, y0 + 1.83, 0),
    new THREE.CylinderGeometry(0.025, 0.025, beamY - y0 - 1.9, 6).translate(0, (beamY + y0 + 1.9) / 2, 0),
  ]), M.bronze);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20).rotateX(Math.PI / 2).translate(0, y0 + 0.03, 0), M.dark.clone());
  inside.material.side = THREE.DoubleSide;
  const frame = mesh(merge([box(3.6, 0.24, 0.24, 0, beamY, 0), box(0.24, 0.24, 3.6, 0, beamY - 0.02, 0)]), M.woodX);
  const log = mesh(merge([
    new THREE.CylinderGeometry(0.09, 0.09, 1.7, 10).rotateX(Math.PI / 2).translate(0, y0 + 0.35, 1.55),
    new THREE.CylinderGeometry(0.012, 0.012, beamY - y0 - 0.4, 5).translate(0, (beamY + y0 + 0.4) / 2, 1.0),
    new THREE.CylinderGeometry(0.012, 0.012, beamY - y0 - 0.4, 5).translate(0, (beamY + y0 + 0.4) / 2, 2.1),
  ]), M.woodZ);
  g.add(body, inside, frame, log);
  return { group: g, hit: body, swing: log };
}

// A barrel drum on a timber stand, its face toward the court.
function drum(M, t) {
  const g = new THREE.Group(), cy = t.platH + 1.75;
  const barrel = mesh(lathe([[0.8, -0.68], [0.9, -0.4], [0.95, 0], [0.9, 0.4], [0.8, 0.68]], 28).rotateX(Math.PI / 2).translate(0, cy, 0), M.lacquer);
  const skins = mesh(merge([new THREE.CircleGeometry(0.8, 28).translate(0, cy, 0.685), new THREE.CircleGeometry(0.8, 28).rotateY(Math.PI).translate(0, cy, -0.685)]), M.hide);
  const stand = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) stand.push(box(0.14, cy - t.platH - 0.3, 0.14, sx * 0.72, (cy + t.platH - 0.3) / 2, sz * 0.5));
  for (const sz of [-1, 1]) stand.push(box(1.7, 0.14, 0.14, 0, cy - 0.78, sz * 0.5), box(1.7, 0.12, 0.12, 0, t.platH + 0.35, sz * 0.5));
  for (const sx of [-1, 1]) stand.push(box(0.12, 0.12, 1.1, sx * 0.72, t.platH + 0.35, 0));
  g.add(barrel, skins, mesh(merge(stand), M.woodX));
  return { group: g, hit: skins, swing: null };
}

// ---- Walking over the plan ----
const terrainLevel = (x, z) => terrain(x, z);
export function createWalker(site) {
  const { solids, decks, ramps } = site.walk;
  const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  function carved(x, z) {   // a floor or stair of a building or terrace, if you are on one
    for (const d of decks) if (inRect(d, x, z)) return d.h;
    for (const r of ramps) if (inRect(r, x, z)) {
      const dx = r.high[0] - r.low[0], dz = r.high[1] - r.low[1];
      return (r.base || 0) + r.h * Math.min(1, Math.max(0, ((x - r.low[0]) * dx + (z - r.low[1]) * dz) / (dx * dx + dz * dz)));
    }
    return null;
  }
  function level(x, z) { if (z > SITE.fore + 0.3) return terrainLevel(x, z); for (const L of LEVELS) if (Math.abs(x) < L.x && z < L.zS && z > L.zN) return L.y; return 0; }
  return {
    heightAt(x, z) { const c = carved(x, z); return c === null ? level(x, z) : c; },
    onGround: (x, z) => carved(x, z) === null,
    blocked(x, z) {
      if (carved(x, z) !== null) return false;
      if (Math.abs(x) > SITE.x + 8 || z < SITE.zN || z > APPROACH.end) return true;
      for (const s of solids) if (inRect(s, x, z)) return true;
      return false;
    },
  };
}
