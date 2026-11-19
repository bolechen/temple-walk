// Do his hands cover his eyes at the tea? (#286, from the 3D review on #246.) The bowl held at his lips in both hands, as
// tools/novice-stage/stage.js poses it (rites.js's hand places): for each eye, the highest point of either hand that lies
// before it (within its width across, and in front of the face), against the eye's lower edge. Positive: the hands are
// that far below the eye; negative: they come up over it.
//
//   node tools/novice-measure-tea.mjs [<body.glb> ...]     (the figure built in code is measured first)
//   node tools/novice-measure-tea.mjs --sequence [<body.glb> ...]
// --sequence (#286): the whole drink as rites.js's drinkTea makes it, seated on his stool: the bowl from his chest to his
// lips, tilted to 0.5 and on to 0.78 with the head back, and down again, three times, frame by frame at 30 a second;
// the least margin over all of it, and the frame where it falls.
//
// The eyes are found as tools/novice-measure.mjs finds them: the dark of the iris in the body's texture (or the closed
// lids' strokes in the vertex colours of the figure built in code), on the front of the face; each eye's lower edge is
// the lowest of its dark points, where the bowl is held (the head bows a little to the bowl).
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "three";
import sharp from "sharp";
const { createMonk } = await import("../app/src/monk.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");
const { wear } = await import("./novice-rig.mjs");

async function textureOf(file, json) {
  const bytes = fs.readFileSync(file), binAt = 20 + bytes.readUInt32LE(12), bin = bytes.subarray(binAt + 8), t = json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index];
  const view = json.bufferViews[json.images[t.source ?? t.extensions.EXT_texture_webp.source].bufferView];
  return sharp(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}
/** The dark points of the eyes, by index into the skin geometry. */
function eyePoints(g, texture) {
  const p = g.attributes.position, uv = g.attributes.uv, col = g.attributes.color; let top = 0, front = -1;
  for (let i = 0; i < p.count; i++) { top = Math.max(top, p.getY(i)); if (p.getY(i) > 0.9) front = Math.max(front, p.getZ(i)); }
  const out = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y < top - 0.3 || z < front - 0.05 || Math.abs(x) < 0.02 || Math.abs(x) > 0.1) continue;
    let c;
    if (texture) { const { data, info } = texture, u = Math.min(info.width - 1, Math.round(uv.getX(i) * (info.width - 1))), w = Math.min(info.height - 1, Math.round(uv.getY(i) * (info.height - 1))), o = (w * info.width + u) * 3; c = [data[o], data[o + 1], data[o + 2]].map((k) => k / 255); }
    else if (col) c = [col.getX(i), col.getY(i), col.getZ(i)]; else continue;
    if (Math.max(...c) < 0.3) out.push(i);
  }
  return out;
}
/** Pose `m` with the bowl at his lips, as the stage does. */
function tea(m) {
  const hand = () => ({ at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 0 });
  const act = { bow: 0, twist: 0, nod: 0, look: 0, breath: null, hands: { left: hand(), right: hand() } };
  for (let i = 0; i < 90; i++) {
    m.group.updateMatrixWorld(true);
    const mouth = m.bones.head.localToWorld(new THREE.Vector3(0, 0.052, 0.128)), cup = mouth.sub(new THREE.Vector3(0, 0.06, -0.07));
    for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; h.at.set(s * 0.068, 0.034, 0.012).add(cup); h.fingers.set(-s * 0.45, 0.15, 1).normalize(); h.palm.set(-s, 0.25, 0).normalize(); h.w = 1; }
    m.update(1 / 30, 0, false, i / 30, () => 0, { act });
  }
  m.group.updateMatrixWorld(true);
}
// HOLD (env, x,y,z): where each hand holds the bowl in the bowl's frame; rites.js's hold() has 0.068,0.034,0.012. Only to try a
// lower grip without touching app/ (#286).
const HOLD = (process.env.HOLD || "0.068,0.034,0.012").split(",").map(Number);
/** rites.js's drinkTea from the bowl at his chest on, seated: each frame calls `each(phase)`. */
function sequence(m, each) {
  const hand = () => ({ at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 1 });
  const act = { bow: 0.06, twist: 0, nod: 0, look: 0, breath: null, hands: { left: hand(), right: hand() } }, cup = new THREE.Vector3(), q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), rim = new THREE.Vector3(0, 0.06, -0.07);
  const ease = (u) => u * u * (3 - 2 * u), chestAt = () => m.bones.chest.localToWorld(new THREE.Vector3(0, 0, 0.17)), toLips = () => m.bones.head.localToWorld(new THREE.Vector3(0, 0.052, 0.128)).sub(rim.clone().applyQuaternion(q));
  const hold = () => { for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; h.at.set(s * HOLD[0], HOLD[1], HOLD[2]).applyQuaternion(q).add(cup); h.fingers.set(-s * 0.45, 0.15, 1).normalize(); h.palm.set(-s, 0.25, 0).normalize(); } };
  const tiltTo = (t) => q.setFromAxisAngle(X, -t);
  let t = 0; const frame = (fn, label) => { m.group.updateMatrixWorld(true); fn(); hold(); m.update(1 / 30, 0, "chair", t, () => -0.44, { act }); t += 1 / 30; each(label); };
  for (let i = 0; i < 60; i++) frame(() => { tiltTo(0); cup.copy(chestAt()); }, null);   // settling: the hands come to the bowl (not measured)
  const steps = (secs) => Math.round(secs * 30);
  for (let sip = 1; sip <= 3; sip++) {
    for (let i = 1; i <= steps(0.75); i++) { const k = ease(i / steps(0.75)); frame(() => { act.nod = -0.17 * k; tiltTo(0.5 * k); cup.copy(chestAt()).lerp(toLips(), k); }, `sip ${sip}: up to the lips`); }
    for (let i = 1; i <= steps(0.75); i++) { const k = ease(i / steps(0.75)); frame(() => { act.nod = -0.17 - 0.07 * k; tiltTo(0.5 + 0.28 * k); cup.copy(toLips()); }, `sip ${sip}: tilted`); }
    for (let i = 1; i <= steps(0.75); i++) { const k = 1 - ease(i / steps(0.75)); frame(() => { act.nod = -0.24 * k; tiltTo(0.78 * k); cup.copy(chestAt()).lerp(toLips(), k); }, `sip ${sip}: down`); }
    for (let i = 1; i <= steps(0.6); i++) frame(() => { tiltTo(0); cup.copy(chestAt()); }, `sip ${sip}: at the chest`);
  }
}
/** The least margin (m) over both eyes, now; and how it is made up. */
function margin(m, eyes) {
  const mesh = m.parts.skin, g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = m.skeleton.bones.map((b) => b.name);
  if (!margin.hands) { margin.hands = []; for (let i = 0; i < g.attributes.position.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (/Hand$/.test(names[si.getComponent(i, k)])) w += sw.getComponent(i, k); if (w > 0.5) margin.hands.push(i); } }
  m.group.updateMatrixWorld(true); const pos = (i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld), H = margin.hands.map(pos);
  let least = Infinity;
  for (const side of [1, -1]) {
    const e = eyes.filter((i) => Math.sign(g.attributes.position.getX(i)) === side).map(pos);
    const x0 = Math.min(...e.map((q) => q.x)) - 0.005, x1 = Math.max(...e.map((q) => q.x)) + 0.005, low = Math.min(...e.map((q) => q.y)), z = Math.max(...e.map((q) => q.z));
    for (const q of H) if (q.x > x0 && q.x < x1 && q.z > z - 0.04) least = Math.min(least, low - q.y);
  }
  return least;
}
function measure(label, m, eyes) {
  const mesh = m.parts.skin, g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = m.skeleton.bones.map((b) => b.name), v = new THREE.Vector3();
  const pos = (i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  const hands = { left: [], right: [] };
  for (let i = 0; i < g.attributes.position.count; i++) for (const side of ["left", "right"]) { let w = 0; for (let k = 0; k < 4; k++) if (names[si.getComponent(i, k)] === side + "Hand") w += sw.getComponent(i, k); if (w > 0.5) hands[side].push(pos(i)); }
  const rows = [];
  for (const side of ["left", "right"]) {
    const e = eyes.filter((i) => (g.attributes.position.getX(i) > 0) === (side === "left")).map(pos);
    const x0 = Math.min(...e.map((q) => q.x)) - 0.005, x1 = Math.max(...e.map((q) => q.x)) + 0.005, low = Math.min(...e.map((q) => q.y)), z = Math.max(...e.map((q) => q.z));
    let top = -Infinity, by = null;
    for (const h of ["left", "right"]) for (const q of hands[h]) if (q.x > x0 && q.x < x1 && q.z > z - 0.04 && q.y > top) { top = q.y; by = h; }
    rows.push(`${side} eye: lower edge ${(low * 100).toFixed(1)} cm; ${by ? `highest hand point before it (${by} hand) ${(top * 100).toFixed(1)} cm, ${top < low ? "below it by" : "OVER it by"} ${(Math.abs(low - top) * 100).toFixed(1)} cm` : "no hand before it"}`);
    void v;
  }
  console.log(label.padEnd(24), rows.join(" | "));
}
const seq = process.argv.includes("--sequence"), files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const run = (label, m, eyes) => {
  if (!seq) { tea(m); measure(label, m, eyes); return; }
  margin.hands = null; let least = Infinity, where = "", n = 0;
  sequence(m, (phase) => { if (!phase) return; n++; const g = margin(m, eyes); if (g < least) { least = g; where = `${phase}, frame ${n}`; } });
  console.log(label.padEnd(24), `the whole drink, ${n} frames: hands at least ${(least * 100).toFixed(1)} cm ${least >= 0 ? "below" : "OVER"} the eyes' lower edge (${where})`);
};
const code = createMonk(); run("code", code, eyePoints(code.parts.skin.geometry, null));
for (const f of files) { const b = readNovice(f), tex = await textureOf(f, b.json); run(f.split("/").pop(), wear(createMonk(), b), eyePoints(b.geometries.skin, tex)); }
