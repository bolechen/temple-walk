// The one search over a grid that both ways round are found with: the way a tap on the ground walks him round what
// stands in his way (route.js, over the floor he can stand on) and the way the eye swings round him through clear air
// when no arc will do (director.js `wayRoundSteps`, over points in the air at three heights). The two differ only in
// what a cell is and which cells touch (each passes its own `edges`); the search itself, the order it looks at cells
// in, the nearest it has come when it gives up, and when it hands the frame back, are here once (#194, the first step
// of #161's migration).
//
// A* with a binary heap. A cell's entry is left in the heap when a shorter way to it is found, and skipped when it
// comes up stale (its cost no longer the cell's best), so a cell is looked at once for each time its cost fell, not
// once for every way that reached it.

/**
 * @typedef {{ end: number, reached: boolean, best: number, bestH: number, chain: number[], g: Map<number, number>, prev: Map<number, number>, tag: Map<number, unknown>, looked: number }} GridResult
 */

/**
 * Search from `start` toward the cells `goal` accepts, a cell at a time; yields whenever `pause(looked)` says so, and
 * returns what it found. `edges(k, link)` calls `link(next, cost, tag?, price?)` for each cell that can be stepped to
 * from `k`: `cost` is the distance, `price` a fixed charge on top of it (what a hop down a porch's edge is worth), and a
 * tag is kept with the step into `next` (the hop's plan); `h(k)` is the straight distance left, used
 * both to order the search and to say which cell came nearest. The search ends at the first goal taken from the heap,
 * when `cap` cells have been looked at, or when nothing is left; `reached` says whether a goal was taken, `best` is the
 * cell that came nearest (by `h`), and `chain` runs from `start` to the goal, or to `best` if none was reached.
 * @param {{ start: number, h: (k: number) => number, goal: (k: number, hk: number) => boolean, edges: (k: number, link: (next: number, cost: number, tag?: unknown, price?: number) => void) => void, cap?: number, pause?: (looked: number) => boolean }} o
 * @returns {Generator<void, GridResult>}
 */
export function* gridSearch({ start, h, goal, edges, cap = Infinity, pause = () => false }) {
  const g = new Map([[start, 0]]), prev = new Map(), tag = new Map(), heap = /** @type {[number, number, number][]} */ ([]);
  const push = (/** @type {number} */ f, /** @type {number} */ k, /** @type {number} */ gk) => { heap.push([f, k, gk]); let a = heap.length - 1; while (a > 0) { const p = (a - 1) >> 1; if (heap[p][0] <= heap[a][0]) break; [heap[p], heap[a]] = [heap[a], heap[p]]; a = p; } };
  const pop = () => { const top = heap[0], last = /** @type {[number, number, number]} */ (heap.pop()); if (heap.length) { heap[0] = last; let a = 0; for (;;) { const l = 2 * a + 1, r = l + 1; let m = a; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === a) break; [heap[m], heap[a]] = [heap[a], heap[m]]; a = m; } } return top; };
  let from = start, gk = 0;
  const link = (/** @type {number} */ nk, /** @type {number} */ cost, /** @type {unknown} */ t, price = 0) => {
    const ng = gk + cost + price;
    if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); prev.set(nk, from); if (t === undefined) tag.delete(nk); else tag.set(nk, t); push(ng + h(nk), nk, ng); }
  };
  const h0 = h(start); push(h0, start, 0);
  let best = start, bestH = h0, end = -1, looked = 0;
  while (heap.length) {
    const [, k, gAt] = pop();
    if (gAt !== g.get(k)) continue;   // a stale entry: a shorter way to this cell was found after it was put in
    const hk = h(k); if (hk < bestH) { bestH = hk; best = k; }
    if (goal(k, hk)) { end = k; break; }
    if (++looked > cap) break;
    if (pause(looked)) yield;
    from = k; gk = gAt; edges(k, link);
  }
  const reached = end >= 0, last = reached ? end : best, chain = [last];
  for (let k = last; prev.has(k); ) { k = /** @type {number} */ (prev.get(k)); chain.push(k); }
  chain.reverse();
  return { end: last, reached, best, bestH, chain, g, prev, tag, looked };
}
