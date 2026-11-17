// The way to a tapped spot when the straight line is not open (#154): a search over the floor he can stand on, pulled
// taut, that goes round columns, tables and cushions, takes the stairs, and, where a porch has an unrailed edge a good
// deal nearer than any stair, hops down it (drop.js `findDrop`, the same hop the Space key makes). It never hops up:
// a tap on a platform is walked there by its steps.
//
// The search is a generator, `planSteps`: it runs a few hundred cells at a time and gives the frame back, so that a
// long way round costs the frame no more than `ROUTE.budget` milliseconds (the way `director.js` does its swings).
import { findDrop } from "./drop.js";

export const ROUTE = Object.freeze({
  cell: 0.2,        // the grid he is searched over, metres
  margin: 10,       // how far outside the box round the two ends the search may go
  step: 0.34,       // the most the floor may rise or fall between two neighbouring cells (a tread is under 0.2)
  hop: 3,           // metres of walking a hop down is worth: it is taken when it saves at least this much on the way round
  cap: 120000,      // cells looked at before the search settles for the nearest it has seen
  slice: 400,       // cells between looks at the clock
  budget: 4,        // milliseconds of one frame
});

/** Can he walk the straight line between two points: every tenth of a metre open, the floor never stepping. */
export function clearLine(walker, a, b, step = ROUTE.step) {
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 0.1));
  let h = walker.heightAt(a.x, a.z);
  for (let i = 1; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    if (walker.blocked(x, z)) return false;
    const g = walker.heightAt(x, z); if (Math.abs(g - h) > step) return false; h = g;
  }
  return true;
}

/** The nearest open point to (x, z) within `max` metres, or null. */
export function nearestOpen(walker, x, z, max = 2.5) {
  if (!walker.blocked(x, z)) return { x, z };
  for (let r = 0.1; r <= max; r += 0.1) for (let k = 0; k < Math.ceil(r * 40); k++) {
    const a = (k / Math.ceil(r * 40)) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    if (!walker.blocked(px, pz)) return { x: px, z: pz };
  }
  return null;
}

/**
 * The route from `from` to `to` as a generator that yields while it works and returns
 * `{ points: [{ x, z, drop? }], reached }`: the points to walk to in order (`drop` is a plan from findDrop, to be made
 * standing at that point), and whether the last one is the tapped spot (or within a stride of it) rather than the nearest he can reach.
 */
export function* planSteps(walker, drops, from, to, opts = {}) {
  const C = ROUTE.cell, o = { ...ROUTE, ...opts };
  const x0 = Math.min(from.x, to.x) - o.margin, z0 = Math.min(from.z, to.z) - o.margin, x1 = Math.max(from.x, to.x) + o.margin, z1 = Math.max(from.z, to.z) + o.margin;
  const W = Math.ceil((x1 - x0) / C) + 1, H = Math.ceil((z1 - z0) / C) + 1;
  const cx = (i) => x0 + i * C, cz = (j) => z0 + j * C, id = (i, j) => j * W + i;
  const ci = (x) => Math.max(0, Math.min(W - 1, Math.round((x - x0) / C))), cj = (z) => Math.max(0, Math.min(H - 1, Math.round((z - z0) / C)));
  const open = new Map(), floor = new Map();
  const isOpen = (i, j) => { const k = id(i, j); let v = open.get(k); if (v === undefined) { v = !walker.blocked(cx(i), cz(j)); open.set(k, v); if (v) floor.set(k, walker.heightAt(cx(i), cz(j))); } return v; };

  // Where he starts: if he stands in something that blocks, from the nearest open point; the first leg is the step out.
  const out = nearestOpen(walker, from.x, from.z);
  if (!out) return { points: [], reached: false };
  // and the search begins on the nearest open cell to that, which is as far as the first leg goes
  let sc = null; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const i = ci(out.x) + a, j = cj(out.z) + b; if (i < 0 || j < 0 || i >= W || j >= H || !isOpen(i, j)) continue; const d = Math.hypot(cx(i) - out.x, cz(j) - out.z); if (!sc || d < sc.d) sc = { i, j, d }; }
  if (!sc) return { points: [], reached: false };
  const start = { x: cx(sc.i), z: cz(sc.j) }, lead = walker.blocked(from.x, from.z) ? [{ x: start.x, z: start.z }] : [];
  // The hops down: from an open cell on a porch, standing as findDrop wants, to the cell it lands on.
  const links = new Map();
  for (const e of drops) {
    const [nx, nz] = e.normal, ax = e.b[0] - e.a[0], az = e.b[1] - e.a[1], span = Math.hypot(ax, az);
    if (Math.max(e.a[0], e.b[0]) < x0 || Math.min(e.a[0], e.b[0]) > x1 || Math.max(e.a[1], e.b[1]) < z0 || Math.min(e.a[1], e.b[1]) > z1) continue;
    for (let along = 0.3; along <= span - 0.3 + 1e-9; along += C) {
      for (let back = 0.0; back <= 0.5; back += 0.05) {
        const px = e.a[0] + (ax * along) / span - nx * back, pz = e.a[1] + (az * along) / span - nz * back, i = ci(px), j = cj(pz), sx = cx(i), sz = cz(j);
        if (!isOpen(i, j)) continue;
        const plan = findDrop(walker, [e], sx, sz, nx, nz); if (!plan) continue;
        const k = id(i, j); if (!links.has(k)) { links.set(k, { plan, to: [plan.to[0], plan.to[2]] }); }
        break;
      }
    }
  }

  // A*, eight ways, never cutting a corner, the floor not stepping; the goal is any cell within a stride of the tapped spot.
  const goalI = ci(to.x), goalJ = cj(to.z), near = (i, j) => Math.hypot(cx(i) - to.x, cz(j) - to.z);
  const g = new Map(), from_ = new Map(), heap = [], push = (f, k) => { heap.push([f, k]); let a = heap.length - 1; while (a > 0) { const p = (a - 1) >> 1; if (heap[p][0] <= heap[a][0]) break; [heap[p], heap[a]] = [heap[a], heap[p]]; a = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let a = 0; for (;;) { let l = 2 * a + 1, r = l + 1, m = a; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === a) break; [heap[m], heap[a]] = [heap[a], heap[m]]; a = m; } } return top; };
  const si = sc.i, sj = sc.j;
  g.set(id(si, sj), 0); push(near(si, sj), id(si, sj));
  let best = id(si, sj), bestD = near(si, sj), goal = -1, looked = 0, t0 = performance.now();
  while (heap.length) {
    const [, k] = pop(), i = k % W, j = (k - i) / W, gk = g.get(k);
    if (gk === undefined) continue;
    const d = near(i, j); if (d < bestD) { bestD = d; best = k; }
    if (d < 0.3) { goal = k; break; }
    if (++looked > o.cap) break;
    if (looked % o.slice === 0 && performance.now() - t0 > o.budget) { yield; t0 = performance.now(); }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H || !isOpen(ni, nj)) continue;
      if (di && dj && (!isOpen(i + di, j) || !isOpen(i, j + dj))) continue;
      if (Math.abs(floor.get(id(ni, nj)) - floor.get(k)) > o.step) continue;
      const nk = id(ni, nj), ng = gk + (di && dj ? 1.4142 : 1) * C;
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); from_.set(nk, k); push(ng + near(ni, nj), nk); }
    }
    const link = links.get(k);
    if (link) {
      const ti = ci(link.to[0]), tj = cj(link.to[1]), nk = id(ti, tj);
      if (isOpen(ti, tj)) { const ng = gk + Math.hypot(link.to[0] - cx(i), link.to[1] - cz(j)) + o.hop; if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); from_.set(nk, -k - 1); push(ng + near(ti, tj), nk); } }
    }
  }
  const end = goal >= 0 ? goal : best, chain = [];
  for (let k = end; k !== undefined; ) { chain.push(k); const p = from_.get(k); if (p === undefined) break; k = p < 0 ? -p - 1 : p; }
  chain.reverse();
  // Pull it taut: from each point the farthest one that can be walked to in a straight line; a hop is kept as it stands.
  const pts = [{ x: start.x, z: start.z }];
  for (let n = 1; n < chain.length; n++) {
    const k = chain[n], prev = chain[n - 1], hop = from_.get(k) < 0;
    const p = { x: cx(k % W), z: cz((k - (k % W)) / W) };
    if (hop) { const s = links.get(prev); pts[pts.length - 1] = { x: cx(prev % W), z: cz((prev - (prev % W)) / W), drop: s.plan }; pts.push({ x: s.to[0], z: s.to[1], landed: true }); }
    else pts.push(p);
  }
  const taut = [pts[0]];
  for (let n = 1; n < pts.length; n++) {
    const last = taut[taut.length - 1];
    if (last.drop || pts[n].landed) { taut.push(pts[n]); continue; }
    // can the point after this one still be reached in a line from `last`? (a point ahead of a hop is kept)
    const next = pts[n + 1];
    if (next && !pts[n].drop && !next.landed && !next.drop && clearLine(walker, last, next)) continue;
    taut.push(pts[n]);
  }
  const reached = goal >= 0 || bestD < 0.3;
  // The tapped spot itself, when it is open and the last leg to it is a line: so that he stops on it, not on a cell.
  const last = taut[taut.length - 1];
  if (reached && !last.drop && !walker.blocked(to.x, to.z) && clearLine(walker, last, to)) taut.push({ x: to.x, z: to.z });
  return { points: [...lead, ...taut.slice(lead.length || taut[0].drop ? 0 : 1)].filter((p, n, a) => n === 0 || p.x !== a[n - 1].x || p.z !== a[n - 1].z || p.drop), reached };
}

/** The whole route at once (tests, tools). */
export function planRoute(walker, drops, from, to, opts) {
  const it = planSteps(walker, drops, from, to, { ...opts, budget: Infinity });
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
