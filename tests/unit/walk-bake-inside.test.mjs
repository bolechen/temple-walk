// Whether a point is inside a closed solid does not depend on what else is in the place (#477). A platform's stone and the flight of steps
// against it share a face at one place; a ray from inside the stone reaches both at the same distance, and which one the hierarchy
// reports first followed the splits it made for every triangle of the place, so a tree a hundred metres off could turn the answer and,
// with it, the cells at the platform's foot. Now all faces at that distance count, and one seen from behind is enough.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const awaitedBake = await import("../../tools/walk/bake.mjs"), { gather, inside, hitOrder } = awaitedBake;

const mat = (name) => { const m = new THREE.MeshBasicMaterial(); m.name = name; return m; };
const box = (x0, x1, y0, y1, z0, z1, name) => new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat(name));
const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const BOX = { x0: -300, x1: 300, z0: -300, z1: 300, top: 60, bottom: -30 };
/** The platform (z -5…5), the steps against its south face (z 5…8, the same width and height), and `n` boxes and trunks placed by seed. */
function place(seed, n) {
  const root = new THREE.Group(), rnd = seeded(seed);
  root.add(box(-2, 2, 0, 1.5, -5, 5, "stone"), box(-2, 2, 0, 1.5, 5, 8, "steps"));
  for (let i = 0; i < n; i++) { const x = (rnd() * 2 - 1) * 200, z = (rnd() * 2 - 1) * 200, w = 0.3 + rnd() * 3, h = 0.5 + rnd() * 12; if (Math.abs(x) < w + 6 && Math.abs(z) < w + 14) continue; root.add(box(x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2, i % 3 ? "bark" : "plaster")); }
  root.updateMatrixWorld(true); return root;
}

test("a point inside a platform's stone is inside it whatever stands elsewhere, though a flight of steps shares its south face", () => {
  const verdicts = [];
  for (let seed = 1; seed <= 24; seed++) {
    const S = gather([place(seed, 5 + seed * 7)], BOX, 0);
    verdicts.push([inside(S, 0, 0.75, 0), inside(S, 0.7, 0.4, 2.5), inside(S, -1.2, 1.2, -3.6)]);
  }
  assert.ok(verdicts.every((v) => v.every(Boolean)), `a point in the stone was taken for outside: ${JSON.stringify(verdicts.map((v, i) => [i + 1, v]).filter(([, v]) => !v.every(Boolean)))}`);
});

test("a point in the open is not inside, nor one beside a solid it could step into", () => {
  const S = gather([place(7, 60)], BOX, 0);
  assert.equal(inside(S, 0, 0.75, 6.5), true, "inside the steps' own block");
  assert.equal(inside(S, 3.5, 0.75, 0), false, "beside the platform, in the open");
  assert.equal(inside(S, 0, 3, 0), false, "over the platform");
  assert.equal(inside(S, 0, 0.75, 12), false, "past the steps, in the open");
});

test("two faces that look the same way at one place do not make a point in front of them inside (the other half of the tie rule)", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const root = place(seed, 5 + seed * 5);
    root.add(box(-2, 2, 0, 1.5, -5, 5, "stone"));   // a second solid on the first: every face of the platform is there twice, looking out
    root.updateMatrixWorld(true);
    const S = gather([root], BOX, 0);
    assert.equal(inside(S, -3.5, 0.75, 0), false, `seed ${seed}: west of the doubled platform, in the open`);
    assert.equal(inside(S, 0, 0.75, -7), false, `seed ${seed}: north of it, in the open`);
    assert.equal(inside(S, 0, 0.75, 0), true, `seed ${seed}: inside it`);
  }
});

test("where no faces meet, the answer is the plain first face's, as before", () => {
  // The rule that was: the first face met in each of four directions is seen from behind. Boxes that stand apart, points drawn by seed.
  const first = (S, x, y, z) => {
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3());
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => { ray.origin.set(x, y, z); ray.direction.set(dx, 0, dz); const h = S.bvh.raycastFirst(ray, THREE.DoubleSide); return !!h && h.face.normal.x * dx + h.face.normal.z * dz >= 0.2; });
  };
  let n = 0, within = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const rnd = seeded(seed * 7919), root = new THREE.Group();
    for (let i = 0; i < 30; i++) { const x = (rnd() * 2 - 1) * 20, z = (rnd() * 2 - 1) * 20, w = 1 + rnd() * 4; root.add(box(x - w / 2, x + w / 2 + 0.013 * i, 0, 2 + rnd() * 6, z - w / 2, z + w / 2 + 0.017 * i, "wall")); }
    root.updateMatrixWorld(true);
    const S = gather([root], BOX, 0);
    for (let p = 0; p < 60; p++) { const x = (rnd() * 2 - 1) * 24, y = 0.2 + rnd() * 6, z = (rnd() * 2 - 1) * 24; n++; const was = first(S, x, y, z); if (was) within++; assert.equal(inside(S, x, y, z), was, `seed ${seed}, (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`); }
  }
  assert.ok(within > 20 && within < n - 20, `the points are both in and out of the boxes (${within} of ${n})`);
});

test("faces at one height are met in one order, whichever the hierarchy hands them in: a wall's foot on a slab, a beam let into the wall", () => {
  // The slab's top and the wall's foot are one plane (a face looking up and one looking down at y 1), and the beam let into the wall puts
  // another looking down above them. The order in which the hierarchy returns faces at one distance follows every triangle of the place,
  // so it is shuffled here, as another place's would be; the bake sorts what it is handed.
  const root = new THREE.Group();
  root.add(box(-10, 10, -1, 0, -10, 10, "paving"), box(-4, 4, 0, 1, -4, 4, "stone"), box(-2, 2, 1, 5, -2, 2, "wall"), box(-1, 1, 2.5, 4, -1, 1, "beam"));
  root.updateMatrixWorld(true);
  const S = gather([root], { x0: -300, x1: 300, z0: -300, z1: 300, top: 60, bottom: -30 }, 0);
  const ray = new THREE.Ray(new THREE.Vector3(0.3, 60, 0.1), new THREE.Vector3(0, -1, 0)), hits = S.bvh.raycast(ray, THREE.DoubleSide, 0, 90);
  const key = (h) => `${h.point.y.toFixed(3)}/${h.face.normal.y}/${S.mat[(h.face.a / 3) | 0]}`;
  const order = hitOrder(S), seen = new Set(), rnd = seeded(5);
  for (let n = 0; n < 40; n++) {
    const h = hits.slice(); for (let i = h.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [h[i], h[j]] = [h[j], h[i]]; }
    seen.add(h.sort(order).map(key).join(" "));
  }
  assert.equal(seen.size, 1, `${seen.size} different orders: ${[...seen].join(" | ")}`);
  const run = [...seen][0].split(" "), at1 = run.filter((k) => k.startsWith("1.000/")).map((k) => Number(k.split("/")[1]));
  assert.deepEqual(at1, [-1, 1], "at the slab's top, the wall's foot (looking down) comes before the slab (looking up): no air over the floor");
});

test("the great hall's platform foot is the same cells with the cedars' trunks and without them (#477: the six cells that opened with a tree a hundred metres off)", async () => {
  // The real place, gathered whole, so that the hierarchy is the page's; the grid baked over the platform only (its first floor reached from the platform's top).
  const { prepare } = await import("../../tools/bake-walk.mjs"), { levelObject } = await import("../../tools/walk/level-arg.mjs");
  const prep = prepare(await levelObject("t00")), g = prep.grids.find((x) => x.kind === "outdoors"), F = g.box;
  const snap = (v, o) => o + Math.round((v - o) / 0.05) * 0.05, WIN = { x0: snap(-14, F.x0), x1: snap(14, F.x0), z0: snap(-30, F.z0), z1: snap(-2, F.z0), top: F.top, bottom: F.bottom };
  const cells = (hide) => {
    const was = []; for (const r of g.roots) r.traverse((o) => { if (o.isMesh && hide(o)) { was.push([o, o.visible]); o.visible = false; } });
    const S = gather(g.roots, F, 0); for (const [o, v] of was) o.visible = v;
    const b = awaitedBake.bakeGrid(S, WIN, [[0, -14, 1.5]], 0.05, []); return Array.from(b.state, (v) => (v === 0 ? 1 : 0)).join("");
  };
  const name = (o) => (Array.isArray(o.material) ? o.material[0] : o.material)?.name;
  const withTrunks = cells(() => false), without = cells((o) => name(o) === "bark");
  assert.ok((withTrunks.match(/1/g) || []).length > 20000, "the platform has open floor");
  let differ = 0; for (let k = 0; k < withTrunks.length; k++) if (withTrunks[k] !== without[k]) differ++;
  assert.equal(differ, 0, `${differ} cells round the platform changed when the trees' trunks were taken out of the place`);
});
