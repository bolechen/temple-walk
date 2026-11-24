// The helper bones a body built by tools/novice-tripo.mjs needs beyond monk.js's skeleton (issue #286), offline: nothing
// here is in app/, and the page does not wear such a body (novice.js's bodyOf refuses a file whose joints are not
// monk.js's own, so a page that has not been taught these bones keeps the figure built in code).
//
// Under a raised arm. Holding the incense at the brow, his upper arm stands some 150° from where it hangs; the cloth of
// the armpit is weighted between the chest and the upper arm, and with linear blend skinning each of its points moves to
// a weighted mean of where the two bones would put it, so that where the weights change, edges were drawn out three
// times their length and more (some 420 of them on the robe; #246, fourth round) and the cloth under the arm smeared. The
// usual cure, the one game rigs use for shoulders and armpits (a "helper", "corrective" or "half" joint, driven by the
// joint it helps), is a bone of its own at the shoulder's ball, carried by the chest, that turns each frame through
// a share (K) of the way the upper arm has swung away from where it hangs, not its twist about its own length. The
// cloth between chest and arm is weighed against it too (Blender's bone heat, tools/novice-heat.py), so the armpit goes
// a third of the way, then two thirds, rather than all at once from one bone to the other. A pose-space driver or an
// RBF interpolator (Unreal's Pose Driver, Maya's helper joints read by RBF) can drive one from several poses; with one
// pose to correct (the arm raised) a fixed share of the swing does as well and needs no poses kept.
//
// What `rig` does to a monk from createMonk(): it adds the bones named in `HELPERS` to its skeleton (after monk.js's
// own, so that their numbers follow its bones'), each at the shoulder's ball in the bind pose, and wraps `update` so
// that after monk.js has posed him, each helper is set from its arm. Moved into monk.js, this is a dozen lines at the
// end of `update` and two bones in the list (docs/t00/refactor/novice-spike.md, #286).
import * as THREE from "three";

/** The helper bones: carried by `parent`, set at the head of `follow` and turned through `k` of its swing. */
export const HELPERS = [
  { name: "leftArmpit", parent: "chest", follow: "leftUpperArm", k: 0.5 },
  { name: "rightArmpit", parent: "chest", follow: "rightUpperArm", k: 0.5 },
];

/**
 * Add the helper bones to `monk` (from createMonk(), before `dress`) and drive them from `update`. Idempotent.
 * @param {any} monk
 * @param {{ name: string, parent: string, follow: string, k: number }[]} [helpers]
 */
export function rig(monk, helpers = HELPERS) {
  if (monk.helpers?.length) return monk;
  const sk = monk.skeleton, B = monk.bones, run = monk.update;
  run.call(monk, 0, 0, "bind", 0); monk.group.updateMatrixWorld(true);
  const list = helpers.map((h) => {
    const parent = B[h.parent], follow = B[h.follow], bone = new THREE.Bone(); bone.name = h.name;
    parent.add(bone); bone.position.copy(parent.worldToLocal(follow.getWorldPosition(new THREE.Vector3())));
    bone.updateMatrixWorld(true);
    // the arm's way in the parent's frame at rest, and the direction it hangs (its own -y)
    const rest = parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(follow.getWorldQuaternion(new THREE.Quaternion()));
    const axis = new THREE.Vector3(0, -1, 0).applyQuaternion(rest).normalize();
    sk.bones.push(bone); sk.boneInverses.push(bone.matrixWorld.clone().invert()); B[h.name] = bone;
    return { ...h, bone, parent, follow, restInv: rest.clone().invert(), axis };
  });
  sk.boneMatrices = new Float32Array(sk.bones.length * 16);
  if (sk.boneTexture) { sk.boneTexture.dispose(); sk.boneTexture = null; }
  const qp = new THREE.Quaternion(), qa = new THREE.Quaternion(), delta = new THREE.Quaternion(), twist = new THREE.Quaternion(), swing = new THREE.Quaternion(), v = new THREE.Vector3(), I = new THREE.Quaternion();
  const drive = () => {
    for (const h of list) {
      h.parent.updateWorldMatrix(true, false); h.follow.updateWorldMatrix(true, false);
      // how the arm has turned since the bind pose, in the chest's frame; its swing is what is left once the turn about
      // the way it hung (its twist) is taken out
      qp.copy(h.parent.getWorldQuaternion(qp)).invert(); qa.copy(h.follow.getWorldQuaternion(qa));
      delta.copy(qp).multiply(qa).multiply(h.restInv);
      const p = v.set(delta.x, delta.y, delta.z).projectOnVector(h.axis); twist.set(p.x, p.y, p.z, delta.w).normalize();
      swing.copy(delta).multiply(twist.invert());
      h.bone.quaternion.slerpQuaternions(I, swing, h.k);
      h.bone.position.copy(h.parent.worldToLocal(h.follow.getWorldPosition(v)));
      h.bone.updateMatrixWorld(true);
    }
  };
  monk.update = function (...a) { const r = run.apply(monk, a); if (a[2] !== "bind") drive(); else for (const h of list) { h.bone.quaternion.identity(); h.bone.position.copy(h.parent.worldToLocal(h.follow.getWorldPosition(v))); h.bone.updateMatrixWorld(true); } return r; };
  Object.defineProperty(monk, "helpers", { value: list, configurable: true });   // monk.js has a getter of its own by that name
  return monk;
}

/** The helpers a body's extras ask for (none for a body without them). */
export const helpersOf = (extras) => extras?.helpers || [];

/**
 * Dress `monk` in a body read by tests/unit/novice-glb.mjs (or any { geometries, extras }), rigging it first if the body
 * was weighted to helper bones.
 */
export function wear(monk, body, material = new THREE.MeshStandardMaterial(), { beads = false } = {}) {
  // monk.js adds the helpers itself now (#163); the beads are left where they were laid unless asked, so that
  // novice-measure-beads.mjs still measures them before and after relayBeads
  monk.dress(body.geometries, material, body.extras.robeColor, { helpers: helpersOf(body.extras), beads });
  return monk;
}

// The beads, laid on the body he wears (#286). monk.js lays its thirty-two beads 1.5 cm proud of the robe built in code
// (onBody, measured against that robe's own shape), and keeps them on the chest bone. The robe from Tripo stands some 3 cm
// further out on the chest and 2 cm on the back, so they sank into it (#246, fourth round: on the chest the median bead
// point 1.4 cm inside the cloth, the worst 3.4 cm). Here each bead is moved along the line from his middle (the vertical
// axis at its own height) through its centre until it sits `gap` off the outermost cloth there, in the bind pose; a
// bead already clear of the cloth by more than that stays where it is. Moved into monk.js this is what `dress` would
// do after swapping the geometry (a few lines, the beads' centres kept when they are built); any later body is then
// fitted without measuring it again.
/**
 * @param {any} monk dressed, and in the bind pose (rig()'s or monk.update(…, "bind"))
 * @param {{ gap?: number }} [o] the clearance between a bead and the cloth, metres
 * @returns {{ beads: number, moved: number, most: number }} how many beads there are, how many moved, the most any moved (m)
 */
export function relayBeads(monk, { gap = 0.004 } = {}) {
  let beads = null; monk.group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.parent === monk.bones.chest && o !== monk.parts.hat && o.geometry.attributes.position.count > 1000) beads = o; });
  if (!beads) throw new Error("no beads on the chest");
  monk.update(0, 0, "bind", 0); monk.group.updateMatrixWorld(true);
  const g = beads.geometry, P = g.attributes.position;
  let N = 38; for (const cand of [38, 32]) if (P.count % cand === 0) { N = cand; break; }
  const per = P.count / N; if (per !== Math.round(per)) throw new Error(`${P.count} bead vertices are not ${N} beads`);
  const cloth = ["robe", "skin"].map((n) => { const m = new THREE.Mesh(monk.parts[n].geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld(true); return m; });
  const ray = new THREE.Raycaster(), v = new THREE.Vector3(), c = new THREE.Vector3(), toLocal = beads.matrixWorld.clone().invert();
  let moved = 0, most = 0;
  for (let b = 0; b < N; b++) {
    c.set(0, 0, 0); let r = 0;
    for (let k = 0; k < per; k++) c.add(v.fromBufferAttribute(P, b * per + k).applyMatrix4(beads.matrixWorld)); c.divideScalar(per);
    for (let k = 0; k < per; k++) r = Math.max(r, v.fromBufferAttribute(P, b * per + k).applyMatrix4(beads.matrixWorld).distanceTo(c));
    const o = new THREE.Vector3(0, c.y, 0), d = c.clone().sub(o); d.y = 0; const len = d.length(); if (len < 0.02) continue; d.normalize();
    ray.set(o, d); const hits = ray.intersectObjects(cloth); if (!hits.length) continue;
    const want = hits[hits.length - 1].distance + r + gap; if (want <= len) continue;
    const shift = d.clone().multiplyScalar(want - len), local = shift.clone().transformDirection(toLocal).multiplyScalar(shift.length());
    for (let k = 0; k < per; k++) { const i = b * per + k; P.setXYZ(i, P.getX(i) + local.x, P.getY(i) + local.y, P.getZ(i) + local.z); }
    moved++; most = Math.max(most, want - len);
  }
  P.needsUpdate = true; g.computeBoundingSphere();
  return { beads: N, moved, most };
}
