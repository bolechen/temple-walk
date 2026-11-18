// Needs the measuring dependencies, which are not on this branch: they are on claude/collision-spike-161-page, or
// `pnpm add -D @dimforge/rapier3d-compat@0.21.0 recast-navigation@0.44.0` for a run.
// Rapier (WASM) in Node: how long it takes to start, to take the trial region's triangles as one fixed trimesh, and
// for its kinematic character controller to move a capsule of his size one step (#161 spike). Only these numbers are
// asked of it; its package size is in sizes.mjs.
import "../../tests/unit/dom-stub.mjs";
import { namedMaterials } from "./mats.mjs";
import { drawnWalker } from "./drawn.mjs";
const { createWalker, buildSite } = await import("../../app/src/site.js?real");
let t = performance.now(); const R = (await import("@dimforge/rapier3d-compat")).default; await R.init(); const initMs = performance.now() - t;
const site = buildSite(namedMaterials()), w = drawnWalker(site, createWalker(site)), g = w.outdoors.bvh.geometry;
t = performance.now();
const world = new R.World({ x: 0, y: -9.8, z: 0 });
world.createCollider(R.ColliderDesc.trimesh(new Float32Array(g.attributes.position.array), new Uint32Array(g.index.array)));
const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.62, 20));
const capsule = world.createCollider(R.ColliderDesc.capsule(0.22, 0.38), body);
const cc = world.createCharacterController(0.01); cc.enableAutostep(0.25, 0.1, false); cc.enableSnapToGround(0.3); cc.setMaxSlopeClimbAngle(Math.PI / 4);
world.step(); const buildMs = performance.now() - t;
t = performance.now(); const N = 2000;
for (let i = 0; i < N; i++) { cc.computeColliderMovement(capsule, { x: 0, y: -0.01, z: -0.035 }); const m = cc.computedMovement(), p = body.translation(); body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }); world.step(); }
const stepUs = (performance.now() - t) / N * 1000, p = body.translation();
console.log(JSON.stringify({ wasmInitMs: Math.round(initMs), trimeshAndWorldMs: Math.round(buildMs), tris: w.outdoors.tris, usPerControllerStep: +stepUs.toFixed(1), after2000Steps: [p.x, p.y, p.z].map((v) => +v.toFixed(2)) }));
