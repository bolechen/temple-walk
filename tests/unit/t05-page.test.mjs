// T05's own page as data and as a watch (app/levels/t05/page.js, src/levelpage.js): the two looks that put the observation's stroke
// on it are met in either order, each held unbroken for its seconds (CHECKPOINTS.md §2.2: C01 3 s, C02 2 s), a break starts its
// count again, walking past without looking meets nothing; C02 asks for the front eave in the upper part of the picture; the
// view's pitch is read back from where two far points fall on the picture; the stele's lines are the transcription's (SOURCES.md §17).
import fs from "node:fs";
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { PAGE } from "../../app/levels/t05/page.js";
import { STELE_TEXT, steleLayout } from "../../app/levels/t05/stele.js";
import { createWatch, viewPitch, within, looking } from "../../app/src/levelpage.js";

const [C01, C02] = PAGE.p1.looks, inC01 = C01.at, inC02 = [0, PAGE.p1.looks[1].box.z1 - 4];
const eaveUp = () => ({ x: 640, y: 200, w: 1280, h: 720, behind: false }), eaveLow = () => ({ x: 640, y: 600, w: 1280, h: 720, behind: false });
const hold = (w, secs, [x, z], yaw, pitch, seen) => { let met = null; for (let t = 0; t < secs; t += 0.1) met = w.step(0.1, x, z, yaw, pitch, seen) || met; return met; };

test("the two looks, in either order, each held for its seconds", () => {
  assert.equal(C01.hold, 3); assert.equal(C02.hold, 2);
  for (const order of [[C01, C02], [C02, C01]]) {
    const w = createWatch(PAGE.p1.looks);
    for (const l of order) {
      const where = l === C01 ? inC01 : inC02, pitch = l === C01 ? 0.05 : 0.3;
      assert.equal(hold(w, l.hold - 0.3, where, 0, pitch, eaveUp), null, `${l.id}: not met before its ${l.hold} s`);
      assert.equal(hold(w, 0.5, where, 0, pitch, eaveUp)?.id, l.id, `${l.id}: met once held ${l.hold} s`);
    }
    assert.ok(w.done());
  }
});
test("a break starts the count again; looking away, looking low or standing elsewhere meets nothing", () => {
  const w = createWatch(PAGE.p1.looks);
  hold(w, 2.5, inC01, 0, 0.05, eaveUp); hold(w, 0.2, inC01, 1.2, 0.05, eaveUp); assert.equal(hold(w, 2.5, inC01, 0, 0.05, eaveUp), null, "a turn away starts C01's three seconds again");
  assert.equal(hold(createWatch(PAGE.p1.looks), 5, inC01, Math.PI, 0.05, eaveUp), null, "looking back down the court is not looking at the hall");
  assert.equal(hold(createWatch(PAGE.p1.looks), 5, inC02, 0, 0.3, eaveLow), null, "at C02 with the eave low in the picture nothing counts");
  assert.equal(hold(createWatch(PAGE.p1.looks), 5, inC02, 0, 0.02, eaveUp), null, "nor with the view not raised");
  assert.equal(hold(createWatch(PAGE.p1.looks), 5, [30, 50], 0, 0.3, eaveUp), null, "nor away from both places");
  assert.ok(within(C02, 0, 14) && within(C02, 0, 27) && !within(C02, 0, 44), "C02 is the flight's foot to the platform's front");
  assert.ok(!looking(C02, 0, 0.3, () => ({ x: 640, y: 200, w: 1280, h: 720, behind: true })), "an eave behind the eye is not seen");
});
test("the view's pitch is read back from the picture to within a hundredth of a radian", () => {
  for (const [pitch, fov, yaw] of [[0, 50, 0], [0.44, 50, 0.3], [-0.2, 65, 2], [0.9, 44, -1]]) {
    const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 800); cam.position.set(3, 4.6, 30); cam.rotation.set(pitch, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
    const so = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return { y: (-v.y * 0.5 + 0.5) * 900, h: 900 }; };
    assert.ok(Math.abs(viewPitch(so, { x: 3.5, y: 4.4, z: 32 }, yaw) - pitch) < 0.01, `pitch ${pitch}`);
  }
});
test("the lines to copy are the transcription's, in full forms, and the page's words have all three translations", async () => {
  assert.deepEqual(STELE_TEXT.lines.map((l) => l.text), ["觀其寶殿崔嵬，儼居七佛", "法堂弘敞，可納千僧"]);
  assert.ok(STELE_TEXT.lines.every((l) => STELE_TEXT.columns.some((c) => c.startsWith(l.text.replace(/，/g, "").slice(0, 8)))), "each line is cut on the stone");
  assert.equal(PAGE.p1.note, "九间，单檐庑殿，青灰瓦。台基比人高。", "CHECKPOINTS.md §2.2's sentence, word for word");
  for (const l of ["ja", "en", "ko"]) {
    const tr = (await import(`../../app/levels/t05/locales/${l}.js`)).default;
    for (const k of [PAGE.p1.note, PAGE.p1.act, PAGE.stele.from, "抄碑", PAGE.hints.eave.text, ...(PAGE.hints.door ? [PAGE.hints.door.text] : [])]) assert.ok(tr[k] && tr[k] !== k, `${l}: ${k}`);
    assert.ok(!/Seven Past Buddhas/.test(JSON.stringify(tr)), "not 'Seven Past Buddhas' (CHECKPOINTS.md §6)");
    // #770 item 5: every line that may be copied has a free rendering under it in each language, and the wording fixes of items 9-11
    for (const L of STELE_TEXT.lines) assert.ok(tr[L.text] && tr[L.text] !== L.text && tr[L.text].length > 12, `${l}: a rendering of ${L.id}`);
    if (l === "en") { assert.match(tr[PAGE.p1.note], /single-eaved hip roof/); assert.match(tr[PAGE.p1.note], /taller than a person/); assert.equal(tr["抄碑"], "Copy a line from the stele"); }
    if (l === "ja") assert.match(tr[PAGE.p1.note], /^正面九間/);
  }
});
test("from his own eyes C02 is CHECKPOINTS.md's own look: the view raised 25° and more, wherever the eave falls", () => {
  const out = () => ({ x: 640, y: -400, w: 1280, h: 720, behind: false });   // the eave above the top of the picture, as it is when he looks up from under it
  assert.equal(hold(createWatch(PAGE.p1.looks), 2.5, inC02, 0, (26 * Math.PI) / 180, out)?.id, "c02", "raised 26°, the eaves are looked at");
  assert.equal(hold(createWatch(PAGE.p1.looks), 2.5, inC02, 0, (20 * Math.PI) / 180, out), null, "raised 20° with the eave out of the picture, they are not");
  assert.equal(hold(createWatch(PAGE.p1.looks), 2.5, inC02, Math.PI, (30 * Math.PI) / 180, out), null, "nor looking up the other way");
});

// #770 item 4, the owner's choice of 2026-11-26: nothing readable on the stone names the real temple or its county town; the weathered heading and column are blotches.
test("what can be read on the stele names no real temple or town; the weathered columns hold no characters", () => {
  const readable = STELE_TEXT.title + STELE_TEXT.columns.join("") + STELE_TEXT.lines.map((l) => l.text).join("");
  assert.ok(!/奉國|奉国|義州|义州/.test(readable), readable);
  const cells = steleLayout(1024, 1400), worn = cells.filter((c) => c.worn);
  assert.ok(worn.length >= 20 && worn.every((c) => c.ch === ""), "weathered cells carry no character");
  assert.ok(!/奉國|義州/.test(cells.map((c) => c.ch).join("")), "the drawn characters either");
  assert.equal(new Set(cells.map((c) => c.col)).size, 5, "five columns stand as before, three of them weathered");
});
test("a book that already holds the copied line zairan (a save from before) reads without a hole", () => {
  const known = (id) => PAGE.stele.lines.find((l) => l.id === id) || null;
  assert.equal(known("zairan"), null);
  assert.equal((known("zairan")?.text || ""), "", "an empty copy, which the page does not show");
});

// #770 item 2, the owner's choice of 2026-11-26: a line before the shut doors, once each time he comes up to them; a line after the first look (C01) until the second is met.
const { createLevelPage } = await import("../../app/src/levelpage.js");
const { default: t05 } = await import("../../app/levels/t05/level.js");
const doorsShut = () => /HALL_DOORS\s*=\s*Object\.freeze\(\{\s*shut:\s*true/.test(fs.readFileSync(new URL("../../app/levels/t05/hall.js", import.meta.url), "utf8"));
function pageWith() {
  const said = [], seen = new Set();
  const y = { walker: { heightAt: () => 0 }, screenOf: () => ({ x: 0, y: 0.3, w: 1, h: 1, behind: false }) };
  const lp = createLevelPage({ level: t05, page: PAGE, places: {}, storage: null, rites: {}, y, wait: async () => {}, say: () => {}, tip: (id, text) => { if (seen.has(id)) return false; seen.add(id); said.push(text); return true; } });
  return { lp, said };
}
test("the door line follows HALL_DOORS.shut: said before the doors once per approach, never when they are open", () => {
  assert.equal(!!PAGE.hints.door, doorsShut());
  if (!PAGE.hints.door) return;
  const { lp, said } = pageWith(), b = PAGE.hints.door.box, mid = (b.x0 + b.x1) / 2;
  lp.tick(0.1, { x: 0, z: 30 }, 0); assert.deepEqual(said, [], "not far from the doors");
  lp.tick(0.1, { x: mid, z: b.z0 + 1 }, 0); assert.deepEqual(said, ["门还关着。"], "before the doors");
  lp.tick(0.1, { x: mid, z: b.z0 + 1.5 }, 0); lp.tick(0.1, { x: b.x1 + 1, z: b.z0 + 1 }, 0); assert.equal(said.length, 1, "not again while he is still near");
  lp.tick(0.1, { x: 0, z: b.z1 + 8 }, 0); lp.tick(0.1, { x: mid, z: b.z0 + 1 }, 0); assert.equal(said.length, 2, "again after he has been away and come back");
  lp.tick(0.1, { x: b.x0 - 5, z: b.z0 + 1 }, 0); assert.equal(said.length, 2, "beside the doors (the windows' bays) is not before them");
});
test("the eave line is said once, after C01 is met and C02 is not, and never before C01", () => {
  const { lp, said } = pageWith(); assert.equal(PAGE.hints.eave.text, "走到檐下，抬头看看。");
  lp.tick(0.1, { x: 0, z: 44 }, 0); assert.ok(!said.includes(PAGE.hints.eave.text), "before C01 is met");
  lp.tick(3.2, { x: 0, z: 44 }, 0);   // C01: the front, held for three seconds from station A (the eave's place in the picture is not asked of it)
  lp.tick(0.1, { x: 0, z: 44 }, 0); assert.equal(lp.state().met.includes("c01"), true);
  assert.equal(said.filter((s) => s === PAGE.hints.eave.text).length, 1, "said once C01 is met");
  lp.tick(0.1, { x: 0, z: 44 }, 0); assert.equal(said.filter((s) => s === PAGE.hints.eave.text).length, 1, "only once");
});
