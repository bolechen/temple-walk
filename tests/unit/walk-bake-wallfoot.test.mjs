// Whether a cell at a wall's foot is open depends on the wall and the ground, and on nothing else (#477). The compound's walls stand on a stone
// skirt 0.35 m high, more than he steps up (CLIMB, 0.25), so the skirt's top is a floor the flood cannot reach, until some step far away
// (a 0.5 m gate platform, flush with the skirt's top within CLIMB) joins it to the ground he walks on. The bake once took a floor it had not
// reached for no floor at all, so the cells beside the skirt were shut over their whole height at the skirt's edge, and a gate shell a
// hundred metres off moved the cells at the wall's foot by one: the first cell open to him was 0.425 m from the skirt with the skirt an island
// and 0.375 m when a step reached it. Now an unreached floor is a floor beside which the cells are shut by what stands on it and by the ledge
// it makes, and the answer is the same either way. (docs/t00/evidence/477-wall-foot/README.md has the mechanism.)
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { gather, bakeGrid } = await import("../../tools/walk/bake.mjs");

const mat = (name) => { const m = new THREE.MeshBasicMaterial(); m.name = name; return m; };
const box = (x0, x1, y0, y1, z0, z1, name, ground) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), o = new THREE.Mesh(g, mat(name));
  if (ground) o.userData.ground = true; return o;
};
function scene(extra) {
  const root = new THREE.Group();
  root.add(box(-50, 50, -0.01, 0, -50, 50, "paving", true));   // the ground, y = 0
  root.add(box(-0.9, -0.1, 0, 3.2, -10, 10, "plaster"));       // the wall: 0.8 m thick, 3.2 m high, the court on its +x side
  root.add(box(-1.0, 0.0, 0, 0.35, -10.1, 10.1, "stone"));     // its skirt: 1 m wide, 0.35 m high, 0.1 m proud of the plaster on each side
  for (const e of extra) root.add(e);
  root.updateMatrixWorld(true); return root;
}
const BOX = { x0: -3, x1: 8, z0: -12, z1: 12, top: 20, bottom: -5 };
/** The court side's first open cell along the middle of the wall, and whether the skirt's top was reached. */
function bake(extra) {
  const S = gather([scene(extra)], BOX, 0), b = bakeGrid(S, BOX, [[3, 0, 0]], 0.05, []), j = Math.floor((0.025 - BOX.z0) / 0.05), row = j * b.nx;
  let first = null; for (let i = 0; i < b.nx; i++) { const x = BOX.x0 + (i + 0.5) * 0.05; if (x > 0 && b.state[row + i] === 0) { first = +x.toFixed(3); break; } }
  return { first, reached: !Number.isNaN(b.h[row + Math.floor((-0.05 - BOX.x0) / 0.05)]) };
}
const pad = (z0) => box(-1, 4, 0, 0.2, z0, 12, "stone");   // a step he can take (0.2 m), and the skirt's top 0.15 m above it

test("the cell at a wall's foot is open or shut by the wall and the ground alone, whether or not a far step lets the flood onto the skirt", () => {
  const alone = bake([]), joined = bake([pad(10.1)]), clear = bake([pad(11.1)]), far = bake([box(4, 7, 0, 0.2, -8, -6, "stone")]);
  assert.equal(alone.reached, false, "with nothing else, the skirt's top is an island");
  assert.equal(joined.reached, true, "a step touching the skirt's end puts the flood on it (the setup of the test means what it says)");
  assert.equal(clear.reached, false); assert.equal(far.reached, false);
  assert.equal(joined.first, alone.first, `the first open cell moved by ${(joined.first - alone.first).toFixed(3)} m when a step ten metres off joined the skirt`);
  assert.equal(clear.first, alone.first); assert.equal(far.first, alone.first);
  // and it is the right cell: the plaster's face is 0.1 m behind the skirt's edge, so x = 0.375 is 0.475 m from it, past his reach at the waist
  // (0.379 m), and the cell before it (0.325, 0.425 m from the plaster) is shut by the ledge the skirt makes. (The bake used to shut one more.)
  assert.equal(alone.first, 0.375);
});
