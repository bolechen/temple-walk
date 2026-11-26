// A Song-style timber building from a handful of numbers: platform, columns, beams, bracket sets,
// infill, and a curved tiled roof. Built in local space: centred on the origin, front facing +z.
// Halls, gate houses, towers and covered walks are all this function with different parameters.
import * as THREE from "three";
import { box, smooth, plain, merge, mesh, tube, stairGeo, stairProfile, STAIR, BODY, CHEEK, footAt } from "./geo.js";
import { makePlaque } from "./plaque.js";

// At a hall's open door he comes this near the line of its leaves before he is inside: his own width and a finger more.
export const DOOR = Object.freeze({ reach: BODY + 0.02, half: 1.0 - BODY - 0.01 });
// How much light a bracket set's face turned to the court takes back from the paving and the platform, against the
// light of the open sky (1): a little more, for pale stone in front of it and no sky to be seen past the eave (#212).
export const EAVE_BOUNCE = 1.7;
// How far out from the column line the eave purlin lies, on the last arm of the bracket sets.
export const PURLIN = 0.88;
// How far out from the column line the slanting arm of a bracket set shows its beak (for a cai of 0.21): the end of a box 1.5 long, leaning 0.4, centred 0.6 out.
export const BEAK = 0.6 + 0.75 * Math.cos(0.4) + 0.065 * Math.sin(0.4);
// A balcony under an upper storey: how tall its bracket sets stand, how far they step out, how tall the board hung
// round its edge is (two timbers), and what the plate under the sets and the floor over them add to the height.
export const PING = Object.freeze({ sets: 0.62, reach: 0.6, board: 0.42, floor: 0.58, lift: 1.2 });   // (lift: sets and floor at the 0.21 grade, which a balcony walked round on the ring below keeps)
// The sitting bench of an open pavilion (#479), in metres, from the Yingzao Fashi's sill-bench (juan 7, diaochuang lankan, the board "kanmian": its board
// 1.8–2.0 chi high, 0.7 of that wide, 0.15 of it thick; a chi taken as 0.31 m, unchecked) with its single balustrade (juan 8, the single goulan:
// the hand rail 0.9 of the board's height over it). The structural review's figures, in docs/t00/SOURCES.md: "seat" (`top`), "depth"
// and "thick" are the text, the rail's height is worked from it, the posts' 0.15 section is ours. `back` is how far the seated body
// is drawn off the rail, `seatWidth` the most one seat takes of a bay.
export const BENCH = Object.freeze({ top: 0.58, depth: 0.4, thick: 0.09, gap: 0.03, seatWidth: 1.2, back: 0.05, rail: 0.52, post: 0.15, legs: 0.07, sill: 0.1 });
// A hair, in metres: where two timbers would otherwise end on one plane, one stops this far short (#688).
const SHY = 0.003;
const DEFAULTS = {
  xs: [-6.7, -2.5, 2.5, 6.7],   // column lines across the front
  zs: [5.4, 1.8, -1.8, -5.4],   // column lines front to back (front first)
  platH: 0.9, platOut: 1.6,     // platform height and how far it reaches beyond the columns
  platBase: 0,                  // where the platform starts: above 0 for an upper storey standing on a roof
  ground: 0,                    // height of the terrace the building stands on (for weathering that follows the ground)
  colTop: 4.08,                 // column head above the platform
  overhang: 2.4,                // eave beyond the columns
  rise: 5.2,                    // how high the ridge stands over the eave purlins (the plan works it out from the span: `ju` in site.js); on a tent roof, eave to peak
  crest: 0,                     // the size its ridge and ridge ornaments are cut to, by the building's rank (0: by its rise)
  cai: 0.21,                    // the depth of its standard timber, by its rank (Yingzao Fashi, juan 4): brackets, tie beams, columns and rafters are all cut to it
  ping: false,                  // an upper storey one can walk round: it stands on a balcony of bracket sets (pingzuo), not straight on the roof below
  skirt: false,                 // a skirt roof: another storey stands on it, and it rises one in two to that storey's wall
  G: 3.3,                       // depth of the end slopes: 0 = plain gable, >= half depth = pyramid
  lift: 0.5, liftLen: 3.6,      // corner upturn and how far along the eave it reaches
  brackets: true,
  timber: false,                // close the bays that are not doors or windows in planks, not lime (a gate)
  front: "lattice",             // lattice | pass | wall | open
  back: "wall",                 // wall | pass | open
  sides: "wall",                // wall | open
  dark: true, lamps: true,      // a dark interior behind the front, with two lamps far back
  steps: 4.6, stepsBack: 0,     // width of the stairs, 0 for none
  stepsBackAt: null,            // where the back stairs come down, as x across the building (a flight to each); on the middle when not given
  walkAll: false,               // the whole platform is open floor (covered walks)
  plaque: "",                   // name board over the front: a string, or { text, vertical, gold }
  rail: false,                  // a white stone balustrade round the platform
  pingRing: null,               // a balcony standing on the column ring of the storey below (its column lines across), not on its own
  bench: null,                  // sides of an open pavilion that carry a sitting bench between the columns: "f" "b" "l" "r" (#479)
  loft: "",                     // an upper storey whose balcony is walked round (its name: the walker counts it only while he is up there)
};

export function buildHall(M, opts) {
  const p = { ...DEFAULTS, ...opts };
  const K = p.cai / 0.21, PUR = PURLIN * K;   // every timber of the frame was first drawn for a cai of 0.21 m, and is scaled from that
  const { xs, zs } = p, nx = xs.length - 1, X = xs[nx], Z = zs[0], ZB = zs[zs.length - 1];
  const COL_TOP = p.platH + p.colTop, PLATE_TOP = COL_TOP + 0.12;
  const EX = X + p.overhang, EZ = Z + p.overhang;
  const G = Math.min(p.G, EZ), gx = EX - G, lift = G > 0.05 ? p.lift : 0;
  const zF = Z + p.platOut, zB = ZB - p.platOut, PX = X + p.platOut;

  // The roof's section, as height over the eave's edge at a distance `d` in from it (Yingzao Fashi, juan 5, on raising
  // and folding a roof). A hall's roof is folded, not bent: from the eave purlin on the bracket sets to the ridge it is
  // straight from purlin to purlin, each fall steeper than the one below (the first purlin under the ridge is let down
  // a tenth of the whole rise below the straight line, the next a twentieth below the line from there, and so on), and
  // beyond the eave purlin the rafters run on out along the lowest fall. A skirt roof under an upper storey rises one
  // in two. A tent roof, over a pavilion or a tower, keeps its hollow curve, and its peak stands half its
  // span above the eave purlins (juan 5, on pointed pavilions).
  const tent = !p.skirt && p.G >= EZ, PURLIN_IN = p.brackets ? p.overhang - PUR : p.overhang, clampD = (d) => Math.min(Math.max(d, 0), EZ);
  let profile;
  // (a tent roof's `rise` is, like a hall's, from its eave purlins to its peak; the hollow curve is drawn from the eave's edge)
  if (tent) { const whole = p.rise / (1 - Math.pow(PURLIN_IN / EZ, 1.38)); profile = (d) => whole * Math.pow(clampD(d) / EZ, 1.38); }
  else if (p.skirt) profile = (d) => 0.5 * clampD(d);
  else {
    const half = EZ - PURLIN_IN, n = Math.max(2, Math.ceil(half / 1.86)), seg = half / n, h = new Array(n + 1).fill(0); h[n] = p.rise;
    for (let k = n - 1; k >= 1; k--) h[k] = (h[k + 1] * k) / (k + 1) - p.rise / (10 * 2 ** (n - 1 - k));
    const s0 = h[1] / seg;
    profile = (d) => { d = clampD(d); if (d <= PURLIN_IN) return s0 * d; const u = Math.min(n - 1e-9, (d - PURLIN_IN) / seg), k = Math.floor(u); return s0 * PURLIN_IN + h[k] + (h[k + 1] - h[k]) * (u - k); };
  }
  // The tiles lie on the eave purlin, so the eave's edge hangs as far below it as the lowest fall carries it.
  const EAVE_Y = tent ? PLATE_TOP + (p.brackets ? 0.75 * K : 0.2) : PLATE_TOP + 1.05 * K - profile(PURLIN_IN), RISE = profile(EZ), CREST = p.crest || RISE;
  function roofY(x, z, eps = 0) {
    const dz = EZ - Math.abs(z), dx = EX - Math.abs(x) + eps;
    const d = dx <= G ? Math.min(dz, dx) : dz;                 // beyond G the end slope stops: that step is the gable
    const t = Math.max(0, 1 - Math.max(dz, dx) / p.liftLen);
    return EAVE_Y + profile(d) + lift * t * t * (1 - smooth(0, 2.6, Math.min(dz, dx)));
  }
  // Darker the higher a surface sits beneath the roof.
  const ao = (x, y, z) => 1 - smooth(-0.4, 1.6, Math.min(EX - Math.abs(x), EZ - Math.abs(z))) * smooth(EAVE_Y - 2.7, EAVE_Y + 0.3, y) * 0.58;
  // The bracket sets are shut off from the sky by the eave, but not from the court: an arm's underside and the faces
  // turned out toward the paving see the stone and the pale platform in front of them, and take light back from them
  // (issue #212; before, every face up there was darkened alike and the sets showed as black cut-outs against the
  // limed band). Only the faces turned up to the eave boards, or in to the wall, keep the dark the roof gives them.
  // It scales the hour's own light from the ground, so at night and at dusk the sets stay as dark as the ground is.
  const bracketAO = (x, y, z, nx, ny, nz) => {
    const base = ao(x, y, z), side = EX - Math.abs(x) < EZ - Math.abs(z), out = side ? nx * Math.sign(x) : nz * Math.sign(z);
    const sees = Math.min(1, Math.max(0, 0.45 - 0.6 * ny + 0.5 * Math.max(0, out))), under = (1 - base) / 0.58;   // how deep under the eave: nothing changes where the roof does not reach
    return base + (EAVE_BOUNCE - base) * sees * under;
  };

  const g = new THREE.Group();
  const backAt = p.stepsBack ? (p.stepsBackAt || [0]) : [];   // the back stairs, by the x of each
  // what of a line along the back from a to b is not where a back stair comes up, widened by `pad` either side of each
  const besideBack = (a, b, pad) => { const out = []; let x = a;
    for (const bx of [...backAt].sort((u, v) => u - v)) { const l = bx - p.stepsBack / 2 - pad, r = bx + p.stepsBack / 2 + pad; if (l > x) out.push([x, Math.min(l, b)]); x = Math.max(x, r); }
    if (b > x) out.push([x, b]); return out.filter(([u, v]) => v - u > 1e-6); };
  // Each mesh says how its occlusion was baked (for the tests): `eave` lit back from the court by `bracketAO`, `position`
  // by `ao` alone, `own` by something the caller gave.
  const add = (geo, mat, o = {}) => { const m = mesh(geo, mat, { ao, ...o }); m.userData.ao = o.ao === bracketAO ? "eave" : "ao" in o ? "own" : "position"; g.add(m); return m; };

  // ---- Platform and stairs ----
  const run = stairGeo(1, p.platH).run, stairs = (w, place) => stairGeo(w, p.platH, { place }).geo;
  {
    const parts = [box(PX * 2, p.platH - p.platBase, zF - zB, 0, (p.platH + p.platBase) / 2, (zF + zB) / 2)];
    const flights = [];
    // Each flight is also kept as where it stands in the building (`userData.flights`), so that its cheeks' feet can be
    // looked under (#272).
    const at = (g.userData.flights = []), flight = (w, m) => { at.push({ w, rise: p.platH, sides: [-1, 1], m }); flights.push(stairs(w, m)); };
    if (p.steps) flight(p.steps, new THREE.Matrix4().makeTranslation(0, 0, zF));
    for (const bx of backAt) flight(p.stepsBack, new THREE.Matrix4().makeTranslation(bx, 0, zB).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
    if (flights.length) add(merge(flights), p.platBase > 0 ? M.woodX : M.steps, { ao: null });   // steps are dressed stone, not the platform's rubble
    add(merge(parts), p.platBase > 0 ? M.woodX : M.stone, { ao: null });   // an upper floor is a timber gallery, not a stone platform
    // The platform's edge: a course of long slabs, cut from single stones, standing a hand proud of the wall below.
    if (p.platBase <= 0 && p.platH >= 0.4) {
      const t = 0.19, o = 0.07, y = p.platH - t / 2 + 0.004, half = p.steps ? p.steps / 2 : 0, cap = [box(0.6, t, zF - zB + o * 2, -PX - o + 0.3, y, (zF + zB) / 2), box(0.6, t, zF - zB + o * 2, PX + o - 0.3, y, (zF + zB) / 2)];
      // Along the back, broken wherever a stair comes up, the middle one too: the slab used to run on over its head and stand
      // 7 cm out over the top step (#288), as the front course has always stopped at the flight.
      // (It stops a hair outside the treads' edge, inside the cheek, whose face toward the treads its end shared, #688.)
      for (const [a, b] of besideBack(-PX - o, PX + o, SHY)) cap.push(box(b - a, t, 0.6, (a + b) / 2, y, zB + 0.3 - o));
      for (const sx of [-1, 1]) { const h0 = half ? half + SHY : 0; cap.push(box(PX + o - h0, t, 0.6, sx * (PX + o + h0) / 2, y, zF - 0.3 + o)); }
      add(merge(cap), M.monolith, { ao: null });
      // A tall platform is a sumeru base: a foot and a head that stand proud, a waist drawn in between them, and
      // small posts dividing the waist into panels.
      if (p.platH >= 1.2) {
        const su = [], h = p.platH, ring = (out, y0, y1) => { const w = PX + out, zf = zF + out, zb = zB - out, hh = y1 - y0, yy = (y0 + y1) / 2;
          su.push(box(w * 2, hh, 0.12, 0, yy, zb + 0.06), box(0.12, hh, zf - zb, -w + 0.06, yy, (zf + zb) / 2), box(0.12, hh, zf - zb, w - 0.06, yy, (zf + zb) / 2));
          for (const sx of [-1, 1]) su.push(box(w - half, hh, 0.12, sx * (w + half) / 2, yy, zf - 0.06)); };
        ring(0.16, 0, 0.2); ring(0.09, 0.2, 0.32); ring(0.09, h - 0.5, h - 0.38); ring(0.14, h - 0.38, h - 0.2);
        const post = (x, z) => su.push(box(0.16, h - 0.82, 0.16, x, (0.32 + h - 0.5) / 2, z));
        for (let x = -PX; x <= PX + 1e-6; x += (PX * 2) / Math.round((PX * 2) / 1.7)) { if (backAt.every((bx) => Math.abs(x - bx) > p.stepsBack / 2 + 0.3)) post(x, zB - 0.03); if (Math.abs(x) > half + 0.3) post(x, zF + 0.03); }
        for (let z = zB; z <= zF + 1e-6; z += (zF - zB) / Math.round((zF - zB) / 1.7)) { post(-PX - 0.03, z); post(PX + 0.03, z); }
        add(merge(su), M.monolith, { ao: null });
      }
    }
  }
  const rails = [];   // each run of railing as the ground it stands on and how high it reaches (walk.rails)
  if (p.rail) {   // posts with caps, a top rail and a panel between, broken where the stairs arrive
    const parts = [], ends = (g.userData.railEnds = []), runs = (g.userData.railRuns = []), y = p.platH, inset = 0.16, gapF = p.steps ? p.steps / 2 + 0.5 : 0;
    const run = (ax, a, b, fixed) => {   // a line of railing along x (ax = "x") or z, from a to b
      // Round a gallery that is walked, each run has an odd number of bays: its middle, before the door and on the
      // axis of the view, is a panel to look over, not a post in the eye.
      let n = Math.max(1, Math.round((b - a) / 1.5)); if (p.loft && n % 2 === 0) n += (b - a) / n > 1.5 ? 1 : -1;
      const d = (b - a) / n; runs.push({ ax, a, b, fixed, n });
      for (const t of [a, b]) ends.push(ax === "x" ? [t, y, fixed] : [fixed, y, t]);   // where a run stops: at a corner, or where a stair breaks it
      const R = 0.12;   // the widest of it, the lotus bud on each post
      rails.push(ax === "x" ? { x0: a - R, x1: b + R, z0: fixed - R, z1: fixed + R, bottom: y, top: y + 1.29 } : { x0: fixed - R, x1: fixed + R, z0: a - R, z1: b + R, bottom: y, top: y + 1.29 });
      // The posts: eight-sided, each ending in a lotus bud. Between them, from the floor up: a sill, a panel, the
      // basin rail, a short strut in the middle of each bay, and the hand rail.
      for (let i = 0; i <= n; i++) { const t = a + i * d, px = ax === "x" ? t : fixed, pz = ax === "x" ? fixed : t;
        parts.push(new THREE.CylinderGeometry(0.085, 0.095, 1.0, 8).translate(px, y + 0.5, pz), new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.12, 0.03], [0.07, 0.06], [0.1, 0.12], [0.095, 0.19], [0.05, 0.26], [0, 0.29]].map(([r, hh]) => new THREE.Vector2(r, hh)), 8).translate(px, y + 1.0, pz));
        if (i < n) { const m = t + d / 2; parts.push(ax === "x" ? box(0.07, 0.2, 0.07, m, y + 0.74, fixed) : box(0.07, 0.2, 0.07, fixed, y + 0.74, m)); } }
      const mid = (a + b) / 2, len = b - a, bar = (hh, th, yy) => parts.push(ax === "x" ? box(len, hh, th, mid, y + yy, fixed) : box(th, hh, len, fixed, y + yy, mid));
      bar(0.1, 0.14, 0.05); bar(0.44, 0.05, 0.34); bar(0.08, 0.14, 0.6); bar(0.09, 0.1, 0.88);
    };
    const ex = PX - inset;
    if (gapF) { run("x", -ex, -gapF, zF - inset); run("x", gapF, ex, zF - inset); } else run("x", -ex, ex, zF - inset);
    for (const [a, b] of besideBack(-ex, ex, 0.5)) run("x", a, b, zB + inset);   // along the back, broken where each stair comes up
    run("z", zB + inset, zF - inset, -ex); run("z", zB + inset, zF - inset, ex);
    add(merge(parts), p.platBase > 0 ? M.woodX : M.monolith, { ao: null });   // a stone railing is the stone of its platform, not white marble
  }

  // ---- Columns ----
  let ping = null; const corners = [];   // the four corner beams, as built: where each starts and ends, its small beam, where its bell hangs
  const sets = [];   // where the bracket sets stand: on the column heads, and between them (`bay` says in which)
  const perimeter = [], COL_R = (p.colTop > 3.6 ? 0.27 : 0.2) * K;
  for (const x of xs) for (const z of zs) {
    const ox = x === xs[0] ? -1 : x === X ? 1 : 0, oz = z === Z ? 1 : z === ZB ? -1 : 0;
    if (ox || oz) perimeter.push({ x, z, ox, oz });
  }
  {
    const h = p.colTop - 0.25, r = COL_R;
    const shaft = new THREE.LatheGeometry([[r, 0], [r * 1.02, h * 0.15], [r, h * 0.55], [r * 0.93, h * 0.88], [r * 0.87, h]].map(([a, b]) => new THREE.Vector2(a, b)), 18).translate(0, p.platH + 0.25, 0);
    const drum = new THREE.LatheGeometry([[0, 0], [r * 1.5, 0], [r * 1.56, 0.05], [r * 1.33, 0.13], [r * 1.22, 0.22], [r * 1.1, 0.25], [0, 0.25]].map(([a, b]) => new THREE.Vector2(a, b)), 18).translate(0, p.platH, 0);
    add(merge(perimeter.map((c) => shaft.clone().translate(c.x, 0, c.z))), M.woodV);
    add(merge(perimeter.map((c) => drum.clone().translate(c.x, 0, c.z))), M.monolith, { ao: null });
  }

  // ---- Beams ----
  const bh = 0.36 * K, by = COL_TOP - bh / 2, topY = COL_TOP - bh;
  const bx = [], bz = [], ex = [], ez = [];   // the beams on the column heads and the plate over them stand under the eave with the sets, and are lit as they are
  // Where a beam along x meets one along z over a corner column, the two are laid side by side and not one through the other: a
  // crossing gives two faces on one plane (their tops, their undersides) that cannot be told apart at a distance (#655). The side
  // beam stops at the face of the front one, and the corner it no longer covers is filled by a small block of its own, so that the
  // timber is the same as it was and nothing is drawn twice. The plate over the heads does the same, its tail past the front plate
  // being a block of its own.
  for (const z of [Z, ZB]) {
    for (let i = 0; i < nx; i++) ex.push(box(xs[i + 1] - xs[i], bh, 0.2, (xs[i] + xs[i + 1]) / 2, by, z));
    ex.push(box(X * 2 + 0.7, 0.12, 0.5, 0, COL_TOP + 0.06, z));
  }
  for (const x of [xs[0], X]) {
    for (let i = 0; i < zs.length - 1; i++) {
      const last = i === zs.length - 2, a = zs[i] - (i === 0 ? 0.1 : 0), b = zs[i + 1] + (last ? 0.1 : 0);   // (the end at a corner column stops at the front beam's face)
      ez.push(box(0.2, bh, a - b, x, by, (a + b) / 2));
    }
    const sx = x < 0 ? -1 : 1;
    for (const [z, sz] of [[Z, 1], [ZB, -1]]) ez.push(box(0.1, bh, 0.1, x + sx * 0.05 + (sx > 0 ? 0 : 0), by, z - sz * 0.05));   // the corner the shortened beam left (the half of its width on the outer side of the column's centre line)
    ez.push(box(0.5, 0.12, Z - ZB - 0.5, x, COL_TOP + 0.06, (Z + ZB) / 2));
    for (const [z, sz] of [[Z, 1], [ZB, -1]]) ez.push(box(0.5, 0.12, 0.1, x, COL_TOP + 0.06, z + sz * 0.3));
  }
  add(merge(ex), M.woodX, { ao: bracketAO }); add(merge(ez), M.woodZ, { ao: bracketAO });

  // ---- Infill ----
  const walls = [], lat = [], boards = [], studs = [];
  // A bay closed in timber rather than lime: upright planks between stiles, a rail at the waist, as a gate is closed.
  const planked = (w, h, d, x, y, z, alongZ) => {
    const span = alongZ ? d : w, n = Math.max(3, Math.round(span / 0.3)), pw = span / n;   // each plank its own board, no two quite flush
    for (let k = 0; k < n; k++) { const o = -span / 2 + pw * (k + 0.5), t = 0.05 + 0.03 * ((k * 7) % 3) / 2; boards.push(alongZ ? box(t, h, pw - 0.012, x, y, z + o) : box(pw - 0.012, h, t, x + o, y, z)); }
    boards.push(alongZ ? box(0.03, h, d - 0.02, x, y, z) : box(w - 0.02, h, 0.03, x, y, z));   // a lining behind the planks, so no daylight shows between them
    for (const o of [-span / 2 + 0.06, span / 2 - 0.06]) boards.push(alongZ ? box(0.14, h, 0.12, x, y, z + o) : box(0.12, h, 0.14, x + o, y, z));
    for (const yy of [y - h / 2 + 0.09, y - h * 0.08, y + h / 2 - 0.09]) boards.push(alongZ ? box(0.15, 0.14, d, x, yy, z) : box(w, 0.14, 0.15, x, yy, z));
  };
  const sill = p.platH + 0.16, head = Math.min(sill + 2.86, topY - 0.5), hasTransom = topY - head > 0.4;
  // kind: 0 a door leaf (lattice over a panel), 1 a transom, 2 a window of upright bars
  // `code` says how brightly the bay behind this leaf glows at dusk and at night (windows.js); it rides in the whole
  // part of the leaf's u coordinate, sixteen to a leaf, so that it survives mergeStatic, which keeps only uv.
  const leafAt = (x0, x1, y0, y1, kind, z, flip, code = 0) => {
    const g2 = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    if (flip) g2.rotateY(Math.PI);
    g2.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
    const n = Math.max(1, Math.round((x1 - x0) / 1.05)), uv = g2.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n + code * 16, kind === 2 ? 201.25 + uv.getY(i) * 1.77 : (kind ? 100 : 0) + uv.getY(i) * (kind ? 0.7 : 3.02));
    lat.push(g2);
  };
  const mid = Math.floor(nx / 2);
  const windows = [];   // every lattice bay as built, with the glow it was given: what tests and tools read
  const face = (mode, z, sign) => {   // one long side of the building; sign = +1 front, -1 back
    if (mode === "open") return;
    const zz = z - sign * 0.03, flip = sign < 0, side = sign > 0 ? "front" : "back";
    for (let i = 0; i < nx; i++) {
      const x0 = xs[i] + 0.25, x1 = xs[i + 1] - 0.25, centre = i === mid;
      const lit = p.lit?.[side]?.[i] || [0, 0], code = lit[0] * 8 + lit[1], leaf = (a, b, c, d, kind, e, f) => leafAt(a, b, c, d, kind, e, f, code);
      if (mode === "lattice") {
        windows.push({ face: side, bay: i, dusk: lit[0], night: lit[1], door: Math.abs(i - mid) <= (nx >= 5 ? 1 : 0) || nx < 3, x0, x1, y0: sill, y1: topY, z: zz });
        // The middle bays are doors; the bays beyond them are windows of upright bars over a white sill wall.
        const door = Math.abs(i - mid) <= (nx >= 5 ? 1 : 0) || nx < 3;
        if (centre && p.dark) { leaf(x0, x0 + 1.05, sill, head, 0, zz, flip); leaf(x1 - 1.05, x1, sill, head, 0, zz, flip); }
        else if (door) leaf(x0, x1, sill, head, 0, zz, flip);
        else { walls.push(box(x1 - x0, 1.0, 0.16, (x0 + x1) / 2, sill + 0.5, z)); bx.push(box(x1 - x0, 0.12, 0.24, (x0 + x1) / 2, sill + 1.06, z)); leaf(x0, x1, sill + 1.12, head, 2, zz, flip); }
        if (hasTransom) leaf(x0, x1, head + 0.14, topY, 1, zz, flip);
        // Seven red, eight white: the row of pale dashes along every tie-beam.
        const dash = (x1 - x0 - 0.3 - 7 * 0.07) / 8; for (let k = 0; k < 8; k++) walls.push(box(dash, 0.07, 0.02, x0 + 0.15 + k * (dash + 0.07) + dash / 2, by + 0.02, z + sign * 0.105));
      } else if (mode === "pass" && centre) {
        if (p.timber && sign > 0) {   // the way through: a lintel with its four pegs, a sill to step over, two leaves standing open, lattice above
          const cx = (x0 + x1) / 2, w = x1 - x0, lw = w / 2 - 0.12, lh = head - p.platH - 0.26;
          bx.push(box(w, 0.22, 0.24, cx, head + 0.02, z), box(w, 0.05, 0.22, cx, p.platH + 0.025, z));   // the sill is worn low: feet do not pass through it
          for (let k = 0; k < 4; k++) boards.push(box(0.16, 0.16, 0.14, cx + (k - 1.5) * w * 0.2, head + 0.02, z + 0.16));
          for (const sx of [-1, 1]) {
            const hx = cx + sx * (w / 2 - 0.05); boards.push(box(0.07, lh, lw, hx, p.platH + 0.13 + lh / 2, z - 0.1 - lw / 2));
            for (let c = 1; c < 6; c++) boards.push(box(0.085, lh, 0.012, hx, p.platH + 0.13 + lh / 2, z - 0.1 - (lw * c) / 6));   // the seams between its boards
            for (const yy of [0.22, 0.5, 0.78]) boards.push(box(0.1, 0.1, lw, hx, p.platH + 0.13 + lh * yy, z - 0.1 - lw / 2));
            for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) studs.push(box(0.05, 0.07, 0.07, hx - sx * 0.05, p.platH + 0.55 + r * (lh - 0.9) / 4, z - 0.25 - c * (lw - 0.3) / 3));
          }
          if (hasTransom) leaf(x0, x1, head + 0.14, topY, 1, zz, flip);
        }
      } else if (!(mode === "pass" && centre)) {
        if (p.timber) { planked(x1 - x0, head - p.platH, 0, (x0 + x1) / 2, (head + p.platH) / 2, z);
          if (Math.abs(i - mid) === 1 && sign > 0) {   // the bays either side of the way through are doors too, kept shut: two leaves, a seam, rows of iron studs
            const cx = (x0 + x1) / 2, w = x1 - x0; boards.push(box(0.05, head - p.platH - 0.3, 0.16, cx, (head + p.platH) / 2, z));
            for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { const sx = cx + (c - 3.5) * (w - 0.5) / 8 + (c < 4 ? -0.06 : 0.06); studs.push(box(0.07, 0.07, 0.05, sx, p.platH + 0.55 + r * (head - p.platH - 1.0) / 4, z + 0.075)); }
          } if (hasTransom) leaf(x0, x1, head + 0.14, topY, 1, zz, flip); else boards.push(box(x1 - x0, topY - head, 0.07, (x0 + x1) / 2, (topY + head) / 2, z)); bx.push(box(x1 - x0, 0.14, 0.18, (x0 + x1) / 2, head + 0.07, z)); }
        else { walls.push(box(x1 - x0, topY - p.platH, 0.14, (x0 + x1) / 2, (topY + p.platH) / 2, z)); bx.push(box(x1 - x0 - 2 * SHY, 0.16, 0.2, (x0 + x1) / 2, p.platH + 1.5, z)); }   // (the rail stops a hair short of the wall's ends, whose plane its own ends shared, #688)
      }
    }
    if (mode === "lattice") bx.push(box(X * 2, 0.16, 0.2, 0, p.platH + 0.08, z), box(X * 2, 0.14, 0.18, 0, head + 0.07, z));
  };
  face(p.front, Z, 1); face(p.back, ZB, -1);
  if (p.sides === "wall") for (const x of [xs[0], X]) for (let i = 0; i < zs.length - 1; i++) {
    if (p.timber) { planked(0, topY - p.platH, zs[i] - zs[i + 1] - 0.5, x, (topY + p.platH) / 2, (zs[i] + zs[i + 1]) / 2, true); continue; }
    walls.push(box(0.14, topY - p.platH, zs[i] - zs[i + 1] - 0.5, x, (topY + p.platH) / 2, (zs[i] + zs[i + 1]) / 2));
    bz.push(box(0.2, 0.16, zs[i] - zs[i + 1] - 0.5 - 2 * SHY, x, p.platH + 1.5, (zs[i] + zs[i + 1]) / 2));
  }
  const underside = (d) => EAVE_Y + profile(d) - 0.17;
  // A gate's way through has a ceiling (#288): without one the eye, looking up from the passage, meets the roof boards from
  // below with no light on them, a single flat black. A plain small-squared ceiling on the plate, with a tie beam across
  // every bay and a long beam either side, is what a gate's passage shows.
  if (p.timber && p.front === "pass" && p.back === "pass") {
    const y = COL_TOP + 0.12, cell = 0.4, w = Z - ZB, ribs = [], panel = new THREE.PlaneGeometry(2 * X, w, Math.max(1, Math.round(2 * X)), Math.max(1, Math.round(w))).rotateX(Math.PI / 2).translate(0, y - 0.02, (Z + ZB) / 2);
    const uv = panel.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, panel.attributes.position.getX(i) / cell, 2000);   // a v of 1000 or more is the plain ground (unused by the `passage` material, which is plain boards)
    for (let i = 0; i <= nx; i++) ribs.push(box(0.22, 0.16, w, xs[i], y - 0.1, (Z + ZB) / 2));
    // (The small rails stop at the plate's inner face, 0.26 m in from each end, instead of running into it: their undersides lie in the
    // plate's own underside, and where they overlapped it the two fought, #655.)
    for (let x = xs[0]; x < X - 0.01; x += 0.9) ribs.push(box(0.07, 0.1, w - 0.52, x + 0.45, y - 0.07, (Z + ZB) / 2));
    // (Only the middle tie beam is a rib of its own. The two at the ends stood in the line of the lintel and the plate over it, the same
    // width, thickness and depth, so that their faces lay in one plane with those and fought them (#655); they were buried in
    // that timber, and drawing them added nothing.)
    ribs.push(box(2 * X, 0.2, 0.2, 0, y - 0.12, (Z + ZB) / 2));
    // (Overhead, 4.9 m up: nothing to stand on, and nothing he reaches, so it is left out of the baked floor (`bake: false`; the eye still keeps
    // out of it, as it must, or the camera backing out of the doorway would go through the boards and see the roof's bare underside again). In the
    // floor it moved the cells at the library's stair heads by a centimetre, ninety metres away: the bake bisected it to this panel and I did not run that to ground, #288.)
    add(panel, M.passage, { ao: () => 0.85 }).userData.bake = false; add(merge(ribs), M.beamX, { ao: () => 0.2, cast: false }).userData.bake = false;
  }
  if (p.brackets) {   // the white band between the bracket sets, all the way round
    const bandH = underside(p.overhang) - PLATE_TOP + 0.12, y = PLATE_TOP + bandH / 2;
    walls.push(box(X * 2, bandH, 0.1, 0, y, Z), box(X * 2, bandH, 0.1, 0, y, ZB), box(0.1, bandH, Z - ZB, xs[0], y, (Z + ZB) / 2), box(0.1, bandH, Z - ZB, X, y, (Z + ZB) / 2));
  }
  if (bx.length) add(merge(bx), M.woodX); if (bz.length) add(merge(bz), M.woodZ);
  if (boards.length) add(merge(boards), M.woodV);
  if (studs.length) add(merge(studs), M.iron, { cast: false });
  if (walls.length) add(footAt(merge(walls), p.platH + p.ground), M.plaster());
  if (lat.length) add(merge(lat), M.lattice, { cast: false });
  if (p.dark) {
    const d = Math.min(2.4, Z - ZB - 0.4);
    // (Without its front face: drawn from inside, BackSide, that face is never seen from the court; from in the doorway,
    // where the eye that follows him out may stand, it would hide him. #396)
    const dg = box(X * 2 - 0.3, topY - p.platH - 0.03, d, 0, p.platH + (topY - p.platH) / 2, Z - 0.1 - d / 2), di = Array.from(dg.index.array);
    di.splice(24, 6); dg.setIndex(di); dg.clearGroups();   // (BoxGeometry's faces go +x, -x, +y, -y, +z, -z, six indices each)
    const m = new THREE.Mesh(dg, M.interior(p.platH));
    m.userData.doorway = true; g.add(m);   // a hall that can be entered paints its own room here instead (doorway.js)
    // The front face the box lost is put back for the baked floor alone: without it the box is not closed, and the bake takes the floor
    // inside a closed solid for none, so the floor ran in at the door into the hollow hall (hall-funnel-349). Never drawn, and the eye's gathering skips it.
    const front = new THREE.Mesh(new THREE.PlaneGeometry(X * 2 - 0.3, topY - p.platH - 0.03).translate(0, p.platH + (topY - p.platH) / 2, Z - 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    front.userData.eye = false; front.userData.keep = true; g.add(front);
    // To the eye that follows him out of the door, the back of the dark is a wall: the dark is painted (a shader, which the
    // eye's gathering passes over), and behind it the hall is hollow, so the eye backed in through the open leaves into the
    // building (#391). It may stand in the dark, though, as far as its back: there it sees him framed in the door as he
    // comes out, where held at the leaves it was half a metre off and he was not drawn (#396). Sheets a hand apart, never
    // drawn nor stood on, as in the rooms' doorways (interior.js): one sheet with nothing behind it the eye would let pass
    // for a moment, as it does a column.
    const W = X * 2 - 0.3, H = topY - p.platH - 0.03, back = Z - 0.1 - d + 0.15, stop = new THREE.Mesh(merge(Array.from({ length: 11 }, (_, k) => new THREE.PlaneGeometry(W, H).translate(0, p.platH + H / 2, back - k * 0.12))), new THREE.MeshBasicMaterial());
    // The dark runs the whole width of the front, behind the shut bays as well as the open door: turned aside, the eye went
    // in through a shut leaf (a thin panel, which it lets pass as it does a column) and stood behind the leaves and the
    // window bays with the wall between it and him (#411's art review, the tea house dragged round 65°). Behind the shut
    // part of the front the dark is filled with sheets, and two stacks run front to back at the opening's edges, so the
    // eye keeps to the dark straight behind the door.
    const open = [xs[mid] + 0.25 + 1.05, xs[mid + 1] - 0.25 - 1.05], side = [];
    for (const [ex, out] of [[open[0], -1], [open[1], 1]]) for (let k = 0; k < 11; k++) side.push(new THREE.PlaneGeometry(d, H).rotateY(Math.PI / 2).translate(ex + out * k * 0.12, p.platH + H / 2, Z - 0.1 - d / 2));
    for (const [a, b] of [[-W / 2, open[0]], [open[1], W / 2]]) if (b - a > 0.05) for (let z = Z - 0.12; z > Z - 0.1 - d + 0.1; z -= 0.12) side.push(new THREE.PlaneGeometry(b - a, H).translate((a + b) / 2, p.platH + H / 2, z));
    stop.geometry = merge([stop.geometry, ...side]);
    stop.visible = false; stop.userData.walk = false; stop.userData.eye = "stop"; g.add(stop);
    if (p.lamps) for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.flame);
      f.position.set(sx * 1.1, p.platH + 1.2, Z - d + 0.1); f.userData.doorFlame = true; g.add(f);
    }
  }

  // ---- Bracket sets (dougong) ----
  if (p.brackets) {
    // One set, outward = +z, base at y = 0. From below it is an inverted, stepped trapezoid: the great block on the
    // column head, a short arm along the wall and a longer one over it, arms stepping outward with a small block
    // at every end, the slanting beak, and the last arm under the eave purlin. Arm ends are rounded off below.
    const arm = (len, y, z, along = "x", h = 0.21, t = 0.15) => {
      const L = len / 2, e = Math.min(0.2, len * 0.22), sh = new THREE.Shape([[-L, h], [L, h], [L, h * 0.5], [L - e * 0.5, h * 0.16], [L - e, 0], [-L + e, 0], [-L + e * 0.5, h * 0.16], [-L, h * 0.5]].map(([a, b]) => new THREE.Vector2(a, b)));
      const g2 = plain(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2)); if (along === "z") g2.rotateY(-Math.PI / 2);
      return g2.translate(0, y, z);
    };
    const dou = (x, y, z, w = 0.21) => box(w, 0.13, w, x, y + 0.065, z);
    const set = merge([
      box(0.46, 0.17, 0.46, 0, 0.195, 0), box(0.34, 0.11, 0.34, 0, 0.055, 0),                         // the great block, narrower at its foot
      arm(0.9, 0.28, 0), dou(-0.35, 0.49, 0), dou(0.35, 0.49, 0),                                      // the first arm along the wall
      arm(1.02, 0.28, 0.16, "z"), dou(0, 0.49, 0.6),                                                   // the first arm stepping out
      arm(1.32, 0.63, 0), dou(-0.55, 0.84, 0), dou(0.55, 0.84, 0),                                     // the long arm over it
      arm(0.9, 0.63, 0.6), dou(-0.35, 0.84, 0.6), dou(0.35, 0.84, 0.6),                                // an arm on the first step
      arm(1.5, 0.63, 0.3, "z"),
      new THREE.BoxGeometry(0.13, 0.16, 1.5).rotateX(0.4).translate(0, 0.6, 0.6),                      // the slanting arm whose beak shows under the eave
      arm(1.0, 0.8, 0.88),                                                                             // the last arm, under the purlin
    ]);
    /** @type {{ x: number, z: number, a: number, bay?: number }[]} */
    const spots = perimeter.map((c) => ({ x: c.x, z: c.z, a: Math.atan2(c.ox, c.oz) }));
    // Between the columns (Yingzao Fashi, juan 4, on setting out the sets: two in the middle bay, one in each of the others): two sets in the middle bay of a
    // face, one in every other. A middle bay too narrow for two to stand clear of each other (their long arms are
    // 1.32 m) keeps one: the single bay of a bell tower or a rest pavilion. A bay
    // too narrow even for one has none, and the sets on its two columns stand side by side: the small bays of a tower's upper storeys.
    const between = (line, i) => { const bays = line.length - 1, a = line[i], b = line[i + 1], w = Math.abs(b - a), n = w < 2 * 1.32 * K - 1e-6 ? 0 : bays % 2 === 1 && i === (bays - 1) / 2 && w / 3 >= 1.32 * K - 1e-6 ? 2 : 1; return Array.from({ length: n }, (_, k) => a + ((b - a) * (k + 1)) / (n + 1)); };
    for (const [z, a] of [[Z, 0], [ZB, Math.PI]]) for (let i = 0; i < nx; i++) for (const x of between(xs, i)) spots.push({ x, z, a, bay: i });
    for (const [x, a] of [[xs[0], -Math.PI / 2], [X, Math.PI / 2]]) for (let i = 0; i < zs.length - 1; i++) for (const z of between(zs, i)) spots.push({ x, z, a, bay: i });
    sets.push(...spots);
    set.scale(K, K, K);
    add(merge(spots.map((s) => set.clone().rotateY(s.a).translate(s.x, PLATE_TOP, s.z))), M.woodX, { ao: bracketAO });
    // A storey that is walked round stands on a balcony (Yingzao Fashi, juan 4, on the pingzuo): under its floor a ring
    // of bracket sets a step shorter than its own, one under every set above, on a plate of their own; round the
    // floor's edge a board twice a timber's depth (the wild-goose-wing board), and the railing inside that. The skirt
    // roof of the storey below comes in under the plate.
    if (p.ping && !p.pingRing) {
      const PH = PING.sets * K, y0 = p.platBase - PH, bd = PING.board * K;
      const low = merge([
        box(0.46, 0.17, 0.46, 0, 0.195, 0), box(0.34, 0.11, 0.34, 0, 0.055, 0),
        arm(0.9, 0.28, 0), dou(-0.35, 0.49, 0), dou(0.35, 0.49, 0),
        arm(1.02, 0.28, 0.16, "z"), dou(0, 0.49, PING.reach),
        arm(0.9, 0.41, PING.reach),
      ]).scale(K, K, K);
      add(merge(spots.map((s) => low.clone().rotateY(s.a).translate(s.x, y0, s.z))), M.woodX, { ao: bracketAO });
      add(merge([box(X * 2 + 0.4, 0.12, 0.34, 0, y0 - 0.06, Z), box(X * 2 + 0.4, 0.12, 0.34, 0, y0 - 0.06, ZB),
        box(PX * 2 + 0.12, bd, 0.06, 0, p.platH - bd / 2, zF + 0.03), box(PX * 2 + 0.12, bd, 0.06, 0, p.platH - bd / 2, zB - 0.03)]), M.woodX);
      // (As over the ring below: the plate along z stops at the face of the one along x, #655.)
      add(merge([...[xs[0], X].flatMap((x) => [box(0.34, 0.12, Z - ZB - 0.34, x, y0 - 0.06, (Z + ZB) / 2)]),
        box(0.06, bd, zF - zB, -PX - 0.03, p.platH - bd / 2, (zF + zB) / 2), box(0.06, bd, zF - zB, PX + 0.03, p.platH - bd / 2, (zF + zB) / 2)]), M.woodZ);
      // Behind the sets the wall is limed, as it is between the sets under the eaves, so that they read against it.
      add(merge([box(X * 2, PH + 0.3, 0.1, 0, y0 + PH / 2 - 0.15, Z - 0.04), box(X * 2, PH + 0.3, 0.1, 0, y0 + PH / 2 - 0.15, ZB + 0.04), box(0.1, PH + 0.3, Z - ZB, xs[0] + 0.04, y0 + PH / 2 - 0.15, (Z + ZB) / 2), box(0.1, PH + 0.3, Z - ZB, X - 0.04, y0 + PH / 2 - 0.15, (Z + ZB) / 2)]), M.plaster());
      ping = { sets: spots.length, reach: PING.reach * K, board: bd, edge: PX, rail: PX - 0.16, bottom: y0 - 0.12 };
    }
    if (p.ping && p.pingRing) {
      // A balcony walked round, as the Fashi builds one over a storey below (juan 4, the pingzuo; the structure review on
      // #101): its bracket sets stand on the column heads of the storey below, on a plate as thick as a timber is deep, the
      // storey's own columns forked down into them. Each set has its arms doubled (chonggong) and steps out as far as the
      // floor reaches past that ring, carrying the edge board on its last arm; where the floor ends over the columns, it
      // does not step out at all.
      const ring = p.pingRing, RX = ring[ring.length - 1], R = Math.max(0, PX - RX - 0.02), dbl = 0.21 + 0.13, PH = 0.62 + dbl, y0 = p.platBase - PH, bd = PING.board, plate = 0.21;
      const parts = [box(0.46, 0.17, 0.46, 0, 0.195, 0), box(0.34, 0.11, 0.34, 0, 0.055, 0), arm(0.9, 0.28, 0), dou(-0.35, 0.49, 0), dou(0.35, 0.49, 0), arm(1.32, 0.62, 0), dou(-0.55, 0.83, 0), dou(0.55, 0.83, 0)];
      if (R > 0.15) parts.push(arm(R + 0.42, 0.28, (R - 0.28) / 2, "z"), dou(0, 0.49, R), arm(0.9, 0.62, R), dou(-0.35, 0.83, R), dou(0.35, 0.83, R));
      const low = merge(parts), at = [];
      for (const x of ring) for (const z of ring) { const ox = x === ring[0] ? -1 : x === RX ? 1 : 0, oz = z === RX ? 1 : z === ring[0] ? -1 : 0; if (ox || oz) at.push({ x, z, a: Math.atan2(ox, oz) }); }
      add(merge(at.map((s) => low.clone().rotateY(s.a).translate(s.x, y0, s.z))), M.woodX, { ao: bracketAO });
      add(merge([box(RX * 2 + 0.4, plate, 0.34, 0, y0 - plate / 2, RX), box(RX * 2 + 0.4, plate, 0.34, 0, y0 - plate / 2, -RX),
        box(PX * 2 + 0.12, bd, 0.06, 0, p.platH - bd / 2, zF + 0.03), box(PX * 2 + 0.12, bd, 0.06, 0, p.platH - bd / 2, zB - 0.03)]), M.woodX);
      // (The plate along z stops at the face of the plate along x instead of crossing it, which gave faces on one plane, #655; the 3 cm
      // it ran on past it are left off.)
      add(merge([...[-RX, RX].flatMap((x) => [box(0.34, plate, RX * 2 - 0.34, x, y0 - plate / 2, 0)]),
        box(0.06, bd, zF - zB, -PX - 0.03, p.platH - bd / 2, (zF + zB) / 2), box(0.06, bd, zF - zB, PX + 0.03, p.platH - bd / 2, (zF + zB) / 2)]), M.woodZ);
      // Behind the sets, between the column heads, the wall of the storey below is limed, so that the sets read against it.
      const wy = y0 + PH / 2 - 0.15, wh = PH + 0.3;
      add(merge([box(RX * 2, wh, 0.1, 0, wy, RX - 0.04), box(RX * 2, wh, 0.1, 0, wy, -RX + 0.04), box(0.1, wh, RX * 2, -RX + 0.04, wy, 0), box(0.1, wh, RX * 2, RX - 0.04, wy, 0)]), M.plaster());
      ping = { sets: at.length, reach: R, board: bd, edge: PX, rail: PX - 0.16, bottom: y0 - plate, ring: RX, double: true, plate, spots: at };
    }
    const o = PUR, py = PLATE_TOP + 1.0 * K;   // the eave purlin the outer arms carry: the outermost timber of the sets, lit as they are
    add(merge([box(X * 2 + o * 2 + 0.6, 0.2, 0.17, 0, py, Z + o), box(X * 2 + o * 2 + 0.6, 0.2, 0.17, 0, py, ZB - o)]), M.woodX, { ao: bracketAO });
    // (The purlin along z stops at the face of the one along x, its tails past it being blocks of their own, so that they do not cross, #655.)
    const zl = Z - ZB + o * 2 - 0.17, zt = 0.3 - 0.085;
    add(merge([xs[0] - o, X + o].flatMap((x) => [box(0.17, 0.2, zl, x, py, (Z + ZB) / 2), box(0.17, 0.2, zt, x, py, Z + o + 0.085 + zt / 2), box(0.17, 0.2, zt, x, py, ZB - o - 0.085 - zt / 2)])), M.woodZ, { ao: bracketAO });
  }

  // ---- Roof ----
  {
    const STEP = 0.26;
    const cols = [];   // {x, eps}: the gable line appears twice, once evaluated on each side of the step
    // The roof is drawn finely only where it curls up at the corners; the long middle of it is nearly straight
    // across and needs a third of the triangles.
    const ticks = (E) => { const out = [], fine = Math.min(E, p.liftLen + 0.6); let v = -E; while (v < E - 1e-6) { out.push(v); v += Math.abs(v) > E - fine - 1e-6 || Math.abs(v + 0.78) > E - fine ? STEP : 0.78; } out.push(E); return out; };
    for (const x of ticks(EX)) cols.push({ x, eps: 0 });
    const split = gx > 0.3 && G > 0.05;
    if (split) for (const s of [-1, 1]) cols.push({ x: s * gx, eps: 0, cut: s }, { x: s * gx, eps: -1e-3, cut: s, inner: true });
    cols.sort((a, b) => a.x - b.x || ((a.inner ? 1 : 0) - (b.inner ? 1 : 0)) * Math.sign(a.x));
    const rows = ticks(EZ);

    const pos = [], uv = [], idx = [], nz = rows.length;
    for (const c of cols) for (const z of rows) {
      const dz = EZ - Math.abs(z), dx = EX - Math.abs(c.x) + c.eps, end = dx <= G && dx < dz;   // on an end slope the tiles run the other way
      pos.push(c.x, roofY(c.x, z, c.eps), z); uv.push(end ? z : c.x, end ? dx : dz);
    }
    for (let i = 0; i < cols.length - 1; i++) {
      if (cols[i].cut && cols[i + 1].cut && cols[i].x === cols[i + 1].x) continue;   // the vertical step is the gable wall, built below
      for (let j = 0; j < nz - 1; j++) { const a = i * nz + j, b = a + nz; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    top.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    // Every triangle of the roof is wound to face the sky (and of the boards under it, the ground), whichever way it was laid.
    const wind = (ix, up) => { for (let i = 0; i < ix.length; i += 3) { const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3, ny = (pos[b + 2] - pos[a + 2]) * (pos[c] - pos[a]) - (pos[b] - pos[a]) * (pos[c + 2] - pos[a + 2]); if (ny > 0 !== up) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } } return ix; };
    // The upright step between the end slope and the main roof is not tiled: it is left out, and the boarded gable behind it shows.
    { const keep = []; for (let i = 0; i < idx.length; i += 3) { const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (Math.abs(ny) > 0.08 * Math.hypot(nx, ny, nz)) keep.push(idx[i], idx[i + 1], idx[i + 2]); }
      idx.length = 0; idx.push(...keep); }
    top.setIndex(wind(idx, true)); top.computeVertexNormals();
    add(top, M.tile, { ao: null });
    {   // the boards seen from below: the same surface a hand lower, turned over so that it faces the ground and is lit as such
      const under = top.clone().translate(0, -0.17, 0), un = under.attributes.normal; wind(under.index.array, false);
      for (let i = 0; i < un.count; i++) un.setXYZ(i, 0, -1, 0);   // lit as a ceiling is, whatever the curl of the corner does to its faces
      add(under, M.rafters, { cast: false });
    }

    // The rafters themselves, under the boards: round the whole eave, one every third of a metre, from the purlin
    // over the brackets out to the edge, and at each corner a fan of them turning from one side to the next.
    {
      const raf = [], beams = [], up = new THREE.Vector3(0, 0, 1), d = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), mid = new THREE.Vector3();
      const stick = (x0, z0, x1, z1) => {
        const y0 = roofY(x0, z0) - 0.27, y1 = roofY(x1, z1) - 0.26; d.set(x1 - x0, y1 - y0, z1 - z0); const L = d.length(); if (L < 0.3) return;
        q.setFromUnitVectors(up, d.normalize()); raf.push(new THREE.BoxGeometry(0.085 * K, 0.1 * K, L).applyMatrix4(m4.compose(mid.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q, one)));
      };
      const inn = p.brackets ? 0.8 * K : 0.15, out = 0.06, gap = 0.34;
      for (let x = -X; x <= X + 1e-6; x += gap) { stick(x, Z + inn, x, EZ - out); stick(x, ZB - inn, x, -EZ + out); }
      for (let z = ZB; z <= Z + 1e-6; z += gap) { stick(X + inn, z, EX - out, z); stick(xs[0] - inn, z, -EX + out, z); }
      // At each corner a great beam runs out on the diagonal, from over the corner column to the corner of the eave
      // (Yingzao Fashi, juan 5, on corner beams): deep, its head cut back underneath; on its back rides a smaller one
      // that runs a little past it and turns up at its end. The corner's rafters are set out along it: their feet
      // stand on the great beam, the nearer the diagonal the further out, and they fan from it to either eave.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const cx = sx > 0 ? X : xs[0], cz = sz > 0 ? Z : ZB, ex = sx * (EX - out), ez = sz * (EZ - out), n = 6;
        const c0 = new THREE.Vector3(cx + sx * inn * 0.5, 0, cz + sz * inn * 0.5), c1 = new THREE.Vector3(sx * (EX - 0.12), 0, sz * (EZ - 0.12));
        c0.y = roofY(c0.x, c0.z) - 0.3 - 0.2 * K; c1.y = roofY(c1.x, c1.z) - 0.3 - 0.12 * K;
        const dir = c1.clone().sub(c0), len = dir.length(), bw = 0.26 * K, bd2 = 0.4 * K; dir.normalize();
        const side = new THREE.Shape([[0, bd2 / 2], [len, bd2 / 2], [len, bd2 * 0.1], [len - 0.35 * K, -bd2 * 0.32], [len - 0.8 * K, -bd2 / 2], [0, -bd2 / 2]].map(([a, b]) => new THREE.Vector2(a, b)));
        const q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir), m2 = new THREE.Matrix4();
        beams.push(plain(new THREE.ExtrudeGeometry(side, { depth: bw, bevelEnabled: false }).translate(0, 0, -bw / 2)).applyMatrix4(m2.compose(c0, q2, one)));
        // The small beam on its back: from two thirds of the way out, past the great beam's head, its end turned up.
        const s0 = c0.clone().addScaledVector(dir, len * 0.62).add(new THREE.Vector3(0, bd2 * 0.62, 0)), flat = new THREE.Vector3(sx, 0, sz).normalize(), tipLen = len * 0.38 + 0.3 * K;
        const up2 = new THREE.Vector3(flat.x * Math.cos(0.3), Math.sin(0.3) + dir.y * 0.4, flat.z * Math.cos(0.3)).normalize(), tip = s0.clone().addScaledVector(up2, tipLen), cw = 0.18 * K, ch = 0.22 * K;
        const q3 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), up2);
        beams.push(new THREE.BoxGeometry(tipLen, ch, cw).translate(tipLen / 2, 0, 0).applyMatrix4(m2.compose(s0, q3, one)));
        const bell = [tip.x - flat.x * 0.08, tip.y - ch / 2, tip.z - flat.z * 0.08];
        corners.push({ from: c0.toArray(), to: c1.toArray(), child: { from: s0.toArray(), tip: tip.toArray() }, bell });
        for (let k = 1; k <= n; k++) { const t = (k - 0.5) / n, u = 0.72 - 1.1 * Math.abs(t - 0.5), fx = c0.x + (c1.x - c0.x) * u, fz = c0.z + (c1.z - c0.z) * u;
          stick(fx, fz, t < 0.5 ? cx + (ex - cx) * t * 2 : ex, t < 0.5 ? ez : ez + (cz - ez) * (t - 0.5) * 2); }
      }
      if (beams.length) add(merge(beams), M.woodX, { cast: false });
      if (raf.length) add(merge(raf), M.woodZ, { cast: false });
    }

    // Eave board closing the edge between tiles and rafters.
    const ring = [];
    for (let x = -EX; x <= EX + 1e-6; x += STEP) ring.push([Math.min(x, EX), EZ]);
    for (let z = EZ; z >= -EZ - 1e-6; z -= STEP) ring.push([EX, Math.max(z, -EZ)]);
    for (let x = EX; x >= -EX - 1e-6; x -= STEP) ring.push([Math.max(x, -EX), -EZ]);
    for (let z = -EZ; z <= EZ + 1e-6; z += STEP) ring.push([-EX, Math.min(z, EZ)]);
    // In winter a lip of snow a hand deep lies along the edge of every eave: a rounded strip standing on the last
    // course of tiles, which is there all year and drawn only when it has snowed.
    { const sp = [], si = [], inn = 0.34;
      ring.forEach(([x, z], i) => { if (i % 2 && i !== ring.length - 1) return; const y = roofY(x, z) + 0.05, nx = Math.abs(x) >= EX - 1e-6 ? -Math.sign(x) : 0, nz = Math.abs(z) >= EZ - 1e-6 ? -Math.sign(z) : 0, b = sp.length / 3;
        const yi = roofY(x + nx * inn, z + nz * inn) + 0.03;
        sp.push(x - nx * 0.05, y - 0.06, z - nz * 0.05, x - nx * 0.03, y + 0.07, z - nz * 0.03, x + nx * inn * 0.5, yi + 0.1 - (yi - y) * 0.5, z + nz * inn * 0.5, x + nx * inn, yi, z + nz * inn);
        if (b) si.push(b - 4, b, b - 3, b - 3, b, b + 1, b - 3, b + 1, b - 2, b - 2, b + 1, b + 2, b - 2, b + 2, b - 1, b - 1, b + 2, b + 3); });
      const lip = new THREE.BufferGeometry(); lip.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); lip.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((sp.length / 3) * 2).fill(0), 2)); lip.setIndex(si); lip.computeVertexNormals();
      add(lip, M.snowlip, { ao: null, cast: false }); }
    const ep = [], ei = [];
    ring.forEach(([x, z], i) => { const y = roofY(x, z); ep.push(x, y + 0.02, z, x, y - 0.2, z); if (i) { const a = (i - 1) * 2; ei.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
    const fascia = new THREE.BufferGeometry();
    fascia.setAttribute("position", new THREE.Float32BufferAttribute(ep, 3));
    fascia.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((ep.length / 3) * 2).fill(0), 2));
    fascia.setIndex(ei); fascia.computeVertexNormals();
    add(fascia, M.fascia, { ao: null });

    // Round end tiles closing each row of cover tiles along the eave.
    // Each is a disc of eight triangles, seen only face-on from below; thousands of them line the eaves.
    const ends = [], cap = new THREE.CircleGeometry(0.085, 8);
    for (let x = -EX + 0.125 + 0.4; x < EX - 0.4; x += 0.25) for (const s of [-1, 1]) ends.push(cap.clone().rotateY(s > 0 ? 0 : Math.PI).translate(x, roofY(x, s * EZ) + 0.035, s * (EZ + 0.045)));
    if (G > 0.05) for (let z = -EZ + 0.125 + 0.4; z < EZ - 0.4; z += 0.25) for (const s of [-1, 1]) ends.push(cap.clone().rotateY(s * Math.PI / 2).translate(s * (EX + 0.045), roofY(s * EX, z) + 0.035, z));
    add(merge(ends), M.ridge, { ao: () => 0.7, cast: false });

    // Ridges: the main ridge with its end ornaments, the gable ridges, the hip ridges that sweep up at the corners.
    const ridgeY = EAVE_Y + RISE, parts = [];
    if (gx > 0.3 && !p.skirt) {   // (a skirt's ridge would lie inside the storey above)
      const rh = Math.min(0.95, 0.34 + CREST * 0.1);   // the ridge: a tall wall of tile courses on a great hall, low on a small one
      // It is bedded well down into the tiles: the roof falls away steeply either side of its top, and a ridge that only
      // touched the crest would show daylight under its edges.
      parts.push(box(gx * 2 + 0.5, rh + 0.34, 0.36, 0, ridgeY - 0.45 + (rh + 0.34) / 2, 0), box(gx * 2 + 0.7, 0.1, 0.46, 0, ridgeY - 0.08 + rh, 0));
      const k = Math.min(1.55, CREST / 3.4), curl = new THREE.Shape([[0, 0], [0.95, 0], [1.0, 0.55], [0.74, 1.1], [0.34, 1.36], [0.1, 1.18], [0.36, 0.98], [0.46, 0.66], [0.22, 0.5], [0, 0.56]].map(([x, y]) => new THREE.Vector2(x * k, y * k)));
      for (const s of [-1, 1]) {
        const c = plain(new THREE.ExtrudeGeometry(curl, { depth: 0.34, bevelEnabled: false }).translate(-k, 0, -0.17));
        if (s < 0) {   // mirror, then restore the winding
          c.scale(-1, 1, 1);
          for (const a of ["position", "uv"]) { const arr = c.attributes[a].array, n = a === "uv" ? 2 : 3; for (let i = 0; i < arr.length; i += n * 3) for (let q = 0; q < n; q++) { const t = arr[i + q]; arr[i + q] = arr[i + n + q]; arr[i + n + q] = t; } }
        }
        parts.push(c.translate(s * (gx + 0.25), ridgeY - 0.1, 0));
      }
      // The tips of the two end ornaments, the highest and outermost points of the roof: what a picture of the whole
      // building must keep inside its frame (`aimToFrame` at the close).
      g.userData.crest = [-1, 1].map((s) => [s * (gx + 0.25), ridgeY - 0.1 + 1.36 * k, 0]);
    } else {   // pyramid roof: a finial at the apex
      parts.push(new THREE.LatheGeometry([[0, 0], [0.34, 0], [0.4, 0.12], [0.2, 0.3], [0.3, 0.52], [0.22, 0.78], [0.08, 0.95], [0, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)), 14).translate(0, roofY(0, 0) - 0.1, 0));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (G > 0.05) {
        const hip = [];
        for (let t = -0.04; t <= 1.0001; t += 0.08) { const d = t * G, x = sx * (EX - d), z = sz * (EZ - d); hip.push(new THREE.Vector3(x, roofY(x, z) + 0.13 + (t < 0 ? 0.12 : 0), z)); }
        parts.push(tube(hip, 0.17));
      }
      if (gx > 0.3 && EZ - G > 0.3) {
        const gab = [];
        for (let t = 0; t <= 1.0001; t += 0.1) { const z = sz * (EZ - G) * (1 - t); gab.push(new THREE.Vector3(sx * (gx + 0.02), EAVE_Y + profile(EZ - Math.abs(z)) + 0.14, z)); }
        parts.push(tube(gab, 0.15));
      }
    }
    add(merge(parts), M.ridge, { ao: null });
    // Under each corner of the eaves hangs a small bronze wind bell.
    {
      const bells = [];
      for (const c of corners) {
        const [x, y0b, z] = c.bell, y = y0b - 0.2;   // on a short chain under the head of the small corner beam
        bells.push(new THREE.LatheGeometry([[0, 0.14], [0.03, 0.135], [0.045, 0.09], [0.058, 0.02], [0.066, 0], [0.05, 0.005], [0, 0.02]].map(([r, h]) => new THREE.Vector2(r, h)), 10).translate(x, y - 0.14, z),
          new THREE.CylinderGeometry(0.006, 0.006, 0.2, 4).translate(x, y + 0.1, z), new THREE.BoxGeometry(0.05, 0.09, 0.006).translate(x, y - 0.2, z));
      }
      add(merge(bells), M.bronze, { ao: null, cast: false });
    }

    // Gable walls under the upper roof.
    const half = EZ - G;
    if (gx > 0.3 && half > 0.3) {
      const gs = new THREE.Shape(), baseY = EAVE_Y + profile(G) - 0.25;
      gs.moveTo(-half, baseY);
      for (let z = -half; z <= half + 1e-6; z += 0.3) gs.lineTo(z, EAVE_Y + profile(EZ - Math.abs(z)) - 0.22);
      gs.lineTo(half, baseY);
      for (const s of [-1, 1]) add(plain(new THREE.ShapeGeometry(gs).rotateY((s * Math.PI) / 2).translate(s * (gx - 0.3), 0, 0)), M.gable, { ao: null });
      // Bargeboards down either slope of each gable, and where they meet under the ridge, a hanging fish.
      const barge = [], k = Math.min(1.4, Math.max(0.6, half / 3)), fish = new THREE.Shape([[0, 0.1], [0.2, -0.22], [0.11, -0.55], [0, -0.9], [-0.11, -0.55], [-0.2, -0.22]].map(([a2, b2]) => new THREE.Vector2(a2 * k, b2 * k)));
      for (const s of [-1, 1]) {
        for (const sz of [-1, 1]) for (let z = 0; z < half - 1e-6; z += 0.3) {
          const z1 = Math.min(half, z + 0.3), y0 = EAVE_Y + profile(EZ - z), y1 = EAVE_Y + profile(EZ - z1), L = Math.hypot(z1 - z, y1 - y0);
          barge.push(new THREE.BoxGeometry(0.06, 0.36, L + 0.03).rotateX(sz * Math.atan2(y0 - y1, z1 - z)).translate(s * (gx + 0.05), (y0 + y1) / 2 - 0.2, sz * (z + z1) / 2));
        }
        barge.push(plain(new THREE.ShapeGeometry(fish).rotateY((s * Math.PI) / 2).translate(s * (gx + 0.09), EAVE_Y + profile(EZ) - 0.3, 0)));
      }
      add(merge(barge), M.fascia, { ao: null });
    }
  }

  if (p.plaque) {   // hung forward of the bracket arms, tucked under the eave
    const pq = typeof p.plaque === "string" ? { text: p.plaque } : p.plaque, m = makePlaque(pq.text, { ...pq, back: M.woodV });
    // Outside the slanting arm's beak, the farthest any timber of a set reaches (BEAK, drawn for a cai of 0.21 and scaled with the
    // frame), with the board's foot swung back by its lean and a finger of air: not through the beak, which lay over the writing (#213).
    const lean = pq.vertical ? 0.3 : 0.2, zz = Z + (p.brackets ? Math.max(1.3, BEAK * K + (m.userData.height / 2) * Math.sin(lean) + 0.04 + 0.06) : 0.45);
    let top = Math.min(PLATE_TOP + 0.52, underside(p.overhang - (zz - Z)) - m.userData.height / 2 - 0.08) + m.userData.height / 2;
    // Over a balcony that is walked round the board hangs over the walk: it is cut smaller, so that its foot is a
    // grown man's height over the floor and a child at the door looks out under it, not into it.
    if (p.loft && top - m.userData.height < p.platH + 2.0) { const k = Math.max(0.5, (top - p.platH - 2.0) / m.userData.height); m.scale.setScalar(k); m.userData.height *= k; }
    m.position.set(0, top - m.userData.height / 2, zz); m.rotation.x = lean;   // its foot on the beam, its head leaning out to be read from below
    g.add(m);
  }

  // ---- Where you can stand (local space; the site turns these into world space) ----
  // `posts` stand in the way even on a floor: a round one is { x, z, r } (its real radius; the walker adds his own
  // width), a square one is a rectangle already drawn that much larger than the thing.
  const walk = { solids: [], decks: [], ramps: [], posts: [], drops: [], roofs: [], rails };
  const plat = { x0: -PX, x1: PX, z0: zB, z1: zF };
  // Every column on the outside is round and in the way wherever a floor comes up to it: the walker keeps his
  // whole width off its shaft (a little fatter than the shaft at its swell).
  // At its foot the stone drum stands out to 1.56 times the shaft, and his shoes reach 0.255 m from his middle below
  // 10 cm (tools/walk/outline.json, the Tripo body's shoes, #163): where the drum and his shoes need more room than
  // the shaft and his width (the great columns), the post is drawn that much larger. The baked floor finds the drum
  // from the mesh; this is only the written plan's.
  const SHOE = 0.255, postR = Math.max(COL_R * 1.03, COL_R * 1.56 + SHOE - BODY);
  for (const c of perimeter) walk.posts.push({ x: c.x, z: c.z, r: postR });
  // ---- A sitting bench between the columns of an open pavilion (#479) ----
  // `bench` lists the sides of an open pavilion that carry one ("f", "b", "l", "r": front, back, left, right): the sides that
  // look out over the view, never the one the way in comes by (that bay stays open from column to column). A board on the column
  // line, one to a bay, carried on four posts to the ground and a sill, with a single balustrade on its outer edge to lean on;
  // he sits on it facing in, his back to the rail and the view behind him. Each bay's seats are handed back in `seats` (local
  // space, `out` the way the rail faces).
  const seats = [], benchParts = [];
  for (const side of p.bench || []) {
    const along = side === "f" || side === "b" ? "x" : "z", fixed = side === "f" ? Z : side === "b" ? ZB : side === "l" ? xs[0] : X;
    const out = side === "f" ? [0, 1] : side === "b" ? [0, -1] : side === "l" ? [-1, 0] : [1, 0];
    const lines = along === "x" ? xs : zs.slice().reverse();
    for (let i = 0; i < lines.length - 1; i++) {
      const a = lines[i] + COL_R + BENCH.gap, b = lines[i + 1] - COL_R - BENCH.gap, len = b - a, mid = (a + b) / 2, top = p.platH + BENCH.top, H = BENCH.depth;
      // A box of `w` along the bench and `d` across it, `hh` high from `y0`, centred `dc` off the line toward the rail.
      const part = (t, w, d, hh, y0, dc = 0) => along === "x" ? box(w, hh, d, t, y0 + hh / 2, fixed + out[1] * dc) : box(d, hh, w, fixed + out[0] * dc, y0 + hh / 2, t);
      benchParts.push(part(mid, len, H, BENCH.thick, top - BENCH.thick));   // the board
      benchParts.push(part(mid, len, 0.14, BENCH.sill, p.platH, 0));   // the sill on the floor, the dizi
      for (let k = 0; k < 4; k++) benchParts.push(part(a + 0.1 + ((len - 0.2) * k) / 3, BENCH.legs, BENCH.legs, top - BENCH.thick - p.platH - BENCH.sill, p.platH + BENCH.sill));   // four posts under it
      // The balustrade on the outer edge: the hand rail, the lip, the bars between, and a post in the middle of the bay.
      const rc = H / 2 - 0.03, ry = top + BENCH.rail;
      benchParts.push(part(mid, len, 0.05, 0.05, ry - 0.05, rc), part(mid, len, 0.07, 0.06, top + 0.1, rc), part(mid, 0.03, 0.03, ry - 0.05 - top - 0.16, top + 0.16, rc));
      for (const t of [a + 0.02, mid, b - 0.02]) benchParts.push(part(t, BENCH.post * (t === mid ? 1 : 0.5), BENCH.post * (t === mid ? 1 : 0.5), BENCH.rail + 0.04, top, rc));
      for (let k = 1; k < 6; k++) { const t = a + (len * k) / 6; if (Math.abs(t - mid) > 0.1) benchParts.push(part(t, 0.03, 0.03, ry - 0.05 - top - 0.16, top + 0.16, rc)); }
      // Kept off by his width: from the board's inner edge to the rail's outer face (its posts stand proud of the board's edge).
      const inner = H / 2, outer = Math.max(H / 2, rc + BENCH.post / 2) + 0.01, lo = (c, o) => (o < 0 ? c - outer : c - inner), hi = (c, o) => (o > 0 ? c + outer : c + inner);
      walk.posts.push(along === "x" ? { x0: a - BODY, x1: b + BODY, z0: lo(fixed, out[1]) - BODY, z1: hi(fixed, out[1]) + BODY } : { x0: lo(fixed, out[0]) - BODY, x1: hi(fixed, out[0]) + BODY, z0: a - BODY, z1: b + BODY });
      const n = Math.max(1, Math.floor(len / BENCH.seatWidth));
      for (let k = 0; k < n; k++) { const t = a + (len * (k + 0.5)) / n, off = BENCH.back; seats.push({ at: along === "x" ? [t, fixed - out[1] * off] : [fixed - out[0] * off, t], out, top }); }
    }
  }
  if (benchParts.length) { const m = add(merge(benchParts), M.woodX, { ao: null }); m.userData.walk = "post"; }

  // An edge with a railing along it is kept back by the rail and by his own width; an open edge only so that his feet stay on the stone.
  const edgeIn = p.rail ? 0.16 + 0.1 + BODY : 0.25;
  const stair = (w, sign, cx = 0) => {   // sign = +1 front, -1 back; `cx`: where it stands across the building
    // The treads are walked clear of the cheek stones by his own width; the cheeks themselves, and the ground
    // round their feet, are closed to him even where a floor or the stair would otherwise let him stand.
    const edge = sign > 0 ? zF : zB, a = edge - sign * Math.max(0.25, edgeIn + 0.06), b = edge + sign * run, hw = w / 2 - BODY - 0.02;
    const cheek = stairProfile(p.platH).count > 2 ? CHEEK : 0;   // (a flight of two steps has no cheek stones, but the ends of its treads still stop his shoes)
    for (const sx of [-1, 1]) walk.posts.push({ x0: cx + (sx > 0 ? w / 2 - BODY - 0.021 : -w / 2 - cheek - BODY), x1: cx + (sx > 0 ? w / 2 + cheek + BODY : -w / 2 + BODY + 0.021), z0: sign > 0 ? edge + 0.02 : b - BODY - 0.06, z1: sign > 0 ? b + BODY + 0.06 : edge - 0.02, h: p.platH });   // (`h`: as high as its platform, for the eye)
    walk.ramps.push({ x0: cx - hw, x1: cx + hw, z0: Math.min(a, b) - STAIR.nosing - 0.02, z1: Math.max(a, b) + STAIR.nosing + 0.02, h: p.platH, low: [cx, b], high: [cx, edge] });
    walk.solids.push({ x0: cx - w / 2 - 0.8, x1: cx + w / 2 + 0.8, z0: Math.min(edge, b), z1: Math.max(edge, b), own: true, h: p.platH });   // (`h`: no higher than the platform it climbs, for the eye)
  };
  if (p.walkAll) {
    walk.decks.push({ x0: -PX + edgeIn - 0.25, x1: PX - edgeIn + 0.25, z0: zB + edgeIn - 0.25, z1: zF - edgeIn + 0.25, h: p.platH });   // open floor, but its columns still stand in the way
    if (p.steps) stair(p.steps, 1);   // (an open pavilion with steps up to it, #274: the path's two)
    for (const bx of backAt) stair(p.stepsBack, -1, bx);
  } else {
    walk.solids.push({ x0: -PX - 0.5, x1: PX + 0.5, z0: zB - 0.5, z1: zF + 0.5, own: true });   // `own`: the building's own platform, whose height the eye knows
    if (p.steps) stair(p.steps, 1);
    for (const bx of backAt) stair(p.stepsBack, -1, bx);
    const passing = p.front === "pass" && p.back === "pass";
    // The way through a gate runs between its open leaves, which stand against the sides with their ledges and studs.
    if (passing) { const hw = (xs[mid + 1] - xs[mid]) / 2 - (p.timber ? 0.25 + 0.2 + BODY + 0.01 : 0.45); walk.decks.push({ x0: -hw, x1: hw, z0: zB + 0.25, z1: zF - 0.25, h: p.platH });
      if (p.timber) {   // the sill: a shoe comes down on it, not through it; beyond the way through it lies under the open leaves, where he does not go
        const sw = (xs[mid + 1] - xs[mid]) / 2; walk.decks.push({ x0: -sw, x1: sw, z0: Z - 0.12, z1: Z + 0.12, h: p.platH + 0.05, floor: "wood" });
        for (const s of [-1, 1]) walk.posts.push({ x0: s > 0 ? hw : -sw - 0.01, x1: s > 0 ? sw + 0.01 : -hw, z0: Z - 0.13, z1: Z + 0.13 });
      } }
    else if (p.steps) {   // the porch, and where it meets the head of its stair
      const ex = Math.min(X + 0.8, PX - edgeIn);
      walk.decks.push({ x0: -ex, x1: ex, z0: Z + 0.45, z1: zF - edgeIn, h: p.platH });
      if (p.rail) walk.decks.push({ x0: -(p.steps / 2 - BODY - 0.02), x1: p.steps / 2 - BODY - 0.02, z0: zF - edgeIn - 0.1, z1: zF - 0.2, h: p.platH });
    }
    // And the threshold of its open door: he steps between the leaves as far as the sill, no farther, and never
    // wider than leaves his sleeves clear of them (the opening is two metres).
    if (p.dark && p.front === "lattice") walk.decks.push({ x0: -(1.0 - BODY - 0.01), x1: 1.0 - BODY - 0.01, z0: Z + DOOR.reach, z1: Z + 0.5, h: p.platH });
  }

  // A balcony that is walked round: four strips of floor between the storey's walls and its railing, each kept his
  // width off the wall (the lattice and sills stand a little proud of the column line) and off the rail. They are
  // floor only while he is up there (`loft`); the columns in the way are the outer ones above.
  let loft = null;
  if (p.loft) {
    const off = 0.13 + BODY, ex = PX - edgeIn, zf = zF - edgeIn, zb = zB + edgeIn, mk = (x0, x1, z0, z1) => ({ x0, x1, z0, z1, h: p.platH, floor: "wood", loft: p.loft });
    walk.decks.push(mk(-ex, ex, Z + off, zf), mk(-ex, ex, zb, ZB - off), mk(X + off, ex, zb, zf), mk(-ex, xs[0] - off, zb, zf));
    loft = { id: p.loft, floor: p.platH, wall: X, edge: PX, rail: PX - 0.16, door: [0, (Z + off + zf) / 2], ceil: topY - 0.15,
      inner: { x0: xs[0] - 0.13, x1: X + 0.13, z0: ZB - 0.13, z1: Z + 0.13 }, outer: { x0: -PX + 0.23, x1: PX - 0.23, z0: zB + 0.23, z1: zF - 0.23 } };
  }
  // Only exposed front porch edges of a low, unrailed ground-level platform can be hopped down.
  if (!p.rail && !p.walkAll && p.steps && p.platBase <= 0 && p.platH >= 0.2 && p.platH <= 1.5) {
    const end = X + 0.8, gap = p.steps / 2 + 0.8;
    for (const [a, b] of [[-end, -gap], [gap, end]]) if (b - a > 0.6) walk.drops.push({ a: [a, zF], b: [b, zF], normal: [0, 1], top: p.platH });
  }
  // What the following eye must keep out of, though he never could reach it: the roof, from the foot of the beams
  // under the eaves to a little over the ridge, over everything the eaves cover and a hand beyond (the corners turn up
  // and out), and within the column lines from the head of the doors (a gate's passage, an open pavilion); and, unless
  // the floor is open, the building: within its walls up to the ridge, and over the rest of its platform only up to
  // the floor (or the top of its railing), so that from a porch the eye can back out over the edge.
  walk.roofs.push({ x0: -EX - 0.3, x1: EX + 0.3, z0: -EZ - 0.3, z1: EZ + 0.3, bottom: topY - 0.15, inner: head - 0.15, top: EAVE_Y + RISE + 0.3,
    body: p.walkAll ? null : { x0: -PX - 0.5, x1: PX + 0.5, z0: zB - 0.5, z1: zF + 0.5 }, core: { x0: -X - 0.4, x1: X + 0.4, z0: ZB - 0.4, z1: Z + 0.4 }, crest: g.userData.crest || null, floor: p.platH, edge: p.platH + (p.rail ? 1.2 : 0.3) });
  // What his shoes come down on here, for the sound of his steps: a timber gallery on an upper storey, stone below.
  for (const r of [...walk.decks, ...walk.ramps]) r.floor ??= p.platBase > 0 ? "wood" : "stone";
  return { group: g, windows, aoAt: ao, walk, plat, seats, sets, ping, corners, cai: p.cai, parts: { ludou: 0.46 * K, nidao: 0.9 * K, hua: 1.02 * K, man: 1.32 * K, ling: 1.0 * K }, cols: perimeter.map((c) => [c.x, c.z]), roof: { EZ, purlin: PURLIN_IN, tent, at: (d) => EAVE_Y + profile(d) }, EX, EZ, eaveY: EAVE_Y, ridgeY: EAVE_Y + RISE, colTop: COL_TOP, platH: p.platH, run, frontZ: Z, zF, zB, roofAt: (d) => EAVE_Y + profile(d), loft, rail: g.userData.railRuns || null };
}
