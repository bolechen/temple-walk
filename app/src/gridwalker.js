// The walker that answers from the floor baked from the drawn meshes (#265, the third step of #161's migration). Where
// he may stand, what stops him and the height of the floor under him are read from the grid `tools/bake-walk.mjs` bakes
// (app/src/walkgrid.js): what is drawn is what stops him, and nobody keeps a second copy of it in step by hand.
//
// For now it answers only over the first court's terrace (`courtRegion`: from the top of the flight up from the
// mountain path, through the forecourt, the gate and the first court, to the foot of the stair to the library's
// terrace), and only for walking, being stopped, a tap on the ground and the hops up and down a porch's edge. Everything
// else is asked of the walker of the written plan (createWalker in site.js), which it holds: the other terraces, the
// path, the rooms, the summit pavilion's balcony, and every question the eye asks (eyeShut, eyeAt, railNear, wall,
// landAt), which the fifth step moves. `?walker=old` is the written plan everywhere; `?walker=mesh` is the grid
// wherever there is one (outdoors, the balcony, every room), to look ahead at the fourth step.
//
// The two meet at the flights between terraces: the grid stops at the first tread of each, where both say the floor is
// the court's (tests/unit/gridwalker.test.mjs walks every such flight up and down on both).
import { NO_FLOOR, cellOf } from "./walkgrid.js";
import { MAX_DROP } from "./drop.js";

/** The modes a page may be opened in: "court" (the default), "old", "mesh". @param {string | null | undefined} q */
export const walkerMode = (q) => (q === "old" || q === "mesh" ? q : "court");

/**
 * The first court's terrace, from the plan: between the flight up from the path (`SITE.fore`) and the foot of the stair to
 * the first terrace above, wall to wall (outside the walls the written plan answers: its hillside and grove are solid, and
 * the bamboo is not in the bake). Read from the stairs themselves (`walk.ramps`), so that moving a terrace moves it.
 * @param {any} site @param {{ fore: number, x: number }} SITE @param {{ zS: number }} T1
 */
export function courtRegion(site, SITE, T1) {
  const ramps = site.walk.ramps, near = (/** @type {number} */ a, /** @type {number} */ b) => Math.abs(a - b) < 0.05;
  const up = ramps.find((/** @type {any} */ r) => near(r.high[1], T1.zS)), path = ramps.find((/** @type {any} */ r) => near(r.high[1], SITE.fore));
  return { x0: -SITE.x, x1: SITE.x, z0: up ? up.z1 : T1.zS, z1: path ? path.z0 : SITE.fore };
}

/**
 * A copy of the part of a grid inside `box` (and the rest let go): the default page keeps only the court's cells.
 * @param {any} g @param {{ x0: number, x1: number, z0: number, z1: number }} box
 */
export function cropGrid(g, box) {
  const i0 = Math.max(0, Math.floor((box.x0 - g.x0) / g.step)), j0 = Math.max(0, Math.floor((box.z0 - g.z0) / g.step));
  const i1 = Math.min(g.nx, Math.ceil((box.x1 - g.x0) / g.step)), j1 = Math.min(g.nz, Math.ceil((box.z1 - g.z0) / g.step));
  const nx = Math.max(0, i1 - i0), nz = Math.max(0, j1 - j0), height = new Int16Array(nx * nz), state = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) { const from = (j + j0) * g.nx + i0; height.set(g.height.subarray(from, from + nx), j * nx); state.set(g.state.subarray(from, from + nx), j * nx); }
  return { id: g.id, kind: g.kind, base: g.base, step: g.step, names: g.names, x0: g.x0 + i0 * g.step, z0: g.z0 + j0 * g.step, nx, nz, height, state };
}

/**
 * The porch edges he may hop down from, and jump up onto, found in the grid: a run of open cells along a line whose
 * neighbours across it are floor between 0.2 m and MAX_DROP lower. An edge with a railing has no open cells along it (the
 * railing is drawn, and keeps him his reach off), so it is not one; nor is a tread (less than 0.2 m). The same shape as
 * the written `walk.drops` ({ a, b, normal, top }, the normal pointing down off the edge), so findDrop and findClimb
 * read them unchanged. Only where the ground 0.9 m out is clear a quarter of a metre round, as findDrop asks before it
 * hops (so an edge stops short of a stair's cheek or a column at its foot, as the written ones did).
 * @param {any} g @param {{ x0: number, x1: number, z0: number, z1: number } | null} box only edges whose middle is inside
 */
export function ledgesOf(g, box = null, { min = 0.2, max = MAX_DROP, span = 0.6, even = 0.02, out: OUT = 0.9, round = 0.25 } = {}) {
  const { nx, nz, step, height, state } = g, out = [];
  const hAt = (/** @type {number} */ k) => (height[k] === NO_FLOOR ? NaN : height[k] / 100 + g.base);
  const far = Math.round(OUT / step), R = Math.round(round / step);
  // (i, j) of a cell; is the ground OUT beyond it, along (di, dj), open and level a quarter of a metre round?
  const lands = (/** @type {number} */ i, /** @type {number} */ j, /** @type {number} */ di, /** @type {number} */ dj) => {
    const ci = i + di * far, cj = j + dj * far; if (ci < R || cj < R || ci >= nx - R || cj >= nz - R) return false;
    const y = hAt(cj * nx + ci);
    for (const [a, b] of [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]]) { const k = (cj + b) * nx + ci + a; if (state[k] || !(Math.abs(hAt(k) - y) <= 0.04)) return false; }
    return true;
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
        const top = hAt(k), fall = top - hAt(kk);
        if (state[k] || !(fall >= min && fall <= max) || !lands(di ? L : s, di ? s : L, di, dj)) { close(); continue; }
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
 * @param {{ mode?: "court" | "mesh", region?: { x0: number, x1: number, z0: number, z1: number } | null, drops?: any[] }} opts
 *   `region`: where outdoors the grid answers (null: everywhere it has a floor); `drops`: the written porch edges, kept outside it
 */
export function createGridWalker(old, grids, { mode = "court", region = null, drops = [] } = {}) {
  const inBox = (/** @type {any} */ b, /** @type {number} */ x, /** @type {number} */ z) => !b || (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  // Which grid, and which of its cells, answers for (x, z) now, or -1 where the written plan does.
  /** @returns {any} */
  const gridNow = () => {
    if (old.room) return mode === "mesh" ? grids.rooms?.[old.room.id] || null : null;
    if (old.loft) return mode === "mesh" ? grids.lofts?.[old.loft] || null : null;
    return grids.outdoors;
  };
  let G = null, K = -1;
  const cell = (/** @type {number} */ x, /** @type {number} */ z) => {
    G = gridNow(); K = -1;
    if (!G || (!old.room && !old.loft && !inBox(region, x, z))) return -1;
    const k = cellOf(G, x, z); if (k < 0 || G.height[k] === NO_FLOOR) return -1;   // no floor reached here: the plan says (a wall, a hall's shell)
    K = k; return k;
  };
  const floorY = () => G.height[K] / 100 + G.base;
  // The porch edges: found in the grid where it answers, the written ones elsewhere.
  const outdoors = grids.outdoors, found = outdoors ? ledgesOf(outdoors, region) : [];
  const kept = region ? drops.filter((/** @type {any} */ e) => !inBox(region, (e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2)) : mode === "mesh" ? [] : drops;
  return {
    kind: "grid", mode, region, old,
    drops: [...found, ...kept],
    setRoom(/** @type {any} */ r) { old.setRoom(r); }, get room() { return old.room; },
    setLoft(/** @type {any} */ id) { old.setLoft(id); }, get loft() { return old.loft; },
    heightAt(/** @type {number} */ x, /** @type {number} */ z) { return cell(x, z) < 0 ? old.heightAt(x, z) : floorY(); },
    blocked(/** @type {number} */ x, /** @type {number} */ z) {
      if (cell(x, z) >= 0) return G.state[K] !== 0;
      // Inside the grid's ground but where it reached no floor (within a hall's walls, a wall's body): shut, as drawn.
      if (G && (old.room || old.loft || inBox(region, x, z)) && cellOf(G, x, z) >= 0) return true;
      return old.blocked(x, z);
    },
    /** Is (x, z) answered by the grid (true) or by the written plan (false)? */
    answers(/** @type {number} */ x, /** @type {number} */ z) { return cell(x, z) >= 0; },
    // Where he stands on the court's own ground rather than on a building's floor or a stair (a tap aimed at a hall).
    onGround(/** @type {number} */ x, /** @type {number} */ z) { return cell(x, z) < 0 ? old.onGround(x, z) : !old.room && !old.loft && floorY() - (G.base || 0) < 0.12 && old.onGround(x, z); },
    // What a shoe comes down on, whether this is a stair, and every question the eye asks: still the written plan's.
    floorAt: (/** @type {number} */ x, /** @type {number} */ z) => old.floorAt(x, z),
    onStairs: (/** @type {number} */ x, /** @type {number} */ z) => old.onStairs(x, z),
    eyeAt: (/** @type {number} */ x, /** @type {number} */ z) => old.eyeAt(x, z),
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
 * The decoded file's grids by place, as createGridWalker takes them; in "court" mode only the court's cells are kept.
 * @param {{ grids: any[] }} decoded @param {"court" | "mesh"} mode @param {any} region
 */
export function gridsByPlace(decoded, mode, region) {
  const out = { outdoors: null, lofts: /** @type {Record<string, any>} */ ({}), rooms: /** @type {Record<string, any>} */ ({}) };
  for (const g of decoded.grids) {
    if (g.kind === "outdoors") out.outdoors = mode === "court" && region ? cropGrid(g, { x0: region.x0 - 1, x1: region.x1 + 1, z0: region.z0 - 1, z1: region.z1 + 1 }) : g;
    else if (mode === "mesh" && g.kind === "loft") out.lofts[g.id.slice(5)] = g;
    else if (mode === "mesh" && g.kind === "room") out.rooms[g.id.slice(5)] = g;
  }
  return out;
}

/** Bytes the grids hold in memory (heights and states; the old walker's bits are not kept). @param {any} grids */
export function gridBytes(grids) {
  let n = 0; for (const g of [grids.outdoors, ...Object.values(grids.lofts || {}), ...Object.values(grids.rooms || {})]) if (g) n += g.height.byteLength + g.state.byteLength;
  return n;
}
