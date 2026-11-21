// The smallest repro for #477: a wall with a stone skirt on flat ground, baked with tools/walk/bake.mjs; then the same with one unrelated
// piece of geometry added or moved. Run from the repository root:  node docs/t00/evidence/477-wall-foot/repro.mjs
// What it prints is the x of the first cell on the court side of the wall that is open to him, at the middle of the wall (z = 0.025).
import "../../../../tests/unit/dom-stub.mjs"; import * as THREE from "three";
const { gather, bakeGrid } = await import("../../../../tools/walk/bake.mjs");
const mat = (name) => { const m = new THREE.MeshBasicMaterial(); m.name = name; return m; };
const box = (x0, x1, y0, y1, z0, z1, name, ground) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); const o = new THREE.Mesh(g, mat(name)); if (ground) o.userData.ground = true; return o; };
function scene(extra) {
  const root = new THREE.Group();
  root.add(box(-50, 50, -0.01, 0, -50, 50, "paving", true));          // the ground, y = 0
  root.add(box(-0.9, -0.1, 0, 3.2, -10, 10, "plaster"));              // the wall: 0.8 m thick, 3.2 m high; the court is on its +x side
  root.add(box(-1.0, 0.0, 0, 0.35, -10.1, 10.1, "stone"));            // its skirt: 1 m wide, 0.35 m high (he steps up 0.25), 0.1 m proud of the plaster each side
  for (const e of extra) root.add(e);
  root.updateMatrixWorld(true); return root;
}
const BOX = { x0: -3, x1: 8, z0: -12, z1: 12, top: 20, bottom: -5 };
function firstOpen(extra) {
  const S = gather([scene(extra)], BOX, 0), b = bakeGrid(S, BOX, [[3, 0, 0]], 0.05, []), j = Math.floor((0.025 - BOX.z0) / 0.05);
  const at = (x) => b.h[j * b.nx + Math.floor((x - BOX.x0) / 0.05)];
  let first = null; for (let i = 0; i < b.nx; i++) { const x = BOX.x0 + (i + 0.5) * 0.05; if (x > 0 && b.state[j * b.nx + i] === 0) { first = +x.toFixed(3); break; } }
  return `first open cell x = ${first}; floor on the skirt's top: ${Number.isNaN(at(-0.05)) ? "none (an island he cannot step up onto)" : "reached (" + at(-0.05).toFixed(2) + " m)"}`;
}
// A 0.2 m pad is a step he can take from the ground (CLIMB is 0.25); the skirt's top, 0.35 m, is 0.15 m above it.
const pad = (z0) => box(-1, 4, 0, 0.2, z0, 12, "stone");
console.log("A  the wall and the ground only                               :", firstOpen([]));
console.log("B  + a 0.2 m pad touching the skirt's end, 10 m from the cell :", firstOpen([pad(10.1)]));
console.log("C  + the same pad 1 m clear of the skirt's end                :", firstOpen([pad(11.1)]));
console.log("D  + the same pad a long way off                              :", firstOpen([box(4, 7, 0, 0.2, -8, -6, "stone")]));
