// How far the novice reaches from his centre at every 5 cm of height, for a body that is not yet in app/ (#286): the
// measure tools/walk/outline.mjs takes for the baked floor (tools/edges.mjs's `outline`, the same poses and frames), with
// the given body in place of app/shared/models/novice.glb, beside what tools/walk/outline.json holds now. Nothing is
// written into tools/walk/: the table is for choosing between widening BODY and drawing the arms in.
//
//   node tools/novice-outline.mjs <body.glb> [<body.glb> ...] [--md]
//
// For each body: `reach` (turned through a whole circle, every pose) and `low` (below the knee, his stride counted only
// sideways), each the larger of the figure built in code and that body, as outline.mjs takes them; and where the
// largest reach lies against BODY.
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import * as THREE from "three";
const { createMonk } = await import("../app/src/monk.js");
const { BODY } = await import("../app/src/geo.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");
const { wear } = await import("./novice-rig.mjs");

const BIN = 0.05, NB = 40;
/** tools/edges.mjs's outline(), for the bodies `makers` make. */
function outline(makers) {
  const bins = new Float32Array(NB), low = new Float32Array(NB), v = new THREE.Vector3();
  for (const make of makers) for (const [speed, pray] of [[0, false], [2.1, false], [4.2, false], [0, true], [0, "hop"], [2.1, "hop"]]) {
    const monk = make(), striding = speed > 0 && pray !== "hop";
    for (let k = 0; k < 150; k++) {
      monk.update(1 / 30, speed, pray, k / 30, () => 0, { heightAt: () => 0, stairs: false }); monk.group.updateMatrixWorld(true); monk.skeleton?.update?.();
      monk.group.traverse((o) => {
        if (!o.isMesh || !o.visible || o.userData.shadow || o.material?.transparent) return;
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { (o.isSkinnedMesh ? o.getVertexPosition(i, v) : v.fromBufferAttribute(a, i)).applyMatrix4(o.matrixWorld); const b = Math.floor(v.y / BIN); if (b < 0 || b >= NB || v.y <= 0.02) continue;
          bins[b] = Math.max(bins[b], Math.hypot(v.x, v.z)); low[b] = Math.max(low[b], striding ? Math.abs(v.x) : Math.hypot(v.x, v.z)); }
      });
    }
  }
  return { reach: Array.from(bins, (x) => +x.toFixed(3)), low: Array.from(low, (x) => +x.toFixed(3)) };
}

const files = process.argv.slice(2).filter((a) => !a.startsWith("--")), md = process.argv.includes("--md");
const now = JSON.parse(fs.readFileSync(new URL("./walk/outline.json", import.meta.url), "utf8"));
const cols = [["outline.json (now)", now]];
for (const f of files) { const body = readNovice(f); cols.push([f.split("/").pop(), outline([createMonk, () => wear(createMonk(), body)])]); }
const cm = (x) => (x * 100).toFixed(1);
const rows = []; for (let b = 0; b < NB; b++) if (cols.some(([, o]) => o.reach[b] > 0)) rows.push(b);
if (md) {
  console.log(`| 高度 | ${cols.map(([n]) => `${n} 半径`).join(" | ")} | ${cols.slice(1).map(([n]) => `${n} 比现在`).join(" | ")} |`);
  console.log(`|---|${cols.map(() => "---").join("|")}|${cols.slice(1).map(() => "---").join("|")}|`);
  for (const b of rows) console.log(`| ${b * 5}–${b * 5 + 5} cm | ${cols.map(([, o]) => o.reach[b].toFixed(3) + (o.low[b] && b * BIN < 0.32 ? ` (脚下 ${o.low[b].toFixed(3)})` : "")).join(" | ")} | ${cols.slice(1).map(([, o]) => `${o.reach[b] - now.reach[b] >= 0 ? "+" : ""}${cm(o.reach[b] - now.reach[b])} cm`).join(" | ")} |`);
} else for (const b of rows) console.log(`${String(b * 5).padStart(3)}-${String(b * 5 + 5).padEnd(3)} cm  ${cols.map(([n, o]) => `${n}: ${o.reach[b].toFixed(3)} / low ${o.low[b].toFixed(3)}`).join("   ")}`);
for (const [n, o] of cols) { const r = Math.max(...o.reach), b = o.reach.indexOf(r); console.log(`${n}: widest ${r.toFixed(3)} m at ${b * 5}-${b * 5 + 5} cm, ${r <= BODY ? "within" : "beyond"} BODY ${BODY} by ${cm(Math.abs(BODY - r))} cm; within 0.40 by ${cm(0.4 - r)} cm`); }
