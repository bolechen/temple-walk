// Did a change to the novice move anything it was not meant to (#664)? Every drawn point of the figure built in code, in
// nine poses he is put in without a cushion (standing, palms together, walking, hurrying, up and down a flight, on a
// stool, in the air, bound), as one short hash for each part: run it on two checkouts and compare.
//
//   node tools/novice-posehash.mjs [<checkout>]          this checkout, or another (a git worktree with node_modules linked in)
//   diff <(node tools/novice-posehash.mjs ../main) <(node tools/novice-posehash.mjs)
//
// Points are rounded to a tenth of a millimetre. A part whose points were only counted or ordered differently hashes
// differently too: say so, and look at tools/novice-views.cjs.
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = pathToFileURL(path.resolve(process.argv[2] || new URL("..", import.meta.url).pathname)).href.replace(/\/$/, "");
await import(root + "/tests/unit/dom-stub.mjs");
const THREE = await import(root + "/node_modules/three/build/three.module.js");
const { createMonk } = await import(root + "/app/src/monk.js");
const crypto = await import("node:crypto");
const POSES = {
  stand: (m) => { for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); },
  pray: (m) => { for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {}); },
  walk: (m) => { for (let i = 0; i <= 52; i++) m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); },
  hurry: (m) => { for (let i = 0; i <= 47; i++) m.update(1 / 30, 4.2, false, i / 30, () => 0, {}); },
  stairsUp: (m) => { const f = (x, z) => Math.floor(z / 0.32) * 0.16; for (let i = 0; i <= 60; i++) { m.group.position.z = i * 0.03; m.group.position.y = f(0, m.group.position.z); m.update(1 / 30, 0.9, false, i / 30, f, { heightAt: (x, z) => z * 0.5, stairs: true }); } },
  stairsDown: (m) => { const f = (x, z) => -Math.floor(z / 0.32) * 0.16; for (let i = 0; i <= 60; i++) { m.group.position.z = i * 0.03; m.group.position.y = f(0, m.group.position.z); m.update(1 / 30, 0.9, false, i / 30, f, { heightAt: (x, z) => -z * 0.5, stairs: true }); } },
  chair: (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); },
  hop: (m) => { for (let i = 0; i < 20; i++) m.update(1 / 30, 0, "hop", i / 30, () => -0.3, {}); },
  bind: (m) => { m.update(1 / 30, 0, "bind", 0); },
};
const v = new THREE.Vector3();
for (const [name, pose] of Object.entries(POSES)) {
  const m = createMonk(); pose(m); m.group.updateMatrixWorld(true); m.skeleton.update?.();
  const names = new Map(Object.entries(m.parts).map(([k, o]) => [o, k])), out = [];
  m.group.traverse((o) => { if (!o.isMesh || !o.visible || o === m.shadow) return; const h = crypto.createHash("sha256"), p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { (o.isSkinnedMesh ? o.getVertexPosition(i, v) : v.fromBufferAttribute(p, i)).applyMatrix4(o.matrixWorld); h.update(`${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)};`); } out.push(`${names.get(o) || "beads"}:${h.digest("hex").slice(0, 8)}`); });
  console.log(name.padEnd(11), out.join(" "));
}
