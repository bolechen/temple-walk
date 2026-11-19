// The body made from Tripo's layered model (tools/novice-tripo.mjs, issue #246) held to what the sculpted body is held to
// (novice.test.mjs) and to what that one fails: sitting on a stool and cross-legged without parting at a seam, no black
// under the robe. The file is a trial and is not in git: it is read from NOVICE_TRIPO, or from tools/out/novice-tripo.glb
// where the tool writes it by default; without either these tests are skipped.
//   node tools/novice-tripo.mjs <dir with seg-model.glb and comp-model.glb> && node --test tests/unit/novice-tripo.test.mjs
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
import "./dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../../app/src/monk.js");
const { readNovice } = await import("./novice-glb.mjs");

const FILE = process.env.NOVICE_TRIPO || new URL("../../tools/out/novice-tripo.glb", import.meta.url).pathname;
const SHIPPED = new URL("../../app/shared/models/novice.glb", import.meta.url);
const skip = !fs.existsSync(FILE) && `no ${FILE}: run tools/novice-tripo.mjs first`;
const PARTS = ["skin", "robe", "legs", "shoes"];
const body = skip ? null : readNovice(FILE);
const dressed = () => { const m = createMonk(); m.dress(body.geometries, new THREE.MeshStandardMaterial(), body.extras.robeColor); return m; };
const world = (mesh, i, v = new THREE.Vector3()) => mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
const tris = (g) => PARTS.reduce((s, n) => s + g[n].index.count / 3, 0);

test("made for this skeleton: four parts, joints numbered as monk.js's bones, two textures", { skip }, () => {
  assert.deepEqual(body.extras.bones, createMonk().skeleton.bones.map((b) => b.name));
  assert.deepEqual(body.json.nodes.map((n) => n.name), PARTS);
  assert.ok(body.json.images.length <= 2 && body.json.images.every((i) => i.mimeType === "image/webp"), `${body.json.images.length} textures`);
});

test("within budget: at most 1.5 times the sculpted body's triangles, at most 1.5 MB", { skip }, () => {
  const mine = tris(body.geometries), theirs = tris(readNovice(SHIPPED).geometries), bytes = fs.statSync(FILE).size;
  assert.ok(mine <= 1.5 * theirs, `${mine} triangles beside ${theirs}`);
  assert.ok(bytes <= 1.5e6, `${(bytes / 1e6).toFixed(2)} MB`);
});

test("he stands 1.18 m tall, soles on the floor, centred; every weight whole and on a bone that is there", { skip }, () => {
  const box = new THREE.Box3(); for (const n of PARTS) { body.geometries[n].computeBoundingBox(); box.union(body.geometries[n].boundingBox); }
  assert.ok(Math.abs(box.max.y - 1.18) < 0.005 && Math.abs(box.min.y) < 0.003, `${box.min.y.toFixed(3)} to ${box.max.y.toFixed(3)} m`);
  assert.ok(Math.abs(box.min.x + box.max.x) < 0.01 && Math.abs(box.min.z + box.max.z) < 0.04, "centred");
  const bones = body.extras.bones.length;
  for (const n of PARTS) {
    const si = body.geometries[n].attributes.skinIndex, sw = body.geometries[n].attributes.skinWeight;
    for (let i = 0; i < si.count; i++) { let s = 0; for (let k = 0; k < 4; k++) { s += sw.getComponent(i, k); assert.ok(si.getComponent(i, k) < bones); } assert.ok(Math.abs(s - 1) < 1e-4, `${n} ${i}: ${s}`); }
  }
});

test("the sash's end hangs on sashTail, at his left front; the rest of the robe does not", { skip }, () => {
  const g = body.geometries.robe, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, tail = body.extras.bones.indexOf("sashTail");
  let n = 0, stray = 0;
  for (let i = 0; i < p.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === tail) w += sw.getComponent(i, k); if (w > 0.9) { n++; if (!(p.getX(i) > 0 && p.getZ(i) > 0 && p.getY(i) < 0.6)) stray++; } }
  assert.ok(n > 100, `${n} vertices wholly on sashTail`);
  assert.equal(stray, 0, `${stray} of them are not at his left front`);
});

test("his hands go with his hands, both forearms with their forearms, his shoes with his feet", { skip }, () => {
  const names = body.extras.bones, share = (part, where, bone) => {
    const g = body.geometries[part], p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight; let w = 0, n = 0;
    for (let i = 0; i < p.count; i++) { if (!where(p.getX(i), p.getY(i), p.getZ(i))) continue; n++; for (let k = 0; k < 4; k++) if (bone(names[si.getComponent(i, k)])) w += sw.getComponent(i, k); }
    return [n, w / Math.max(1, n)];
  };
  for (const s of [1, -1]) {
    const side = s > 0 ? "left" : "right";
    const [nh, wh] = share("skin", (x, y) => s * x > 0.33 && y < 0.62, (b) => b === side + "Hand" || b === side + "LowerArm");
    const [nf, wf] = share("skin", (x, y) => s * x > 0.24 && s * x < 0.3 && y < 0.75, (b) => b === side + "LowerArm" || b === side + "Hand" || b === side + "UpperArm");
    assert.ok(nh > 30 && wh > 0.95, `${side} hand: ${nh} vertices, ${wh.toFixed(2)} on hand and forearm`);
    assert.ok(nf > 20 && wf > 0.95, `${side} forearm: ${nf} vertices, ${wf.toFixed(2)} on the arm`);
  }
  // below the collar: the ring the shoe shares with the leg wrap takes half the shin's weight on purpose (WRAP_RANK)
  const [ns, ws] = share("shoes", (x, y) => y < 0.06, (b) => /Foot$/.test(b)); assert.ok(ns > 100 && ws > 0.95, `shoes below the collar ${ws.toFixed(2)}`);
});

// Copies of one point (a seam, or where two pieces meet) must take one weight and stay together. The sash's end is
// the one exception, kept apart on purpose: its edge lies on the skirt and leaves it when it swings.
const groups = skip ? [] : (() => {
  const all = []; for (const p of PARTS) { const a = body.geometries[p].attributes.position; for (let i = 0; i < a.count; i++) all.push([p, i, a.getX(i), a.getY(i), a.getZ(i)]); }
  const tail = body.extras.bones.indexOf("sashTail"), onTail = ([p, i]) => { const g = body.geometries[p].attributes; for (let k = 0; k < 4; k++) if (g.skinIndex.getComponent(i, k) === tail && g.skinWeight.getComponent(i, k) > 0) return true; return false; };
  const cell = new Map(); for (const v of all) { const k = `${Math.round(v[2] * 1e5)},${Math.round(v[3] * 1e5)},${Math.round(v[4] * 1e5)}`; if (!cell.has(k)) cell.set(k, []); cell.get(k).push(v); }
  return [...cell.values()].filter((g) => g.length > 1 && (g.every(onTail) || !g.some(onTail))).map((g) => g.map(([p, i]) => [p, i]));
})();

test("every copy of one point takes the same weights (the sash's free edge apart)", { skip }, () => {
  let bad = 0; const dense = ([p, i]) => { const g = body.geometries[p].attributes, m = new Map(); for (let k = 0; k < 4; k++) { const w = g.skinWeight.getComponent(i, k); if (w > 0) m.set(g.skinIndex.getComponent(i, k), (m.get(g.skinIndex.getComponent(i, k)) || 0) + w); } return m; };
  for (const g of groups) { const a = dense(g[0]); for (const c of g.slice(1)) { const b = dense(c); for (const k of new Set([...a.keys(), ...b.keys()])) if (Math.abs((a.get(k) || 0) - (b.get(k) || 0)) > 1e-6) { bad++; break; } } }
  assert.ok(groups.length > 1000, `${groups.length} points with more than one copy`);
  assert.equal(bad, 0, `${bad} copies take other weights than their point's first`);
});

function together(m, what) {
  m.group.updateMatrixWorld(true); const a = new THREE.Vector3(), v = new THREE.Vector3(); let worst = 0, n = 0;
  for (const g of groups) { world(m.parts[g[0][0]], g[0][1], a); let s = 0; for (const [p, i] of g.slice(1)) s = Math.max(s, world(m.parts[p], i, v).distanceTo(a)); worst = Math.max(worst, s); if (s > 0.001) n++; }
  assert.ok(worst <= 0.001, `${what}: ${n} points come apart, at worst ${(worst * 1000).toFixed(1)} mm`);
}

test("copies stay within a millimetre standing, through a stride and up a flight", { skip }, () => {
  const m = dressed(); for (let i = 0; i < 40; i++) m.update(1 / 30, 0, false, i / 30, () => 0, {}); together(m, "standing");
  const w = dressed(); for (let i = 0; i < 120; i++) { w.update(1 / 30, 2.1, false, i / 30, () => 0, {}); if (i >= 30 && i % 3 === 0) together(w, `walking, frame ${i}`); }
  const c = dressed(), step = (z) => Math.max(0, Math.floor(-z / 0.3)) * 0.15, ramp = (z) => Math.max(0, -z) * 0.5;
  for (let i = 0; i < 90; i++) { const z = -i / 30 * 1.2; c.group.position.set(0, ramp(z), z); c.update(1 / 30, 1.2, false, i / 30, (x, zz) => step(zz), { heightAt: (x, zz) => ramp(zz), stairs: true }); if (i >= 30 && i % 3 === 0) together(c, `climbing, frame ${i}`); }
});

test("copies stay within a millimetre sitting on a stool and cross-legged on a cushion, and with palms together", { skip }, () => {
  const chair = dressed(); for (let i = 0; i < 100; i++) { chair.update(1 / 30, 0, "chair", i / 30, () => -0.44, {}); if (i >= 60 && i % 10 === 0) together(chair, `on a stool, frame ${i}`); }
  const sit = dressed(); for (let i = 0; i < 100; i++) { sit.update(1 / 30, 0, "sit", i / 30, () => -0.104, {}); if (i >= 60 && i % 10 === 0) together(sit, `on a cushion, frame ${i}`); }
  const pray = dressed(); for (let i = 0; i < 90; i++) pray.update(1 / 30, 0, "pray", i / 30, () => 0, {}); together(pray, "palms together");
});

test("nothing he wears is black: the faces the completion made under the robe are coloured", { skip }, async () => {
  const sharp = (await import("sharp")).default, b = fs.readFileSync(FILE), json = body.json;
  const binAt = 20 + b.readUInt32LE(12), bin = b.subarray(binAt + 8), view = json.bufferViews[json.images[(t => t.source ?? t.extensions.EXT_texture_webp.source)(json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index])].bufferView];
  const { data, info } = await sharp(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const part of ["legs", "robe"]) {
    const uv = body.geometries[part].attributes.uv; let dark = 0;
    for (let i = 0; i < uv.count; i++) { const x = Math.min(info.width - 1, Math.round(uv.getX(i) * (info.width - 1))), y = Math.min(info.height - 1, Math.round(uv.getY(i) * (info.height - 1))), o = (y * info.width + x) * 3; if (Math.max(data[o], data[o + 1], data[o + 2]) < 40) dark++; }
    assert.ok(dark / uv.count < 0.002, `${part}: ${dark} of ${uv.count} vertices sit on near-black texture`);
  }
});

test("no triangle of the trousers is half on the plain colour and half on the texture (#246: red and cream zigzags)", { skip }, () => {
  // The faces the completion made all point at one spot of the atlas, the plain colour: the most common coordinate.
  const g = body.geometries.legs, uv = g.attributes.uv, idx = g.index, count = new Map(), key = (i) => `${uv.getX(i).toFixed(6)},${uv.getY(i).toFixed(6)}`;
  for (let i = 0; i < uv.count; i++) count.set(key(i), (count.get(key(i)) || 0) + 1);
  const plain = [...count].sort((a, b) => b[1] - a[1])[0][0]; let mixed = 0;
  for (let t = 0; t < idx.count; t += 3) { const n = [0, 1, 2].filter((k) => key(idx.getX(t + k)) === plain).length; if (n === 1 || n === 2) mixed++; }
  assert.ok(count.get(plain) > 100, `${count.get(plain)} corners on the plain colour`);
  assert.equal(mixed, 0, `${mixed} triangles stretch from the plain colour across the atlas`);
});

// #256 review: with the arms raised over the shoulders (the incense at the brow) the sleeves tore along the upper arm and
// opened at the armpit, and walking, the back foot's leg wrap tore at its lower edge. Copies of one point must stay
// together there too.
test("copies stay within a millimetre with the arms raised to the brow, and on the back foot through a stride", { skip }, () => {
  const m = dressed(), hand = () => ({ at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 1 });
  const act = { bow: 0, twist: 0, nod: 0, look: 0, breath: null, hands: { left: hand(), right: hand() } };
  for (let i = 0; i < 90; i++) {
    m.group.updateMatrixWorld(true);
    for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; m.bones.head.localToWorld(h.at.set(s * 0.0125, 0.15, 0.15)); h.fingers.set(0, 1, 0.25).normalize(); h.palm.set(-s, 0, 0); }
    m.update(1 / 30, 0, false, i / 30, () => 0, { act });
    if (i >= 60 && i % 10 === 0) together(m, `arms raised to the brow, frame ${i}`);
  }
  const w = dressed();
  for (let i = 0; i < 90; i++) { w.update(1 / 30, 2.1, false, i / 30, () => 0, {}); if (i >= 40 && i % 2 === 0) together(w, `walking, frame ${i}`); }
});

// #256 review, measured: what tore under the raised arms and at the back foot's leg wrap was not copies parting (the
// test above held there) but edges drawn out many times their length. Edges stretched past 3× with the arms at the brow,
// and edge-frames past 2× round the ankles through a stride, counted on the file before the sleeves, the shoulders and the
// wraps took bone heat (629 and 1,896) and after (about 420 and 350).
const stretched = (m, part, over, keep = () => true) => {
  const g = body.geometries[part], p = g.attributes.position, idx = g.index, mesh = m.parts[part], a = new THREE.Vector3(), c = new THREE.Vector3(), A = new THREE.Vector3(), C = new THREE.Vector3(); let n = 0;
  m.group.updateMatrixWorld(true);
  for (let t = 0; t < idx.count; t += 3) for (let k = 0; k < 3; k++) { const i = idx.getX(t + k), j = idx.getX(t + (k + 1) % 3); a.fromBufferAttribute(p, i); c.fromBufferAttribute(p, j); const L0 = a.distanceTo(c); if (L0 < 1e-4 || !keep(a)) continue; mesh.getVertexPosition(i, A).applyMatrix4(mesh.matrixWorld); mesh.getVertexPosition(j, C).applyMatrix4(mesh.matrixWorld); if (A.distanceTo(C) / L0 > over) n++; }
  return n;
};
test("the cloth is not drawn out under the raised arms, nor round the back foot's ankle", { skip }, () => {
  const m = dressed(), hand = () => ({ at: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(1, 0, 0), w: 1 }), act = { hands: { left: hand(), right: hand() } };
  for (let i = 0; i < 90; i++) { m.group.updateMatrixWorld(true); for (const [n, s] of [["left", 1], ["right", -1]]) { const h = act.hands[n]; m.bones.head.localToWorld(h.at.set(s * 0.0125, 0.15, 0.15)); h.fingers.set(0, 1, 0.25).normalize(); h.palm.set(-s, 0, 0); } m.update(1 / 30, 0, false, i / 30, () => 0, { act }); }
  const arms = stretched(m, "robe", 3);
  assert.ok(arms < 500, `arms at the brow: ${arms} robe edges stretched past 3×`);
  const w = dressed(); let ankles = 0;
  for (let i = 0; i < 90; i++) { w.update(1 / 30, 2.1, false, i / 30, () => 0, {}); if (i >= 40 && i % 2 === 0) ankles += stretched(w, "legs", 2, (v) => v.y < 0.22); }
  assert.ok(ankles < 800, `walking: ${ankles} edge-frames round the ankles stretched past 2×`);
});
