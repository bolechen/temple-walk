import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { MODE, THEME, hz, inMode, sealNote, ZONES, zoneBounds, zoneOf, createZoneKeeper, moodMusic, makePhrase, createConductor, rng, step, RANGE, FADE, SECTION_LEVEL, endingPhrase, ENDING, COMPLETE_AFTER } from "../../app/src/score.js";
const { buildSite, SITE, LEVELS, APPROACH, SCREEN } = await import("../../app/src/site.js");
import * as THREE from "three";
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), B = zoneBounds(SITE, LEVELS, APPROACH, SCREEN);
const SEASONS = ["spring", "summer", "autumn", "winter"], TIMES = ["dawn", "day", "dusk", "night"];
const MELODY = new Set(["qin", "xiao", "harm"]), PHRASE_DIALOGUE = new Set(["summit", "complete"]);
// The theme as steps of the mode, ignoring octaves, so that it is found moved anywhere in the mode, in any octave.
const degree = (m) => { let d = 0; for (let x = MODE.tonic - 24; x < m; x++) if (inMode(x + 1)) d++; return d; };
const steps = (ms) => ms.slice(1).map((m, i) => (((degree(m) - degree(ms[i])) % 5) + 5) % 5);
const THEME_STEPS = "," + steps(THEME.map((n) => n.m)).join(",") + ",";
const holdsTheme = (events) => { const ms = events.filter((e) => MELODY.has(e.voice)).sort((a, b) => a.at - b.at).map((e) => e.m); return ("," + steps(ms).join(",") + ",").includes(THEME_STEPS); };

test("an instrument's range moves a whole line, not single notes: the melody keeps its shape", () => {
  const shape = (es, v) => { const ms = es.filter((e) => e.voice === v).map((e) => e.m); return ms.slice(1).map((m, i) => m - ms[i]).join(); };
  const theme = THEME.slice(1).map((n, i) => n.m - THEME[i].m).join();
  for (const s of SEASONS) for (const t of TIMES) {
    const p = makePhrase("complete", { r: rng(1), seals: 7, mood: moodMusic(s, t) });
    for (const v of new Set(p.events.filter((e) => MELODY.has(e.voice)).map((e) => e.voice))) if (p.events.filter((e) => e.voice === v).length === 7) assert.equal(shape(p.events, v), theme, `${s}-${t}: the ${v}'s theme lost its shape`);
  }
  for (const sec of ["stair", "upper", "summit", "grove", "gate"]) for (const s of SEASONS) for (const t of TIMES) for (let seed = 1; seed < 60; seed++) {
    const p = makePhrase(sec, { r: rng(seed), seals: 3, mood: moodMusic(s, t) });
    for (const v of ["qin", "xiao"]) { const ms = p.events.filter((e) => e.voice === v).map((e) => e.m); for (let i = 1; i < ms.length; i++) assert.ok(Math.abs(ms[i] - ms[i - 1]) <= 12, `${sec} ${s}-${t} seed ${seed}: the ${v} leaps ${ms[i] - ms[i - 1]}`); }
  }
});

test("a step in the mode keeps a note in the mode", () => {
  for (let m = 40; m < 90; m++) if (inMode(m)) for (const k of [-3, -1, 1, 2]) assert.ok(inMode(step(m, k)) && Math.sign(step(m, k) - m) === Math.sign(k));
});

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
      const [lo, hi] = RANGE[e.voice]; assert.ok(e.m >= lo && e.m <= hi, `${sec} ${s}-${t}: ${e.voice} ${e.m} is outside its range`);
      assert.ok(e.at >= 0 && e.dur > 0 && e.vel > 0 && e.vel <= 1, `${sec}: ${JSON.stringify(e)}`);
    }
    const flute = p.events.filter((e) => e.voice === "xiao");
    for (let i = 1; i < flute.length; i++) assert.ok(flute[i - 1].at + flute[i - 1].dur <= flute[i].at + 1e-9, `${sec} ${s}-${t}: the flute plays two notes at once`);
    if (p.events.some((e) => e.voice === "xiao")) assert.ok(new Set(p.events.filter((e) => MELODY.has(e.voice)).map((e) => e.voice)).size >= 2 || !PHRASE_DIALOGUE.has(sec), `${sec} ${s}-${t}: the dialogue lost its second voice`);
    assert.ok(!holdsTheme(p.events), `${sec} ${s}-${t} seed ${seed}: the whole theme, with ${seed % 7} seals`);
  }
  const whole = makePhrase("complete", { r: rng(1), seals: 7 });
  assert.ok(holdsTheme(whole.events), "after seven seals the whole theme is played");
  assert.equal(makePhrase("hall", { r: rng(2) }).events.filter((e) => MELODY.has(e.voice)).length, 0, "indoors there is no melody");
});

// Ten minutes on the mountain, as a visit goes: the bamboo, the stair, round the screen wall, the court, a hall, the
// court again, the terraces with a seal or two on the way, and the summit, where the seventh seal is earned.
// The gate is crossed in about twelve seconds, as a visitor really crosses it.
const WALK = [["grove", 70], ["stair", 60], ["gate", 12], ["court", 110], ["hall", 60], ["court", 25], ["upper", 120], ["summit", 110], ["upper", 30], ["court", 40], ["gate", 40]];
function visit(seed, opts = {}) {
  const keeper = createZoneKeeper(2), c = createConductor(seed), phrases = [], changes = [], cuts = []; let t = 0, seals = 0, last = null;
  for (const [zone, secs] of WALK) {
    const end = t + secs;
    for (; t < end; t += 0.25) {
      // Along a boundary for the first few seconds of each place: back and forth twice a second.
      const here = t - (end - secs) < (opts.dither || 0) && last ? (Math.floor(t * 2) % 2 ? last : zone) : zone;
      if (zone === "upper" && t - (end - secs) > 40) seals = Math.max(seals, 5);
      if (zone === "summit" && t - (end - secs) > 30) seals = 7;
      const stable = keeper.update(here, t); if (changes.at(-1)?.zone !== stable) changes.push({ zone: stable, t });
      const p = c.tick(t, stable, seals, moodMusic(opts.season, opts.time)); if (p && p.cut) cuts.push({ ...p, section: c.section }); else if (p) phrases.push({ ...p, zone: stable, seals });
    }
    last = zone;
  }
  return { phrases, changes, cuts, length: t };
}

test("a ten-minute visit: one phrase at a time, none cut, none twice running, and the music follows him", () => {
  for (const [seed, season, time] of [[1, "summer", "day"], [7, "autumn", "dusk"], [23, "winter", "night"], [99, "spring", "dawn"]]) {
    const { phrases, changes, cuts } = visit(seed, { season, time, dither: 3 });
    assert.ok(phrases.length >= 18, `only ${phrases.length} phrases in ten minutes`);
    for (let i = 1; i < phrases.length; i++) {
      const a = phrases[i - 1], b = phrases[i];
      const cut = cuts.find((x) => x.at >= a.start && x.at < a.notesEnd);
      assert.ok(b.start >= (cut ? cut.at + FADE : a.notesEnd), `phrase ${i} begins before the last one has finished or faded`);
      assert.notEqual(b.sig, a.sig, `the same phrase twice running (${b.sig})`);
    }
    for (const p of phrases) if (p.seals < 7) assert.ok(!holdsTheme(p.events), `the whole theme with ${p.seals} seals`);
    assert.ok(phrases.some((p) => p.section === "complete" && p.seals === 7), "the seventh seal brings the whole theme");
    assert.ok(phrases.some((p) => p.section === "gate" && p.first), `${season}-${time}: the gate's first phrase was never heard`);
    assert.ok(cuts.every((x) => x.section !== "complete"), "the whole theme must never be cut outdoors");
    // After each settled change of place the old music fades and the new place's begins within FADE + 1.5 s (a few
    // tenths more for the tick), unless the whole theme was sounding, which is let finish.
    for (const ch of changes.slice(1)) {
      const before = phrases.filter((p) => p.start < ch.t).at(-1), next = phrases.find((p) => p.start >= ch.t);
      if (!next || (before && before.section === "complete" && before.notesEnd > ch.t)) continue;
      assert.ok(next.start - ch.t <= FADE + 1.5 + 0.5 || (before && before.notesEnd - ch.t <= FADE + 0.3 && next.start - before.notesEnd <= 1.5 + 0.5), `${season}-${time}: ${ch.zone} took ${(next.start - ch.t).toFixed(1)} s to be heard`);
    }
  }
});

test("a phrase never quite repeats: across five hundred visits, each place's phrases vary", () => {
  for (const sec of ["grove", "stair", "upper", "summit", "court"]) {
    const sigs = new Set(), opens = new Set(); for (let seed = 1; seed <= 500; seed++) { const p = makePhrase(sec, { r: rng(seed), seals: 3 }); sigs.add(p.sig); opens.add(p.events.filter((e) => MELODY.has(e.voice)).slice(0, 2).map((e) => e.m).join()); }
    assert.ok(sigs.size >= 25, `${sec}: only ${sigs.size} different phrases`); assert.ok(opens.size >= 4, `${sec}: only ${opens.size} different openings`);
  }
});

test("a quick crossing of the gate still hears its first phrase whole, on some later visit if not this time", () => {
  let missed = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const keeper = createZoneKeeper(2), c = createConductor(seed); let heardWhole = false, cur = null;
    const legs = [["stair", 30], ["gate", 8], ["court", 60], ["gate", 30]];
    let t = 0; for (const [zone, secs] of legs) for (const end = t + secs; t < end; t += 0.25) {
      const p = c.tick(t, keeper.update(zone, t), 0); if (p && !p.cut) cur = p; if (p && p.cut) cur = null;
      if (cur && cur.section === "gate" && cur.first && t >= cur.notesEnd - 0.25) heardWhole = true;
    }
    if (!heardWhole) missed++;
  }
  assert.ok(missed === 0, `${missed} of 300 visits never heard the gate's first phrase whole, though they came back to it`);
});

test("the same seed makes the same visit; another seed another", () => {
  const sigs = (s) => visit(s).phrases.map((p) => p.sig).join("|");
  assert.equal(sigs(5), sigs(5)); assert.notEqual(sigs(5), sigs(6));
});

// ---- The close of the chapter (game.js's finale): music written to its timeline ----
test("the close's music: the far bell is heard alone, the flute comes with the title, and it ends on D, not home", () => {
  for (const s of SEASONS) for (const t of TIMES) for (const bell of [18.5, 19.5, 20.2]) {
    const title = 25.5, p = endingPhrase(moodMusic(s, t), { bell, title }), id = `${s}-${t}, bell at ${bell}`;
    // Nothing but the held fifth sounds from a little before the far bell until the title.
    for (const e of p.events) if (e.voice !== "pad") assert.ok(e.at + e.dur <= bell - ENDING.clear + 1e-6 || e.at >= title, `${id}: ${e.voice} ${e.m} sounds over the far bell`);
    const melody = p.events.filter((e) => MELODY.has(e.voice)), before = melody.filter((e) => e.at < title), after = melody.filter((e) => e.at >= title);
    assert.ok(before.length >= 5 && after.length >= 4, `${id}: the theme is not given before and after the title`);
    // The flute (harmonics in winter) answers only once the title is there, an octave above the string.
    assert.ok(after.every((e) => e.at >= title) && Math.min(...after.map((e) => e.m)) > Math.min(...before.map((e) => e.m)), `${id}: the answer is not above the string`);
    // Never the whole theme, and the last note is D, the fifth of G: the chapter is not over.
    assert.ok(!holdsTheme(p.events), `${id}: the close plays the whole theme home`);
    const lastNote = melody.at(-1).m; assert.equal(((lastNote - MODE.tonic) % 12 + 12) % 12, 7, `${id}: it ends on ${lastNote}, not on D`);
    for (const e of p.events) { const [lo, hi] = RANGE[e.voice]; assert.ok(e.m >= lo && e.m <= hi, `${id}: ${e.voice} ${e.m} out of range`); assert.ok(inMode(e.m), `${id}: ${e.m} is out of the mode`); }
    assert.ok(p.length < title + 14, `${id}: the close's music runs on ${p.length.toFixed(1)} s`);
  }
});

test("the close's music begins at once, is cut only when passed over, and the whole theme of the seventh seal waits for it", () => {
  const mood = moodMusic(), c = createConductor(5), log = []; let t = 0, closed = null;
  // Six seals on the summit, then the seventh (the sitting), and the close 4.6 s later, as game.js has it.
  for (; t < 30; t += 0.25) { const p = c.tick(t, "summit", 6, mood); if (p && !p.cut) log.push({ ...p }); }
  const seventh = t;
  for (; t < seventh + 4.6; t += 0.25) { const p = c.tick(t, "summit", 7, mood); if (p && !p.cut) log.push({ ...p }); }
  assert.ok(!log.some((p) => p.section === "complete"), "the whole theme came before the close could begin");
  closed = c.close(t, endingPhrase(mood), "summit");
  assert.ok(closed.start - t <= 0.6 + 1e-9, "the close's music did not begin at once");
  for (; t < closed.notesEnd + 40; t += 0.25) {
    // The eye leaves him; where he is does not change, but even a change of place does not cut it.
    const zone = t > closed.start + 10 && t < closed.start + 14 ? "upper" : "summit", p = c.tick(t, zone, 7, mood);
    if (p && p.cut) assert.ok(t >= closed.notesEnd, `the close was cut at ${(t - closed.start).toFixed(1)} s`);
    else if (p) log.push({ ...p });
  }
  const whole = log.find((p) => p.section === "complete");
  assert.ok(whole && whole.start >= closed.notesEnd, "the whole theme owed for the seventh seal never came after the close");
  // Passed over: it fades like a change of place, and nothing new begins before the fade is done.
  const d = createConductor(9); let u = 0; d.tick(u, "summit", 3, mood); const q = d.close(1, endingPhrase(mood), "summit");
  const cut = d.leave(q.start + 6); assert.ok(cut && cut.cut && cut.fade === FADE, "passing over the close did not fade it");
  for (u = q.start + 6; u < q.start + 6 + FADE; u += 0.25) assert.equal(d.tick(u, "summit", 3, mood), null, "something began while the close faded");
  assert.equal(createConductor(1).leave(0), null, "there is nothing to pass over when no close is sounding");
  assert.ok(COMPLETE_AFTER > 0 && COMPLETE_AFTER < 8);
});
