// The music of the mountain, as data. Nothing here makes a sound: this file says which notes a phrase holds, where on
// the mountain the visitor is listening from, and when the next phrase may begin. audio.js and instruments.js play it.
//
// One theme of seven notes, one for each seal. On the way up only pieces of it are heard: two or three harmonics in
// the bamboo, a longer piece on the stair, a whole phrase once the gate is seen round the screen wall, single notes and
// long silence in the first court, nothing but a low open string inside a hall. The theme is heard entire, in order,
// only once the seventh seal is earned; until then no phrase is allowed to hold it (the unit tests walk ten minutes of
// mountain to make sure). The chime that answers each seal sounds the next note of it.
//
// The mode is G yu (G Bb C D F), the minor pentatonic on the bell's own fundamental: the great bell hums at 98 Hz with
// a minor third among its partials, so the music is built on what the place already rings. It is one constant; change
// MODE and the theme together if the key is ever changed.

export const MODE = { name: "G yu", tonic: 43, steps: [0, 3, 5, 7, 10] };   // MIDI 43 = G2 = 98 Hz, the bell
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const inMode = (m) => MODE.steps.includes((((m - MODE.tonic) % 12) + 12) % 12);
// The theme: it climbs to the high G as the path climbs to the gate, and comes down to the low one, the ground.
// b: length in beats.
export const THEME = [
  { m: 62, b: 1.5 }, { m: 65, b: 0.5 }, { m: 67, b: 3 }, { m: 65, b: 1 }, { m: 62, b: 1 }, { m: 60, b: 2 }, { m: 55, b: 4 },
];
// What sounds when the n-th seal is earned (1..7): that note of the theme, two octaves up, on a hand chime.
// The first is D6, 1175 Hz, the chime the seals have always rung.
export const sealNote = (n) => (n >= 1 && n <= 7 ? THEME[n - 1].m + 24 : null);

// ---- Where the visitor is listening from ----
// Seven places, in the order a visit meets them. The bounds come from site.js (passed in, so that this file needs
// nothing of three.js and can be rendered offline).
export const ZONES = ["grove", "stair", "gate", "court", "hall", "upper", "summit"];
export function zoneBounds(SITE, LEVELS, APPROACH, SCREEN) {
  return { grove: APPROACH.zA1, stair: SCREEN.z + 1.5, gate: SITE.zS, court: LEVELS[0].zS, summit: LEVELS[2].zS };
}
/** What a zone plays on the year-end bell's night (#341): the bell's court and the terraces above it take the drone. @param {string} zone */
export const joyaZone = (zone) => (zone === "court" || zone === "upper" ? "joya" : zone);
export function zoneOf(x, z, inside, B) {
  if (!B || B.layers) return "none";    // a level with no music of its own yet (#409): the prologue's is not played there; T05, which gives `layers`, has a sound field but no melody
  if (inside) return "hall";
  if (z > B.grove) return "grove";      // the bamboo and the first flight, below the half-way pavilion
  if (z > B.stair) return "stair";      // the turning stair and the forecourt before the screen wall
  if (z > B.gate) return "gate";        // round the screen wall: the gate seen whole
  if (z > B.court) return "court";      // the first court
  if (z > B.summit) return "upper";     // the terraces and the tea slope
  return "summit";
}

/**
 * The layer of sound he stands in, for a level that gives `zones.layers` (T05, docs/t05/SOUND.md §1): "hall" under the
 * great hall's roof (Z3), "yard" everywhere else (Z1; Z2, the doorway, is left to the doorstep's own mixing for now). A level
 * with no layers, the prologue, has none: null, and audio.js keeps going by `zoneOf`. A room under the courts is the hall.
 * @param {number} x @param {number} z @param {boolean} inside @param {any} B
 */
export function layerOf(x, z, inside, B) {
  if (!B || !B.layers) return null;
  const h = B.layers.hall;
  return inside || (h && x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1) ? "hall" : "yard";
}

// A place counts as where he is only once he has stayed in it `hold` seconds, so that walking along a boundary,
// or stepping back over it, does not keep changing the music.
export function createZoneKeeper(hold = 2) {
  let stable = null, cand = null, since = 0;
  return {
    update(zone, now) {
      if (stable === null) { stable = cand = zone; since = now; return stable; }
      if (zone !== cand) { cand = zone; since = now; }
      if (cand !== stable && now - since >= hold) stable = cand;
      return stable;
    },
    // Where he is, known at once (the prologue's title says he has come round the screen wall): no two seconds' wait.
    settle(zone, now) { stable = cand = zone; since = now; },
    get stable() { return stable; },
    get candidate() { return cand; },
  };
}

// ---- How each season and hour colours it: register, pace, who leads ----
// lead: "qin" (plucked), "xiao" (the vertical flute takes the melody), "harm" (only harmonics: winter).
// rest: multiplies the silences. Nothing else about a mood changes the score; sixteen moods are not sixteen pieces.
export function moodMusic(season = "summer", time = "day") {
  const m = { tempo: 52, lead: "qin", rest: 1, octave: 0, pad: 1, xiao: 0.35 };
  if (season === "spring") { m.octave = 12; m.rest = 0.9; }
  if (season === "autumn") { m.tempo = 48; m.xiao = 0.6; }
  if (season === "winter") { m.lead = "harm"; m.rest = 1.3; m.tempo = 46; m.pad = 0.6; }
  if (time === "dawn") { m.rest *= 0.95; m.xiao *= 0.5; }
  if (time === "dusk") { m.tempo -= 3; m.xiao = Math.min(1, m.xiao + 0.25); }
  if (time === "night") { m.lead = season === "winter" ? "harm" : "xiao"; m.tempo -= 4; m.rest *= 1.2; m.pad *= 1.3; }
  return m;
}
// How loud each place keeps the music, before the visitor's own level (the bus fades to this over a few seconds).
export const SECTION_LEVEL = { grove: 0.8, stair: 0.9, gate: 1, court: 0.75, hall: 0.55, joya: 0.55, upper: 0.9, summit: 1, complete: 1, ending: 1 };

// ---- Phrases ----
// A small seeded random, so a visit is varied but a test is repeatable.
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
const between = (r, a, b) => a + r() * (b - a);
// k steps of the mode up (or down, if k is negative) from m: a phrase moved within the mode keeps its shape and its key.
export function step(m, k) { let x = m; const d = Math.sign(k); for (let i = 0; i < Math.abs(k); i++) { do x += d; while (!inMode(x)); } return x; }
// The range each instrument is written for, in MIDI notes.
export const RANGE = { qin: [36, 81], low: [31, 50], harm: [55, 93], xiao: [62, 86], pad: [31, 55] };
// Voices: qin (a plucked silk string), harm (a qin harmonic), low (an open string, low), xiao (vertical flute),
// pad (a thin held fifth, almost not there). Each event: at and dur in beats, m a MIDI note, vel 0..1,
// slide "up" (the finger slides into the note after the pluck) or "yin" (a slow waver), both qin ornaments.
// `ring`: the written length is only until the next note; a plucked string is let ring past it.
const ev = (at, voice, m, dur, vel, slide, ring) => ({ at, voice, m, dur, vel, ...(slide ? { slide } : {}), ...(ring ? { ring: true } : {}) });
// Notes i0..i0+k-1 of the theme from beat `from`: moved `deg` steps in the mode and `shift` semitones, its rhythm
// stretched. Only the theme itself (deg 0, from its first note) is ever heard in full, and only after seven seals.
function head(k, voice, from = 0, o = {}) {
  const { i0 = 0, deg = 0, shift = 0, vel = 0.7, stretch = 1 } = o, out = []; let t = from;
  for (let i = i0; i < Math.min(7, i0 + k); i++) {
    const n = THEME[i], slide = voice === "qin" ? (i === 2 ? "yin" : i === 1 ? "up" : null) : null;
    out.push(ev(t, voice, step(n.m, deg) + shift, n.b * stretch, vel * (i === 2 ? 1.1 : 1), slide, true)); t += n.b * stretch;
  }
  return { notes: out, end: t };
}

// Each place's way of making a phrase. Returns { events, beats, rest: [min, max] seconds of silence after it }.
// `seals` is how many seals are held; `first` is true the first time a place is heard (whole) on this visit.
const PHRASES = {
  grove(r, s) {   // two or three harmonics from the theme's opening, high and far apart, as if the wind found them
    const k = s.seals >= 3 ? pick(r, [2, 3, 3]) : pick(r, [2, 2, 3]), i0 = pick(r, [0, 0, 1, 2]), deg = pick(r, [0, 0, 1, -1, 2]), out = []; let t = 0;
    for (let i = i0; i < Math.min(7, i0 + k); i++) { out.push(ev(t, "harm", step(THEME[i].m, deg) + 12, 4, 0.55 + r() * 0.15)); t += between(r, 1.6, 3.4); }
    if (r() < 0.35) out.push(ev(t + 1, "harm", pick(r, [MODE.tonic + 24, MODE.tonic + 31]), 5, 0.4));
    return { events: out, beats: t + 2, rest: [9, 16] };
  },
  stair(r, s) {   // a low open string, then a longer piece of the theme, not always from the same note
    const k = pick(r, s.seals >= 2 ? [3, 4, 4] : [3, 3, 4]), h = head(k, "qin", 1.5, { i0: pick(r, [0, 0, 1]), deg: pick(r, [0, 0, -1, 1]), vel: 0.62, stretch: between(r, 0.9, 1.2) });
    return { events: [ev(0, "low", pick(r, [MODE.tonic, MODE.tonic, MODE.tonic - 5]), 6, 0.5), ...h.notes, ...(r() < 0.4 ? [ev(h.end + 0.5, "harm", MODE.tonic + 24, 4, 0.4)] : [])], beats: h.end + 1.5, rest: [7, 12] };
  },
  gate(r, s) {    // the gate seen whole: the theme's phrase as it is the first time, over the held fifth; quieter answers after
    if (s.first) {
      const h = head(5, "qin", 2, { vel: 0.75, stretch: 1.15 });
      return { events: [ev(0, "pad", MODE.tonic, h.end + 6, 0.8), ev(0.5, "low", MODE.tonic, 6, 0.55), ...h.notes, ev(h.end + 1, "low", MODE.tonic, 7, 0.6, "yin")], beats: h.end + 3, rest: [9, 13] };
    }
    const h = head(pick(r, [3, 4]), "qin", 1, { i0: pick(r, [0, 1]), deg: pick(r, [1, 2, -1]), vel: 0.6, stretch: between(r, 0.95, 1.25) });
    return { events: [ev(0, "low", MODE.tonic + 7, 5, 0.45), ...h.notes], beats: h.end + 1.5, rest: [9, 14] };
  },
  court(r) {      // single notes, and silence for the water and the wind
    const n = pick(r, [1, 1, 2]), out = []; let t = 0;
    for (let i = 0; i < n; i++) { const m = pick(r, [55, 58, 60, 62, 62, 65, 67]); out.push(r() < 0.4 ? ev(t, "harm", m + 12, 5, 0.5) : ev(t, "qin", m, 5, 0.55, r() < 0.5 ? "yin" : null)); t += between(r, 2.5, 4); }
    return { events: out, beats: t + 1, rest: [10, 18] };
  },
  hall(r) {       // no melody: the room's own hum, a held fifth that never quite stops, and now and then a low open string
    const out = [ev(0, "pad", MODE.tonic, 26, 0.7), ev(1, "low", pick(r, [MODE.tonic, MODE.tonic, MODE.tonic - 5]), 7, 0.45, r() < 0.5 ? "yin" : null)];
    if (r() < 0.5) out.push(ev(between(r, 8, 11), "low", pick(r, [MODE.tonic, MODE.tonic + 7]), 7, 0.35));
    return { events: out, beats: 18, rest: [4, 8] };
  },
  // The year-end bell's night (#341), in the bell's court and above: no melody and no string, only the hall's held fifth
  // (G-D, the bell's own G under it), so that the strokes everyone rings, and the far bell that answers each 108, are the
  // music. The music reviewer's advice of 2026-11-20: a pad at the hall's level, ducked by the bell as ever, never silence.
  joya() { return { events: [ev(0, "pad", MODE.tonic, 26, 0.7)], beats: 18, rest: [4, 8] }; },
  upper(r, s) {   // the theme turned round, or a rising figure somewhere in the mode; the flute begins to answer
    const kind = pick(r, ["back", "lift", "lift", "back"]), deg = pick(r, [0, 1, -1]), out = []; let t = 0;
    if (kind === "back") { for (const i of [2, 1, 0]) { out.push(ev(t, "qin", step(THEME[i].m, deg), THEME[i].b + 0.5, 0.6, i === 2 ? "up" : null, true)); t += THEME[i].b + 0.5; } }
    else { let m = pick(r, [60, 62, 65, 67]); for (let i = 0; i < 3; i++) { out.push(ev(t, "qin", m, 1.5, 0.58, null, true)); t += pick(r, [1, 1.5, 1.5, 2]); m = step(m, pick(r, [1, 1, 2])); } }
    if (r() < s.xiao + 0.15 * s.seals / 7) { out.push(ev(t + 1, "xiao", pick(r, [62, 65, 67, 70]), 4, 0.5)); t += 5; }
    return { events: [ev(0, "low", MODE.tonic, 5, 0.4), ...out], beats: t + 1.5, rest: [8, 14] };
  },
  summit(r) {     // the flute calls with the opening, the string answers with the close
    const call = head(pick(r, [2, 3, 3]), "xiao", 0, { i0: pick(r, [0, 0, 1]), deg: pick(r, [0, 0, 1, -1]), shift: 12, vel: 0.55, stretch: between(r, 1.1, 1.4) }), out = [...call.notes]; let t = call.end + between(r, 1, 2);
    const deg = pick(r, [0, 0, 1, -1]);
    for (const i of pick(r, [[4, 5, 6], [4, 5, 6], [5, 6], [3, 5, 6]])) { out.push(ev(t, "qin", step(THEME[i].m, deg), THEME[i].b, 0.6, i === 6 ? "yin" : null, true)); t += THEME[i].b; }
    return { events: [ev(0, "pad", MODE.tonic, t + 4, 0.6), ...out], beats: t + 2, rest: [10, 15] };
  },
  // Once, when the seventh seal is earned, and now and then at the gate or the summit after: the whole theme,
  // the string first and the flute after it, an octave up.
  complete() {
    const a = head(7, "qin", 1, { vel: 0.72, stretch: 1.1 }), b = head(7, "xiao", a.end + 2, { shift: 12, vel: 0.5, stretch: 1.1 });
    return { events: [ev(0, "pad", MODE.tonic, b.end + 6, 0.8), ev(0, "low", MODE.tonic, 7, 0.55), ...a.notes, ...b.notes, ev(b.end, "low", MODE.tonic, 8, 0.55, "yin")], beats: b.end + 3, rest: [12, 18] };
  },
};

// Who plays each note in this mood. A dialogue (flute and string together) keeps two voices: in winter the string's
// part goes to harmonics and the flute stays; at night it is left as it is. Otherwise the string's part goes to
// whoever leads, and in winter the flute's part too.
function voicing(events, mood) {
  const dialogue = events.some((e) => e.voice === "xiao") && events.some((e) => e.voice === "qin");
  return events.map((e) => {
    let v = e.voice;
    if (v === "qin" && (dialogue ? mood.lead === "harm" : mood.lead !== "qin")) v = mood.lead;
    else if (v === "xiao" && !dialogue && mood.lead === "harm") v = "harm";
    return { ...e, voice: v };
  });
}
const fit = (m, [lo, hi]) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };
// Each voice's line in a phrase is moved by one octave for all its notes, the one that leaves the fewest outside the
// instrument (and the smallest move among those), so the melody keeps its shape; only what still will not fit is folded.
function fold(events) {
  const by = {}; for (const e of events) (by[e.voice] ||= []).push(e);
  for (const v in by) {
    const [lo, hi] = RANGE[v]; let best = 0, worst = Infinity;
    for (const k of [0, -1, 1, -2, 2, -3, 3]) { const bad = by[v].filter((e) => e.m + 12 * k < lo || e.m + 12 * k > hi).length; if (bad < worst) { worst = bad; best = k; } }
    for (const e of by[v]) e.m = fit(e.m + 12 * best, [lo, hi]);
  }
  return events;
}

// A phrase, made ready to play: events in seconds from its start, voiced for the mood, each in its instrument's range,
// plucked notes let ring, the flute one note at a time.
export function makePhrase(section, opts) {
  const { r, seals = 0, first = false, mood = moodMusic() } = opts, s = { seals, first, xiao: mood.xiao };
  const p = PHRASES[section](r, s), beat = 60 / mood.tempo;
  const events = fold(voicing(p.events, mood).map((e) => ({ ...e, m: e.m + (e.voice === "qin" || e.voice === "xiao" ? mood.octave : 0) }))).map((e) => {
    const dur = e.dur + (e.ring && e.voice !== "xiao" ? 1.5 : 0);
    const { ring, ...rest } = e;
    return { ...rest, at: e.at * beat, dur: dur * beat, vel: e.voice === "pad" ? Math.min(1, e.vel * mood.pad) : e.vel, ...(e.voice === "xiao" ? { slide: undefined } : {}) };
  }).sort((a, b) => a.at - b.at);
  const flute = events.filter((e) => e.voice === "xiao");
  for (let i = 0; i + 1 < flute.length; i++) flute[i].dur = Math.min(flute[i].dur, flute[i + 1].at - flute[i].at - 0.06);
  for (const e of events) if (e.slide === undefined) delete e.slide;
  const length = Math.max(p.beats * beat, ...events.map((e) => e.at + Math.min(e.dur, 3)));
  return { section, first, events, length, rest: p.rest.map((v) => v * mood.rest), sig: section + ":" + events.map((e) => e.voice[0] + e.m).join(",") };
}

// ---- The prologue's title ----
// The first time he comes round the screen wall with the gate before him, the title rises and the gate's first phrase
// begins with it: the theme's first five notes, the first whole phrase of the visit. Its first D is the title's note, so
// the string is brought forward to sound a moment after the title, the held fifth and the low string with it.
export const TITLE_LEAD = 0.3;   // seconds from the title to the string's first note
export function titlePhrase(r, mood = moodMusic()) {
  const p = makePhrase("gate", { r, seals: 0, first: true, mood }), melody = p.events.filter((e) => e.voice !== "pad" && e.voice !== "low");
  const d = Math.max(0, Math.min(...melody.map((e) => e.at)) - TITLE_LEAD);
  return { ...p, events: p.events.map((e) => ({ ...e, at: Math.max(0, e.at - d) })), length: p.length - d };
}

// ---- The close of the chapter ----
// Not a phrase of a place but music written to the close (rites.close, game.js's finale): `bell` is when the far bell
// sounds, `title` when the title comes, in seconds from the start of the close. While the words are said the string
// gives the theme slowly, a little to each line, and does not bring it home; the far bell is heard alone over the held
// fifth; with the title the flute takes the theme up an octave higher and stops on D, the fifth, not on G: the chapter
// is not over. Seconds, not beats, and slower than any walk; the mood moves it as it moves the rest.
export const ENDING = { slow: 1.18, clear: 0.6, rest: [14, 20] };
export function endingPhrase(mood = moodMusic(), { bell = 19.5, title = 25.5 } = {}) {
  const b = (60 / mood.tempo) * ENDING.slow, lead = mood.lead === "harm" ? "harm" : "qin", fl = mood.lead === "harm" ? "harm" : "xiao";
  const up = (v) => (v === "qin" || v === "xiao" ? mood.octave : 0), E = [];
  const note = (at, voice, m, dur, vel, slide) => E.push({ at, voice, m: m + up(voice), dur, vel, ...(slide && voice === "qin" ? { slide } : {}) });
  note(0.2, "pad", MODE.tonic, title + 7.5, Math.min(1, 0.62 * mood.pad));       // the held fifth under all of it
  note(1.0, "low", MODE.tonic, 9, 0.5);
  // The string's three pieces of the theme: from the first words, halfway to the bell, and one held note that has
  // died away when the bell comes.
  const a = 3.7, last = bell - 3.8, mid = a + (last - a) / 2;
  let t = a; for (const [m, n, sl] of /** @type {[number, number, string?][]} */ ([[62, 1.5], [65, 0.5, "up"], [67, 3, "yin"]])) { note(t, lead, m, n * b + 1.6, 0.62, sl); t += n * b; }
  t = mid; for (const [m, n] of [[65, 1], [62, 1.6]]) { note(t, lead, m, n * b + 1.6, 0.56); t += n * b; }
  note(last, lead, 60, Math.min(2 * b + 2.4, bell - last - ENDING.clear), 0.5, "yin");
  note(last, "low", MODE.tonic, bell - last - ENDING.clear, 0.38);
  // With the title, the flute, and it ends on D.
  t = title + 0.1; const tune = [[74, 1.5], [77, 0.5], [79, 2.5], [77, 1], [74, 3.2]];
  for (const [m, n] of tune) { note(t, fl, m, n * b - 0.06, 0.46); t += n * b; }
  const events = fold(E).sort((x, y) => x.at - y.at), length = Math.max(...events.map((e) => e.at + Math.min(e.dur, 4)));
  return { section: "ending", first: true, events, length, rest: ENDING.rest.map((v) => v * mood.rest), sig: "ending:" + events.map((e) => e.voice[0] + e.m).join(",") };
}

// ---- The conductor: which phrase, and when ----
// Called a few times a second with the audio clock, the place he is settled in, the seals and the mood. Returns the
// phrase to start (with its start time), or { cut } when the place has changed under a sounding phrase, or null.
// On a change of place the old phrase's notes not yet begun are dropped and what sounds fades over FADE seconds; the
// new place begins 1.5 s after. A rest is simply cut short; so is a phrase with less than FADE left, by waiting it out.
// The whole theme, after the seventh seal, is cut only by going indoors.
export const FADE = 3.5;
export const COMPLETE_AFTER = 6;   // seconds from the seventh seal's chime to the whole theme
export function createConductor(seed = 1) {
  const r = rng(seed), heard = new Set();
  let section = null, startedIn = null, first = false, notesEnd = -1, restEnd = -1, lastSig = "", completeDue = false, completeAt = Infinity, sealsSeen = null, count = 0, cuts = 0, cutting = false;
  return {
    tick(now, zone, seals, mood = moodMusic()) {
      // The seventh seal, earned just now: the whole theme, a few seconds after its chime. On the summit the close
      // usually follows at once; then the whole theme waits until the close's own music is over.
      if (sealsSeen !== null && seals >= 7 && sealsSeen < 7) completeAt = now + COMPLETE_AFTER;
      sealsSeen = seals;
      if (now >= completeAt) { completeDue = true; completeAt = Infinity; }
      const want = completeDue && zone !== "hall" ? "complete" : zone;
      const changed = (want === "complete" && section !== "complete") || zone !== startedIn;
      if (section === "ending" && !cutting && (now < notesEnd || (now < restEnd && zone === startedIn))) return null;   // the close is never cut but by passing over it, and rests after
      if (now < notesEnd) {
        // A phrase is sounding: let it be where he still is, when it is nearly over, or when it is the whole theme
        // (unless he has gone indoors, where there is no melody).
        if (!changed || cutting || notesEnd - now <= FADE || (section === "complete" && zone !== "hall")) return null;
        cutting = true; cuts++; if (first) heard.delete(section);         // a first hearing cut short will be heard again
        notesEnd = now + FADE; restEnd = notesEnd + 1.5;
        return { cut: true, at: now, fade: FADE };
      }
      if (now < restEnd && !(changed && now >= notesEnd + 1.5)) return null;   // resting: unless the place has changed
      // Choose the phrase. Never the same one twice running; after seven seals the gate and summit sometimes play it whole.
      let sec = want; if (sec !== "complete" && section !== "complete" && seals >= 7 && (zone === "gate" || zone === "summit") && r() < 0.3) sec = "complete";
      let p, tries = 0;
      do { p = makePhrase(sec, { r, seals: Math.min(seals, 7), first: !heard.has(sec), mood }); } while (p.sig === lastSig && ++tries < 8);
      if (sec === "complete") completeDue = false;
      heard.add(sec); lastSig = p.sig; section = sec; startedIn = zone; first = p.first; cutting = false; count++;
      const start = now + 0.15; notesEnd = start + p.length; restEnd = notesEnd + between(r, p.rest[0], p.rest[1]);
      return { ...p, start, notesEnd, restEnd, n: count };
    },
    // The close of the chapter: its music begins now, whatever was sounding (which the player fades), and the whole
    // theme still owed waits until it is over.
    close(now, p, zone) {
      if (completeAt < Infinity) { completeDue = true; completeAt = Infinity; }
      return this.begin(now, { ...p, section: "ending" }, zone);
    },
    // A phrase begun now because something in the walk says so (the close, the prologue's title), whatever was sounding.
    begin(now, p, zone) {
      const was = now < notesEnd; section = p.section; startedIn = zone; first = !!p.first; cutting = false; count++; lastSig = p.sig; heard.add(p.section);
      const start = now + (was ? 0.6 : 0.1); notesEnd = start + p.length; restEnd = notesEnd + between(r, p.rest[0], p.rest[1]);
      return { ...p, start, notesEnd, restEnd, n: count, faded: was };
    },
    heard: (sec) => heard.has(sec),
    // Passed over: what sounds fades as on a change of place, and the place's music comes back after a short rest.
    leave(now) {
      if (section !== "ending" || now >= notesEnd || cutting) return null;
      cutting = true; cuts++; notesEnd = now + FADE; restEnd = notesEnd + 4;
      return { cut: true, at: now, fade: FADE };
    },
    get section() { return section; },
    get place() { return startedIn; },
    get notesEnd() { return notesEnd; },
    get restEnd() { return restEnd; },
    get count() { return count; },
    get cuts() { return cuts; },
  };
}
