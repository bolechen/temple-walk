// The altar of the great hall and what stands on it, as white-box masses (#432, docs/t05/PLAN.md item 7): one long altar
// across the middle seven bays, the seven Buddhas each on a base of two stages (a Sumeru base and a lotus) with a pointed
// body halo behind, an attendant standing either side of each a little in front, and a guardian king at each end of the
// altar on the floor. They are placeholders for the figures the statue session makes (#370, #407): only their places,
// their outlines and their heights are meant, so that the hall can be walked and judged from the threshold before the
// figures come. The figures stand in the hall itself, on its floor; nothing is built under the court.
//
// Sizes and how far each is sourced: docs/t05/SOURCES.md §14 (the hall table), DECISIONS.md (2026-11-21, item 7).
import * as THREE from "three";
import { box, merge, mesh, BODY } from "../../src/geo.js";
import { HALL } from "./hall.js";

/**
 * The altar: 37.5 × 4.8 × 0.87 m (DECISIONS.md §3), its front 14.5 m in from the front column line. The structural review
 * of #432 brought it 1.0 m forward of where the statue session's stage first had it, so that the back inner columns
 * (0.84 m thick on the fourth line, z -20.10) stand 0.38 m clear behind it.
 */
export const ALTAR = Object.freeze({ w: 37.5, d: 4.8, h: 0.87, zF: -14.5, zB: -19.3 });
/**
 * The seven, east to west as the visitor sees them from the door, right to left (DECISIONS.md: Kasyapa, Krakucchanda, Sikhin,
 * Vipashyin, Visvabhu, Kanakamuni, Shakyamuni), each on the middle of its bay. `h` is the whole from the altar's top, base and halo-less
 * figure together. The middle one is 9.28 m and the six 8.6 (DECISIONS.md, 2026-11-21: the art director and the structural
 * review on #493), so that from cam03 his head stands 25–38 px over his neighbours' at 1080 lines; the six are alike, as no
 * figure-by-figure heights are known.
 * Shakyamuni at the west end is turned 7° to the west (yaw in radians, +z the way the hall faces).
 */
export const FIGURES = Object.freeze([
  { id: "kasyapa", x: 16.45, h: 8.6 },
  { id: "krakucchanda", x: 11.33, h: 8.6 },
  { id: "sikhin", x: 5.8, h: 8.6 },
  { id: "vipasyin", x: 0, h: 9.28 },
  { id: "visvabhu", x: -5.8, h: 8.6 },
  { id: "kanakamuni", x: -11.33, h: 8.6 },
  { id: "sakyamuni", x: -16.45, h: 8.6, yaw: (-7 * Math.PI) / 180 },
].map((f) => Object.freeze(f)));
/** A figure's base (a Sumeru base 2.0 m and a lotus 1.0 m, as the statue session's stage has it), its outline on the altar, and the halo behind it (4.0 m at its widest: the art director's 4.2 of #407, narrowed on #493 so that every halo keeps 0.15 m from the frames' beams beside it). */
export const SEAT = Object.freeze({ sumeru: 2.0, lotus: 1.0, w: 4.4, d: 3.2, z: -16.9, halo: { w: 4.0, over: 1.6, z: -19.05, t: 0.18 } });
/** The attendants: two to each Buddha, standing on the altar's front strip either side of his base, 2.6 m with their lotus (DECISIONS.md §3: 2.5–2.7). */
export const ATTEND = Object.freeze({ dx: 1.6, z: -14.95, w: 0.6, h: 2.6 });
/** The two guardian kings on the floor at the altar's ends (ARCHITECTURE.md §2.3: x about ±19.5–20.5), 3.7 m on a 0.35 m plinth (DECISIONS.md §3: 3.5–4.0). */
export const KING = Object.freeze({ x: 19.5, z: -16.4, w: 1.1, plinth: 0.35, h: 3.7 });

/** The pointed body halo (boat-shaped), w wide at its widest, h tall, as a flat outline in x and y about its foot. */
function haloShape(w, h) {
  const s = new THREE.Shape(), ys = h * 0.45;
  s.moveTo(-w * 0.32, 0); s.quadraticCurveTo(-w * 0.5, ys * 0.5, -w * 0.5, ys);
  s.quadraticCurveTo(-w * 0.5, h * 0.8, 0, h); s.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.5, ys);
  s.quadraticCurveTo(w * 0.5, ys * 0.5, w * 0.32, 0); s.lineTo(-w * 0.32, 0);
  return s;
}

/**
 * One of the seven with everything that stands on his bay, in the hall's frame, from the altar's top `top`: the base, the figure, his
 * halo and his two attendants, each geometry already turned and placed. `f` is a FIGURES entry or the same shape with other numbers
 * (the debug panel's way of trying them, #684): `{ id, x, h, yaw? }`. buildAltar is this for each of FIGURES.

 * @param {{ id: string, x: number, h: number, yaw?: number }} f @param {number} [top] the altar's top (the hall's floor and the altar's height)
 */
export function buildFigure(f, top = HALL.floor + ALTAR.h) {
  const clay = [], halo = [], attendants = [], attendClay = [];
  const g = [], ga = [], { x } = f, z = SEAT.z;
  // the Sumeru base, waisted, and the lotus on it
  let y = top;
  for (const [kw, kd, h] of [[1, 1, 0.35], [0.86, 0.86, 1.2], [1.02, 1.02, 0.45]]) { g.push(box(SEAT.w * kw, h, SEAT.d * kd, 0, y + h / 2, 0)); y += h; }
  g.push(new THREE.CylinderGeometry(1, 0.86, SEAT.lotus, 24).scale(SEAT.w * 0.45, 1, SEAT.d * 0.45).translate(0, y + SEAT.lotus / 2, 0)); y += SEAT.lotus;
  // the figure seated on it, as three masses: the crossed legs, the body to the shoulders, and the head with its crown
  const fig = f.h - SEAT.sumeru - SEAT.lotus, legs = fig * 0.22, body = fig * 0.5, head = fig - legs - body;
  g.push(box(3.4, legs, 2.4, 0, y + legs / 2, 0.1)); y += legs;
  g.push(new THREE.CylinderGeometry(0.95, 1.15, body, 16).scale(1, 1, 0.72).translate(0, y + body / 2, -0.15)); y += body;
  g.push(new THREE.CylinderGeometry(0.5, 0.58, head * 0.72, 16).translate(0, y + head * 0.36, -0.1), new THREE.SphereGeometry(0.34, 12, 8).translate(0, y + head * 0.86, -0.1)); y += head;
  const topRec = { id: f.id, x, z, top: y, head: y - head * 0.5 };
  // the halo behind, from the lotus up to over the head
  const hy = top + SEAT.sumeru + SEAT.lotus, hh = y + SEAT.halo.over - hy;
  const h = [new THREE.ExtrudeGeometry(haloShape(SEAT.halo.w, hh), { depth: SEAT.halo.t, bevelEnabled: false, curveSegments: 12 }).translate(0, hy, -SEAT.halo.t / 2)];   // (about its own middle: see below)
  // the attendants either side, a little in front: a lotus and a standing figure
  for (const s of [-1, 1]) {
    const ax = s * ATTEND.dx, az = ATTEND.z - z, a = ATTEND.w;
    ga.push(new THREE.CylinderGeometry(a * 0.6, a * 0.5, 0.25, 12).translate(ax, top + 0.125, az));
    ga.push(new THREE.CylinderGeometry(a * 0.3, a * 0.42, ATTEND.h - 0.25 - 0.5, 12).translate(ax, top + 0.25 + (ATTEND.h - 0.75) / 2, az));
    ga.push(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10).translate(ax, top + ATTEND.h - 0.25, az));
  }
  // the whole group, Buddha, halo and attendants, stood on its bay and turned as it faces
  const turn = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(f.yaw ?? 0));
  for (const p of g) clay.push(p.applyMatrix4(turn));
  for (const p of ga) attendClay.push(p.applyMatrix4(turn));   // (the attendants apart, so that the real figure (./figures/) takes the seated mass and not them)
  // the halo turned about its own middle, not the base's: turned about the base it would swing 0.26 m sideways into the
  // frame's beam beside it (the outer halos keep only 0.09 m from those beams, the structural review of #493)
  const turnHalo = new THREE.Matrix4().makeTranslation(x, 0, SEAT.halo.z).multiply(new THREE.Matrix4().makeRotationY(f.yaw ?? 0));
  for (const p of h) halo.push(p.applyMatrix4(turnHalo));
  for (const s of [-1, 1]) { const at = new THREE.Vector3(s * ATTEND.dx, 0, ATTEND.z - z).applyMatrix4(turn); attendants.push({ of: f.id, side: s, x: at.x, z: at.z, top: top + ATTEND.h }); }
  return { clay: [...clay, ...attendClay], body: clay, attendClay, halo, top: topRec, attendants };
}

/** The altar's meshes (by material), where each figure's top is, and what the written plan's walker is told of them. */
export function buildAltar() {
  const y0 = HALL.floor, top = y0 + ALTAR.h, zc = (ALTAR.zF + ALTAR.zB) / 2;
  const stone = [], clay = [], halo = [], walk = { posts: [] };
  const post = (x0, x1, z0, z1) => walk.posts.push({ x0: x0 - BODY, x1: x1 + BODY, z0: z0 - BODY, z1: z1 + BODY });
  stone.push(box(ALTAR.w, ALTAR.h - 0.12, ALTAR.d, 0, y0 + (ALTAR.h - 0.12) / 2, zc), box(ALTAR.w + 0.3, 0.12, ALTAR.d + 0.3, 0, top - 0.06, zc));   // the altar and its cap
  post(-ALTAR.w / 2 - 0.15, ALTAR.w / 2 + 0.15, ALTAR.zB - 0.15, ALTAR.zF + 0.15);
  const tops = [], attendants = [];
  for (const f of FIGURES) {
    const one = buildFigure(f, top);
    clay.push(...one.clay); halo.push(...one.halo); tops.push(one.top); attendants.push(...one.attendants);
  }
  // the two kings at the ends, on the floor, each on its plinth
  const kings = [], kingClay = [];
  for (const s of [-1, 1]) {
    const kx = s * KING.x, w = KING.w, k = KING.h;
    stone.push(box(w, KING.plinth, w, kx, y0 + KING.plinth / 2, KING.z));
    const b = y0 + KING.plinth;
    const kc = [new THREE.CylinderGeometry(0.38, 0.48, k * 0.82, 12).scale(1, 1, 0.8).translate(kx, b + k * 0.41, KING.z), new THREE.CylinderGeometry(0.2, 0.24, k * 0.18, 10).translate(kx, b + k * 0.91, KING.z)];
    clay.push(...kc); kingClay.push(...kc);
    post(kx - w / 2, kx + w / 2, KING.z - w / 2, KING.z + w / 2);
    kings.push({ x: kx, z: KING.z, top: b + k });
  }
  return { parts: { stone, clay, halo }, walk, tops, attendants, kings, kingClay };
}

/**
 * The seven as parts of their own for the debug panel (#684): each one's seated mass, attendants and halo in three meshes of their own, kept out of the static merge
 * (`userData.keep`), and `rebuild(id, params)` drawing one again from `{ ...his FIGURES entry, ...params }` (x, h, yaw in radians). Returns what is
 * left of the altar's clay once the seven are out of it (`built.kingClay`, the two kings), to be merged as before, the group of the seven, and the hook. A rebuilt
 * figure also updates his place in `built.tops` and `built.attendants`.
 * @param {*} M the level's materials @param {ReturnType<typeof buildAltar>} built @param {*} sh the options the hall's meshes are made with
 */
export function benchFigures(M, built, sh) {
  const group = new THREE.Group(), clayMat = M.plaster(), haloMat = M.woodX;
  const at = (id) => built.tops.findIndex((t) => t.id === id);
  const list = FIGURES.map((f) => ({ id: f.id, f: /** @type {{ id: string, x: number, h: number, yaw?: number }} */ ({ ...f }), parts: /** @type {any[]} */ ([]) }));
  const make = (e) => {
    for (const m of e.parts) { group.remove(m); m.geometry.dispose(); }
    const o = buildFigure(e.f, HALL.floor + ALTAR.h);
    e.parts = [[o.body, clayMat, "clay"], [o.attendClay, clayMat, "attend"], [o.halo, haloMat, "halo"]].map(([geos, material, kind]) => {
      const m = mesh(merge(geos), material, sh); m.userData.keep = true; m.userData.figure = e.id; m.name = `altar-${e.id}-${kind}`; group.add(m); return m;
    });
    const k = at(e.id); if (k >= 0) built.tops[k] = o.top;
    built.attendants = built.attendants.filter((a) => a.of !== e.id).concat(o.attendants);
  };
  list.forEach(make);
  return {
    group, rest: built.kingClay, list,
    /** @param {string} id @param {{ x?: number, h?: number, yaw?: number }} params */
    rebuild(id, params) { const e = list.find((x) => x.id === id); if (!e) throw new Error(`no figure ${id}`); e.f = { ...e.f, ...params }; make(e); },
  };
}

