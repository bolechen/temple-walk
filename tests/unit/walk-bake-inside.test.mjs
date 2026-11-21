// Whether a point is inside a closed solid does not depend on what else is in the place (#477). A platform's stone and the flight of steps
// against it share a face at one place; a ray from inside the stone reaches both at the same distance, and which one the hierarchy
// reports first followed the splits it made for every triangle of the place, so a tree a hundred metres off could turn the answer and,
// with it, the cells at the platform's foot. Now all faces at that distance count, and one seen from behind is enough.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const awaitedBake = await import("../../tools/walk/bake.mjs"), { gather, inside } = awaitedBake;

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
