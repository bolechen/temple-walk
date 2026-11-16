// Route B of issue #80, the part that needs no paid tool, tried: a body rigged in Blender to a skeleton of its own (as
// Auto-Rig Pro would export it, with game-engine bone names) is turned into the file monk.dress() wears.
//
//   node tools/novice-retarget-trial.mjs bones <out.json>          our skeleton in its bind pose, for the Blender side
//   node tools/novice-retarget-trial.mjs convert <in.glb> <out.glb> a Blender export → the novice.glb format
//
// The Blender side is tools/novice-retarget-trial.py. `convert` reads the export's skin, names each of its joints by
// MAP (theirs → ours; bones of theirs that we do not have give their weight to the nearest of ours up the chain), splits
// the meshes by material into skin, robe, legs and shoes, and gives the robe below the sash the skirt's weights from the
// figure built in code (Auto-Rig Pro has no skirt bones of ours; the skirt is a spring, not a limb). Nothing it writes is
// shipped: a trial for issue #80, step one.
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "three";
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const { createMonk } = await import("../app/src/monk.js");

const PARTS = ["skin", "robe", "legs", "shoes"];
// Theirs → ours. The names are Unreal's, which is what Auto-Rig Pro's game export writes by default (its own names,
// thigh_stretch.l and the like, map the same way); twist and stretch bones fold into the limb they lie along.
const MAP = {
  root: "root", pelvis: "hips", spine_01: "spine", spine_02: "chest", spine_03: "chest", neck_01: "neck", head: "head",
  clavicle_l: "leftShoulder", upperarm_l: "leftUpperArm", upperarm_twist_01_l: "leftUpperArm", lowerarm_l: "leftLowerArm", lowerarm_twist_01_l: "leftLowerArm", hand_l: "leftHand",
  clavicle_r: "rightShoulder", upperarm_r: "rightUpperArm", upperarm_twist_01_r: "rightUpperArm", lowerarm_r: "rightLowerArm", lowerarm_twist_01_r: "rightLowerArm", hand_r: "rightHand",
  thigh_l: "leftUpperLeg", thigh_twist_01_l: "leftUpperLeg", calf_l: "leftLowerLeg", foot_l: "leftFoot", ball_l: "leftFoot",
  thigh_r: "rightUpperLeg", thigh_twist_01_r: "rightUpperLeg", calf_r: "rightLowerLeg", foot_r: "rightFoot", ball_r: "rightFoot",
};
const monk = createMonk(); monk.update(1 / 30, 0, "bind", 0); monk.group.updateMatrixWorld(true);
const names = monk.skeleton.bones.map((b) => b.name);
const [cmd, a, b] = process.argv.slice(2);

if (cmd === "bones") {
  const v = new THREE.Vector3();
  fs.writeFileSync(a, JSON.stringify(monk.skeleton.bones.map((bn) => ({ name: bn.name, parent: bn.parent.isBone ? bn.parent.name : null, p: bn.getWorldPosition(v).toArray() }))));
  console.log("wrote", a, names.length, "bones");
} else if (cmd === "convert") {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(a), root = doc.getRoot();
  const skin = root.listSkins()[0]; if (!skin) throw new Error("the export has no skin");
  // Blender's exporter adds "neutral_bone" for vertices the bind left without a weight; those take the code figure's.
  const theirs = skin.listJoints().map((j) => j.getName()), unmapped = theirs.filter((n) => !MAP[n] && n !== "neutral_bone");
  if (unmapped.length) throw new Error(`bones with no counterpart: ${unmapped.join(", ")}`);
  const toOurs = theirs.map((n) => (n === "neutral_bone" ? -1 : names.indexOf(MAP[n])));
  // weights from the figure built in code: the K nearest vertices of the same part
  let R, filled = 0;
  const codeWeights = (part, x, y, z) => {
    R = monk.parts[part].geometry.attributes;
    const best = []; for (let i = 0; i < R.position.count; i++) { const d = (R.position.getX(i) - x) ** 2 + (R.position.getY(i) - y) ** 2 + (R.position.getZ(i) - z) ** 2; if (best.length < 4 || d < best[3][0]) { best.push([d, i]); best.sort((p, q) => p[0] - q[0]); best.length = Math.min(best.length, 4); } }
    const w = new Map(); let s = 0; for (const [d, i] of best) { const k = 1 / (d + 1e-5); s += k; for (let j = 0; j < 4; j++) { const bw = R.skinWeight.getComponent(i, j); if (bw > 0) w.set(R.skinIndex.getComponent(i, j), (w.get(R.skinIndex.getComponent(i, j)) || 0) + k * bw); } }
    for (const [bn, v] of w) w.set(bn, v / s); return w;
  };
  const out = new Document(); out.createBuffer(); const buf = out.getRoot().listBuffers()[0], scene = out.createScene("novice");
  const material = out.createMaterial("novice").setDoubleSided(true), acc = (t, arr) => out.createAccessor().setType(t).setArray(arr).setBuffer(buf), counts = {};
  for (const part of PARTS) {
    const pos = [], nor = [], uv = [], jj = [], ww = [], idx = [];
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      if (prim.getMaterial()?.getName() !== part) continue;
      const P = prim.getAttribute("POSITION"), N = prim.getAttribute("NORMAL"), T = prim.getAttribute("TEXCOORD_0"), Jt = prim.getAttribute("JOINTS_0"), Wt = prim.getAttribute("WEIGHTS_0"), base = pos.length / 3;
      for (let i = 0; i < P.getCount(); i++) {
        const p = P.getElement(i, []); pos.push(...p); nor.push(...N.getElement(i, [])); uv.push(...(T ? T.getElement(i, []) : [0, 0]));
        let w = new Map(); const jv = Jt.getElement(i, []), wv = Wt.getElement(i, []);
        for (let k = 0; k < 4; k++) if (wv[k] > 0 && toOurs[jv[k]] >= 0) w.set(toOurs[jv[k]], (w.get(toOurs[jv[k]]) || 0) + wv[k]);
        if ([...w.values()].reduce((s, v) => s + v, 0) < 1e-3) { w = codeWeights(part, ...p); filled++; }
        if (part === "robe" && p[1] < 0.5) {   // below the sash the skirt bones take over, fully by mid-thigh
          const k = Math.min(1, (0.5 - p[1]) / 0.12), s = codeWeights("robe", p[0], p[1], p[2]), m = new Map();
          for (const [bn, v] of w) m.set(bn, (1 - k) * v); for (const [bn, v] of s) m.set(bn, (m.get(bn) || 0) + k * v); w = m;
        }
        const top = [...w].sort((x, y) => y[1] - x[1]).slice(0, 4), sum = top.reduce((s, [, v]) => s + v, 0);
        for (let k = 0; k < 4; k++) { jj.push(top[k]?.[0] ?? 0); ww.push(top[k] ? top[k][1] / sum : 0); }
      }
      for (const i of prim.getIndices().getArray()) idx.push(base + i);
    }
    if (!idx.length) throw new Error(`no ${part} in the export`);
    counts[part] = { triangles: idx.length / 3, vertices: pos.length / 3 };
    const prim = out.createPrimitive().setAttribute("POSITION", acc("VEC3", new Float32Array(pos))).setAttribute("NORMAL", acc("VEC3", new Float32Array(nor)))
      .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(uv))).setAttribute("JOINTS_0", acc("VEC4", new Uint16Array(jj))).setAttribute("WEIGHTS_0", acc("VEC4", new Float32Array(ww)))
      .setIndices(acc("SCALAR", new Uint32Array(idx))).setMaterial(material);
    scene.addChild(out.createNode(part).setMesh(out.createMesh(part).addPrimitive(prim)));
  }
  out.getRoot().setExtras({ generator: "tools/novice-retarget-trial.mjs", height: 1.18, bones: names, parts: PARTS, counts, from: theirs });
  await io.write(b, out);
  console.log("wrote", b, (fs.statSync(b).size / 1e6).toFixed(2), "MB", JSON.stringify(counts), "| their joints", theirs.length, "| vertices the bind left bare, given the code figure's weights:", filled);
} else { console.error("usage: bones <out.json> | convert <in.glb> <out.glb>"); process.exit(1); }
