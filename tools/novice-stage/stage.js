// A bare stage for the novice alone (tools/novice-views.cjs): no temple, so software rendering draws a frame in moments.
// He is moved exactly as the unit tests move him (monk.update, frame by frame), so every view of a pose is the same
// instant and two bodies can be set side by side frame for frame.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createMonk } from "../../app/src/monk.js";
import { CUSHION } from "../../app/src/geo.js";
import { bodyOf, skinMaterial, tintCloth } from "../../app/src/novice.js";
import { lidShader, eyeSkin } from "../../app/src/blink.js";
import { helpersOf, relayBeads } from "../novice-rig.mjs";
import { teaBowl } from "../../app/src/rites.js";

const W = 300, H = 640;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8e9497);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const hemi = new THREE.HemisphereLight(0xdfe6ea, 0x5a5048, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2e0, 1.6); sun.position.set(1.2, 3, 2); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1.5, bottom: -0.6 }); scene.add(sun);
const camera = new THREE.PerspectiveCamera(26, W / H, 0.05, 30);
const floorM = new THREE.MeshStandardMaterial({ color: 0x6f7375, roughness: 0.9 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const seatM = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.8 });
const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.44, 24), seatM); stool.position.y = -0.22; stool.castShadow = stool.receiveShadow = true;
// the cushion as the place draws it (geo.js CUSHION, a lathe of that outline), its crown at the seat's height
const cushion = new THREE.Mesh(new THREE.LatheGeometry(CUSHION.map(([r, y]) => new THREE.Vector2(r, y)), 40), new THREE.MeshStandardMaterial({ color: 0x5c4434, roughness: 0.95, side: THREE.DoubleSide })); cushion.position.y = -0.104; cushion.receiveShadow = true;

let monk = null;
function fresh() {
  if (monk) scene.remove(monk.group);
  monk = createMonk(); scene.add(monk.group);
  monk.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  return monk;
}
let body = null; const bodies = {};
// `load` fetches a body and wears it from then on; `use(url)` goes back to one already fetched, `use(null)` to the body built in code.
async function load(url) { const gltf = await new GLTFLoader().loadAsync(url); body = bodies[url] = { gltf }; }
function use(url) { body = url ? bodies[url] : null; }
// `stage.unlit` (#286): every part drawn with its texture only, no light, to tell a pale texture from a highlight.
function unlit(m) { m.group.traverse((o) => { if (o.isMesh && o.material) o.material = new THREE.MeshBasicMaterial({ map: o.material.map || null, color: o.material.map ? 0xffffff : o.material.color, side: THREE.DoubleSide }); }); }
// `stage.idpass` (#286): flat colours on black, for counting pixels: the sleeves red, the rest of the robe green, the rest
// of him blue (by the body's extras.ranges, which say which vertices of the robe are the sleeves).
function idPass(m) {
  scene.background.set(0x000000); for (const o of [floor, stool, cushion, bowl]) o.visible = false;
  const ranges = body?.gltf.parser.json.extras?.ranges?.robe || [], sleeves = new Set(["tripo_part_1", "tripo_part_13"]);
  m.group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (o === m.parts.robe && ranges.length) {
      const g = o.geometry, c = new Float32Array(g.attributes.position.count * 3);
      for (const [name, start, n] of ranges) for (let i = start; i < start + n; i++) c.set(sleeves.has(name) ? [1, 0, 0] : [0, 1, 0], i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(c, 3)); o.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    } else if (o === m.parts.skin) {
      // the forearms and hands (skin weighted to the arm's bones) yellow, the head blue
      const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = m.skeleton.bones.map((b) => b.name), c = new Float32Array(si.count * 3);
      for (let i = 0; i < si.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (/Arm$|Hand$/.test(names[si.getComponent(i, k)])) w += sw.getComponent(i, k); c.set(w > 0.5 ? [1, 1, 0] : [0, 0, 1], i * 3); }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3)); o.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    } else o.material = new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide, toneMapped: false });
  });
}
// `stage.faces`: back faces magenta and the background green, to tell the inside of the cloth from a hole through it.
function showFaces(m) {
  if (!stage.faces) { scene.background.set(0x8e9497); return; }
  scene.background.set(0x00ff00);
  m.group.traverse((o) => { if (!o.isMesh || !o.material) return; const mat = o.material.clone(); mat.side = THREE.DoubleSide;
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);'); };
    mat.customProgramCacheKey = () => 'faces'; o.material = mat; });
}
function dress(m) { if (!body) return; const extras = body.gltf.parser.json.extras;   // a body weighted to helper bones (#286) has monk.js add them
  const { geometries, material, robeColor } = bodyOf(body.gltf.scene, extras, m); const g = {}; for (const k in geometries) g[k] = geometries[k].clone(); material.envMapIntensity = 0.45; if (tintCloth(g, extras)) material.vertexColors = true; const eyes = !!extras.helpers?.length, skin = skinMaterial(material); if (eyes) lidShader(skin, m.lid, eyeSkin(g.skin));   // the Tripo body's lids (#607)
  m.dress(g, material, robeColor, { helpers: helpersOf(extras), skinMaterial: skin, eyes }); if (stage.beads != null) relayBeads(m, { gap: stage.beads }); m.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } }); }   // dressed as the page dresses him: beads and straps laid on the worn robe

// The poses, as tests/unit/novice.test.mjs and tools/novice-weld-trial.mjs run them: frames to settle, then the frame shown.
const POSES = {
  bind: (m) => { m.update(1 / 30, 0, "bind", 0); },
  stand: (m) => { for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); },
  pray: (m) => { for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {}); },
  walk: (m, f = 52) => { for (let i = 0; i <= f; i++) m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); },
  // #284: standing, told to go the other way: the page turns him at 9 a second of the angle left and raises his speed at 10
  // (yard.js), and the cloth must keep over his thighs. `f` frames at 30 a second since the word.
  turn: (m, f = 6) => {
    for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {});
    let h = 0, sp = 0; for (let i = 1; i <= f; i++) { const dt = 1 / 30; h += Math.atan2(Math.sin(Math.PI - h), Math.cos(Math.PI - h)) * Math.min(1, dt * 9); sp += (2.1 - sp) * Math.min(1, dt * 10); m.group.rotation.y = h; m.update(dt, sp, false, (40 + i) / 30, () => 0, {}); }
  },
  chair: (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); },
  sit: (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); },
  // half way down onto the cushion (#664: the hat on its way off his back, the skirt between the two shapes)
  sitting: (m) => { for (let i = 0; i < 9; i++) m.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); },
  // Two of the observances' hand places, as rites.js sets them (issue #246: do the hands still meet the body?): the bowl
  // of tea held in both hands at his lips, and the incense raised between his palms to the brow. Each frame the hands
  // are sent where rites.js would send them from the bones of the frame before.
  tea: (m) => hold(m, (B, act) => {
    const mouth = B.head.localToWorld(new THREE.Vector3(0, 0.052, 0.128)), cup = mouth.sub(new THREE.Vector3(0, 0.06, -0.07));
    bowl.position.copy(cup); bowl.quaternion.identity(); scene.add(bowl);
    const [hx, hy, hz] = stage.hold || (m.dressed ? [0.068, -0.025, -0.025] : [0.054, 0.02, -0.008]);
    for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; h.at.set(s * hx, hy, hz).add(cup); h.fingers.set(-s * 0.45, 0.15, 1).normalize(); h.palm.set(-s, 0.25, 0).normalize(); h.w = 1; }
  }),
  // the tea as it is drunk, seated on his stool: `stage.tea` = [tilt, nod] of the bowl at his lips (#286; rites.js tilts
  // it to 0.78 with the head back 0.24)
  teaSeat: (m) => hold(m, (B, act) => {
    const [tilt, nod] = stage.tea || [0.78, -0.24]; act.nod = nod;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tilt), mouth = B.head.localToWorld(new THREE.Vector3(0, 0.052, 0.128)), cup = mouth.sub(new THREE.Vector3(0, 0.06, -0.07).applyQuaternion(q));
    bowl.position.copy(cup); bowl.quaternion.copy(q); scene.add(bowl);
    const [hx, hy, hz] = stage.hold || (m.dressed ? [0.068, -0.025, -0.025] : [0.054, 0.02, -0.008]);   // rites.js's grip (hold()), in the bowl's frame
    for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; h.at.set(s * hx, hy, hz).applyQuaternion(q).add(cup); h.fingers.set(-s * 0.45, 0.15, 1).normalize(); h.palm.set(-s, 0.25, 0).normalize(); h.w = 1; }
  }, "chair", -0.44),
  incense: (m) => hold(m, (B, act) => { for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; const [by, bz] = stage.brow || [0.15, 0.15]; B.head.localToWorld(h.at.set(s * 0.0125, by, bz)); h.fingers.set(0, 1, 0.25).normalize(); h.palm.set(-s, 0, 0); h.w = 1; } }),
};
// rites.js's own bowl (#163: an open cylinder stood in for it here, and its empty bottom showed in the tea's pictures)
const bowl = teaBowl({ glaze: new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.18 }), tea: new THREE.MeshStandardMaterial({ color: 0x6b7a3c, roughness: 0.7 }) });
bowl.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
function hold(m, set, pose = false, floorY = 0) {
  const hand = () => ({ at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 0 });
  const act = { bow: 0, twist: 0, nod: 0, look: 0, breath: null, hands: { left: hand(), right: hand() } };
  for (let i = 0; i < 90; i++) { m.group.updateMatrixWorld(true); set(m.bones, act); m.update(1 / 30, 0, pose, i / 30, () => floorY, { act }); }
}
/** Pose him and look from `yaw` (0: before him) and `pitch`; returns a PNG data URL. */
function shot(pose, yaw, pitch = 0.08, frame, near = 1) {
  scene.remove(bowl); const m = fresh(); dress(m); showFaces(m); POSES[pose](m, frame); if (stage.lid != null) m.lid.value = stage.lid; for (const n of stage.hide || []) if (m.parts[n]) m.parts[n].visible = false; m.group.updateMatrixWorld(true);
  const seated = pose === "chair" || pose === "sit" || pose === "sitting" || pose === "teaSeat";
  scene.remove(stool, cushion); if (pose !== "tea" && pose !== "teaSeat") scene.remove(bowl); if (pose === "chair" || pose === "teaSeat") scene.add(stool); if (pose === "sit" || pose === "sitting") scene.add(cushion);
  floor.position.y = pose === "chair" || pose === "teaSeat" ? -0.44 : pose === "sit" || pose === "sitting" ? -0.104 : 0;
  const cy = (seated ? 0.35 : 0.6) * (near > 1 ? 0.0 : 1) + (near > 1 ? stage.focus ?? (seated ? 0.3 : 0.6) : 0), d = 3.3 / near;
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, cy + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  const fx = near > 1 ? stage.focusX || 0 : 0; camera.position.x += fx; camera.lookAt(fx, cy, 0);
  // `stage.cam` (#286): an observance's own shot, as site.js and interior.js give it, in the place's frame (x to his left,
  // z the way he faces, y up from the floor), with `size` the picture's width and height
  const [w, h] = stage.size || [W, H]; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = 26;
  if (stage.cam) { const { at, look, fov } = stage.cam; camera.fov = fov; camera.position.set(at[0], at[1] + floor.position.y, at[2]); camera.lookAt(look[0], look[1] + floor.position.y, look[2]); }
  camera.updateProjectionMatrix();
  if (stage.idpass) idPass(m); else if (stage.unlit) unlit(m);
  // `stage.facefix` (#286, a trial of what the page could do): where the cloth has been drawn out so far that its
  // normal faces away from the eye on a face that faces it, the normal is turned toward the eye before lighting
  if (stage.facefix) m.group.traverse((o) => { if (!o.isSkinnedMesh || !o.material || o.material.isMeshBasicMaterial) return; o.material = o.material.clone();
    o.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n  if (dot(normal, vViewPosition) < 0.0) normal = -normal;"); };
    o.material.customProgramCacheKey = () => "facefix"; });
  if (stage.noindirect) { if (stage.noindirect !== 'env') hemi.visible = false; if (stage.noindirect !== 'hemi') scene.environment = null; }   // trial: without the sky light ('hemi'), the environment ('env') or both
  if (stage.flat) m.group.traverse((o) => { if (o.isMesh && o.material?.normalMap) { o.material = o.material.clone(); o.material.normalMap = null; o.material.needsUpdate = true; } });   // `stage.flat`: no normal map (#286)
  renderer.render(scene, camera);
  if (stage.idpass) { scene.background.set(0x8e9497); for (const o of [floor, stool, cushion, bowl]) o.visible = true; }
  return renderer.domElement.toDataURL("image/png");
}
const stage = { load, use, shot, ready: true, focus: null };
window.stage = stage;
