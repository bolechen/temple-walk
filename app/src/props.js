// The iron censer with its smoke, and sheets of mist hanging beyond the walls.
import * as THREE from "three";
import { mesh } from "./geo.js";
import { procMat } from "./materials.js";
import { castTexture, censerGeometry, censerMaterial, createSmoke, traceStubsGeometry } from "./censer.js";
import { U } from "./glsl.js";

export function createProps(scene, M, at, centre) {
  // The Wanli censer of Jingshan, in its three parts (censer.js).
  const iron = censerMaterial(procMat, castTexture(), at);
  scene.add(mesh(censerGeometry().translate(at.x, 0, at.z), iron));
  // The stubs other visitors left today (同修留痕, censer.js): one more draw call when there are any, none when there are not.
  let traces = null, traceK = 0;
  const setTraces = (k) => {
    k = Math.floor(k) || 0; if (k === traceK) return traceK;
    if (traces) { scene.remove(traces); traces.geometry.dispose(); traces = null; }
    const g = traceStubsGeometry(k); traceK = g ? k : 0;
    if (g) { traces = mesh(g.translate(at.x, 0, at.z), iron); traces.castShadow = false; scene.add(traces); }
    return traceK;
  };
  const smoke = createSmoke(at, U); scene.add(smoke.mesh);

  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), r = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  r.addColorStop(0, "rgba(240,240,236,.55)"); r.addColorStop(0.5, "rgba(240,240,236,.16)"); r.addColorStop(1, "rgba(240,240,236,0)");
  x.fillStyle = r; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);

  // Sheets of mist beyond the walls, on either side, all the way up the hill: never over the courts or across a roof,
  // where a sheet of mist reads as a pale pane hung in front of the building. All fourteen are one mesh; each sheet
  // turns to face the eye and drifts a little, in the vertex shader.
  const mu = { tMap: { value: tex }, uT: { value: 0 }, uCol: { value: new THREE.Color(0xdfe6e4) }, uOp: { value: 0.5 } };
  {
    const pos = [], cor = [], idx = [];
    for (let i = 0; i < 14; i++) { const a = i * 2.4, x0 = (i % 2 ? 1 : -1) * (44 + (i % 3) * 9), b = pos.length / 3;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(x0, 5 + (i % 4) * 2.2, 84 - i * 17); cor.push(cx, cy, a); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("corner", new THREE.Float32BufferAttribute(cor, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: mu, transparent: true, depthWrite: false,
      vertexShader: "attribute vec3 corner; uniform float uT; varying vec2 vU; void main(){ vU=corner.xy*.5+.5; vec3 p=position; p.x+=sin(uT*.03+corner.z*3.)*6.; vec4 mv=modelViewMatrix*vec4(p,1.); mv.xy+=corner.xy*vec2(19.,6.); gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D tMap; uniform vec3 uCol; uniform float uOp; varying vec2 vU; void main(){ gl_FragColor=vec4(uCol,texture2D(tMap,vU).a*uOp); }" }));
    m.frustumCulled = false; scene.add(m);
  }
  // Shafts of light: at dawn and dusk, when the sun is low and the air is not all cloud, its light comes over the
  // side halls' roofs and stands in the mist of the first court. Each is two crossed sheets, brightest along its middle.
  const shafts = [], sc = document.createElement("canvas"); sc.width = 64; sc.height = 256;
  { const g2 = sc.getContext("2d"), img = g2.createImageData(64, 256); let q = 91; const rn = () => ((q = (q * 16807) % 2147483647) / 2147483647);
    for (let yy = 0; yy < 256; yy++) for (let xx = 0; xx < 64; xx++) { const u = xx / 63 - 0.5, v = yy / 255, a2 = Math.pow(Math.max(0, 1 - Math.abs(u) * 2), 1.6) * Math.sin(Math.PI * Math.pow(v, 0.7)) * (0.82 + 0.18 * rn()), i = (yy * 64 + xx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a2 * 255; }
    g2.putImageData(img, 0, 0); }
  const shaftTex = new THREE.CanvasTexture(sc), shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, opacity: 0 });
  for (let i = 0; i < 5; i++) for (let k = 0; k < 1; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shaftMat); m.visible = false; m.renderOrder = 3; m.userData = { i, k }; shafts.push(m); scene.add(m); }
  const Yax = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), from = new THREE.Vector3(), turn = new THREE.Quaternion();
  function setShafts(m) {
    const low = m.sun[1] < 0.3 && m.time !== "night", k = low ? 0.075 * Math.max(0, 1 - m.cloud * 1.3) : 0;   // faint: light standing in mist, not a beam
    shaftMat.opacity = k; shaftMat.color.setRGB(m.sunCol[0], m.sunCol[1], m.sunCol[2]);
    dir.set(-m.sun[0], -m.sun[1], -m.sun[2]).normalize();
    for (const s of shafts) {
      s.visible = k > 0.01; if (!s.visible) continue;
      const { i, k: cross } = s.userData, len = 17 + (i % 3) * 3, w = 4.2 + (i % 2) * 1.8;
      from.set(Math.sign(m.sun[0] || 1) * 10.5, 5.6 + (i % 2) * 0.5, 31 - i * 6.2 + (i % 2) * 1.3);       // just over the eaves on the sun's side
      s.position.copy(from).addScaledVector(dir, len / 2); s.quaternion.setFromUnitVectors(Yax, dir);
      s.quaternion.multiply(turn.setFromAxisAngle(Yax, Math.atan2(dir.x, dir.z) > 0 ? 0.5 : -0.5)); s.scale.set(w, len, 1);   // turned a little toward the axis of the court, from where it is seen
    }
  }
  return {
    setMood(m) { setShafts(m); iron.userData.setMood(m); smoke.setMood(m); mu.uCol.value.fromArray(m.fog).multiplyScalar(1.08); mu.uOp.value = 0.5 * m.mist; },
    // what the censer shows now (`__censer` in yard.js)
    censer: () => ({ ...iron.userData.state(), smoke: smoke.state(), traceStubs: traceK, traceTris: traces ? (traces.geometry.index?.count ?? traces.geometry.attributes.position.count) / 3 : 0 }),
    setTraces,
    update(t, dt, still, px = 800) {
      if (!still) mu.uT.value = t;
    },
  };
}
