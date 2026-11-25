// What tools/review-sheet.cjs asks of the page, for an art review that reads numbers instead of guessing at a picture:
// the novice painted in flat colours by part (skin, hands, robe, trousers, shoes, the rest), alone or one part at a time,
// and where his bones, his hem and his hat are in the world, with the camera that drew the frame. It is the workbench's
// only (the dev server and a pull request's preview, and then only with `?review=1`): the published page and the
// canary never install it, so no visitor's path touches it. Nothing here changes how a frame is drawn until `ids()` is
// called, and `ids(null)` puts every material back.
import * as THREE from "three";
import { onBench } from "./debuggate.js";

/** The flat colours of the id pass, by part: far apart in RGB and not the browns, golds and greys of the temple. */
export const REVIEW_COLORS = Object.freeze({
  skin: [255, 0, 255],
  hand: [255, 255, 0],
  robe: [0, 255, 255],
  legs: [0, 255, 0],
  shoes: [0, 0, 255],
  other: [255, 0, 0],
});

/** @param {{ dev: boolean, hostname: string, search: string }} o */
export const reviewOn = ({ dev, hostname, search }) => onBench({ dev, hostname }) && new URLSearchParams(search).get("review") === "1";

/** Install `window.__review` for a page that asked. @param {any} o { monk, camera, scene, renderer, dev, hostname, search } */
export function installReview({ monk, camera, dev, hostname, search }) {
  if (!reviewOn({ dev, hostname, search })) return null;
  const saved = new Map();   // mesh → { material, visible, color }
  const partOf = (o) => { const p = monk.parts; return o === p.skin ? "skin" : o === p.robe ? "robe" : o === p.legs ? "legs" : o === p.shoes ? "shoes" : "other"; };
  const mat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255), vertexColors: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const boneNames = () => monk.skeleton.bones.map((b) => b.name);
  /** The skin's vertices weighted to a forearm or a hand get the hand colour. */
  const handColors = (mesh, solo) => {
    const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = boneNames(), c = new Float32Array(si.count * 3);
    for (let i = 0; i < si.count; i++) {
      let w = 0; for (let k = 0; k < 4; k++) if (/(LowerArm|Hand)$/.test(names[si.getComponent(i, k)])) w += sw.getComponent(i, k);
      const col = w > 0.5 ? REVIEW_COLORS.hand : solo ? [0, 0, 0] : REVIEW_COLORS.skin; c.set([col[0] / 255, col[1] / 255, col[2] / 255], i * 3);
    }
    return c;
  };
  /** @param {null | { solo?: "skin"|"hand"|"robe"|"legs"|"shoes"|"other" }} o */
  function ids(o) {
    for (const [m, s] of saved) { m.material = s.material; m.visible = s.visible; if (!s.color) m.geometry.deleteAttribute("color"); else m.geometry.setAttribute("color", s.color); }
    saved.clear();
    if (!o) return false;
    const solo = o.solo || null;
    if (monk.shadow) { saved.set(monk.shadow, { material: monk.shadow.material, visible: monk.shadow.visible, color: monk.shadow.geometry.getAttribute("color") || null }); monk.shadow.visible = false; }   // the painted shadow is no part of him
    monk.group.traverse((m) => {
      if (!m.isMesh && !m.isPoints) return;
      const part = partOf(m);
      saved.set(m, { material: m.material, visible: m.visible, color: m.geometry.getAttribute("color") || null });
      const keep = !solo || (solo === "hand" ? part === "skin" : part === solo);
      if (!keep) { m.visible = false; return; }
      if (part === "skin") {
        m.geometry.setAttribute("color", new THREE.BufferAttribute(handColors(m, solo === "hand"), 3));
        m.material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, fog: false });
      } else m.material = mat(REVIEW_COLORS[part]);
    });
    return true;
  }
  const w = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
  /** Where he is, where his joints, his hem and his hat are, and the camera that drew this frame (matrices as arrays). */
  function measure() {
    monk.group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(monk.group.matrixWorld).invert(), at = (n) => monk.skeleton.bones.find((b) => b.name === n);
    const P = (n) => at(n)?.getWorldPosition(new THREE.Vector3()) || null;
    const bones = {}; for (const n of ["leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm", "leftHand", "rightHand", "head", "hips"]) { const p = P(n); if (p) bones[n] = w(p); }
    const origin = new THREE.Vector3().setFromMatrixPosition(monk.group.matrixWorld), fwd = new THREE.Vector3(0, 0, 1).transformDirection(monk.group.matrixWorld);
    // the robe as drawn now (skinning and the sitting drape applied): the front-most vertices are the hem's lip
    const robe = monk.parts.robe, n = robe.geometry.attributes.position.count, v = new THREE.Vector3(), loc = new THREE.Vector3();
    let maxZ = -1e9; const pts = [];
    for (let i = 0; i < n; i++) { robe.getVertexPosition(i, v); v.applyMatrix4(robe.matrixWorld); loc.copy(v).applyMatrix4(inv); pts.push([loc.x, loc.y, loc.z, v.y]); if (loc.z > maxZ) maxZ = loc.z; }
    const lip = pts.filter((p) => p[2] > maxZ - 0.03);
    const hemFront = lip.length ? { y: +(lip.reduce((s, p) => s + p[3], 0) / lip.length).toFixed(4), z: +maxZ.toFixed(4), n: lip.length } : null;
    // the hat's width across him, in his own frame
    const hat = monk.parts.hat, hp = hat?.geometry?.attributes?.position; let hx0 = 1e9, hx1 = -1e9;
    if (hp) { hat.updateMatrixWorld(true); for (let i = 0; i < hp.count; i++) { v.fromBufferAttribute(hp, i).applyMatrix4(hat.matrixWorld).applyMatrix4(inv); hx0 = Math.min(hx0, v.x); hx1 = Math.max(hx1, v.x); } }
    return {
      origin: w(origin), facing: w(fwd), yaw: Math.atan2(fwd.x, fwd.z), bones, hemFront,
      hatWidth: hp ? +(hx1 - hx0).toFixed(4) : null,
      camera: { position: w(camera.position), fov: camera.fov, aspect: camera.aspect, view: Array.from(camera.matrixWorldInverse.elements), projection: Array.from(camera.projectionMatrix.elements) },
    };
  }
  window.__review = { ids, measure, colors: REVIEW_COLORS };
  return window.__review;
}
