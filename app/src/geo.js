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
  if (!n.attributes.normal) n.computeVertexNormals();   // a turned shape keeps its round normals; only what has none is given flat ones
  return n;
}
export const merge = (list) => mergeGeometries(list.map(plain));

// Tell a wall how high its foot stands: plaster is damp and green at its foot wherever that is, and one material
// serves every wall by reading the height from here (kept in the first texture coordinate, which walls do not use).
export function footAt(geo, base) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, base); return geo; }

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
// A flight of stone steps with sloped cheeks. Top edge at z = 0, descending toward +z, rising `rise` from y = 0.
export const STAIR = Object.freeze({ rise: 0.18, tread: 0.34, nosing: 0.05 });
export function stairProfile(rise) {
  const count = Math.max(1, Math.round(rise / STAIR.rise));
  return { count, height: rise / count, tread: STAIR.tread, run: STAIR.tread * count, nosing: STAIR.nosing };
}
export function stairGeo(w, rise) {
  const { count: N, height: sh, tread: sd, run, nosing } = stairProfile(rise), parts = [];
  // Each tread is a slab that oversails its riser by a thumb's length: the dark line under it is what lets a flight
  // be read as steps from below, even on a day without shadows.
  for (let i = 0; i < N; i++) { const top = sh * (N - i); parts.push(box(w, top - 0.06, sd, 0, (top - 0.06) / 2, sd * (i + 0.5)), box(w, 0.06, sd + nosing, 0, top - 0.03, sd * (i + 0.5) + nosing / 2)); }
  if (N > 2) for (const sx of [-1, 1]) {
    const len = Math.hypot(run, rise);
    parts.push(new THREE.BoxGeometry(0.42, 0.26, len + 0.1).rotateX(Math.atan2(rise, run)).translate(sx * (w / 2 + 0.21), rise / 2 - 0.02, run / 2),
      box(0.42, rise / 2, run, sx * (w / 2 + 0.21), rise / 4 - 0.1, run / 2));
  }
  return { geo: merge(parts), run };
}
// Once the place is built, everything that never moves and shares a material becomes one mesh per stretch
// of the axis: a few hundred draws become a few dozen, and what is behind you is still culled.
// Meshes marked `userData.keep`, and anything not drawn with a procedural material, are left alone.
export function mergeStatic(root, zones) {
  root.updateMatrixWorld(true);
  const groups = new Map(), gone = [], c = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.keep || Array.isArray(o.material)) return;
    const a = o.geometry.attributes; if (!a.ao || !a.uv || !a.normal) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv", "ao"].includes(k)) g.deleteAttribute(k);
    g.computeBoundingBox(); g.boundingBox.getCenter(c);
    const zone = zones.findIndex((z) => c.z > z), key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${zone}`;
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
    groups.get(key).geos.push(g); gone.push(o);
  });
  for (const o of gone) { o.parent.remove(o); o.geometry.dispose(); }
  for (const g of groups.values()) { const m = new THREE.Mesh(mergeGeometries(g.geos), g.mat); m.castShadow = g.cast; m.receiveShadow = g.recv; root.add(m); }
  return { before: gone.length, after: groups.size };
}
export const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 8, false);
