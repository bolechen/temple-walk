// The visitor: a novice of six or seven, round-headed, eyes closed in a small smile, in a robe the colour
// of persimmon that is a little too big for him, with a string of beads round his neck.
// He walks where you send him, and can put his palms together.
// Modelled by hand after the feeling of small carved novices; see docs/HANDOFF.md for the reference.
import * as THREE from "../v/build/three.module.js";
import { STAIR } from "./geo.js";
import { mergeGeometries } from "../v/jsm/utils/BufferGeometryUtils.js";

const V2 = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function weave() {   // the grain of coarse cloth, as a bump
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  x.fillStyle = "#808080"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) { x.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.14})`; x.fillRect(i, 0, 1, 256); x.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.14})`; x.fillRect(0, i, 256, 1); }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},0,.05)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}

export function createMonk() {
  // He is built on a skeleton: a hip bone under the root, and from it the spine, head, two arms with their hands, two
  // legs, and the hat on his back. Each part of him is bound to one bone and moves with it; `update` poses the bones.
  // A sculpted, skinned figure can take this one's place by bringing bones of the same names (see `skeleton` below).
  const bone = (name) => { const b = new THREE.Bone(); b.name = name; return b; };
  const root = new THREE.Group(), body = bone("spine"); root.add(body);
  const bump = weave();
  const cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, bumpMap: bump, bumpScale: 0.6, envMapIntensity: 0.35 });
  const robeM = cloth(0x9a6846), sashM = cloth(0x5a3b28), linen = cloth(0xd9d2c2), dark = cloth(0x2b2622);   // persimmon-dyed cloth after many washings
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2cdae, roughness: 0.58, envMapIntensity: 0.45, emissive: 0x2a1206, emissiveIntensity: 0.55 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x4a2f22, roughness: 0.6 });
  const beadM = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.32, envMapIntensity: 0.9 });
  const rose = new THREE.MeshBasicMaterial({ color: 0xee9a8a, transparent: true, opacity: 0.34, depthWrite: false });
  const add = (parent, geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };

  // ---- Robe: narrow at the shoulders, falling in soft folds to an uneven hem ----
  const robe = new THREE.LatheGeometry(V2([[0, 0.2], [0.235, 0.2], [0.246, 0.215], [0.225, 0.32], [0.2, 0.44], [0.182, 0.54], [0.18, 0.62], [0.18, 0.7], [0.166, 0.75], [0.128, 0.786], [0.094, 0.8], [0.062, 0.81], [0, 0.81]]), 96);
  {
    const p = robe.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), low = 1 - smooth(0.3, 0.62, y);
      const seam = Math.exp(-Math.pow((Math.abs(a) - Math.PI) * 9, 2)) * 0.012 * smooth(0.78, 0.5, y);   // the seam down the middle of his back
      const k = 1 + low * (0.06 * Math.sin(a * 7 + 0.6) + 0.028 * Math.sin(a * 13 + 2)) + 0.014 * Math.sin(a * 5 + y * 9) * smooth(0.5, 0.7, y) - seam + 0.01 * Math.sin(y * 46 + a * 2) * smooth(0.5, 0.6, y) * smooth(0.72, 0.6, y);
      p.setXYZ(i, x * k, y + (y < 0.23 ? 0.014 * Math.sin(a * 7 + 1.3) : 0), z * k * (1 - 0.07 * smooth(0.45, 0.75, y)));   // a child's chest is not round
    }
    robe.computeVertexNormals();
  }
  // The crossed collar, and its pale under-collar, laid over the chest.
  const lapel = (from, to, r, out) => {
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, y = from[1] + (to[1] - from[1]) * t, x = from[0] + (to[0] - from[0]) * t, rad = (0.062 + (0.176 - 0.062) * smooth(0.81, 0.6, y)) * out; pts.push(new THREE.Vector3(x, y, Math.sqrt(Math.max(0.0004, rad * rad - x * x)) * 0.94)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, r, 8).scale(1, 1, 1);
  };
  const robeMesh = add(body, mergeGeometries([robe, new THREE.TorusGeometry(0.068, 0.017, 10, 28).rotateX(Math.PI / 2).translate(0, 0.808, 0), lapel([-0.058, 0.8], [0.1, 0.55], 0.014, 1.02)]), robeM);
  add(body, mergeGeometries([new THREE.TorusGeometry(0.056, 0.012, 8, 24).rotateX(Math.PI / 2).translate(0, 0.822, 0), lapel([0.05, 0.8], [0.005, 0.7], 0.009, 1.0)]), linen);
  // The sash, knotted at the left, its two ends hanging.
  const knot = [new THREE.TorusGeometry(0.183, 0.017, 10, 48).rotateX(Math.PI / 2).scale(1, 1.25, 0.94).translate(0, 0.545, 0), new THREE.SphereGeometry(0.026, 12, 10).translate(-0.07, 0.545, 0.165)];
  for (const [dx, len, rot] of [[-0.085, 0.15, 0.12], [-0.055, 0.12, -0.1]]) knot.push(new THREE.BoxGeometry(0.03, len, 0.008).translate(0, -len / 2, 0).rotateZ(rot).translate(dx, 0.54, 0.178));
  add(body, mergeGeometries(knot), sashM);
  // Beads: each one turned, strung in a loop that hangs to the chest.
  const beads = []; for (let i = 0; i < 30; i++) { const a = (i / 30) * 6.283, hang = (1 - Math.cos(a)) / 2; beads.push(new THREE.SphereGeometry(i === 15 ? 0.017 : 0.0115, 10, 8).translate(Math.sin(a) * 0.092, 0.815 - hang * 0.2, 0.02 + Math.cos(a) * -0.07 + hang * 0.215)); }
  add(body, mergeGeometries(beads), beadM);
  // On his back, the bamboo hat every walking monk carries, hung by a cord that crosses his chest.
  const hat = bone("hat"); hat.position.set(0, 0.6, -0.178); hat.rotation.x = -Math.PI / 2 + 0.3; body.add(hat);
  {
    const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#b39a63"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 3) { x.fillStyle = `rgba(${i % 2 ? "70,52,24" : "235,215,160"},${0.18 + Math.random() * 0.2})`; x.fillRect(i, 0, 1.5, 256); }                     // the ribs, from crown to rim
    for (let j = 0; j < 256; j += 9) { x.fillStyle = `rgba(60,44,20,${0.12 + Math.random() * 0.16})`; x.fillRect(0, j, 256, 1.5); }                                                   // and the rings that bind them
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
    const straw = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.5, roughness: 0.85, envMapIntensity: 0.3, side: THREE.DoubleSide });
    add(hat, new THREE.LatheGeometry(V2([[0.0, 0.082], [0.03, 0.076], [0.1, 0.045], [0.168, 0.012], [0.178, 0.004], [0.174, 0], [0.16, 0.006], [0.09, 0.036], [0.0, 0.064]]), 56), straw);
    add(hat, new THREE.TorusGeometry(0.176, 0.006, 6, 56).rotateX(Math.PI / 2).translate(0, 0.004, 0), sashM);                                                                         // the bound rim
    for (const sx of [-1, 1]) add(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.085, 0.67, -0.165), new THREE.Vector3(sx * 0.1, 0.775, -0.06), new THREE.Vector3(sx * 0.098, 0.792, 0.04),
      new THREE.Vector3(sx * 0.075, 0.72, 0.15), new THREE.Vector3(sx * 0.05, 0.6, 0.182), new THREE.Vector3(sx * 0.03, 0.555, 0.186)]), 32, 0.0042, 6), sashM);   // a cord over each shoulder, tucked into the sash
  }

  // ---- Head: large, soft in the cheek ----
  const head = bone("head"); head.position.set(0, 0.84, 0); body.add(head);
  const R = 0.205, S = [1, 0.95, 0.97], HY = 0.165;
  const on = (az, el, k = 1) => new THREE.Vector3(R * Math.sin(az) * Math.cos(el) * S[0] * k, HY + R * Math.sin(el) * S[1] * k, R * Math.cos(az) * Math.cos(el) * S[2] * k);   // a point on the face
  const skull = new THREE.SphereGeometry(R, 56, 40).scale(...S);
  { const p = skull.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / R, f = smooth(0.1, -0.75, y) * 0.09 * smooth(-1, -0.55, y) + smooth(0.2, -0.5, y) * 0.035; p.setX(i, p.getX(i) * (1 + f)); p.setZ(i, p.getZ(i) * (1 + f * 0.5)); } skull.translate(0, HY, 0); skull.computeVertexNormals(); }
  const flesh = [skull, new THREE.CylinderGeometry(0.058, 0.066, 0.07, 20).translate(0, -0.02, 0), new THREE.SphereGeometry(0.013, 14, 10).scale(1, 0.85, 0.8).translate(...on(0, -0.2, 1.015).toArray())];
  for (const sx of [-1, 1]) flesh.push(new THREE.SphereGeometry(0.05, 18, 14).scale(0.42, 1, 0.72).rotateY(sx * 0.35).translate(sx * 0.208, HY - 0.035, -0.005), new THREE.TorusGeometry(0.026, 0.008, 6, 14).rotateY(Math.PI / 2 + sx * 0.3).scale(1, 1.3, 1).translate(sx * 0.222, HY - 0.03, 0.002));
  add(head, mergeGeometries(flesh.map((g) => g.index ? g.toNonIndexed() : g)), skin);
  {   // a shaved head is not the colour of a cheek: the grey-blue shadow of the hair lies over the crown and fades at the hairline
    const c = document.createElement("canvas"); c.width = 8; c.height = 128; const x = c.getContext("2d"), g2 = x.createLinearGradient(0, 0, 0, 128);
    g2.addColorStop(0, "#fff"); g2.addColorStop(0.62, "#fff"); g2.addColorStop(1, "#000"); x.fillStyle = g2; x.fillRect(0, 0, 8, 128);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.014, 56, 24, 0, Math.PI * 2, 0, 1.32).scale(...S).rotateX(-0.36).translate(0, HY, 0),
      new THREE.MeshStandardMaterial({ color: 0x6b6a70, roughness: 0.75, transparent: true, opacity: 0.34, alphaMap: new THREE.CanvasTexture(c), depthWrite: false, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
    head.add(cap);
  }
  // The face is drawn in a few fine lines: closed eyes, brows, a small smile.
  const stroke = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, r, 6);
  const lines = [];
  for (const sx of [-1, 1]) {
    const eye = [], brow = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8 - 0.5; eye.push(on(sx * (0.36 + t * 0.3), -0.06 - 0.085 * (1 - 4 * t * t), 1.008)); brow.push(on(sx * (0.34 + t * 0.32), 0.2 + 0.05 * (1 - 4 * t * t) - t * sx * 0.0, 1.006)); }
    lines.push(stroke(eye, 0.0052), stroke(brow, 0.0034));
  }
  const smile = []; for (let i = 0; i <= 8; i++) { const t = i / 8 - 0.5; smile.push(on(t * 0.24, -0.36 + 0.045 * (4 * t * t), 1.012)); }
  lines.push(stroke(smile, 0.0042));
  add(head, mergeGeometries(lines), ink).castShadow = false;
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12).scale(1, 0.7, 0.22), rose); b.position.copy(on(sx * 0.6, -0.3, 0.99)); b.rotation.y = sx * 0.6; head.add(b); }

  // ---- Arms: wide sleeves that hang open at the cuff; small hands ----
  const arms = [], hands = [], legs = [], trousers = [], soles = [], footLift = [0, 0];
  for (const sx of [-1, 1]) {
    const arm = bone(sx < 0 ? "armL" : "armR"); arm.position.set(sx * 0.152, 0.765, 0); body.add(arm); arms.push(arm);
    const sleeve = new THREE.LatheGeometry(V2([[0.0, 0.035], [0.045, 0.025], [0.06, -0.02], [0.07, -0.12], [0.084, -0.22], [0.09, -0.27], [0.086, -0.285], [0.06, -0.275], [0.03, -0.262]]), 32);
    { const p = sleeve.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), d = smooth(-0.08, -0.3, y), a = Math.atan2(p.getX(i), p.getZ(i)); p.setY(i, y - d * 0.03 * (1 + Math.cos(a - Math.PI)) * 0.5 - d * 0.006 * Math.sin(a * 5)); p.setX(i, p.getX(i) * (1 - d * 0.12)); } sleeve.computeVertexNormals(); }
    const sl = add(arm, sleeve, robeM); sl.material = robeM;
    const hand = bone(sx < 0 ? "handL" : "handR"); hand.position.set(0, -0.265, 0.008); arm.add(hand); hands.push(hand);
    add(hand, mergeGeometries([new THREE.SphereGeometry(0.034, 16, 12).scale(0.62, 1.25, 0.95).translate(0, -0.04, 0), new THREE.SphereGeometry(0.014, 10, 8).scale(1, 1.7, 1).rotateX(-0.5).translate(0, -0.03, 0.03), new THREE.CylinderGeometry(0.02, 0.024, 0.05, 12).translate(0, 0.005, 0),
      ...[-0.0135, -0.0045, 0.0045, 0.0135].map((fx, k) => new THREE.CapsuleGeometry(0.0052, 0.022 + (k === 1 || k === 2 ? 0.006 : 0), 3, 8).translate(0, -0.088, fx))]), skin);   // four fingers, held together
    // Legs: loose trousers gathered at the ankle, white socks, black cloth shoes.
    const leg = bone(sx < 0 ? "legL" : "legR"); leg.position.set(sx * 0.082, 0.25, 0); root.add(leg); legs.push(leg);
    trousers.push(add(leg, new THREE.CylinderGeometry(0.062, 0.05, 0.13, 16).translate(0, -0.065, 0), sashM));
    add(leg, new THREE.CylinderGeometry(0.038, 0.04, 0.07, 14).translate(0, -0.16, 0), linen);
    const shoe = add(leg, mergeGeometries([new THREE.SphereGeometry(0.05, 16, 10).scale(0.86, 0.6, 1.75).translate(0, -0.215, 0.032), new THREE.CylinderGeometry(0.043, 0.045, 0.012, 14).translate(0, -0.192, 0)]), dark);
    shoe.geometry.computeBoundingBox();
    const bounds = shoe.geometry.boundingBox, probes = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) probes.push(new THREE.Vector3(x, y, z));
    soles.push(probes);
  }
  // He casts no real shadow (the shadow map is drawn once, for the buildings); a soft dark patch goes with him.
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  patch.position.y = 0.03; root.add(patch);
  const sun = { az: 0, len: 1, op: 1 };

  // Seated, his legs are folded under the robe: what shows is a lap of cloth spreading round him.
  const lap = add(root, mergeGeometries([new THREE.SphereGeometry(0.3, 24, 12).scale(1.12, 0.36, 0.95).translate(0, 0.1, 0.06), new THREE.SphereGeometry(0.13, 14, 10).scale(1.2, 0.7, 1.3).translate(-0.2, 0.1, 0.2), new THREE.SphereGeometry(0.13, 14, 10).scale(1.2, 0.7, 1.3).translate(0.2, 0.1, 0.2)]), robeM);
  lap.visible = false;
  let phase = 0, gait = 0, palms = 0, seat = 0;
  const contact = new THREE.Vector3(), bodyWorld = new THREE.Matrix4(), bodyInverse = new THREE.Matrix4();
  const clothPoints = robeMesh.geometry.attributes.position, clothBase = new Float32Array(clothPoints.array), hem = [], clothLift = new Float32Array(clothPoints.count);
  for (let i = 0; i < clothPoints.count; i++) if (clothPoints.getY(i) < 0.62) hem.push(i);
  clothPoints.setUsage(THREE.DynamicDrawUsage);
  robeMesh.geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  let bodyHeight = null, lastRootY = null;
  // The skeleton, in its resting pose: what an animation clip or a replacement figure is written against.
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([body, head, hat, ...arms, ...hands, ...legs]);
  return {
    group: root, skeleton, bones: Object.fromEntries(skeleton.bones.map((b) => [b.name, b])),
    // Where the light comes from (a direction toward it) and how strong it is, 0..1: his shadow lies away from it,
    // long when it is low.
    setSun(dir, strength) { const flat = Math.hypot(dir.x, dir.z) || 1e-3; sun.az = Math.atan2(-dir.x, -dir.z); sun.len = Math.min(3.4, Math.max(1, flat / Math.max(dir.y, 0.12))); sun.op = 0.35 + 0.65 * Math.min(1, strength); },
    // `speed` in metres a second; `pray` true to bring the palms together and bow the head a little.
    // `pose`: false to stand or walk, true or "pray" for palms together, "sit" to sit with legs folded.
    update(dt, speed, pose, t, surfaceAt, grounding = {}) {
      const pray = pose === true || pose === "pray", sit = pose === "sit", hop = pose === "hop";
      seat += ((sit ? 1 : 0) - seat) * Math.min(1, dt * 3.5);
      gait += ((speed > 0.05 && !sit ? 1 : 0) - gait) * Math.min(1, dt * 8); palms += ((pray ? 1 : 0) - palms) * Math.min(1, dt * 4);
      phase += dt * Math.max(speed, 0.4) * (grounding.stairs ? Math.PI / STAIR.tread : 4.6);
      const sw = Math.sin(phase) * 0.55 * gait, breathe = Math.sin(t * 1.6) * 0.004;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      arms.forEach((a, i) => {
        const sx = i ? 1 : -1;
        a.rotation.set(-0.95 * palms + (i ? sw : -sw) * 0.5 * (1 - palms), 0, -sx * 0.5 * palms + sx * 0.08 * (1 - palms));
        hands[i].rotation.set(-2.1 * palms, 0, 0); hands[i].position.y = -0.265 - 0.05 * palms;   // the hands come out of the sleeves, fingers up, to meet
      });
      body.position.y = Math.abs(Math.sin(phase)) * (grounding.stairs ? 0.008 : 0.024) * gait + breathe; body.rotation.x = 0.06 * gait + 0.08 * palms; body.rotation.z = Math.sin(phase) * 0.03 * gait;
      hat.rotation.z = Math.sin(phase) * 0.05 * gait; hat.position.y = 0.6 + Math.abs(Math.cos(phase)) * 0.008 * gait;
      head.rotation.x = 0.22 * palms + Math.sin(phase * 2) * 0.02 * gait; head.rotation.z = -Math.sin(phase) * 0.025 * gait;
      if (hop) {
        legs.forEach(leg => leg.rotation.x = -0.16);
        arms.forEach((arm, i) => { arm.rotation.x = -0.35; arm.rotation.z = i ? 0.24 : -0.24; });
        body.rotation.x = 0.08;
      }
      if (seat > 0.01) {   // down onto the cushion: hands in the lap, head a little bowed, breathing slowly
        body.position.y = -0.37 * seat + Math.sin(t * 0.9) * 0.006; body.rotation.x = 0.05 * seat; head.rotation.x += 0.1 * seat;
        arms.forEach((a, i) => { const sx = i ? 1 : -1; a.rotation.x += -0.62 * seat; a.rotation.z += -sx * 0.3 * seat; });
      }
      // The collider stays on the tread. The torso uses a continuous visual height,
      // while each foot compensates the collider's vertical delta in world space.
      let clothChanged = false;
      if (surfaceAt && seat < 0.01 && !hop) {
        root.updateWorldMatrix(true, false);
        const rootY = root.matrixWorld.elements[13], delta = lastRootY === null ? 0 : rootY - lastRootY;
        const desiredBody = grounding.heightAt ? grounding.heightAt(root.position.x, root.position.z) : rootY;
        if (bodyHeight === null || Math.abs(desiredBody - bodyHeight) > 1.2) bodyHeight = desiredBody;
        else bodyHeight = THREE.MathUtils.damp(bodyHeight, desiredBody, 18, dt);
        body.position.y += THREE.MathUtils.clamp(bodyHeight - rootY, -0.35, 0.2);
        legs.forEach((leg, i) => {
          leg.position.y = 0.25; leg.updateMatrix();
          let highest = -Infinity, lowest = Infinity;
          for (const probe of soles[i]) {
            contact.copy(probe).applyMatrix4(leg.matrix).applyMatrix4(root.matrixWorld);
            highest = Math.max(highest, surfaceAt(contact.x, contact.z)); lowest = Math.min(lowest, contact.y);
          }
          const lift = highest + 0.002 - lowest;
          const previous = Math.abs(delta) > 0.75 ? lift : footLift[i] - delta;
          footLift[i] = Math.max(lift, THREE.MathUtils.damp(previous, lift, 16, dt));
          leg.position.y += footLift[i];
          // The robe hides the hip: extend the trousers to connect the smoothed torso
          // to its independently planted foot without opening a gap under the hem.
          const length = Math.max(0.025, 0.13 + body.position.y - footLift[i]);
          trousers[i].scale.y = length / 0.13; trousers[i].position.y = length - 0.13;
        });
        lastRootY = rootY;
        // Bunch only the cloth that touches a higher tread; never lift the entire
        // upper body to clear a single vertex at the front of the robe.
        body.updateMatrix(); bodyWorld.multiplyMatrices(root.matrixWorld, body.matrix); bodyInverse.copy(bodyWorld).invert();
        for (const i of hem) {
          contact.fromArray(clothBase, i * 3).applyMatrix4(bodyWorld);
          const lift = Math.max(0, surfaceAt(contact.x, contact.z) + 0.002 - contact.y);
          clothLift[i] = Math.max(lift, THREE.MathUtils.damp(clothLift[i], lift, 20, dt));
          contact.y += clothLift[i]; contact.applyMatrix4(bodyInverse);
          if (Math.abs(contact.x - clothPoints.getX(i)) + Math.abs(contact.y - clothPoints.getY(i)) + Math.abs(contact.z - clothPoints.getZ(i)) > 1e-6) { clothPoints.setXYZ(i, contact.x, contact.y, contact.z); clothChanged = true; }
        }
      } else {
        bodyHeight = lastRootY = root.position.y;
        legs.forEach((leg, i) => { leg.position.y = 0.25; footLift[i] = 0; trousers[i].scale.y = 1; trousers[i].position.y = 0; });
        for (const i of hem) if (clothLift[i]) { clothPoints.setXYZ(i, clothBase[i * 3], clothBase[i * 3 + 1], clothBase[i * 3 + 2]); clothLift[i] = 0; clothChanged = true; }
      }
      if (clothChanged) { clothPoints.needsUpdate = true; robeMesh.geometry.computeVertexNormals(); }
      lap.visible = seat > 0.3; lap.scale.setScalar(Math.min(1, seat * 1.2)); for (const l of legs) l.visible = seat < 0.45;
      // The shadow keeps to the ground and to the sun, whichever way he turns.
      const a = sun.az - root.rotation.y, off = (sun.len - 1) * 0.42;
      patch.rotation.y = a; patch.scale.set(1, 1, sun.len); patch.position.set(Math.sin(a) * off, 0.03, Math.cos(a) * off); patch.material.opacity = sun.op;
    },
  };
}
