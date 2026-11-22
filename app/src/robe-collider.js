// The robe over a raised thigh (#615). The skirt's bones turn with the knee only as far as a board-flat hem forbids (#284), so a
// thigh coming up on a stair came out through the front of the robe, or parted it from above. Cloth in a game lies over a body
// as a collider holds it: each thigh is a capsule from the hip joint to the knee, and a point of the skirt that would lie inside
// one is carried out to its surface (the dynamic-bone way, as #284 itself cites). Done in the robe's vertex shader after the
// skinning, for the vertices marked `collide`, and the same few lines in JavaScript (`pushOut`) so that the tests see what the
// shader draws.
import * as THREE from "three";

/** `margin`: how far outside the thigh's own surface cloth is held; `below`: the robe's points this far under the hip are carried. */
export const COLLIDER = { margin: 0.012, below: 0.03 };

const _ab = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
/**
 * Carries `p` out of the capsule `a`–`b` of radius `r` if it lies inside (the nearest way out; `w` of the way, the share of a
 * point the thighs carry), in place; true if it moved.
 * @param {THREE.Vector3} p @param {THREE.Vector3} a @param {THREE.Vector3} b @param {number} r
 */
export function pushOut(p, a, b, r, w = 1) {
  _ab.subVectors(b, a); const len2 = _ab.lengthSq() || 1e-9, t = Math.min(1, Math.max(0, _d.subVectors(p, a).dot(_ab) / len2));
  _c.copy(a).addScaledVector(_ab, t); _d.subVectors(p, _c); const L = _d.length();
  if (L >= r) return false;
  if (L < 1e-6) _d.set(0, 0, 1); else _d.divideScalar(L);
  _c.addScaledVector(_d, r); p.lerp(_c, w); return true;
}

/** The two thighs: capsule ends (hip joint, knee) in the robe's space, the radius, and the uniforms the shader reads. */
export function createCollider() {
  const a = [new THREE.Vector3(), new THREE.Vector3()], b = [new THREE.Vector3(), new THREE.Vector3()];
  return { a, b, r: 0, uniforms: { uCapA: { value: a }, uCapB: { value: b }, uCapR: { value: 0 } } };
}

/**
 * Marks which of a robe's points the thighs may carry: `collide` is the share of a point's weights on the skirt's bones and the
 * thighs, for points more than COLLIDER.below under the hip; the belt, sleeves and collar stay as they are. `cclear` is how far the
 * point lies from the nearer thigh's axis in the bind pose, less a finger: the point is never held nearer than the radius or than
 * that, so that cloth standing closer to a thigh than the thigh is wide (a trouser leg wider than the tight robe over it) stays
 * where it was standing and is only kept from coming nearer.
 * @param {THREE.BufferGeometry} geometry @param {Set<number>} bones the skirt's and the thighs' bone numbers
 * @param {THREE.Vector3[]} hip the hip joints in the bind pose @param {THREE.Vector3[]} knee the knees
 */
export function markCollide(geometry, bones, hip, knee) {
  const P = geometry.attributes.position, si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight, out = new Float32Array(P.count), clear = new Float32Array(P.count), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    clear[i] = 1;
    if (P.getY(i) > hip[0].y - COLLIDER.below) continue;
    let w = 0; for (let k = 0; k < 4; k++) if (bones.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
    out[i] = Math.min(1, w); v.fromBufferAttribute(P, i); let d = 9;
    for (let s = 0; s < 2; s++) { _ab.subVectors(knee[s], hip[s]); const t = Math.min(1, Math.max(0, _d.subVectors(v, hip[s]).dot(_ab) / _ab.lengthSq())); _c.copy(hip[s]).addScaledVector(_ab, t); d = Math.min(d, v.distanceTo(_c)); }
    clear[i] = Math.max(0.01, d - 0.004);
  }
  geometry.setAttribute("collide", new THREE.BufferAttribute(out, 1)); geometry.setAttribute("cclear", new THREE.BufferAttribute(clear, 1));
  return out;
}

/**
 * Closes the front of a made robe at its middle seam (#615, the 3D review): the points either side of it are weighted to the left
 * and to the right thigh, so that when one knee comes up the two halves part (up to 9 cm on a flight, in half the frames). Within
 * 2 cm of the middle a point's thigh weight goes to the front skirt bone, which both halves share; out to 7 cm the share
 * eases back to the thighs. Changes the weights in place; returns how many points it moved.
 * A point that another part of the body shares (a robe point lying on the trousers: `others`) is left alone, the parts being held
 * together there (a unit test holds copies of one point within a millimetre).
 * @param {THREE.BufferGeometry} geometry @param {number[]} thighBones @param {number} frontBone @param {number} hipY the hip joint's height in the bind pose @param {THREE.BufferGeometry[]} others
 */
export function closeSeam(geometry, thighBones, frontBone, hipY, others = []) {
  const P = geometry.attributes.position, si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight; let moved = 0;
  const key = (x, y, z) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`, shared = new Set();
  for (const g of others) { const Q = g.attributes.position; for (let i = 0; i < Q.count; i++) shared.add(key(Q.getX(i), Q.getY(i), Q.getZ(i))); }
  for (let i = 0; i < P.count; i++) {
    if (shared.has(key(P.getX(i), P.getY(i), P.getZ(i)))) continue;
    const x = Math.abs(P.getX(i)); if (P.getZ(i) < 0.0 || x >= 0.07 || P.getY(i) > hipY - COLLIDER.below) continue;
    const t = Math.min(1, Math.max(0, (x - 0.02) / 0.05)), keep = t * t * (3 - 2 * t); let share = 0, slot = -1;
    for (let k = 0; k < 4; k++) { const b = si.getComponent(i, k), w = sw.getComponent(i, k); if (b === frontBone) slot = k; else if (thighBones.includes(b) && w > 0) { const m = w * (1 - keep); sw.setComponent(i, k, w - m); share += m; } }
    if (share <= 0) continue;
    if (slot < 0) { let low = 0; for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) < sw.getComponent(i, low)) low = k; slot = low; si.setComponent(i, slot, frontBone); sw.setComponent(i, slot, 0); }
    sw.setComponent(i, slot, sw.getComponent(i, slot) + share); moved++;
  }
  si.needsUpdate = sw.needsUpdate = true; return moved;
}

/**
 * The thigh's radius in the bind pose: the 85th percentile of the distance from the hip–knee line of the trousers' points that the
 * thigh carries (its own bone's weight over a half) between the knee and the hip, with COLLIDER.margin on top.
 * @param {THREE.BufferGeometry} legs @param {number[]} thighBones @param {THREE.Vector3[]} hip @param {THREE.Vector3[]} knee
 */
export function thighRadius(legs, thighBones, hip, knee) {
  const P = legs.attributes.position, si = legs.attributes.skinIndex, sw = legs.attributes.skinWeight, v = new THREE.Vector3(), d = [];
  for (let i = 0; i < P.count; i++) for (let s = 0; s < 2; s++) {
    let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === thighBones[s]) w += sw.getComponent(i, k);
    if (w < 0.5) continue; v.fromBufferAttribute(P, i);
    if (v.y > hip[s].y - 0.03 || v.y < knee[s].y + 0.04) continue;
    _ab.subVectors(knee[s], hip[s]); const t = Math.min(1, Math.max(0, _d.subVectors(v, hip[s]).dot(_ab) / _ab.lengthSq()));
    _c.copy(hip[s]).addScaledVector(_ab, t); d.push(v.distanceTo(_c));
  }
  d.sort((x, y) => x - y); return (d.length ? d[Math.floor(d.length * 0.85)] : 0.08) + COLLIDER.margin;
}

/** Patches a material so the points marked `collide` are carried out of the thighs after skinning. */
export function colliderShader(material, collider) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, renderer) => {
    prev?.call(material, sh, renderer);
    Object.assign(sh.uniforms, collider.uniforms);
    sh.vertexShader = "attribute float collide;\nattribute float cclear;\nuniform vec3 uCapA[2];\nuniform vec3 uCapB[2];\nuniform float uCapR;\n" + sh.vertexShader.replace("#include <skinning_vertex>", `#include <skinning_vertex>
  if (collide > 0.0) {
    for (int c = 0; c < 2; c++) {
      vec3 ab = uCapB[c] - uCapA[c]; float t = clamp(dot(transformed - uCapA[c], ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
      vec3 cp = uCapA[c] + ab * t, dv = transformed - cp; float L = length(dv), rr = min(uCapR, cclear);
      if (L < rr) transformed = mix(transformed, cp + (L < 1e-6 ? vec3(0.0, 0.0, 1.0) : dv / L) * rr, min(collide, 1.0));
    }
  }`);
  };
  material.customProgramCacheKey = () => "robecollide";
  material.needsUpdate = true;
  return material;
}
