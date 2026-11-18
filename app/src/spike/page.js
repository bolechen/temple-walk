// @ts-nocheck   (#161 spike, branch only: not held to the project's types)
// The drawn walker in the page, for measuring it (#161 spike; this branch only). `?walker=mesh` builds it from the
// meshes as they stand before mergeStatic batches them, bakes its floor grid there and then (the worst case: a
// published build would fetch the grid baked when the site was built), and swaps it in under the walker yard.js already
// holds. Every question put to either walker is timed, so that a frame's walking, blocking and eye questions can be
// weighed (`__walker()`), old against new, on the same page.
import * as THREE from "three";
import { gather, createMeshWalker } from "./meshwalker.js";

const METHODS = ["heightAt", "blocked", "onGround", "floorAt", "eyeShut", "eyeAt", "landAt", "onStairs", "wall", "railNear", "setRoom", "setLoft"];
/** @returns {any} */
export function swappable(first) {
  let impl = first, ms = 0, calls = 0;
  const o = { swap(next) { if (impl.room) next.setRoom(impl.room); impl = next; }, get impl() { return impl; }, stats: () => ({ ms, calls }), reset() { ms = 0; calls = 0; } };
  for (const k of METHODS) o[k] = (...a) => { const t = performance.now(), r = impl[k](...a); ms += performance.now() - t; calls++; return r; };
  Object.defineProperty(o, "room", { get: () => impl.room });
  Object.defineProperty(o, "loft", { get: () => impl.loft });
  return o;
}

export const REGION = { x0: -22, x1: 22, z0: -27, z1: 34, ceil: 3.0, floorY: 0, seeds: [[0, 20], [0, 30]] };
// A thing the plan would mark to be walked round (see tools/spike/drawn.mjs): low, standing on a floor, a mesh of its own.
const box3 = new THREE.Box3(), size = new THREE.Vector3();
function furniture(o, base = 0) {
  if (o.userData.ground || !o.parent || o.parent.children.length < 4) return null;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  box3.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).getSize(size);
  return size.y < 0.6 && Math.min(size.x, size.z) > 0.4 && Math.min(size.x, size.z) < 1.2 && box3.min.y > base + 0.02 && box3.min.y < base + 2 ? "post" : null;
}

/** Build the drawn walker over the trial region and the great hall's room; returns it with what it cost to make. */
export function buildDrawnWalker(scene, rooms, fallback) {
  const t0 = performance.now();
  scene.updateMatrixWorld(true);
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(46, 70).rotateX(-Math.PI / 2).translate(0, 0, 7), new THREE.MeshBasicMaterial({ name: "paving" })); pave.userData.ground = true; pave.updateMatrixWorld(true);
  const roots = scene.children.filter((c) => c !== rooms.group && !c.isLight && !c.isCamera);
  const outdoors = gather([...roots, pave], new THREE.Box3(new THREE.Vector3(REGION.x0, -2, REGION.z0), new THREE.Vector3(REGION.x1, 20, REGION.z1)), furniture);
  const R = rooms.rooms.main.room;
  const room = gather(rooms.rooms.main.group, new THREE.Box3(new THREE.Vector3(R.x0, R.y - 1, R.z0), new THREE.Vector3(R.x1, R.y + 20, R.z1)), (m) => furniture(m, R.y));
  const t1 = performance.now();
  const w = createMeshWalker({ outdoors, region: REGION, room: { id: "main", data: room, ceil: R.y + 2.6, box: { x0: R.x0 - 0.3, x1: R.x1 + 0.3, z0: R.z0 - 0.3, z1: R.z1 + 0.3, seeds: [[R.door[0], R.door[1] - 1.2]] } }, fallback, earthZ: Infinity });
  const bake = w.bake(0.05), t2 = performance.now();
  w.cost = { gatherAndBvhMs: Math.round(t1 - t0), bakeMs: Math.round(t2 - t1), bake, tris: outdoors.tris + room.tris };
  return w;
}
