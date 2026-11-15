import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { MODE, THEME, hz, inMode, sealNote, ZONES, zoneBounds, zoneOf, createZoneKeeper, moodMusic, makePhrase, createConductor, rng, SECTION_LEVEL } from "../../app/src/score.js";
const { buildSite, SITE, LEVELS, APPROACH } = await import("../../app/src/site.js");
import * as THREE from "../../app/vendor/three/build/three.module.js";
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), B = zoneBounds(SITE, LEVELS, APPROACH);
const SEASONS = ["spring", "summer", "autumn", "winter"], TIMES = ["dawn", "day", "dusk", "night"];
const MELODY = new Set(["qin", "xiao", "harm"]);
// The theme as intervals, so that it is found in any octave or key.
const steps = (ms) => ms.slice(1).map((m, i) => m - ms[i]);
const THEME_STEPS = steps(THEME.map((n) => n.m)).join(",");
const holdsTheme = (events) => { const ms = events.filter((e) => MELODY.has(e.voice)).sort((a, b) => a.at - b.at).map((e) => e.m); return steps(ms).join(",").includes(THEME_STEPS); };

test("the music is in the bell's key, and the theme has seven notes, one for each seal", () => {
  assert.ok(Math.abs(hz(MODE.tonic) - 98) < 0.01, "the tonic is the bell's 98 Hz");
  assert.equal(THEME.length, 7);
  for (const n of THEME) { assert.ok(inMode(n.m), `theme note ${n.m} is outside the mode`); assert.ok(n.b > 0); }
  assert.equal(THEME.at(-1).m % 12, MODE.tonic % 12, "the theme comes home to the tonic");
  assert.ok(Math.abs(hz(sealNote(1)) - 1174.7) < 1, "the first seal still rings the chime it always has");
  for (let n = 1; n <= 7; n++) assert.ok(inMode(sealNote(n)));
  assert.equal(sealNote(0), null); assert.equal(sealNote(8), null);
});

test("every named place on the way up is heard as the part of the mountain it is", () => {
  const V = site.views, at = (v) => zoneOf(V[v][0], V[v][1], false, B);
  assert.equal(at("arrive"), "grove"); assert.equal(at("cam01"), "grove");
  assert.equal(at("cam02"), "stair"); assert.equal(at("cam03"), "stair"); assert.equal(at("forecourt"), "stair");
  assert.equal(at("cam04"), "gate"); assert.equal(at("gate"), "gate"); assert.equal(at("cam05"), "court", "cam05 stands in the court, looking back at the gate");
  assert.equal(at("cam06"), "court"); assert.equal(at("court"), "court"); assert.equal(at("hall"), "court");
  assert.equal(at("library"), "upper"); assert.equal(at("guanyin"), "upper"); assert.equal(at("tea"), "upper");
  assert.equal(at("summit"), "upper", "the summit view looks up from the tea slope"); assert.equal(at("cushion"), "summit"); assert.equal(at("lookback"), "summit");
  assert.equal(zoneOf(0, 29, true, B), "hall", "inside any hall is the hall");
  for (const z of ZONES) assert.ok(z in SECTION_LEVEL, z);
});

test("a place counts only once he has stayed in it two seconds; pacing a boundary changes nothing", () => {
  const k = createZoneKeeper(2);
  assert.equal(k.update("grove", 0), "grove", "the first place is settled at once");
  assert.equal(k.update("stair", 1), "grove"); assert.equal(k.update("stair", 2.9), "grove"); assert.equal(k.update("stair", 3.0), "stair");
  for (let t = 4; t < 30; t += 0.5) assert.equal(k.update(t % 1 ? "gate" : "stair", t), "stair", "stepping back and forth over a line keeps the music where it was");
  k.update("stair", 29.9); k.update("gate", 30); assert.equal(k.update("gate", 31.99), "stair"); assert.equal(k.update("gate", 32), "gate");
});

test("every season and hour gives the score what it needs", () => {
  for (const s of SEASONS) for (const t of TIMES) {
    const m = moodMusic(s, t);
    assert.ok(m.tempo >= 36 && m.tempo <= 72 && m.rest > 0 && ["qin", "xiao", "harm"].includes(m.lead), `${s}-${t}`);
  }
  assert.equal(moodMusic("summer", "night").lead, "xiao", "at night the flute leads"); assert.equal(moodMusic("winter", "day").lead, "harm", "in winter only harmonics");
});

test("every phrase stays in the mode, in range, and none holds the whole theme before the seventh seal", () => {
  for (const sec of [...ZONES]) for (const s of SEASONS) for (const t of TIMES) for (let seed = 1; seed < 40; seed++) for (const first of [true, false]) {
    const p = makePhrase(sec, { r: rng(seed), seals: seed % 7, first, mood: moodMusic(s, t) });
    assert.ok(p.events.length > 0 && p.length > 0 && p.length < 40, `${sec} ${s}-${t}: length ${p.length}`);
    for (const e of p.events) {
      assert.ok(inMode(e.m), `${sec}: ${e.m} is outside the mode`);
      assert.ok(e.m >= 36 && e.m <= 96 && e.at >= 0 && e.dur > 0 && e.vel > 0 && e.vel <= 1, `${sec}: ${JSON.stringify(e)}`);
    }
    assert.ok(!holdsTheme(p.events), `${sec} ${s}-${t} seed ${seed}: the whole theme, with ${seed % 7} seals`);
  }
  const whole = makePhrase("complete", { r: rng(1), seals: 7 });
  assert.ok(holdsTheme(whole.events), "after seven seals the whole theme is played");
  assert.equal(makePhrase("hall", { r: rng(2) }).events.filter((e) => MELODY.has(e.voice)).length, 0, "indoors there is no melody");
});

// Ten minutes on the mountain, as a visit goes: the bamboo, the stair, round the screen wall, the court, a hall, the
// court again, the terraces with a seal or two on the way, and the summit, where the seventh seal is earned.
const WALK = [["grove", 70], ["stair", 60], ["gate", 45], ["court", 110], ["hall", 60], ["court", 25], ["upper", 120], ["summit", 110]];
function visit(seed, opts = {}) {
  const keeper = createZoneKeeper(2), c = createConductor(seed), phrases = [], changes = []; let t = 0, seals = 0, last = null;
  for (const [zone, secs] of WALK) {
    const end = t + secs;
    for (; t < end; t += 0.25) {
      // Along a boundary for the first few seconds of each place: back and forth twice a second.
      const here = t - (end - secs) < (opts.dither || 0) && last ? (Math.floor(t * 2) % 2 ? last : zone) : zone;
      if (zone === "upper" && t - (end - secs) > 40) seals = Math.max(seals, 5);
      if (zone === "summit" && t - (end - secs) > 30) seals = 7;
      const stable = keeper.update(here, t); if (changes.at(-1)?.zone !== stable) changes.push({ zone: stable, t });
      const p = c.tick(t, stable, seals, moodMusic(opts.season, opts.time)); if (p) phrases.push({ ...p, zone: stable, seals });
    }
    last = zone;
  }
  return { phrases, changes, length: t };
}

test("a ten-minute visit: one phrase at a time, none cut, none twice running, and the music follows him", () => {
  for (const [seed, season, time] of [[1, "summer", "day"], [7, "autumn", "dusk"], [23, "winter", "night"], [99, "spring", "dawn"]]) {
    const { phrases, changes } = visit(seed, { season, time, dither: 3 });
    assert.ok(phrases.length >= 18, `only ${phrases.length} phrases in ten minutes`);
    for (let i = 1; i < phrases.length; i++) {
      const a = phrases[i - 1], b = phrases[i];
      assert.ok(b.start >= a.notesEnd, `phrase ${i} begins before the last one's notes are done`);
      assert.notEqual(b.sig, a.sig, `the same phrase twice running (${b.sig})`);
    }
    for (const p of phrases) if (p.seals < 7) assert.ok(!holdsTheme(p.events), `the whole theme with ${p.seals} seals`);
    assert.ok(phrases.some((p) => p.section === "complete" && p.seals === 7), "the seventh seal brings the whole theme");
    assert.ok(phrases.some((p) => p.section === "gate"), "the gate was never heard");
    // After each settled change of place, the new place's music begins soon: at once if the music was resting, and
    // in any case once the phrase that was sounding has finished.
    for (const ch of changes.slice(1)) {
      const before = phrases.filter((p) => p.start < ch.t).at(-1), next = phrases.find((p) => p.start >= ch.t);
      if (!next) continue;
      const wait = next.start - Math.max(ch.t, before ? before.notesEnd + 1.5 : 0);
      assert.ok(wait < 0.5, `${season}-${time}: ${ch.zone} waited ${wait.toFixed(1)} s after the last notes`);
      assert.ok(next.start - ch.t < 40, `${ch.zone}: the music took ${(next.start - ch.t).toFixed(1)} s to follow`);
    }
  }
});

test("the same seed makes the same visit; another seed another", () => {
  const sigs = (s) => visit(s).phrases.map((p) => p.sig).join("|");
  assert.equal(sigs(5), sigs(5)); assert.notEqual(sigs(5), sigs(6));
});
