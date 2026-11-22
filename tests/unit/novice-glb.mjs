// Reads the geometry of a worn body (app/shared/models/novice-tripo.glb, which the page wears by default since #163, or
// novice.glb, Meshy's, for ?body=sculpt) in Node, with no textures and no loader: the tests need positions, joints and
// weights, not pictures. Returns what monk.dress() takes.
import fs from "node:fs";
import * as THREE from "three";

const FILE = new URL("../../app/shared/models/novice.glb", import.meta.url);
export const TRIPO = new URL("../../app/shared/models/novice-tripo.glb", import.meta.url);
const COMPONENT = { 5121: [Uint8Array, 1], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function readNovice(file = FILE) {
  const b = fs.readFileSync(file), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
  const binAt = 20 + b.readUInt32LE(12), bin = b.subarray(binAt + 8, binAt + 8 + b.readUInt32LE(binAt));
  const read = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], [T, size] = COMPONENT[a.componentType], n = WIDTH[a.type];
    const base = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || n * size, out = new T(a.count * n);
    for (let r = 0; r < a.count; r++) for (let k = 0; k < n; k++) { const o = base + r * stride + k * size; out[r * n + k] = T === Float32Array ? bin.readFloatLE(o) : size === 4 ? bin.readUInt32LE(o) : size === 2 ? bin.readUInt16LE(o) : bin[o]; }
    return { array: out, n };
  };
  const geometries = {};
  for (const node of json.nodes) {
    const prim = json.meshes[node.mesh].primitives[0], g = new THREE.BufferGeometry(), at = prim.attributes;
    const put = (name, i, Attr = THREE.BufferAttribute) => { const { array, n } = read(i); g.setAttribute(name, new Attr(array, n)); };
    put("position", at.POSITION); put("normal", at.NORMAL); put("uv", at.TEXCOORD_0);
    put("skinIndex", at.JOINTS_0, THREE.Uint16BufferAttribute); put("skinWeight", at.WEIGHTS_0);
    g.setIndex(new THREE.BufferAttribute(read(prim.indices).array, 1));
    geometries[node.name] = g;
  }
  return { geometries, extras: json.extras, json };
}

/** A monk wearing a body (by default the one the page wears, Tripo's), as the page dresses him once the file has arrived: its helper bones added, the beads laid on it. */
export function dressed(createMonk, file = TRIPO) {
  const monk = createMonk(), { geometries, extras } = readNovice(file);
  monk.dress(geometries, new THREE.MeshStandardMaterial(), extras.robeColor, { helpers: extras.helpers || [] });
  return monk;
}
/** A monk wearing Meshy's body (?body=sculpt). */
export const sculpted = (createMonk) => dressed(createMonk, FILE);
