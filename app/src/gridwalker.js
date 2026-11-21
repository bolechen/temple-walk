// The walker that answers from the floor baked from the drawn meshes (#265, the third step of #161's migration). Where
// he may stand, what stops him and the height of the floor under him are read from the grid `tools/bake-walk.mjs` bakes
// (app/src/walkgrid.js): what is drawn is what stops him, and nobody keeps a second copy of it in step by hand.
//
// Since #274 (the fourth step) it answers everywhere a walk is laid out: the courts and the path up to them, the summit
// pavilion's balcony, every room; and for walking, being stopped, a tap on the ground, the hops up and down a porch's
// edge, whether he is on a stair and the height the eye rides at (eyeAt: the floor's). What the eye asks about what is in
// its way (eyeShut, railNear, wall, landAt) and what a shoe sounds on (floorAt) are still asked of the walker of the
// written plan (createWalker in site.js), which it holds; the fifth step moves the eye. `?walker=old` is the written plan
// everywhere, with no code to roll back, until the sixth step deletes it.
import { NO_FLOOR, cellOf } from "./walkgrid.js";
import { MAX_DROP, LAND_OUT } from "./drop.js";


/** How far round him the floor is averaged for the eye on a stair: half a tread (geo.js STAIR.tread is 0.34 m). */
const EYE_RUN = 0.17;

/**
 * The modes a page may be opened in: "mesh" (the default: the baked floor everywhere), "old" (the written plan). A level
 * whose written plan is not kept up to what is drawn (`writtenPlan: false`, T05) is always walked on the baked floor.
 * @param {string | null | undefined} q @param {{ writtenPlan?: boolean }} [level]
 */
export const walkerMode = (q, level) => (q === "old" && level?.writtenPlan !== false ? "old" : "mesh");

/**
 * The porch edges he may hop down from, and jump up onto, found in the grid: a run of open cells along a line whose
 * neighbours across it are floor more than he steps (0.255 m) and up to MAX_DROP lower. An edge with a railing has no open cells along it (the
 * railing is drawn, and keeps him his reach off), so it is not one; nor is a tread (less than 0.2 m). The same shape as
 * the written `walk.drops` ({ a, b, normal, top }, the normal pointing down off the edge), so findDrop and findClimb
 * read them unchanged. Only where the ground 0.9 m out is clear a quarter of a metre round, as findDrop asks before it
 * hops (so an edge stops short of a stair's cheek or a column at its foot, as the written ones did).
 * @param {any} g @param {{ x0: number, x1: number, z0: number, z1: number } | null} box only edges whose middle is inside
 */
export function ledgesOf(g, box = null, { min = 0.255, max = MAX_DROP, span = 0.6, even = 0.02, outs = LAND_OUT, round = 0.25 } = {}) {
  const { nx, nz, step, height, state } = g, out = [];
  const hAt = (/** @type {number} */ k) => (height[k] === NO_FLOOR ? NaN : height[k] / 100 + g.base);
  const R = Math.round(round / step);
  // (i, j) of a cell; is the ground some way beyond it, along (di, dj), open and level where he would come down (drop.js
  // findDrop: 0.9 m out, clear a quarter of a metre round; or nearer, clear a quarter of a metre along the edge)?
  const lands = (/** @type {number} */ i, /** @type {number} */ j, /** @type {number} */ di, /** @type {number} */ dj, /** @type {number} */ top) => {
    for (const [n, o] of outs.entries()) {
      const far = Math.round(o / step), ci = i + di * far, cj = j + dj * far; if (ci < R || cj < R || ci >= nx - R || cj >= nz - R) continue;
      const y = hAt(cj * nx + ci); if (!(top - y >= 0.2 && top - y <= max)) continue;
      const pts = n === 0 ? [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]] : di ? [[0, 0], [0, R], [0, -R]] : [[0, 0], [R, 0], [-R, 0]];
      if (pts.every(([a, b]) => { const k = (cj + b) * nx + ci + a; return !state[k] && Math.abs(hAt(k) - y) <= 0.04; })) return true;
    }
    return false;
  };
  // For an edge facing ±x, the cells of one column whose neighbour in the next column is lower, run along z; facing ±z,
  // of one row, run along x. A run breaks where a cell is shut, the fall is out of range, or the porch steps.
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const lines = di ? nx : nz, len = di ? nz : nx, d = di || dj;
    for (let L = 0; L < lines; L++) {
      const lo = L + d; if (lo < 0 || lo >= lines) continue;
      /** @type {{ s0: number, n: number, sum: number } | null} */ let run = null;
      const close = () => {
        if (run && run.n * step >= span) {
          const top = run.sum / run.n, line = (di ? g.x0 : g.z0) + (L + (d > 0 ? 1 : 0)) * step, s0 = (di ? g.z0 : g.x0) + run.s0 * step, s1 = s0 + run.n * step;
          const e = di ? { a: [line, s0], b: [line, s1], normal: [di, 0], top: +top.toFixed(3) } : { a: [s0, line], b: [s1, line], normal: [0, dj], top: +top.toFixed(3) };
          const mx = (e.a[0] + e.b[0]) / 2, mz = (e.a[1] + e.b[1]) / 2;
          if (!box || (mx > box.x0 && mx < box.x1 && mz > box.z0 && mz < box.z1)) out.push(e);
        }
        run = null;
      };
      for (let s = 0; s < len; s++) {
        const k = di ? s * nx + L : L * nx + s, kk = di ? s * nx + lo : lo * nx + s;
        const top = hAt(k); let fall = top - hAt(kk);
        // (Past a lip too narrow to stand on, a little lower and shut: the base course under a platform's edge.)
        for (let n = 2; n <= 5 && fall >= 0 && fall < min && state[kk]; n++) { const far2 = L + d * n; if (far2 < 0 || far2 >= lines) break; fall = top - hAt(di ? s * nx + far2 : far2 * nx + s); if (!(fall < min)) break; }
        if (state[k] || !(fall >= min && fall <= max) || !lands(di ? L : s, di ? s : L, di, dj, top)) { close(); continue; }
        if (run && Math.abs(top - run.sum / run.n) > even) close();
        if (!run) run = { s0: s, n: 0, sum: 0 };
        run.n++; run.sum += top;
      }
      close();
    }
  }
  return out;
}

/**
 * The walker over the baked grid, holding the written plan's for whatever the grid does not answer.
 * @param {any} old createWalker(site)
 * @param {{ outdoors: any, lofts?: Record<string, any>, rooms?: Record<string, any> }} grids decoded grids by place
 */
// Before a hall's door (#294): a visitor walks at a two-metre doorway and expects to go in, but he goes in only within
// DOOR.half (0.61 m) of its middle, and from 0.7 m off it the frame stopped him dead. Within this much of the door, while he
// heads in, his step is bent toward its middle, as a game's doors draw a walker in (a door's "magnetism", a funnel).
export const FUNNEL = Object.freeze({
  depth: 1.5,   // how far before the door's line it reaches, metres
  past: 0.3,    // and how far past it: the pocket beside the doorway, between the leaf's frame and the threshold he may not cross
  half: 1.1,    // how far either side of the door's middle (the doorway is 2 m; past this is the wall or a column)
  core: 0.35,   // within this of the middle he is left to go straight in
  pull: 0.9,    // at most this much of his step goes across toward the middle
  heading: 0.5, // he is heading in when at least this much of his step is toward the door
});
/** @param {any} old @param {any} grids @param {{ doors?: any[] }} [opts] the halls (site.halls), for the funnel before each door */
export function createGridWalker(old, grids, opts = {}) {
  const mode = "mesh";
  // Each hall's door: where its line is, the way in, and the way across it.
  const doors = (opts.doors || []).map((h) => { const ix = h.door[0] - h.out[0], iz = h.door[1] - h.out[1], d = Math.hypot(ix, iz) || 1; return { x: h.door[0], z: h.door[1], ux: ix / d, uz: iz / d, lx: -iz / d, lz: ix / d }; });
  // Which grid, and which of its cells, answers for (x, z) now, or -1 where the written plan does.
  /** @returns {any} */
  const gridNow = () => {
    if (old.room) return grids.rooms?.[old.room.id] || null;
    if (old.loft) return grids.lofts?.[old.loft] || null;
    return grids.outdoors;
  };
  let G = null, K = -1;
  const cell = (/** @type {number} */ x, /** @type {number} */ z) => {
    G = gridNow(); K = -1;
    if (!G) return -1;
    const k = cellOf(G, x, z); if (k < 0 || G.height[k] === NO_FLOOR) return -1;   // no floor reached here: the plan says (a wall, a hall's shell)
    K = k; return k;
  };
  const floorY = () => G.height[K] / 100 + G.base;
  const onStairs = (/** @type {number} */ x, /** @type {number} */ z) => {
    if (cell(x, z) < 0) return old.onStairs(x, z);
    const g = G, k = K, i = k % g.nx, j = (k - i) / g.nx, h = g.height[k], n = Math.round(0.3 / g.step);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 1; d <= n; d++) {
      const ii = i + di * d, jj = j + dj * d; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.nz) break;
      const kk = jj * g.nx + ii, hh = g.height[kk]; if (hh === NO_FLOOR) break; if (g.state[kk]) continue;   // (only a tread he can stand on)
      const rise = Math.abs(hh - h); if (rise >= 8 && rise <= 25) return true; if (rise > 25) break;
    }
    return false;
  };
  // The porch edges, found in the grid.
  const outdoors = grids.outdoors, found = outdoors ? ledgesOf(outdoors) : [];
  return {
    kind: "grid", mode, old,
    drops: found,
    setRoom(/** @type {any} */ r) { old.setRoom(r); }, get room() { return old.room; },
    setLoft(/** @type {any} */ id) { old.setLoft(id); }, get loft() { return old.loft; },
    heightAt(/** @type {number} */ x, /** @type {number} */ z) { return cell(x, z) < 0 ? old.heightAt(x, z) : floorY(); },
    blocked(/** @type {number} */ x, /** @type {number} */ z) {
      if (cell(x, z) >= 0) return G.state[K] !== 0;
      // Inside the grid's ground but where it reached no floor (within a hall's walls, a wall's body): shut, as drawn.
      if (G && cellOf(G, x, z) >= 0) return true;
      return old.blocked(x, z);
    },
    /** The grid that answers where he is now (out of doors, the room he is in, the balcony he is on), for the debug panel's drawing of it (walkviz.js). */
    grid: () => gridNow(),
    /** Is (x, z) answered by the grid (true) or by the written plan (false)? */
    answers(/** @type {number} */ x, /** @type {number} */ z) { return cell(x, z) >= 0; },
    // Where he stands on the court's own ground rather than on a building's floor or a stair (a tap aimed at a hall).
    onGround(/** @type {number} */ x, /** @type {number} */ z) { return cell(x, z) < 0 ? old.onGround(x, z) : !old.room && !old.loft && floorY() - (G.base || 0) < 0.12 && old.onGround(x, z); },
    // What a shoe comes down on, whether this is a stair, and every question the eye asks: still the written plan's.
    floorAt: (/** @type {number} */ x, /** @type {number} */ z) => old.floorAt(x, z),
    // On a stair: where the grid answers, where the open floor steps by a tread (0.08 to 0.25 m) within 0.3 m, so that his pace
    // and gait there (#273) and the eye's slope ask the same floor his feet stand on. (The written stairs' rectangles take
    // in the landing at their head and stop a cell short of their foot.)
    onStairs,
    // Where the eye rides: the floor he stands on; on a stair, its slope rather than its treads (the mean of the open floor
    // within half a tread of him, leaving out whatever lies more than a step above or below: the court under a porch's edge).
    // It is the grid's own floor, not the written plan's ramp: asking the written plan put the eye under a platform whose
    // sides the grid opens and the plan had solid (#265: the owner, at the great hall's east end, saw from his own eyes the
    // underside of the floor), and where its ramp and the drawn treads drifted a tread apart the eye flipped between them (#274).
    eyeAt(/** @type {number} */ x, /** @type {number} */ z) {
      if (cell(x, z) < 0) return old.eyeAt(x, z);
      if (!onStairs(x, z)) { cell(x, z); return floorY(); }
      cell(x, z);
      const g = G, k = K, fx = (x - g.x0) / g.step - 0.5, fz = (z - g.z0) / g.step - 0.5, h = g.height[k], R = EYE_RUN / g.step, n = Math.ceil(R);
      const ci = Math.round(fx), cj = Math.round(fz); let sum = 0, w = 0;
      for (let b = -n; b <= n; b++) for (let a = -n; a <= n; a++) {
        const ii = ci + a, jj = cj + b; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.nz) continue;
        const d = Math.hypot(ii - fx, jj - fz); if (d > R) continue;
        const kk = jj * g.nx + ii, hh = g.height[kk]; if (hh === NO_FLOOR || g.state[kk] || Math.abs(hh - h) > 26) continue;
        const q = 1 - d / (R + 1); sum += hh * q; w += q;
      }
      return (w ? sum / w : h) / 100 + g.base;
    },
    /**
     * Before a hall's door, heading in: the step (vx, vz) bent toward the door's middle, as long as it was, the step straight across toward it for when the frame is in the way, and the step straight in; null anywhere else
     * (stride.js asks it before each step; the written plan's walker has no funnel).
     */
    funnel(/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ vx, /** @type {number} */ vz) {
      if (old.room || old.loft || !doors.length) return null;
      const v = Math.hypot(vx, vz); if (v < 1e-6) return null;
      for (const d of doors) {
        const rx = x - d.x, rz = z - d.z, along = rx * d.ux + rz * d.uz, across = rx * d.lx + rz * d.lz, inward = (vx * d.ux + vz * d.uz) / v;
        if (along < -FUNNEL.depth || along > FUNNEL.past || Math.abs(across) > FUNNEL.half || inward < FUNNEL.heading) continue;
        if (Math.abs(across) <= FUNNEL.core) return null;
        const pull = -Math.sign(across) * Math.min(Math.abs(across) - FUNNEL.core, v * FUNNEL.pull), fwd = Math.max(inward * v, v * 0.3);
        const bx = d.ux * fwd + d.lx * pull, bz = d.uz * fwd + d.lz * pull, b = Math.hypot(bx, bz);
        return [(bx / b) * v, (bz / b) * v, -Math.sign(across) * d.lx * v, -Math.sign(across) * d.lz * v, d.ux * v, d.uz * v];   // (and, should the frame stop him, the step across toward the middle, and the step in)
      }
      return null;
    },
    landAt: (/** @type {number} */ x, /** @type {number} */ z) => old.landAt(x, z),
    wall: (/** @type {number} */ x, /** @type {number} */ z) => old.wall(x, z),
    railNear: (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z, /** @type {number} */ m) => old.railNear(x, y, z, m),
    eyeShut: (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z, /** @type {number} */ foot) => old.eyeShut(x, y, z, foot),
  };
}

/**
 * Where to stand him when he is put down at (x, z) (a kept place, a `?cam` address) and that is shut: the nearest open
 * spot within `max` metres (on the grid every open cell can be walked to from where he arrives; it was flooded from
 * there), or null when there is none, and he goes back to the start of the path. An open spot is kept as it is.
 * @param {{ blocked: (x: number, z: number) => boolean }} walker @param {number} x @param {number} z
 */
export function settle(walker, x, z, max = 0.5, step = 0.025) {
  if (!walker.blocked(x, z)) return { x, z };
  for (let r = step; r <= max + 1e-9; r += step) {
    const n = Math.max(8, Math.ceil((2 * Math.PI * r) / step));
    let best = null;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!walker.blocked(px, pz)) { best = { x: px, z: pz }; break; } }
    if (best) return best;
  }
  return null;
}

/**
 * The decoded file's grids by place, as createGridWalker takes them.
 * @param {{ grids: any[] }} decoded
 */
export function gridsByPlace(decoded) {
  const out = { outdoors: null, lofts: /** @type {Record<string, any>} */ ({}), rooms: /** @type {Record<string, any>} */ ({}) };
  for (const g of decoded.grids) {
    if (g.kind === "outdoors") out.outdoors = g;
    else if (g.kind === "loft") out.lofts[g.id.slice(5)] = g;
    else if (g.kind === "room") out.rooms[g.id.slice(5)] = g;
  }
  return out;
}

/** Bytes the grids hold in memory (heights and states; the old walker's bits are not kept). @param {any} grids */
export function gridBytes(grids) {
  let n = 0; for (const g of [grids.outdoors, ...Object.values(grids.lofts || {}), ...Object.values(grids.rooms || {})]) if (g) n += g.height.byteLength + g.state.byteLength;
  return n;
}
