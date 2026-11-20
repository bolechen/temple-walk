// How far each pose raises his arms, and how much of the robe that draws out (#286): for each pose the stage shows
// (tools/novice-stage/stage.js, posed the same way), the upper arm's angle from hanging straight down (the larger of
// the two), and the robe's edges stretched past 3× their length on the upper robe and belt, on the sleeves and on the
// skirt, as tests/unit/novice-tripo.test.mjs counts them (extras.ranges says which vertices are which piece).
//
//   node tools/novice-measure-arms.mjs <body.glb> [--md]
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../app/src/monk.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");
const { wear } = await import("./novice-rig.mjs");

const file = process.argv.slice(2).find((a) => !a.startsWith("--")), md = process.argv.includes("--md"), body = readNovice(file);
const hand = () => ({ at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 1 });
const hold = (m, set, pose = false, floor = 0) => { const act = { bow: 0, twist: 0, nod: 0, look: 0, breath: null, hands: { left: hand(), right: hand() } }; for (let i = 0; i < 90; i++) { m.group.updateMatrixWorld(true); set(m.bones, act); m.update(1 / 30, 0, pose, i / 30, () => floor, { act }); } };
const tea = (tilt, nod, pose, floor) => (m) => hold(m, (B, act) => {
  act.nod = nod; const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tilt), cup = B.head.localToWorld(new THREE.Vector3(0, 0.052, 0.128)).sub(new THREE.Vector3(0, 0.06, -0.07).applyQuaternion(q));
  for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; h.at.set(s * 0.068, 0.034, 0.012).applyQuaternion(q).add(cup); h.fingers.set(-s * 0.45, 0.15, 1).normalize(); h.palm.set(-s, 0.25, 0).normalize(); }
}, pose, floor);
const POSES = [
  ["站立", (m) => { for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); }],
  ["走路（第 52 帧）", (m) => { for (let i = 0; i <= 52; i++) m.update(1 / 30, 2.1, false, i / 30, () => 0, {}); }],
  ["合掌", (m) => { for (let i = 0; i < 90; i++) m.update(1 / 30, 0, "pray", i / 30, () => 0, {}); }],
  ["举香（到眉）", (m) => hold(m, (B, act) => { for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; B.head.localToWorld(h.at.set(s * 0.0125, 0.15, 0.15)); h.fingers.set(0, 1, 0.25).normalize(); h.palm.set(-s, 0, 0); } })],
  ["吃茶（站，碗到唇不倾）", tea(0, 0, false, 0)],
  ["吃茶（坐凳，碗倾 0.5）", tea(0.5, -0.17, "chair", -0.44)],
  ["吃茶（坐凳，碗倾 0.78，最高）", tea(0.78, -0.24, "chair", -0.44)],
  ["坐凳", (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); }],
  ["盘坐", (m) => { for (let i = 0; i < 100; i++) m.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); }],
];
const ranges = body.extras.ranges?.robe || [], sleeves = new Set(["tripo_part_1", "tripo_part_13"]), skirt = new Set(["tripo_part_5", "tripo_part_5_sash"]);
const pieceOf = (i) => (ranges.find(([, o, n]) => i >= o && i < o + n) || ["?"])[0];
const rows = [];
for (const [name, pose] of POSES) {
  const m = wear(createMonk(), body); pose(m); m.group.updateMatrixWorld(true);
  const angle = Math.max(...["left", "right"].map((s) => { const a = m.bones[s + "UpperArm"].getWorldPosition(new THREE.Vector3()), b = m.bones[s + "LowerArm"].getWorldPosition(new THREE.Vector3()); return Math.acos(Math.max(-1, Math.min(1, -(b.y - a.y) / a.distanceTo(b)))) * 180 / Math.PI; }));
  const g = body.geometries.robe, P = g.attributes.position, idx = g.index, mesh = m.parts.robe, a = new THREE.Vector3(), c = new THREE.Vector3(), A = new THREE.Vector3(), C = new THREE.Vector3();
  let onBody = 0, onSleeves = 0, onSkirt = 0;
  for (let t = 0; t < idx.count; t += 3) for (let k = 0; k < 3; k++) { const i = idx.getX(t + k), j = idx.getX(t + (k + 1) % 3); a.fromBufferAttribute(P, i); c.fromBufferAttribute(P, j); const L0 = a.distanceTo(c); if (L0 < 1e-4) continue; mesh.getVertexPosition(i, A).applyMatrix4(mesh.matrixWorld); mesh.getVertexPosition(j, C).applyMatrix4(mesh.matrixWorld); if (A.distanceTo(C) / L0 > 3) { const q = pieceOf(i); if (sleeves.has(q)) onSleeves++; else if (skirt.has(q)) onSkirt++; else onBody++; } }
  rows.push([name, angle, onBody, onSleeves, onSkirt]);
}
if (md) { console.log("| 姿势 | 上臂离下垂 | 上衣和腰带拉过 3 倍的边 | 袖子拉过 3 倍的边 | 袍摆拉过 3 倍的边 |\n|---|---|---|---|---|"); for (const [n, a, b, s, k] of rows) console.log(`| ${n} | ${a.toFixed(0)}° | ${b} | ${s} | ${k} |`); }
else for (const [n, a, b, s, k] of rows) console.log(`${n.padEnd(20)} upper arm ${a.toFixed(0).padStart(4)}° from hanging; upper robe and belt ${b}, sleeves ${s}, skirt ${k} edges past 3×`);
