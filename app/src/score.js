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
export function zoneBounds(SITE, LEVELS, APPROACH) {
  return { grove: APPROACH.zA1, stair: 56.5, gate: 40, court: LEVELS[0].zS, summit: LEVELS[2].zS };
}
export function zoneOf(x, z, inside, B) {
  if (inside) return "hall";
  if (z > B.grove) return "grove";      // the bamboo and the first flight, below the half-way pavilion
  if (z > B.stair) return "stair";      // the turning stair and the forecourt before the screen wall
  if (z > B.gate) return "gate";        // round the screen wall: the gate seen whole
  if (z > B.court) return "court";      // the first court
  if (z > B.summit) return "upper";     // the terraces and the tea slope
  return "summit";
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
export const SECTION_LEVEL = { grove: 0.8, stair: 0.9, gate: 1, court: 0.75, hall: 0.55, upper: 0.9, summit: 1, complete: 1 };

// ---- Phrases ----
// A small seeded random, so a visit is varied but a test is repeatable.
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
const between = (r, a, b) => a + r() * (b - a);
// Voices: qin (a plucked silk string), harm (a qin harmonic), low (an open string, low), xiao (vertical flute),
// pad (a thin held fifth, almost not there). Each event: at and dur in beats, m a MIDI note, vel 0..1,
// slide "up" (the finger slides into the note after the pluck) or "yin" (a slow waver), both qin ornaments.
const ev = (at, voice, m, dur, vel, slide) => ({ at, voice, m, dur, vel, ...(slide ? { slide } : {}) });
// The first k notes of the theme, laid end to end from beat `from`, in `voice`, `shift` semitones up.
function head(k, voice, from = 0, shift = 0, vel = 0.7, stretch = 1) {
  const out = []; let t = from;
  for (let i = 0; i < k; i++) { const n = THEME[i]; out.push(ev(t, voice, n.m + shift, n.b * stretch + (voice === "xiao" ? 0 : 1.5), vel * (i === 2 ? 1.1 : 1), voice === "qin" && i === 2 ? "yin" : voice === "qin" && i === 1 ? "up" : null)); t += n.b * stretch; }
  return { notes: out, end: t };
}
const lead = (voice, mm) => (voice === "low" || voice === "pad" ? voice : voice === "qin" ? (mm.lead === "qin" ? "qin" : mm.lead) : voice === "xiao" && mm.lead === "harm" ? "harm" : voice);

// Each place's way of making a phrase. Returns { events, beats, rest: [min, max] seconds of silence after it }.
// `seals` is how many seals are held; `first` is true the first time a place is heard on this visit.
const PHRASES = {
  grove(r, s) {   // two or three harmonics of the theme's opening, high and far apart, as if the wind found them
    const k = s.seals >= 3 ? pick(r, [2, 3, 3]) : pick(r, [2, 2, 3]), ev0 = []; let t = 0;
    for (let i = 0; i < k; i++) { ev0.push(ev(t, "harm", THEME[i].m + 12, 4, 0.55 + r() * 0.15)); t += between(r, 1.6, 3.2); }
    if (r() < 0.35) ev0.push(ev(t + 1, "harm", MODE.tonic + 24, 5, 0.4));
    return { events: ev0, beats: t + 2, rest: [9, 16] };
  },
  stair(r, s) {   // a low open string, then a longer piece of the theme
    const k = pick(r, s.seals >= 2 ? [3, 4, 4] : [3, 3, 4]), h = head(k, "qin", 1.5, 0, 0.62);
    return { events: [ev(0, "low", MODE.tonic, 6, 0.5), ...h.notes, ...(r() < 0.4 ? [ev(h.end + 0.5, "harm", MODE.tonic + 24, 4, 0.4)] : [])], beats: h.end + 1.5, rest: [7, 12] };
  },
  gate(r, s) {    // the gate seen whole: a full phrase the first time, over the held fifth; quieter answers after
    if (s.first) {
      const h = head(5, "qin", 2, 0, 0.75, 1.15);
      return { events: [ev(0, "pad", MODE.tonic, h.end + 6, 0.8), ev(0.5, "low", MODE.tonic, 6, 0.55), ...h.notes, ev(h.end + 1, "low", MODE.tonic, 7, 0.6, "yin")], beats: h.end + 3, rest: [9, 13] };
    }
    const h = head(4, "qin", 1, 0, 0.6);
    return { events: [ev(0, "low", MODE.tonic + 7, 5, 0.45), ...h.notes], beats: h.end + 1.5, rest: [9, 14] };
  },
  court(r) {      // single notes, and silence for the water and the wind
    const n = pick(r, [1, 1, 2]), out = []; let t = 0;
    for (let i = 0; i < n; i++) { const m = pick(r, [55, 62, 62, 67, 60]); out.push(r() < 0.4 ? ev(t, "harm", m + 12, 5, 0.5) : ev(t, "qin", m, 5, 0.55, r() < 0.5 ? "yin" : null)); t += between(r, 2.5, 4); }
    return { events: out, beats: t + 1, rest: [10, 18] };
  },
  hall(r) {       // no melody: a low open string under a held fifth, the room's own hum
    const m = pick(r, [MODE.tonic, MODE.tonic, MODE.tonic - 5]);
    return { events: [ev(0, "pad", MODE.tonic, 10, 0.7), ev(1, "low", m, 7, 0.45, r() < 0.5 ? "yin" : null)], beats: 6, rest: [12, 20] };
  },
  upper(r, s) {   // the theme turned round, or lifted a fourth; the flute begins to answer
    const kind = pick(r, ["back", "lift", "lift", "back"]), out = []; let t = 0;
    if (kind === "back") { for (const i of [2, 1, 0]) { out.push(ev(t, "qin", THEME[i].m, THEME[i].b + 1.5, 0.6, i === 2 ? "up" : null)); t += THEME[i].b + 0.5; } }
    else { for (const m of [67, 70, 72]) { out.push(ev(t, "qin", m, 3, 0.58)); t += 1.5; } }
    if (r() < s.xiao + 0.15 * s.seals / 7) { out.push(ev(t + 1, "xiao", pick(r, [62, 67]), 4, 0.5)); t += 5; }
    return { events: [ev(0, "low", MODE.tonic, 5, 0.4), ...out], beats: t + 1.5, rest: [8, 14] };
  },
  summit(r) {     // the flute calls with the opening, the string answers with the close
    const call = head(3, "xiao", 0, 12, 0.55, 1.25), out = [...call.notes]; let t = call.end + 1.5;
    for (const i of [4, 5, 6]) { out.push(ev(t, "qin", THEME[i].m, THEME[i].b + 2, 0.6, i === 6 ? "yin" : null)); t += THEME[i].b; }
    return { events: [ev(0, "pad", MODE.tonic, t + 4, 0.6), ...out], beats: t + 2, rest: [10, 15] };
  },
  // Once, when the seventh seal is earned, and now and then at the gate or the summit after: the whole theme,
  // the string first and the flute after it, an octave up.
  complete() {
    const a = head(7, "qin", 1, 0, 0.72, 1.1), b = head(7, "xiao", a.end + 2, 12, 0.5, 1.1);
    return { events: [ev(0, "pad", MODE.tonic, b.end + 6, 0.8), ev(0, "low", MODE.tonic, 7, 0.55), ...a.notes, ...b.notes, ev(b.end, "low", MODE.tonic, 8, 0.55, "yin")], beats: b.end + 3, rest: [12, 18] };
  },
};

// A phrase, made ready to play: events in seconds from its start, the voices as the mood has them, register shifted.
export function makePhrase(section, opts) {
  const { r, seals = 0, first = false, mood = moodMusic() } = opts, s = { seals, first, xiao: mood.xiao };
  const p = PHRASES[section](r, s), beat = 60 / mood.tempo;
  const events = p.events.map((e) => {
    const voice = lead(e.voice, mood), lift = voice === "low" || voice === "pad" ? 0 : mood.octave && voice === "harm" ? 0 : mood.octave;
    return { ...e, voice, m: e.m + lift, at: e.at * beat, dur: e.dur * beat };
  });
  const length = Math.max(p.beats * beat, ...events.map((e) => e.at + Math.min(e.dur, 3)));
  return { section, events, length, rest: p.rest.map((v) => v * mood.rest), sig: section + ":" + events.map((e) => e.voice[0] + e.m).join(",") };
}

// ---- The conductor: which phrase, and when ----
// Called a few times a second with the audio clock, the place he is settled in, the seals and the mood. Returns the
// phrase to start (with its start time) or null. A phrase is never cut. The silence after one is cut short when the
// place has changed, so the music follows him within a few seconds; it waits out the last notes first.
export function createConductor(seed = 1) {
  const r = rng(seed), heard = new Set();
  let section = null, startedIn = null, notesEnd = -1, restEnd = -1, lastSig = "", completeDue = false, sealsSeen = null, count = 0;
  return {
    tick(now, zone, seals, mood = moodMusic()) {
      if (sealsSeen !== null && seals >= 7 && sealsSeen < 7) completeDue = true;   // the seventh seal, earned just now
      sealsSeen = seals;
      const want = completeDue && zone !== "hall" ? "complete" : zone;
      const changed = (want === "complete" && section !== "complete") || zone !== startedIn;
      if (now < notesEnd) return null;                         // a phrase is sounding: never cut it
      if (now < restEnd && !(changed && now >= notesEnd + 1.5)) return null;   // resting: unless the place has changed
      // Choose the phrase. Never the same one twice running; after seven seals the gate and summit sometimes play it whole.
      let sec = want; if (sec !== "complete" && section !== "complete" && seals >= 7 && (zone === "gate" || zone === "summit") && r() < 0.3) sec = "complete";
      let p, tries = 0;
      do { p = makePhrase(sec, { r, seals: Math.min(seals, 7), first: !heard.has(sec), mood }); } while (p.sig === lastSig && ++tries < 8);
      if (sec === "complete") completeDue = false;
      heard.add(sec); lastSig = p.sig; section = sec; startedIn = zone; count++;
      const start = now + 0.15; notesEnd = start + p.length; restEnd = notesEnd + between(r, p.rest[0], p.rest[1]);
      return { ...p, start, notesEnd, restEnd, n: count };
    },
    get section() { return section; },
    get place() { return startedIn; },
    get notesEnd() { return notesEnd; },
    get restEnd() { return restEnd; },
    get count() { return count; },
  };
}
