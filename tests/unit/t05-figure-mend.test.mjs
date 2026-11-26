// What tools/t05-statue/mend.mjs does to a figure before it is packed (#763, #578), held on small made-up surfaces, and what it was made for,
// held on the figure as shipped: Sakyamuni's right wrist as the two nearest places a visitor can stand see it (the art director, 2026-11-26:
// a patch of red on the forearm, a black scrap at the wrist; the west aisle walks nearest).
import test from "node:test"; import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { owners, mendMap, components, tubeMesh, mendShape } from "../../tools/t05-statue/mend.mjs";
const { SOURCE } = await import("../../app/levels/t05/figures/registry.js");
const bin = new URL("../../app/shared/models/t05/", import.meta.url);
const skip = SOURCE.base !== null || existsSync(bin) ? false : "the seven are not published yet (registry.js SOURCE): nothing fetches them";

// a flat sheet of n × n squares in the plane y = `y`, from (x, z) on, each square `d` wide, wound to be seen from above
function sheet(n, x, y, z, d = 0.1) {
  const pos = [], index = [], m = n + 1;
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) pos.push(x + i * d, y, z + j * d);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * m + i; index.push(a, a + m, a + 1, a + 1, a + m, a + m + 1); }
  return { pos, index };
}
// several surfaces as one part, every point looking up and lying at one place of the picture
function part(...surfaces) {
  const pos = [], index = [];
  for (const s of surfaces) { const base = pos.length / 3; pos.push(...s.pos); index.push(...s.index.map((v) => v + base)); }
  const n = pos.length / 3, nor = new Float32Array(n * 3), tan = new Float32Array(n * 4), uv = new Float32Array(n * 2).fill(0.5);
  for (let i = 0; i < n; i++) { nor[i * 3 + 1] = 1; tan[i * 4] = 1; tan[i * 4 + 3] = 1; }
  return { pos: Float32Array.from(pos), nor, tan, uv, index: Uint32Array.from(index) };
}

test("a picture's specks are filled from the sound texels beside them, and nothing else in it changes", () => {
  const W = 32, rgb = Buffer.alloc(W * W * 3), uv = Float32Array.from([0, 0, 1, 0, 1, 1, 0, 1]), index = Uint32Array.from([0, 1, 2, 0, 2, 3]);
  for (let i = 0; i < W * W; i++) { rgb[i * 3] = 140; rgb[i * 3 + 1] = 120; rgb[i * 3 + 2] = 254; }   // a surface that leans a little one way
  const bad = [[10, 10], [11, 10], [10, 11], [20, 5]]; for (const [x, y] of bad) { const i = (y * W + x) * 3; rgb[i] = 250; rgb[i + 1] = 128; rgb[i + 2] = 130; }   // normals lying along the surface
  const before = Buffer.from(rgb), did = mendMap(rgb, W, owners(uv, index, W));
  assert.equal(did.specks, bad.length); assert.equal(did.lost, 0); assert.ok(did.filled > bad.length, "the texels round a speck are mended with it");
  for (const [x, y] of bad) { const i = (y * W + x) * 3; assert.ok(Math.abs(rgb[i] - 140) <= 2 && Math.abs(rgb[i + 1] - 120) <= 2 && rgb[i + 2] >= 252, `the speck at ${x}, ${y} takes what lies round it: ${rgb[i]} ${rgb[i + 1]} ${rgb[i + 2]}`); }
  let far = 0; for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { if (bad.some(([a, b]) => Math.abs(a - x) <= 4 && Math.abs(b - y) <= 4)) continue; const i = (y * W + x) * 3; if (rgb[i] !== before[i] || rgb[i + 1] !== before[i + 1] || rgb[i + 2] !== before[i + 2]) far++; }
  assert.equal(far, 0, "texels away from every speck");
});

test("a sound picture is left as it is", () => {
  const W = 16, rgb = Buffer.alloc(W * W * 3); for (let i = 0; i < W * W; i++) { rgb[i * 3] = 128; rgb[i * 3 + 1] = 128; rgb[i * 3 + 2] = 255; }
  const before = Buffer.from(rgb), did = mendMap(rgb, W, owners(Float32Array.from([0, 0, 1, 0, 1, 1]), Uint32Array.from([0, 1, 2]), W));
  assert.deepEqual([did.specks, did.filled, did.lost, did.margin], [0, 0, 0, 0]); assert.ok(rgb.equals(before));
});

test("components are told apart by where their points are, not by their numbers: two triangles that share an edge through copied points are one", () => {
  const pos = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1, /* copies of two of them */ 1, 0, 0, 0, 0, 1, 1, 0, 1, /* far off */ 5, 0, 0, 6, 0, 0, 5, 0, 1]);
  const C = components(pos, Uint32Array.from([0, 1, 2, 3, 5, 4, 6, 7, 8]));
  assert.deepEqual([...C.of], [0, 0, 1]); assert.deepEqual(C.size, [2, 1]); assert.deepEqual(C.box[1], [5, 6, 0, 0, 0, 1]);
});

test("a tube lies inside the circles it was fitted to, is closed over its far end and shows its outside", () => {
  const stations = [[0, 1, 0, 0.3], [0.1, 1, 0.6, 0.2]], T = tubeMesh(stations, { inset: 0.01, dome: 0.05, segments: 16, step: 0.05 });
  let far = -Infinity, tip = Infinity;
  for (let i = 0; i < T.pos.length; i += 3) {
    const z = T.pos[i + 2], f = Math.min(1, z / 0.6), r = Math.hypot(T.pos[i] - 0.1 * f, T.pos[i + 1] - 1);
    assert.ok(r <= 0.3 - 0.1 * f - 0.01 + 1e-6, `a point at z ${z.toFixed(2)} stands ${r.toFixed(3)} from the middle`);
    if (z > far) { far = z; tip = r; } assert.ok(z > 0 && z <= 0.65 + 1e-6);
  }
  assert.ok(Math.abs(far - 0.65) < 1e-6 && tip < 0.01, "the far end closes to a point's width at the dome's height");
  for (let t = 0; t < T.index.length; t += 3) {
    const [a, b, c] = [T.index[t] * 3, T.index[t + 1] * 3, T.index[t + 2] * 3], u = [0, 1, 2].map((k) => T.pos[b + k] - T.pos[a + k]), v = [0, 1, 2].map((k) => T.pos[c + k] - T.pos[a + k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const z = (T.pos[a + 2] + T.pos[b + 2] + T.pos[c + 2]) / 3, out = [(T.pos[a] + T.pos[b] + T.pos[c]) / 3 - 0.1 * Math.min(1, z / 0.6), (T.pos[a + 1] + T.pos[b + 1] + T.pos[c + 1]) / 3 - 1, z > 0.6 ? 0.05 : 0];   // away from the axis, and over the dome toward the far end
    assert.ok(n[0] * out[0] + n[1] * out[1] + n[2] * out[2] > 0, `triangle ${t / 3} is wound to be seen from outside`);
  }
});

test("scraps are taken away whole, and a spec written for another surface is refused", () => {
  const P = part(sheet(4, 0, 0, 0), sheet(1, 0.1, 0.5, 0.1), sheet(2, 3, 0, 3)), before = Float32Array.from(P.pos);
  const M = mendShape(P, { scraps: { box: [0, 0.4, 0.4, 0.6, 0, 0.4], sizes: [2] } });
  assert.equal(M.did.scraps, 2); assert.equal(M.index.length / 3, 32 + 8); assert.deepEqual(components(M.pos, M.index).size, [32, 8]);
  assert.deepEqual(P.pos, before, "the part handed in is not changed");
  assert.throws(() => mendShape(P, { scraps: { box: [0, 0.4, 0.4, 0.6, 0, 0.4], sizes: [3] } }), /written for another surface/, "no component of that size");
  assert.throws(() => mendShape(part(sheet(4, 0, 0, 0), sheet(1, 0.1, 0.5, 0.1), sheet(1, 3, 0, 3)), { scraps: { box: [0, 0.4, 0.4, 0.6, 0, 0.4], sizes: [2] } }), /written for another surface/, "two components of that size");
  assert.throws(() => mendShape(P, { scraps: { box: [0, 0.4, 0.4, 0.6, 0, 0.4], sizes: [8] } }), /not where the spec has it/, "a component of that size somewhere else");
});

test("a trim takes a component's triangles in a box, and with `thin` only the long thin ones", () => {
  // a sheet 0.2 m square with one more triangle standing on its far edge, as the top of the cloth before Sakyamuni's knee has them
  const stood = (i, j, top) => { const S = sheet(2, 0, 0, 0); S.pos.push(...top); S.index.push(i, j, 9); return part(S); };
  const all = mendShape(stood(6, 8, [0.1, 0.6, 0.2]), { trims: [{ of: "main", box: [-1, 1, 0.1, 1, -1, 1] }] });
  assert.equal(all.did.trims, 1, "the one triangle whose middle is in the box"); assert.equal(all.index.length / 3, 8);
  const sliver = stood(7, 8, [0.19, 0.5, 0.2]), box = [-1, 1, 0.1, 1, -1, 1];   // 0.1 at its foot and 0.5 tall, leaning: a fifth as high as its longest edge
  assert.equal(mendShape(sliver, { trims: [{ of: "main", box, thin: 0.3, longer: 0.04 }] }).did.trims, 1, "thinner than 0.3");
  assert.equal(mendShape(sliver, { trims: [{ of: "main", box, thin: 0.1, longer: 0.04 }] }).did.trims, 0, "not thinner than 0.1");
  assert.equal(mendShape(sliver, { trims: [{ of: "main", box, thin: 0.3, longer: 0.6 }] }).did.trims, 0, "its longest edge is not over 0.6");
  assert.equal(mendShape(stood(6, 8, [0.1, 0.2, 0.2]), { trims: [{ of: "main", box: [-1, 1, 0.05, 1, -1, 1], thin: 0.3, longer: 0.04 }] }).did.trims, 0, "a triangle as tall as it is wide is no sliver");
});

test("a press lays a rim flat at the box's floor, lets go what would hang from it, and turns the pressed points' normals to the flat", () => {
  // a sheet whose far row of points stands up as a rim, and one point high above joined to that rim
  const S = sheet(2, 0, 0, 0); for (const v of [6, 7, 8]) S.pos[v * 3 + 1] = 0.15; const top = S.pos.length / 3; S.pos.push(0.1, 0.5, 0.3); S.index.push(6, top, 7);
  const P = part(S); for (const v of [6, 7, 8]) { P.nor[v * 3 + 1] = 0; P.nor[v * 3 + 2] = 1; }
  const M = mendShape(P, { press: [{ of: "main", box: [-1, 1, 0.05, 0.3, -1, 1], over: 0.02 }] });
  assert.equal(M.did.pressed, 3); assert.equal(M.did.hanging, 1); assert.equal(M.index.length / 3, 8);
  for (const v of [6, 7, 8]) { assert.ok(Math.abs(M.pos[v * 3 + 1] - 0.05) < 1e-6, "at the floor"); assert.ok(M.nor[v * 3 + 1] > 0.8, "looking up again"); }
  assert.deepEqual([...M.moved], [6, 7, 8], "the points whose place changed"); assert.equal(M.first, P.pos.length / 3, "no point was added");
});

test("a tube is added with every one of its points at the picture's neutral place, and the old points keep their numbers", () => {
  const P = part(sheet(2, 0, 0, 0)), M = mendShape(P, { neutral: [0.25, 0.75], tube: { stations: [[0, 1, 0, 0.3], [0, 1, 0.3, 0.3]], segments: 8, step: 0.1 } });
  assert.equal(M.first, 9); assert.deepEqual([...M.index.slice(0, 24)], [...P.index]); assert.deepEqual([...M.pos.slice(0, 27)], [...P.pos]);
  assert.equal(M.did.tube.points, (M.pos.length / 3) - 9); assert.ok(M.did.tube.triangles > 0);
  for (let v = M.first; v < M.pos.length / 3; v++) { assert.ok(Math.abs(M.uv[v * 2] - 0.25) < 1e-6 && Math.abs(M.uv[v * 2 + 1] - 0.75) < 1e-6); assert.ok(Math.abs(Math.hypot(M.nor[v * 3], M.nor[v * 3 + 1], M.nor[v * 3 + 2]) - 1) < 1e-5); assert.ok(Math.abs(Math.hypot(M.tan[v * 4], M.tan[v * 4 + 1], M.tan[v * 4 + 2]) - 1) < 1e-5); }
  assert.throws(() => mendShape(P, { tube: { stations: [[0, 1, 0, 0.3], [0, 1, 0.3, 0.3]] } }), /neutral/);
});

// What the eye meets at Sakyamuni's right wrist from a place a visitor can stand: 51 × 51 lines of sight through a square 0.6 m wide at the
// wrist, each followed to the first surface that shows its right side (the page draws no other). `steps`: neighbouring lines whose first
// surfaces lie more than 3 cm apart in depth, one of them at the wrist: an edge in the picture (the hand's and the forearm's own outlines are
// among them; shreds, slivers and scraps each add their own). `air`: lines that meet only the wrong side of something at the wrist and then
// nothing: the hall seen through the figure.
const AT = [-1.85, 3.58, 1.38], WRIST = [-2.25, -1.5, 3.4, 3.75, 1.1, 1.6];
function wristSeen(fig, eye, { half = 0.3, step = 0.012 } = {}) {
  const { pos, index } = fig, near = [];
  for (let t = 0; t < index.length; t += 3) for (let j = 0; j < 3; j++) { const v = index[t + j] * 3; if (pos[v] > -2.7 && pos[v] < -1.0 && pos[v + 1] > 2.0 && pos[v + 1] < 4.5 && pos[v + 2] > 0.3 && pos[v + 2] < 2.3) { near.push(t); break; } }
  const f = AT.map((v, k) => v - eye[k]), fl = Math.hypot(...f), d0 = f.map((v) => v / fl), rl = Math.hypot(d0[2], d0[0]), R = [d0[2] / rl, 0, -d0[0] / rl], U = [R[1] * d0[2] - R[2] * d0[1], R[2] * d0[0] - R[0] * d0[2], R[0] * d0[1] - R[1] * d0[0]];
  const depth = new Map(); let air = 0, steps = 0;
  for (let a = -half, i = 0; a <= half + 1e-9; a += step, i++) for (let b = -half, j = 0; b <= half + 1e-9; b += step, j++) {
    const d = AT.map((v, k) => v + R[k] * a + U[k] * b - eye[k]), dl = Math.hypot(...d); d[0] /= dl; d[1] /= dl; d[2] /= dl;
    let front = Infinity, any = Infinity, anyFront = true;
    for (const t of near) {
      const A = index[t] * 3, B = index[t + 1] * 3, C = index[t + 2] * 3, e1x = pos[B] - pos[A], e1y = pos[B + 1] - pos[A + 1], e1z = pos[B + 2] - pos[A + 2], e2x = pos[C] - pos[A], e2y = pos[C + 1] - pos[A + 1], e2z = pos[C + 2] - pos[A + 2];
      const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, tx = eye[0] - pos[A], ty = eye[1] - pos[A + 1], tz = eye[2] - pos[A + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
      const s = (e2x * qx + e2y * qy + e2z * qz) * inv; if (s <= 1e-6) continue;
      if (s < any) { any = s; anyFront = det > 0; } if (det > 0 && s < front) front = s;
    }
    const at = (s) => { const p = [eye[0] + d[0] * s, eye[1] + d[1] * s, eye[2] + d[2] * s]; return p[0] > WRIST[0] && p[0] < WRIST[1] && p[1] > WRIST[2] && p[1] < WRIST[3] && p[2] > WRIST[4] && p[2] < WRIST[5]; };
    depth.set(i * 1000 + j, front === Infinity ? 0 : at(front) ? front : -front);
    if (any !== Infinity && !anyFront && at(any) && front === Infinity) air++;
  }
  for (const [k, s] of depth) for (const o of [k + 1000, k + 1]) { const q = depth.get(o); if (q !== undefined && (s > 0 || q > 0) && Math.abs(Math.abs(s) - Math.abs(q)) > 0.03) steps++; }
  return { air, steps };
}

test("Sakyamuni's right wrist from the two nearest places a visitor stands: from the west aisle no line of sight goes through the figure into the hall and the wrist has under half the edges it had as first shipped (569, now 177); from before the altar under three quarters (324, now 180)", { skip }, async () => {
  const E = await import("../../tools/t05-paint-eval.mjs"), fig = await E.loadFigure("sakyamuni");
  const west = wristSeen(fig, [-4.05, 0.2, 2.6]), front = wristSeen(fig, [-1.95, 0.2, 3.1]);
  assert.equal(west.air, 0, "the west aisle: lines of sight that see the hall through the wrist");
  assert.ok(west.steps <= 250, `the west aisle: ${west.steps} edges at the wrist`);
  assert.ok(front.steps <= 240, `before the altar: ${front.steps} edges at the wrist`);
  // Known and not mended (docs/t05/SOURCES.md §19): the knee's rim beside the palm has no underside, so from before the altar a slot about
  // ten centimetres long beside the hand shows the hall (95 lines; 64 as first shipped, when shreds of the rim stood in some of them). It is
  // held where it is so that nothing opens it further.
  assert.ok(front.air <= 100, `before the altar: ${front.air} lines of sight see the hall through the wrist`);
});

// The slot beside the palm is still open (above), and through it the page drew the dark hall behind him: a black scrap at the wrist from ten
// metres down the nave (the final review of 18b2024). Until the knee's rim has an underside, he alone is drawn from both sides, so that what a
// line of sight through the slot meets is the inside of his own knee and hand, in their own paint.
test("while the slot beside Sakyamuni's palm is open he is drawn from both sides, and he alone", { skip }, async () => {
  const E = await import("../../tools/t05-paint-eval.mjs"), fig = await E.loadFigure("sakyamuni"), { FIGURE_FILES } = await import("../../app/levels/t05/figures/registry.js");
  const open = wristSeen(fig, [-1.95, 0.2, 3.1]).air + wristSeen(fig, [1.2, 0.2, 9.9]).air;   // before the altar, and from ten metres down the nave
  assert.ok(open > 0, "the slot is mended: take `twoSided` off Sakyamuni and this test away");
  assert.deepEqual(FIGURE_FILES.filter((f) => f.twoSided).map((f) => f.id), ["sakyamuni"]);
  const load = (await import("node:fs")).readFileSync(new URL("../../app/levels/t05/figures/load.js", import.meta.url), "utf8");
  assert.match(load, /if \(d\.twoSided\) p\.side = THREE\.DoubleSide;/, "load.js draws such a figure from both sides");
});

test("the mended Sakyamuni stands as the first did: the page stands a figure by its bounding box and the anchors are measured from it", { skip }, async () => {
  const E = await import("../../tools/t05-paint-eval.mjs"), fig = await E.loadFigure("sakyamuni"), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < fig.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], fig.pos[i + k]); hi[k] = Math.max(hi[k], fig.pos[i + k]); }
  const was = [-2.40505, 0, -2.31716, 2.40505, 8.2, 2.31716];   // the figure's frame, as packed from sakyamuni-V14b (ship-701)
  [...lo, ...hi].forEach((v, k) => assert.ok(Math.abs(v - was[k]) < 1e-3, `bound ${k}: ${v}, was ${was[k]}`));
});
