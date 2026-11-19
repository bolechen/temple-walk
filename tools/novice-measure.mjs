// What a new body for the novice would change if he wore it (issue #246, acceptance 8): how far he reaches from his
// centre beside BODY (the width the plan keeps him off everything, geo.js), measured in the poses edges.test.mjs
// measures; the top of his head and his eyes above his soles; the code body's beside it.
//
//   node tools/novice-measure.mjs [<body.glb> ...]
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import sharp from "sharp";
import fs from "node:fs";
const { createMonk } = await import("../app/src/monk.js");
const { BODY } = await import("../app/src/geo.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");

function reach(make) {
  let r = 0, worst = null; const v = new THREE.Vector3();
  for (const [speed, pose] of [[0, false], [2.1, false], [4.2, false], [0, true], [0, "hop"], [2.1, "hop"]]) {
    const m = make();
    for (let k = 0; k < 90; k++) {
      m.update(1 / 30, speed, pose, k / 30, () => 0, { heightAt: () => 0, stairs: false }); m.group.updateMatrixWorld(true);
      m.group.traverse((o) => { if (!o.isMesh || !o.visible || o.material?.transparent) return; const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { (o.isSkinnedMesh ? o.getVertexPosition(i, v) : v.fromBufferAttribute(a, i)).applyMatrix4(o.matrixWorld); const d = Math.hypot(v.x, v.z); if (v.y > 0.02 && d > r) { r = d; worst = `${o.name || o.parent?.name || "?"} ${speed} m/s ${pose}`; } } });
    }
  }
  return { r, worst };
}
// The eyes: the dark of the iris (or the closed lid's stroke) on the front of the face, its mean height.
async function eyes(g, texture) {
  const p = g.attributes.position, uv = g.attributes.uv, col = g.attributes.color; let top = 0, front = -1; for (let i = 0; i < p.count; i++) { top = Math.max(top, p.getY(i)); if (p.getY(i) > 0.9) front = Math.max(front, p.getZ(i)); }
  let s = 0, n = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y < top - 0.3 || z < front - 0.05 || Math.abs(x) < 0.02 || Math.abs(x) > 0.1) continue;
    let c;
    if (texture) { const { data, info } = texture, u = Math.min(info.width - 1, Math.round(uv.getX(i) * (info.width - 1))), w = Math.min(info.height - 1, Math.round(uv.getY(i) * (info.height - 1))), o = (w * info.width + u) * 3; c = [data[o], data[o + 1], data[o + 2]].map((k) => k / 255); }
    else if (col) c = [col.getX(i), col.getY(i), col.getZ(i)]; else continue;
    if (Math.max(...c) < 0.3) { s += y; n++; }
  }
  return { top, eye: n ? s / n : NaN, n };
}
const code = createMonk(); code.update(1 / 30, 0, "bind", 0);
const out = { BODY, code: { ...reach(createMonk), ...(await eyes(code.parts.skin.geometry, null)) } };
for (const f of process.argv.slice(2)) {
  const b = readNovice(f), make = () => { const m = createMonk(); m.dress(b.geometries, new THREE.MeshStandardMaterial(), b.extras.robeColor); return m; };
  const bytes = fs.readFileSync(f), json = b.json, binAt = 20 + bytes.readUInt32LE(12), bin = bytes.subarray(binAt + 8), t = json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index];
  const view = json.bufferViews[json.images[t.source ?? t.extensions.EXT_texture_webp.source].bufferView];
  const texture = await sharp(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  out[f] = { ...reach(make), ...(await eyes(b.geometries.skin, texture)) };
}
for (const [k, v] of Object.entries(out)) if (typeof v === "object") console.log(k.padEnd(36), `reach ${v.r.toFixed(3)} m (${v.worst}) vs BODY ${BODY}: ${((v.r - BODY) * 100).toFixed(1)} cm; head top ${v.top.toFixed(3)} m; eyes ${v.eye.toFixed(3)} m (${v.n} points)`);
