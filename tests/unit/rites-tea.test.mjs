// The tea, drunk as rites.js has him drink it, sitting on the stool at the court's tea table: his hands must stay below
// his eyes the whole time (#286). With the bowl held at its sides a little above its rim, his hands went round with it
// as he tilted it, and at the full tilt (0.78) they came up over his eyes, 4.5 cm above their lower edge on the figure
// built in code (tools/novice-measure-tea.mjs --sequence measured it first; the 3D review of #292).
//
// What is measured, each frame of the whole drink (lifted from the stand, three sips, set back), at 30 frames a
// second on the observances' own clock:
//   - the eyes: the closed lids' strokes on the figure built in code (the skin's vertices drawn near-black, on the front
//     of the face, as tools/novice-measure.mjs finds them); each eye's lower edge is the lowest of its strokes' points;
//   - the hands: every vertex of the skin weighted more than half to a hand bone;
//   - both in his own frame (x to his left, z the way he faces), with his seat turned to the table;
//   - for each eye, the highest point of either hand that lies before it (within its width across, 5 mm either side,
//     and no more than 4 cm behind its front), against its lower edge.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker, placeLift } = await import("../../app/src/site.js");
const { createMonk } = await import("../../app/src/monk.js");
const { createRites } = await import("../../app/src/rites.js");
const { readNovice, dressed, TRIPO } = await import("./novice-glb.mjs");
import fs from "node:fs";
import sharp from "sharp";
// The body the page wears by default (#163): its eyes are in its texture, not in vertex colours.
const tripo = readNovice(TRIPO);
async function textureOf(file, json) {
  const bytes = fs.readFileSync(file), binAt = 20 + bytes.readUInt32LE(12), bin = bytes.subarray(binAt + 8), t = json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index];
  const view = json.bufferViews[json.images[t.source ?? t.extensions.EXT_texture_webp.source].bufferView];
  return sharp(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}
const tripoTexture = await textureOf(TRIPO, tripo.json);
const BODIES = [["built in code", createMonk, null], ["Tripo's, worn by default", () => dressed(createMonk), tripoTexture]];
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site);

// the observances' clock is the page's: here it is a number the test moves on, a frame at a time
let now = 0; performance.now = () => now;

/** The whole drink, frame by frame; `each(monk, rites, bowl)` after every frame from the moment he begins it. */
async function drink(each, make = createMonk) {
  const monk = make(), G = monk.group, scene = new THREE.Scene(), ticks = [];
  scene.add(G);
  // sat on his stool as the walk sits him there (yard.js: drawn at the seat, lifted by placeLift, turned to the place's face)
  const p = site.places.tea, s = p.seat || p.at, floor = walker.heightAt(p.at[0], p.at[1]);
  G.position.set(s[0], floor + placeLift(p, site.seats, walker.heightAt), s[1]); G.rotation.y = p.face;
  const y = { monk, scene, site, M, onTick: (f) => ticks.push(f), strike: () => {}, direct: () => {}, directed: () => false, directArrived: () => false, directOut: () => 1 };
  const rites = createRites(y);
  const frame = () => { now += 1000 / 30; for (const f of ticks) f(); G.updateMatrixWorld(true); monk.update(1 / 30, 0, "chair", now / 1000, () => floor, { act: rites.act }); G.updateMatrixWorld(true); };
  for (let i = 0; i < 90; i++) frame();   // sat down, settled
  let done = false; const run = rites.drinkTea(() => true).then(() => { done = true; });
  let cup = null; scene.traverse((o) => { if (!cup && o.userData.part === "bowl" && o.parent?.isGroup && o.parent !== scene) cup = o.parent; });
  for (let i = 0; i < 30 * 30 && !done; i++) { frame(); each(monk, rites, cup); await Promise.resolve(); await Promise.resolve(); }
  await run;
  return monk;
}

/** The eyes' strokes (or, on a body with a texture, the dark of its irises there) and the hands' vertices. */
function parts(monk, texture = null) {
  const g = monk.parts.skin.geometry, p = g.attributes.position, uv = g.attributes.uv, col = g.attributes.color, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = monk.skeleton.bones.map((b) => b.name);
  let top = 0, front = -1; for (let i = 0; i < p.count; i++) { top = Math.max(top, p.getY(i)); if (p.getY(i) > 0.9) front = Math.max(front, p.getZ(i)); }
  const eyes = { left: [], right: [] }, hands = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), yv = p.getY(i), z = p.getZ(i);
    if (yv > top - 0.3 && z > front - 0.05 && Math.abs(x) > 0.02 && Math.abs(x) < 0.1) {
      let c;
      if (texture) { const { data, info } = texture, u = Math.min(info.width - 1, Math.round(uv.getX(i) * (info.width - 1))), w = Math.min(info.height - 1, Math.round(uv.getY(i) * (info.height - 1))), o = (w * info.width + u) * 3; c = [data[o], data[o + 1], data[o + 2]].map((k) => k / 255); }
      else c = [col.getX(i), col.getY(i), col.getZ(i)];
      if (Math.max(...c) < 0.3) eyes[x > 0 ? "left" : "right"].push(i);
    }
    let w = 0; for (let k = 0; k < 4; k++) if (/Hand$/.test(names[si.getComponent(i, k)])) w += sw.getComponent(i, k);
    if (w > 0.5) hands.push(i);
  }
  return { eyes, hands };
}
/** The least, over both eyes, of the eye's lower edge less the highest hand point before it (m). */
function margin(monk, { eyes, hands }) {
  const mesh = monk.parts.skin, G = monk.group, inv = G.matrixWorld.clone().invert();
  const mine = (i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv), H = hands.map(mine);
  let least = Infinity;
  for (const side of ["left", "right"]) {
    const e = eyes[side].map(mine), x0 = Math.min(...e.map((q) => q.x)) - 0.005, x1 = Math.max(...e.map((q) => q.x)) + 0.005, low = Math.min(...e.map((q) => q.y)), z = Math.max(...e.map((q) => q.z));
    for (const q of H) if (q.x > x0 && q.x < x1 && q.z > z - 0.04) least = Math.min(least, low - q.y);
  }
  return least;
}

for (const [which, make, texture] of BODIES) test(`drinking his tea, his hands stay at least 1 cm below his eyes from the lifting of the bowl to its setting down (${which})`, async () => {
  let pp = null, least = Infinity, at = null, frames = 0, sips = 0;
  await drink((monk, rites) => {
    pp ||= parts(monk, texture); frames++; sips = rites.state().tea.sips;
    const m = margin(monk, pp); if (m < least) { least = m; at = frames; }
  }, make);
  assert.ok(pp.eyes.left.length > 3 && pp.eyes.right.length > 3 && pp.hands.length > 100, `the eyes' strokes and the hands are found: ${pp.eyes.left.length}, ${pp.eyes.right.length}, ${pp.hands.length}`);
  assert.ok(frames > 300 && sips === 3, `the drink ran ${frames} frames, ${sips} sips`);
  console.log(`# ${which}: hands at least ${(least * 100).toFixed(1)} cm below the eyes' lower edge (frame ${at})`);
  assert.ok(least >= 0.01, `at frame ${at} of the drink a hand comes ${least >= 0 ? (least * 100).toFixed(1) + " cm below" : (-least * 100).toFixed(1) + " cm over"} the lower edge of an eye`);
});

test("drinking, the bowl stays between his hands: each hand within reach of the bowl's side, neither inside it", async () => {
  // The hand bone's head (the wrist) is held a little out from the bowl: the palm and fingers lie against its side. A
  // hand more than 12 cm from the bowl's middle has let it go; its wrist nearer than 4 cm is inside the bowl's wall.
  let far = 0, near = Infinity, held = 0;
  await drink((monk, rites, cup) => {
    if (!cup || !rites.state().tea.held) return; held++; cup.updateMatrixWorld(true);
    const c = new THREE.Vector3(0, 0.03, 0).applyMatrix4(cup.matrixWorld);
    for (const n of ["left", "right"]) { const d = monk.bones[n + "Hand"].getWorldPosition(new THREE.Vector3()).distanceTo(c); far = Math.max(far, d); near = Math.min(near, d); }
  });
  assert.ok(held > 200, `the bowl was held ${held} frames`);
  assert.ok(far < 0.12, `a wrist goes ${(far * 100).toFixed(1)} cm from the bowl's middle`);
  assert.ok(near > 0.04, `a wrist comes within ${(near * 100).toFixed(1)} cm of the bowl's middle`);
});
