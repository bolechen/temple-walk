// The first trailer's script (#610), held to the director's own limits on the real plan: every free camera goes no faster than
// 15 m/s and turns no faster than 144°/s, stands in no wall, roof, column or floor; every way he is made to walk can be
// walked; the film is as long as it says, opens on the opening, ends on the title and the wishlist, and the paper that lies
// over each cut covers it whole. A frame is a function of its number: nothing here reads a clock.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { buildSite, createWalker } from "../../app/src/site.js";
import { buildInteriors } from "../../app/src/interior.js";
import { wayThrough } from "../../app/src/route.js";
import { DIRECT } from "../../app/src/director.js";
import { LIMITS, eyeAt, eyeMotion, shotAt, coverAt, captionAt, cardAt, framesOf } from "../../app/src/trailer-path.js";
import { TRAILER as S } from "../../app/levels/t00/trailer.js";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls), walker = createWalker(site);
const DT = 1 / 60;

test("the limits are the director's", () => { assert.equal(LIMITS.speed, DIRECT.speed); assert.equal(LIMITS.turn, 144); });

test("the shots follow one another from 0 to the end, 60 to 75 seconds, with a season and an hour each", () => {
  assert.ok(S.length >= 60 && S.length <= 75, `${S.length} s`);
  assert.equal(S.shots[0].from, 0); assert.equal(S.shots.at(-1).to, S.length);
  for (let i = 1; i < S.shots.length; i++) assert.equal(S.shots[i].from, S.shots[i - 1].to, `${S.shots[i].id} does not begin where ${S.shots[i - 1].id} ends`);
  for (const s of S.shots) { assert.ok(["summer", "autumn"].includes(s.season), `${s.id}: ${s.season} (the film is summer and autumn only)`); assert.ok(["day", "dusk"].includes(s.time)); assert.ok(s.to > s.from); }
  assert.equal(S.shots[0].kind, "opening", "the first frame is the opening's");
  assert.deepEqual(new Set(S.shots.map((s) => s.id)).size, S.shots.length);
});

test("every frame of the film belongs to one shot", () => {
  for (let i = 0; i < framesOf(S, 60); i += 7) assert.ok(shotAt(S, i / 60), `frame ${i}`);
  assert.equal(shotAt(S, S.length).shot.id, S.shots.at(-1).id);
});

test("every free camera goes no faster than 15 m/s and turns no faster than 144°/s", () => {
  for (const s of S.shots.filter((k) => k.kind === "eye")) {
    const m = eyeMotion(s, DT);
    assert.ok(m.speed <= LIMITS.speed, `${s.id}: ${m.speed.toFixed(2)} m/s`); assert.ok(m.turn <= LIMITS.turn, `${s.id}: ${m.turn.toFixed(1)}°/s`);
    for (let t = s.keys[0].t; t <= s.keys.at(-1).t; t += 0.5) assert.ok(Math.abs(eyeAt(s, t).fov) > 20, `${s.id}: fov`);
    assert.ok(s.keys.at(-1).t >= s.to - s.from - 1e-9, `${s.id}: the keys end before the shot does`);
  }
});

test("no free camera stands in a wall, a roof, a column or the ground, and the balcony's stays between its wall and its rail", () => {
  try { for (const s of S.shots.filter((k) => k.kind === "eye")) {
    walker.setRoom(s.hall ? rooms.rooms[s.hall].room : null); walker.setLoft?.(s.up || null);
    for (let t = s.keys[0].t; t <= s.keys.at(-1).t + 1e-9; t += DT * 6) {
      const p = eyeAt(s, t).p, foot = s.up ? site.lofts[s.up].floor : walker.heightAt(p.x, p.z);
      assert.ok(!walker.eyeShut(p.x, p.y, p.z, foot), `${s.id} at ${t.toFixed(2)} s: inside something at ${p.toArray().map((v) => v.toFixed(2))}`);
      assert.ok(p.y > walker.landAt(p.x, p.z) + 0.15 || s.hall || s.up, `${s.id} at ${t.toFixed(2)} s: at the ground`);
      const lowShot = s.id === "bell";   // the bell's own shot is the director's: a low eye, 0.5 m over the floor
      assert.ok(p.y > foot + (lowShot ? 0.3 : 1.0) && p.y < foot + 2.2, `${s.id} at ${t.toFixed(2)} s: ${(p.y - foot).toFixed(2)} m over the floor`);
      if (s.up) { const r = Math.max(Math.abs(p.x - site.lofts[s.up].at[0]), Math.abs(p.z - site.lofts[s.up].at[1])); assert.ok(r > 3.7 && r < 5.6, `${s.id}: ${r.toFixed(2)} m out from the pavilion's middle`); }
    }
  }
  } finally { walker.setRoom(null); walker.setLoft?.(null); }
});

test("every way he is made to walk starts where he can stand and is reached", () => {
  for (const s of S.shots.filter((k) => k.kind === "follow")) {
    walker.setRoom(s.hall ? rooms.rooms[s.hall].room : null);
    const [x, z] = s.at; assert.ok(!walker.blocked(x, z), `${s.id}: he starts in something`);
    const r = wayThrough(walker, walker.drops, { x, z }, s.walk.map(([a, b]) => ({ x: a, z: b })));
    assert.ok(r.length > 0, `${s.id}: no way`);
    for (const p of r) assert.ok(!walker.blocked(p.x, p.z) || p.escape || p.drop || (s.hall && p === r.at(-1)), `${s.id}: the way goes through something at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    const last = r.at(-1), [gx, gz] = s.walk.at(-1);
    assert.ok(Math.hypot(last.x - gx, last.z - gz) < 0.6 || s.hall, `${s.id}: ends ${Math.hypot(last.x - gx, last.z - gz).toFixed(1)} m short`);
    let len = 0, a = { x, z }; for (const p of r) { len += Math.hypot(p.x - a.x, p.z - a.z); a = p; }
    assert.ok(len >= 4, `${s.id}: only ${len.toFixed(1)} m to walk`);
  }
  walker.setRoom(null);
});

test("the paper lies whole over every cut, the film's first frame is bare and its last is paper", () => {
  assert.equal(coverAt(S, 0), 0, "the first frame is the opening, bare");
  for (let i = 1; i < S.shots.length; i++) if (S.shots[i].cut !== "hard") assert.ok(coverAt(S, S.shots[i].from) > 0.999, `the cut into ${S.shots[i].id}`);
  assert.ok(coverAt(S, S.length) > 0.999);
  let jump = 0, last = coverAt(S, 0); for (let i = 1; i <= framesOf(S, 60); i++) { const c = coverAt(S, i / 60); jump = Math.max(jump, Math.abs(c - last)); last = c; }
  assert.ok(jump < 0.1, `the paper moves ${jump.toFixed(3)} of the picture in a sixtieth of a second`);
});

test("four captions of at most twelve characters, in Chinese and English together, in the film and not over a cut; the title and the wishlist stand in the last five seconds", () => {
  assert.equal(S.captions.length, 4);
  for (const c of S.captions) {
    assert.ok([...c.zh.replace(/[，。]/g, "")].length <= 12, c.zh); assert.ok(c.en.length > 3);
    assert.ok(c.to - c.from >= 3, `${c.zh} is up for ${c.to - c.from} s`);
    for (const k of S.shots.slice(1).filter((x) => x.cut !== "hard")) assert.ok(k.from < c.from - S.dip || k.from > c.to + S.dip || false, `${c.zh} is up over the cut into ${k.id}`);
    assert.ok(captionAt(S, (c.from + c.to) / 2).alpha > 0.99);
  }
  assert.equal(captionAt(S, 0), null);
  assert.ok(S.card.from >= S.length - 5 && S.card.wish && S.card.wishEn && S.card.title && S.card.sub && S.card.en);
  assert.equal(cardAt(S, 10), 0); assert.ok(cardAt(S, S.length) > 0.99);
  assert.ok(!/\bv?\d+\.\d+\.\d+\b|版本/.test(JSON.stringify(S)), "no version in the film");
});

test("a frame is a function of its number: the same script and the same frame give the same camera, paper and words", () => {
  const read = () => JSON.stringify([...Array(40)].map((_, k) => { const sec = (k * 97 % framesOf(S, 60)) / 60, h = shotAt(S, sec); return [h.shot.id, coverAt(S, sec), captionAt(S, sec)?.alpha ?? null, h.shot.kind === "eye" ? eyeAt(h.shot, sec - h.shot.from).p.toArray() : null]; }));
  assert.equal(read(), read());
});
