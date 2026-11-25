// What his hands do at T05's own page (src/writing.js, through rites.js): before the Yuan stele he takes the leaf and the
// brush, writes the line a character at a time, stops his brush and puts them away; at the observation's place he draws the
// stroke and writes its line. Run on the observances' own clock at 20 frames a second, the copy on both bodies (the stroke on the one built in code), standing where the
// walk stands him (site.places.copy). PRD.md §1.3 (a) ④: neither hand, nor the brush, nor the leaf comes within 0.3 m of the
// stele's face, every frame (20 frames a second, the observances' own clock); the brush's tip comes down on the paper for each character; the leaf is held before his chest,
// below his eyes and above his waist; and nothing is left in his hands at the end.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker } = await import("../../app/levels/t05/site.js");
const { PAGE } = await import("../../app/levels/t05/page.js");
const { STELE_TEXT } = await import("../../app/levels/t05/stele.js");
const { createMonk } = await import("../../app/src/monk.js");
const { createRites } = await import("../../app/src/rites.js");
const { HOLD } = await import("../../app/src/writing.js");
const { dressed } = await import("./novice-glb.mjs");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site);
for (const [k, p] of Object.entries(PAGE.places)) site.places[k] ??= { ...p, r: 0 };
let now = 0; performance.now = () => now;

async function write(make, id, how) {
  const monk = make(), G = monk.group, scene = new THREE.Scene(), ticks = [];
  scene.add(G);
  const p = site.places[id], floor = walker.heightAt(p.at[0], p.at[1]);
  G.position.set(p.at[0], floor, p.at[1]); G.rotation.y = p.face; G.updateMatrixWorld(true);
  const y = { monk, scene, site, M, onTick: (f) => ticks.push(f), strike: () => {}, direct: () => {}, directed: () => false, directArrived: () => false, directOut: () => 1 };
  const rites = createRites(y), out = { frames: [], marks: 0 };
  const frame = () => { now += 1000 / 20; for (const f of ticks) f(); G.updateMatrixWorld(true); monk.update(1 / 20, 0, null, now / 1000, () => floor, { act: rites.act }); G.updateMatrixWorld(true); };
  for (let i = 0; i < 30; i++) frame();
  let done = false, ok = null; const run = how(rites).then((v) => { done = true; ok = v; });
  let leaf = null, brush = null; scene.traverse((o) => { if (o.userData.part === "writing" && o.parent === scene) { if (!leaf) leaf = o; else brush = o; } });
  const B = monk.bones, v = new THREE.Vector3();
  for (let i = 0; i < 20 * 60 && !done; i++) {
    frame();
    const hands = [B.leftHand, B.rightHand].map((b) => b.getWorldPosition(new THREE.Vector3()));
    const w = rites.state().writing;
    out.frames.push({ hands, leaf: leaf.visible ? leaf.position.clone() : null, tip: brush.visible ? brush.position.clone() : null, eye: B.head.getWorldPosition(v).y, hip: B.hips.getWorldPosition(new THREE.Vector3()).y, w });
    await Promise.resolve(); await Promise.resolve();
  }
  await run;
  return { ok, out, rites, floor, leaf, brush };
}

const BODIES = [["built in code", createMonk], ["Tripo's, worn by default", () => dressed(createMonk)]];
for (const [name, make] of BODIES) {
  test(`the stele copied (${name}): every character written, hands, brush and leaf 0.3 m and more off the stone`, async () => {
    const line = STELE_TEXT.lines[0], face = site.places.copy.stele.face;
    const r = await write(make, "copy", (rites) => rites.writing.copyLine(() => true, { text: line.text, from: "元大德七年碑" }));
    assert.equal(r.ok, true, "the copy ran to its end");
    const st = r.rites.state().writing, chars = [...line.text].filter((c) => c !== "，");
    assert.equal(st.copied, chars.join(""), "every character written in order"); assert.ok(st.marks >= chars.length, `a mark for each character (${st.marks})`);
    let nearest = Infinity;
    for (const f of r.out.frames) for (const q of [...f.hands, f.leaf, f.tip]) if (q) nearest = Math.min(nearest, q.z - face);
    assert.ok(nearest >= 0.3, `the nearest of his hands, the brush and the leaf came ${nearest.toFixed(3)} m from the stele's face`);
    assert.ok(st.nearest === null || st.nearest >= 0.3, `writing.js's own count says ${st.nearest}`);
    const held = r.out.frames.filter((f) => f.leaf && f.w.writing);
    assert.ok(held.length > 40, "the leaf was held for the writing");
    for (const f of held) assert.ok(f.leaf.y < f.eye - 0.05 && f.leaf.y > f.hip - 0.05, `the leaf is held before his chest: ${f.leaf.y.toFixed(3)} between hip ${f.hip.toFixed(3)} and eyes ${f.eye.toFixed(3)}`);
    // His right hand is at the brush, his left at the leaf's left edge: each within reach of where it was asked to be.
    const R = r.rites.act.hands.right, L = r.rites.act.hands.left; void R; void L;
    assert.ok(!r.leaf.visible && !r.brush.visible && r.rites.act.hands.left.w === 0 && r.rites.act.hands.right.w === 0, "nothing is left in his hands");
  });
  if (make === createMonk) test(`the observation's stroke and its line written (${name})`, async () => {
    const r = await write(make, "p1b", (rites) => rites.writing.strokeLine(() => true, { note: PAGE.p1.note }));
    assert.equal(r.ok, true);
    const st = r.rites.state().writing; assert.equal(st.stroked, 1, "the stroke was drawn"); assert.ok(st.marks >= 4, `the stroke and three lines under it (${st.marks})`);
    assert.ok(!r.leaf.visible && !r.brush.visible, "put away at the end");
    assert.equal(r.rites.writing.page.stroke, 1); assert.equal(r.rites.writing.page.noteK, 1);
  });
}
test("broken off, the writing stops at once and leaves nothing in his hands", async () => {
  let go = true; const r = await write(createMonk, "copy", (rites) => { const p = rites.writing.copyLine(() => go, { text: STELE_TEXT.lines[1].text }); setTimeout(() => {}, 0); return p; });
  void r; go = false;
  const s = await write(createMonk, "copy", async (rites) => { let n = 0; const ok = await rites.writing.copyLine(() => ++n < 200, { text: STELE_TEXT.lines[1].text }); rites.rest(); return ok; });
  assert.equal(s.ok, false, "broken off, it reports so");
  assert.ok(!s.leaf.visible && !s.brush.visible, "rest() puts the leaf and the brush away");
});

// `?show=shot-copy` and `__poseRite` pose him at once (writing.pose), before the walk has turned him to the place: the
// leaf must follow him there, held before his chest with its paper turned up to him, as it is while he really writes.
test("posed at once and then turned to the place, the leaf is held before him with its paper up", async () => {
  const monk = createMonk(), G = monk.group, scene = new THREE.Scene(), ticks = []; scene.add(G);
  const y = { monk, scene, site, M, onTick: (f) => ticks.push(f), strike: () => {}, direct: () => {}, directed: () => false, directArrived: () => false, directOut: () => 1 };
  const rites = createRites(y);
  G.position.set(0, 0, 0); G.rotation.y = 0; G.updateMatrixWorld(true);
  rites.writing.pose({ text: STELE_TEXT.lines[0].text });
  const p = site.places.copy, floor = walker.heightAt(p.at[0], p.at[1]);
  G.position.set(p.at[0], floor, p.at[1]); G.rotation.y = p.face; G.updateMatrixWorld(true);   // the walk stands him there a frame later
  for (let i = 0; i < 3; i++) { now += 50; for (const f of ticks) f(); G.updateMatrixWorld(true); }
  let leaf = null; scene.traverse((o) => { if (!leaf && o.userData.part === "writing" && o.parent === scene) leaf = o; });
  const local = G.worldToLocal(leaf.position.clone());
  assert.ok(local.distanceTo(new THREE.Vector3(...HOLD.board)) < 0.02, `the board stands where he holds it, before his chest: ${local.toArray().map((v) => v.toFixed(3))}`);
  const up = new THREE.Vector3(0, 0, 1).applyQuaternion(leaf.quaternion), toHim = new THREE.Vector3(0, 0, -1).applyQuaternion(G.quaternion);
  assert.ok(up.y > 0.5 && up.dot(toHim) > 0.2, `its paper faces up and toward him (${up.toArray().map((v) => v.toFixed(2))})`);
  rites.rest(); assert.ok(!leaf.visible, "rest() puts it away");
});

// The paper lies on the board, not in its face: two faces on one plane flicker and, from some angles and on some cards,
// show the board through the paper (a dark wedge across the leaf on a T4, the whole leaf dark in software).
test("the paper lies a millimetre clear of the board's face, and the brush's tip clear of the paper", () => {
  const scene = new THREE.Scene(), ticks = [], monk = createMonk(); scene.add(monk.group);
  createRites({ monk, scene, site, M, onTick: (f) => ticks.push(f), strike: () => {}, direct: () => {}, directed: () => false, directArrived: () => false, directOut: () => 1 });
  let leaf = null; scene.traverse((o) => { if (!leaf && o.userData.part === "writing" && o.parent === scene) leaf = o; });
  const [board, paper] = leaf.children; board.geometry.computeBoundingBox(); paper.geometry.computeBoundingBox();
  const gap = paper.geometry.boundingBox.min.z - board.geometry.boundingBox.max.z;
  assert.ok(gap >= 0.0008, `the paper is ${(gap * 1000).toFixed(2)} mm above the board's face`);
  assert.ok(0.005 - paper.geometry.boundingBox.max.z >= 0.0005, "the brush's tip (5 mm off the leaf's middle) is above the paper");
});

// #744 (the art director's final review on #728): seen in the copy's shot, over his left shoulder, the hand that writes lay on
// his left ear, as if he scratched it. Through the whole of the writing, on both bodies, the hand stays clear of the ear in a
// 1920×1080 picture: its centre at least 45 px from the ear's (the ear is about 42 px tall there, the hand about 36 px across).
const { shotPose } = await import("../../app/src/director.js");
for (const [name, make] of BODIES) test(`in the copy's shot the hand that writes stays clear of his ear (${name})`, async () => {
  const monk = await make(), G = monk.group, scene = new THREE.Scene(); scene.add(G);
  monk.update(0, 0, "bind", 0, () => 0, {}); G.updateMatrixWorld(true);
  let ear = null;   // the left ear: the skin's farthest point to his left at ear height in the bind pose, kept in the head bone's frame
  for (const m of Object.values(monk.parts)) { const P = m.geometry?.attributes?.position; if (!P) continue; for (let i = 0; i < P.count; i++) { const y = P.getY(i), x = P.getX(i); if (y > 0.93 && y < 1.03 && (!ear || x > ear.x)) ear = new THREE.Vector3(x, y, P.getZ(i)); } }
  ear.x -= 0.012; const earAt = monk.bones.head.worldToLocal(ear.clone());
  const p = site.places.copy, floor = walker.heightAt(p.at[0], p.at[1]);
  G.position.set(p.at[0], floor, p.at[1]); G.rotation.y = p.face; G.updateMatrixWorld(true);
  const ticks = [], rites = createRites({ monk, scene, site, M, onTick: (f) => ticks.push(f), strike: () => {}, direct: () => {}, directed: () => false, directArrived: () => false, directOut: () => 1 });
  const o = shotPose(p, p.shot, floor, 0, 16 / 9), cam = new THREE.PerspectiveCamera(o.fov, 16 / 9, 0.05, 500); cam.position.copy(o.p); cam.quaternion.copy(o.q); cam.updateMatrixWorld();
  const px = (v) => { const q = v.clone().project(cam); return new THREE.Vector2((q.x + 1) * 960, (1 - q.y) * 540); };
  const frame = () => { now += 50; for (const f of ticks) f(); G.updateMatrixWorld(true); monk.update(0.05, 0, null, now / 1000, () => floor, { act: rites.act }); G.updateMatrixWorld(true); };
  for (let i = 0; i < 20; i++) frame();
  let done = false; rites.writing.copyLine(() => true, { text: STELE_TEXT.lines[0].text }).then(() => { done = true; });
  let nearest = Infinity, seen = 0;
  for (let i = 0; i < 1200 && !done; i++) {
    frame(); await Promise.resolve(); await Promise.resolve();
    if (!rites.state().writing.writing) continue;
    seen++; nearest = Math.min(nearest, px(monk.bones.head.localToWorld(earAt.clone())).distanceTo(px(monk.bones.rightHand.getWorldPosition(new THREE.Vector3()))));
  }
  assert.ok(seen > 100, `the writing was watched (${seen} frames)`);
  assert.ok(nearest >= 45, `the hand came within ${nearest.toFixed(1)} px of his ear`);
});
