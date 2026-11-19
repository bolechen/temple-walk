// Issue #246, second round: measures the novice's beads on a body in novice.glb's format beside the figure built in code (docs/t00/refactor/novice-spike.md).
//   node tools/novice-measure-beads.mjs <body.glb> [--relay[=gap]]
// --relay (#286): the body worn as tools/novice-rig.mjs dresses it, with the beads laid on it by relayBeads, `gap` metres off the cloth (0.004).
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../app/src/monk.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");
const { wear, relayBeads } = await import("./novice-rig.mjs");
const relay = process.argv.find((a) => a.startsWith("--relay")), file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const m = createMonk();
if (relay) { const b = readNovice(file); wear(m, b); const r = relayBeads(m, { gap: relay.includes("=") ? +relay.split("=")[1] : 0.004 }); console.log(`beads laid on the body: ${r.moved} of ${r.beads} moved, at most ${(r.most * 100).toFixed(1)} cm`); }
m.update(1/30,0,"bind",0); m.group.updateMatrixWorld(true);
let beads = null; m.group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.parent === m.bones.chest && o !== m.parts.hat && o.geometry.attributes.position.count > 1000) beads = o; });
const P = beads.geometry.attributes.position, v = new THREE.Vector3();
const b = readNovice(file);   // the bead loop is the code's (or, with --relay, laid on this body), the cloth is this body's
const surf = (g) => { const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mesh.updateMatrixWorld(true); return mesh; };
const targets = relay ? { tripo: [surf(b.geometries.robe), surf(b.geometries.skin)] } : { tripo: [surf(b.geometries.robe), surf(b.geometries.skin)], code: [surf(createMonk().parts.robe.geometry), surf(createMonk().parts.skin.geometry)] };
const ray = new THREE.Raycaster();
for (const [label, meshes] of Object.entries(targets)) {
  const rows = {};
  for (let i = 0; i < P.count; i += 3) {
    v.fromBufferAttribute(P, i).applyMatrix4(beads.matrixWorld);
    const o = new THREE.Vector3(0, v.y, 0), d = v.clone().sub(o); d.y = 0; const len = d.length(); if (len < 0.02) continue; d.normalize();
    ray.set(o, d); const hits = ray.intersectObjects(meshes); if (!hits.length) continue;
    const far = hits[hits.length - 1].distance, inside = far - len;   // >0: the bead is that far inside the outermost cloth
    const zone = v.z > 0.05 && v.y < 0.85 ? "chest" : v.z < -0.03 ? "back" : "shoulders";
    (rows[zone] ||= []).push(inside);
  }
  for (const [z, a] of Object.entries(rows)) { a.sort((x, y) => x - y); console.log(label.padEnd(6), z.padEnd(9), `bead points ${a.length}, inside the outer cloth: median ${(a[a.length >> 1] * 100).toFixed(1)} cm, worst ${(a[a.length - 1] * 100).toFixed(1)} cm, share inside ${(100 * a.filter((x) => x > 0).length / a.length).toFixed(0)}%`); }
}
