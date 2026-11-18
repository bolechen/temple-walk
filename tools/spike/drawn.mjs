// The walker of the drawn meshes for a plan already built (#161 spike): what stands round the plan's buildings (the
// trees, the censer, the paving, the rooms) is built beside it, the trial region's triangles gathered, and the floor grid
// baked, or read back from tools/out/spike/cache when the same triangles were baked before.
import * as THREE from "three";
import fs from "node:fs";
import { namedMaterials } from "./mats.mjs";
import { gather, createMeshWalker } from "../../app/src/spike/meshwalker.js";
const { LEVELS, SITE } = await import("../../app/src/site.js?real");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createTrees } = await import("../../app/src/trees.js");
const { createProps } = await import("../../app/src/props.js");

// The trial region, and where he comes into it: the court's middle, and the great hall's room inside its door.
export const REGION = { x0: -22, x1: 22, z0: -27, z1: 34, ceil: 3.0, floorY: 0, seeds: [[0, 20], [0, 30]] };
const DIR = new URL("../out/spike/cache", import.meta.url).pathname;
export const diskCache = {
  dir: DIR,
  exists: (f) => fs.existsSync(f),
  read(f) { const b = fs.readFileSync(f), n = b.readUInt32LE(0), head = JSON.parse(b.subarray(4, 4 + n).toString()), N = head.nx * head.nz; let o = 4 + n; o += (4 - (o % 4)) % 4;
    const h = new Float32Array(b.buffer.slice(b.byteOffset + o, b.byteOffset + o + N * 4)); o += N * 4;
    const cause = new Int16Array(b.buffer.slice(b.byteOffset + o, b.byteOffset + o + N * 2)); o += N * 2;
    const shut = new Uint8Array(b.buffer.slice(b.byteOffset + o, b.byteOffset + o + N));
    return { ...head, h, cause, shut }; },
  write(f, g) { fs.mkdirSync(DIR, { recursive: true }); const { h, cause, shut, ...head } = g, js = Buffer.from(JSON.stringify(head)), pad = (4 - ((4 + js.length) % 4)) % 4, len = Buffer.alloc(4); len.writeUInt32LE(js.length);
    fs.writeFileSync(f, Buffer.concat([len, js, Buffer.alloc(pad), Buffer.from(h.buffer), Buffer.from(cause.buffer), Buffer.from(shut.buffer)])); },
};

// What the plan would mark, where it draws them, as a thing to walk round rather than stand on (userData.walk = "post"):
// the spike does not edit site.js, so it finds them here by their shape, without asking their material's name (the unit
// tests' materials have none): a mesh of its own in a building's group, lower than 0.6 m, standing on a floor, no
// thinner than 0.4 m across (a sill is thinner; a sill is a floor his shoes come down on). In the trial region that is
// the tea house's cushions and its two low tables with what stands on them; in the page it would be one line where each is made.
const box3 = new THREE.Box3(), size = new THREE.Vector3();
export function furniture(o, base = 0) {
  if (o.userData.ground || !o.parent || o.parent.children.length < 4) return null;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  box3.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).getSize(size);
  return size.y < 0.6 && Math.min(size.x, size.z) > 0.4 && Math.min(size.x, size.z) < 1.2 && box3.min.y > base + 0.02 && box3.min.y < base + 2 ? "post" : null;   // (from 2 cm up: not a stair or a base set into the ground)
}
export const TAGGED = [];

export function drawnWalker(site, fallback, { step = 0.05, cache = diskCache } = {}) {
  const t0 = performance.now(), M = namedMaterials(), extra = new THREE.Scene();
  try { createProps(extra, M, site.censer, (SITE.zN + SITE.zS) / 2); } catch { /* the censer is in; mist and shafts need a canvas */ }
  createTrees(extra, M, site.trees, { a2c: false });
  const pave = Object.assign(new THREE.MeshBasicMaterial(), { name: "paving" });
  for (const c of [{ x: SITE.x + 1, zS: SITE.zS + 2, zN: LEVELS[0].zS, y: 0 }]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(c.x * 2, c.zS - c.zN).rotateX(-Math.PI / 2).translate(0, c.y, (c.zS + c.zN) / 2), pave); m.userData.ground = true; extra.add(m); }
  const rooms = buildInteriors(M, site.halls), R = rooms.rooms.main.room;
  site.root.updateMatrixWorld(true); extra.updateMatrixWorld(true); rooms.group.updateMatrixWorld(true);
  site.root.traverse((m) => { if (m.isMesh && furniture(m)) { box3.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); TAGGED.push({ mat: m.material.name, box: [box3.min.x, box3.min.y, box3.min.z, box3.max.x, box3.max.y, box3.max.z].map((v) => +v.toFixed(2)) }); } });
  const outdoors = gather([site.root, extra], new THREE.Box3(new THREE.Vector3(REGION.x0, -2, REGION.z0), new THREE.Vector3(REGION.x1, 20, REGION.z1)), furniture);
  const roomData = gather(rooms.rooms.main.group, new THREE.Box3(new THREE.Vector3(R.x0, R.y - 1, R.z0), new THREE.Vector3(R.x1, R.y + 20, R.z1)), (m) => furniture(m, R.y));
  const t1 = performance.now();
  const w = createMeshWalker({ outdoors, region: REGION, room: { id: "main", data: roomData, ceil: R.y + 2.6, box: { x0: R.x0 - 0.3, x1: R.x1 + 0.3, z0: R.z0 - 0.3, z1: R.z1 + 0.3, seeds: [[R.door[0], R.door[1] - 1.2]] } }, fallback, earthZ: SITE.fore + 0.3 });
  const b = w.bake(step, cache), t2 = performance.now();
  w.R = R; w.outdoors = outdoors; w.roomData = roomData;
  w.cost = { gatherMs: Math.round(t1 - t0), bakeMs: Math.round(t2 - t1), bake: b, tris: outdoors.tris + roomData.tris };
  return w;
}
