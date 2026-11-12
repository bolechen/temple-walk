// Small geometry helpers.
import * as THREE from "../v/build/three.module.js";
import { mergeGeometries } from "../v/jsm/utils/BufferGeometryUtils.js";

export const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Bring any geometry to one layout (non-indexed; position, normal, uv) so it can be merged with others.
export function plain(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(n.attributes.position.count * 2).fill(0), 2));
  n.computeVertexNormals();
  return n;
}
export const merge = (list) => mergeGeometries(list.map(plain));

// Bake an occlusion value into every vertex. `fn(x, y, z)` returns 0..1; omit it for "fully lit".
export function bakeAO(geo, fn) {
  const p = geo.attributes.position, a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = fn ? fn(p.getX(i), p.getY(i), p.getZ(i)) : 1;
  geo.setAttribute("ao", new THREE.BufferAttribute(a, 1));
  return geo;
}
export function mesh(geo, mat, { cast = true, receive = true, ao } = {}) {
  if (!geo.attributes.ao || ao) bakeAO(geo, ao);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
export const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 8, false);
