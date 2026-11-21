// A bare stage with the archway on it, drawn with the real materials (tools/paifang-views.cjs, issue #433): front, side and
// top as flat drawings (orthographic), and three looks from a person's height. No site, no walker, no mood: one sun and one sky.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createMaterials } from "../../app/src/materials.js";
import { buildPaifang } from "../../app/src/paifang.js";

const W = 1200, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fb4c8);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
scene.add(new THREE.HemisphereLight(0xdfe9f2, 0x6b6257, 1.25));
const sun = new THREE.DirectionalLight(0xfff0dc, 1.1); sun.position.set(-16, 22, 26); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 }); sun.shadow.bias = -0.0004; scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
// the paved way, a lane of lighter flags along the axis, so that the walk-through reads from the front
const way = new THREE.Mesh(new THREE.PlaneGeometry(9, 400), new THREE.MeshStandardMaterial({ color: 0x8c877d, roughness: 0.9 })); way.rotation.x = -Math.PI / 2; way.position.y = 0.01; way.receiveShadow = true; scene.add(way);
const M = createMaterials(), pf = buildPaifang(M);
pf.group.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
scene.add(pf.group);
const { w, h } = pf.size, cy = h / 2;

function ortho(pos, up, halfW, halfH, target) {
  const c = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 200); c.position.copy(pos); c.up.copy(up); c.lookAt(target); return c;
}
const aspect = W / H;
const VIEWS = {
  // flat drawings, as the structure review reads them
  front: () => { const hh = Math.max(h * 0.62, (w * 0.56) / aspect); return ortho(new THREE.Vector3(0, cy, 60), new THREE.Vector3(0, 1, 0), hh * aspect, hh, new THREE.Vector3(0, cy, 0)); },
  side: () => { const hh = Math.max(h * 0.62, 4); return ortho(new THREE.Vector3(60, cy, 0), new THREE.Vector3(0, 1, 0), hh * aspect, hh, new THREE.Vector3(0, cy, 0)); },
  top: () => { const hh = (w * 0.56) / aspect; return ortho(new THREE.Vector3(0, 60, 0), new THREE.Vector3(0, 0, -1), hh * aspect, hh, new THREE.Vector3(0, 0, 0)); },
  // from a person's height
  iso: () => { const c = new THREE.PerspectiveCamera(30, aspect, 0.1, 400); c.position.set(17, 8.5, 25); c.lookAt(0, 4.2, 0); return c; },
  gate: () => { const c = new THREE.PerspectiveCamera(26, aspect, 0.1, 400); c.position.set(0, 1.6, 40); c.lookAt(0, 4.6, 0); return c; },
  under: () => { const c = new THREE.PerspectiveCamera(48, aspect, 0.1, 400); c.position.set(-3.2, 1.6, 7.5); c.lookAt(2.6, 5.6, 0); return c; },
  low: () => { const c = new THREE.PerspectiveCamera(60, aspect, 0.1, 400); c.position.set(0.8, 1.6, 2.4); c.lookAt(-0.8, 5.0, -1.0); return c; },
};
function shoot(name) {
  const cam = VIEWS[name](); sun.target.position.set(0, 3, 0);
  renderer.render(scene, cam); return renderer.domElement.toDataURL("image/png");
}
window.stage = { shoot, views: Object.keys(VIEWS), census: pf.census(), size: pf.size, ready: true };
