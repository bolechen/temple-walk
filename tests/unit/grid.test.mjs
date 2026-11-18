// The one search over a grid (grid.js, #194): a tap on the ground (route.js) and the eye's way round him (director.js)
// are both found by it, and neither keeps a search of its own.
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { gridSearch } = await import("../../app/src/grid.js");

const drain = (it) => { let r = it.next(), slices = 0; while (!r.done) { slices++; r = it.next(); } return { ...r.value, slices }; };
// A small floor W x H, `#` shut; four ways, each step a metre.
function floor(rows) {
  const H = rows.length, W = rows[0].length, open = (i, j) => i >= 0 && j >= 0 && i < W && j < H && rows[j][i] !== "#";
  const find = (c) => { for (let j = 0; j < H; j++) { const i = rows[j].indexOf(c); if (i >= 0) return j * W + i; } return -1; };
  const S = find("S"), G = find("G"), gi = G % W, gj = (G - gi) / W;
  const h = (k) => { const i = k % W; return Math.hypot(i - gi, (k - i) / W - gj); };
  const edges = (k, link) => { const i = k % W, j = (k - i) / W; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(i + di, j + dj)) link((j + dj) * W + i + di, 1); };
  return { S, G, W, h, edges };
}

test("the shortest way round a wall, from start to goal", () => {
  const f = floor(["S..#....", "...#.##.", "...#..#.", "......#G"]);
  const r = drain(gridSearch({ start: f.S, h: f.h, goal: (k) => k === f.G, edges: f.edges }));
  assert.ok(r.reached); assert.equal(r.chain[0], f.S); assert.equal(r.chain.at(-1), f.G);
  assert.equal(r.g.get(f.G), r.chain.length - 1, "each step a metre, none wasted");
  for (let n = 1; n < r.chain.length; n++) { const a = r.chain[n - 1], b = r.chain[n]; assert.equal(Math.abs(a % f.W - b % f.W) + Math.abs(Math.floor(a / f.W) - Math.floor(b / f.W)), 1, "each step to a neighbour"); }
  // the shortest, counted by a plain breadth-first walk
  const dist = new Map([[f.S, 0]]), q = [f.S]; while (q.length) { const k = q.shift(); f.edges(k, (n) => { if (!dist.has(n)) { dist.set(n, dist.get(k) + 1); q.push(n); } }); }
  assert.equal(r.g.get(f.G), dist.get(f.G));
});

test("a goal that cannot be reached: the nearest cell it came to, not reached", () => {
  const f = floor(["S..#...", "...#.G.", "...#..."]);
  const r = drain(gridSearch({ start: f.S, h: f.h, goal: (k) => k === f.G, edges: f.edges }));
  assert.ok(!r.reached); assert.equal(r.end, r.best); assert.equal(r.best % f.W, 2, "the nearest is against the wall"); assert.equal(r.chain[0], f.S);
});

test("the search stops after `cap` cells, and gives the frame back whenever `pause` asks", () => {
  const f = floor(["S.........", "..........", "..........", ".........G"]);
  const capped = drain(gridSearch({ start: f.S, h: () => 0, goal: (k) => k === f.G, edges: f.edges, cap: 5 }));
  assert.ok(!capped.reached); assert.equal(capped.looked, 6, "the sixth cell is not looked at");
  const sliced = drain(gridSearch({ start: f.S, h: f.h, goal: (k) => k === f.G, edges: f.edges, pause: (n) => n % 2 === 0 }));
  const whole = drain(gridSearch({ start: f.S, h: f.h, goal: (k) => k === f.G, edges: f.edges }));
  assert.ok(sliced.slices >= 2); assert.deepEqual(sliced.chain, whole.chain, "pausing changes nothing found");
});

test("a step's tag and fixed price are kept with it; a cheaper plain step later takes the tag away", () => {
  // 0 -> 1 -> 2 -> 3 plain (1 each); 0 -> 3 by a "hop" costing 1 + price
  const edges = (price) => (k, link) => { if (k < 3) link(k + 1, 1); if (k === 0) link(3, 1, "hop", price); };
  const hop = drain(gridSearch({ start: 0, h: () => 0, goal: (k) => k === 3, edges: edges(0.5) }));
  assert.deepEqual(hop.chain, [0, 3]); assert.equal(hop.tag.get(3), "hop"); assert.equal(hop.g.get(3), 1.5);
  const walk = drain(gridSearch({ start: 0, h: () => 0, goal: (k) => k === 3, edges: edges(5) }));
  assert.deepEqual(walk.chain, [0, 1, 2, 3]); assert.equal(walk.tag.has(3), false, "reached on foot in the end: no hop");
});

test("route.js and director.js search with grid.js and keep no heap or A* of their own", () => {
  for (const f of ["route.js", "director.js"]) {
    const src = readFileSync(new URL(`../../app/src/${f}`, import.meta.url), "utf8");
    assert.match(src, /import \{ gridSearch \} from "\.\/grid\.js"/, `${f} imports the shared search`);
    assert.match(src, /yield\* gridSearch\(/, `${f} searches with it`);
    assert.doesNotMatch(src, /heap|const open = new Map\(\[\[/, `${f} keeps no frontier of its own`);
  }
});
