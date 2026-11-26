// The hour and the season, as numbers: where the sun stands and what colour it is, how thick the air,
// how much cloud, whether there is snow, what falls through the air. Everything visible reads from one of these.
import { IDENTITY } from "./lut.js";
import { SKY_TRIAL, atmosphereMood } from "./atmosphere.js";

export const SEASONS = ["spring", "summer", "autumn", "winter"], TIMES = ["dawn", "day", "dusk", "night"];
export const NAMES = { spring: "春", summer: "夏", autumn: "秋", winter: "冬", dawn: "晨", day: "昼", dusk: "暮", night: "夜" };

// The film's finish for each hour (docs/t00/art-goal.md, first stage; targets in docs/t00/art-targets.md):
//   hal       halation, the warm glow film gives round a bright light (post.js), 0..1
//   ao        how dark ambient occlusion lays where things meet (high tier only)
//   win       the colour of lamplight through the lattice paper after dusk: the palette's "local lamplight" #C68C49 with some of
//             its saturation taken out (ART-SPEC.md, ART-REVIEW A2); where a window is lit is the level's data (windows.js)
//   winNight  which of a bay's two levels the lattice shows: 0 the dusk and dawn one (a few bays lit), 1 the night one
//   fogLayer  the mist in layers (fog.js): [strength 0..1, the height in metres it is thickest below, the height in
//             which it thins by e, how many times thicker it may grow below that height]; strength 0 is plain air
//   haze      how far the far ranges are lost in the mist (1: as before)
//   lut       the colour table (lut.js): lift, gamma, gain, saturation, and tints laid into the darks and the lights
const WIN = [0.62, 0.34, 0.15];
const TIME = {
  dawn:  { sun: [0.8, 0.2, 0.5], sunCol: [1, 0.72, 0.5], sunI: 3.0, hemiS: [0.72, 0.76, 0.9], hemiG: [0.34, 0.3, 0.28], hemiI: 0.8, fog: [0.4, 0.43, 0.48], fogD: 0.0125,
           zen: [0.2, 0.27, 0.42], hor: [0.5, 0.44, 0.4], cloud: -0.15, stars: 0, glow: 1.1, exp: 1.05, lamp: 0.55, sh: [0.94, 0.98, 1.07], hi: [1.07, 1, 0.92], sat: 1.08, lift: 0.014, bloom: 0.3, mist: 1.3,
           hal: 0.5, ao: 0.6, win: WIN, winNight: 0, fogLayer: [0.75, -12, 12, 2.2], haze: 0.85,
           lut: { lift: [0, 0.004, 0.008], gamma: [1, 1.01, 1], gain: [1, 1, 0.99], sat: 1.12, shadow: [-0.01, 0.003, 0.01], light: [0.01, 0.004, -0.008] } },
  day:   { sun: [0.5, 0.72, 0.5], sunCol: [1, 0.95, 0.86], sunI: 3.2, hemiS: [0.86, 0.91, 0.95], hemiG: [0.3, 0.31, 0.28], hemiI: 1.1, fog: [0.72, 0.77, 0.79], fogD: 0.0085,
           zen: [0.3, 0.48, 0.76], hor: [0.8, 0.87, 0.92], cloud: 0, stars: 0, glow: 0.6, exp: 1.12, lamp: 0, sh: [0.93, 1, 1.035], hi: [1.03, 1, 0.965], sat: 1.06, lift: 0.012, bloom: 0.22, mist: 1,
           hal: 0.25, ao: 0.6, win: WIN, winNight: 0, fogLayer: [0.5, -6, 20, 2], haze: 1,
           lut: { lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1.06, shadow: [0, 0, 0.005], light: [0.006, 0.002, -0.004] } },
  dusk:  { sun: [-0.82, 0.17, 0.42], sunCol: [1, 0.67, 0.36], sunI: 4.0, hemiS: [0.66, 0.6, 0.64], hemiG: [0.36, 0.27, 0.2], hemiI: 0.8, fog: [0.84, 0.6, 0.47], fogD: 0.008,
           zen: [0.22, 0.3, 0.52], hor: [0.95, 0.7, 0.44], cloud: -0.1, stars: 0.12, glow: 1.3, exp: 1.2, lamp: 1.0, sh: [0.97, 0.97, 1.0], hi: [1.08, 1, 0.86], sat: 1.14, lift: 0.01, con: 1.12, bloom: 0.36, mist: 0.9,
           hal: 0.7, ao: 0.65, win: WIN, winNight: 0, fogLayer: [0.6, -4, 16, 2.2], haze: 1,
           lut: { lift: [0, 0, 0.006], gamma: [1.02, 1, 0.98], gain: [1.02, 1, 0.975], sat: 1.1, shadow: [0.004, 0.002, -0.004], light: [0.014, 0.008, -0.014] } },
  night: { sun: [-0.4, 0.62, 0.55], sunCol: [0.5, 0.64, 1], sunI: 1.0, hemiS: [0.15, 0.21, 0.38], hemiG: [0.04, 0.05, 0.07], hemiI: 0.75, fog: [0.055, 0.085, 0.15], fogD: 0.0072,
           zen: [0.01, 0.022, 0.065], hor: [0.055, 0.095, 0.19], cloud: -0.3, stars: 1, glow: 0.55, exp: 1.3, lamp: 1.5, sh: [0.88, 0.97, 1.14], hi: [1.04, 1, 0.96], sat: 0.96, lift: 0.006, bloom: 0.48, mist: 0.45,
           hal: 0.6, ao: 0.5, win: WIN, winNight: 1, fogLayer: [0.4, -6, 20, 2], haze: 1,
           lut: { lift: [0, 0, 0.006], gamma: [1, 1, 1.01], gain: [1, 1, 1], sat: 1, shadow: [-0.006, 0, 0.01], light: [0.01, 0.004, -0.006] } },
};
const SEASON = {
  spring: { cloud: 0.36, wet: 0.6, snow: 0, leaf: [0.98, 1.08, 0.84], hills: [0.12, 0.2, 0.12], fogK: 1.1, drift: "petal" },
  summer: { cloud: 0.86, wet: 1, snow: 0, leaf: [1, 1, 1], hills: [0.1, 0.16, 0.13], fogK: 1.05, drift: "none" },
  autumn: { cloud: 0.22, wet: 0.3, snow: 0, leaf: [1.1, 1.0, 0.78], hills: [0.2, 0.16, 0.09], fogK: 0.8, drift: "leaf" },
  winter: { cloud: 0.8, wet: 0, snow: 1, leaf: [0.84, 0.9, 0.9], hills: [0.3, 0.33, 0.36], fogK: 1.3, drift: "snow" },
};
// One line for the foot of a photograph, by season, for the light hours and the dark.
export const LINES = {
  spring: ["一树花开，无人亦香", "花落夜钟迟"], summer: ["雨过竹声凉", "流萤照石阶"],
  autumn: ["叶落知山空", "一灯红叶深"], winter: ["雪深不闻钟", "雪夜一灯明"],
};

// `tune` is the level's own say in the mood (Level.moodFor, app/src/level.js): called with the season, the hour and the mood as the
// hours and seasons have made it, it returns the fields of the table to replace, or nothing. The hours' tables stay as they are for every level that says nothing.
export function moodOf(season, time, tune) {
  if (!TIME[time]) time = "day"; if (!SEASON[season]) season = "summer";
  const t = TIME[time], s = SEASON[season], dark = time === "night" || time === "dusk";
  const cloud = Math.min(1, Math.max(0.05, s.cloud + t.cloud));
  const m = { ...t, season, time, cloud, wet: s.wet, snow: s.snow, leaf: s.leaf, hills: s.hills, fogD: t.fogD * s.fogK, disk: 1 };
  m.sunI = t.sunI * (1 - 0.62 * cloud);                 // cloud takes the edge off the sun and gives it back as skylight
  m.hemiI = t.hemiI * (1 + 0.15 * cloud);
  // At dusk the lamps are lit sooner and burn brighter under cloud, when the day goes early; on a clear autumn evening
  // the sky still holds the light and the paper only glows (the prototypes: 05 at a cloudy summer dusk, 03 and 04 clear).
  if (time === "dusk") m.lamp = t.lamp * (0.1 + 1.1 * cloud);
  // Summer by day is the picture the place is judged by (J01 in docs/ART-SPEC.md): overcast, just after rain. No sun
  // to speak of, a grey sky darker than the white walls, thin cool mist that leaves what is near perfectly clear.
  if (season === "summer" && time === "day") Object.assign(m, { cloud: 1, sunI: 0.65, sunCol: [0.62, 0.65, 0.66], hills: [0.05, 0.085, 0.07], hemiI: 1.25, hemiS: [0.61, 0.665, 0.655], hemiG: [0.72, 0.74, 0.64],
    fog: [0.47, 0.51, 0.5], fogD: 0.0056, zen: [0.3, 0.335, 0.35], hor: [0.42, 0.455, 0.45], exp: 1.16, sat: 1.0, lift: 0.01, con: 1.1, bloom: 0.14, mist: 0.8, glow: 0.3,
    hal: 0, fogLayer: [0, 0, 20, 2], haze: 1, lut: IDENTITY });   // the film's finish leaves J01 as it was: no table, no halation, plain air
  // A summer dawn after rain: pale jade mist in the bamboo, the light cool and green rather than gold (prototype 01).
  if (season === "summer" && time === "dawn") Object.assign(m, { fog: [0.6, 0.68, 0.64], hor: [0.9, 0.96, 0.9], zen: [0.38, 0.5, 0.62], sunCol: [0.98, 0.96, 0.86], sunI: m.sunI * 1.6, exp: 1.18, sat: 1.18, lift: 0.008 });
  // A cloudy summer dusk after rain: the deck glows rose under an indigo sky and the lamps burn amber (prototype 05).
  if (season === "summer" && time === "dusk") Object.assign(m, { zen: [0.13, 0.15, 0.4], hor: [0.78, 0.47, 0.56], sunCol: [1, 0.55, 0.45], sunI: m.sunI * 0.6, win: [0.66, 0.34, 0.13] });
  if (s.snow && time !== "night") m.fog = t.fog.map((v, i) => v * 0.6 + [0.86, 0.88, 0.92][i] * 0.4);
  if (SKY_TRIAL.on) { const air = atmosphereMood(m); if (air) Object.assign(m, air); }   // #592 trial B: the sky, mist, sky-light and sun's colour from one scattering model, at the table's own lightness; off, this line is not reached
  const own = tune ? tune(season, time, m) : null; if (own) Object.assign(m, own);   // the level's say, after the hours and the seasons have had theirs
  const ownDrift = own && own.drift, ownLine = own && own.line;   // a level whose winter has no snow (T05's J01) says what falls in the air and which verse it is
  m.drift = ownDrift || (s.drift === "none" && time === "night" ? "firefly" : s.drift);
  // The breeze (wind.js), m/s at its steadiest: a spring and autumn day the liveliest, still winter cold and the night
  // the calmest, so that the smoke stands straightest then. And how much of the censer's incense is burning: most after
  // the morning service, a few sticks by evening, two or three glowing ends at night (#217; by common sense, our own choice).
  m.wind = { spring: 0.9, summer: 0.6, autumn: 1.05, winter: 0.4 }[season] * { dawn: 0.6, day: 1, dusk: 0.75, night: 0.45 }[time];
  m.incense = { dawn: 1, day: 0.6, dusk: 0.3, night: 0.12 }[time];
  m.line = ownLine || LINES[season][dark ? 1 : 0];
  m.label = `${NAMES[season]} · ${NAMES[time]}`;
  return m;
}
// The season and hour a page opens in (#573 step 7). `query` is the address (has/get); `now` is moodNow(); `prologueDay` says the book has not
// been filled once, so the walk is by day (the owner, 2026-11-17, yard.js). `firstMood` is what a level says about its own first look
// ({ season, time }, Level.firstMood); a level that keeps no book of its own (`keepsPlace` false) has no "later", so it is always the first look.
// An address that names a season, an hour or a fixed view (?shot, ?show, ?cam) is obeyed before all of this. A level that declares nothing
// gets exactly what the prologue always had: the visitor's own season, and by day until the book is filled.
export function startMood({ query, now, prologueDay, firstMood, keepsPlace }) {
  const fixed = query.has("shot") || query.has("show") || query.has("cam"), first = !!firstMood && (!keepsPlace || prologueDay);
  const askedSeason = SEASONS.includes(query.get("season")), askedTime = TIMES.includes(query.get("time"));
  return {
    season: askedSeason ? query.get("season") : fixed ? "summer" : first ? firstMood.season : now.season,
    time: askedTime ? query.get("time") : fixed ? "day" : first ? firstMood.time : prologueDay ? "day" : now.time,
    follow: !askedTime && !fixed && !prologueDay && !first,   // (the hour follows the clock only after the prologue, and not on a level's own first look)
  };
}
// The first time the book is shut after the close (#726): the hour turns to the visitor's own and follows the clock from there.
// Returns the hour to go to, or null where it must stay: an address that names an hour or a fixed view, or a hand's choice (the
// hand keeps what it chose). Already following: the hour it should now be, as `hourFollow` would say.
export function takeClock(state, query, d = new Date()) {
  if (state.hand || TIMES.includes(query.get("time")) || query.has("shot") || query.has("show") || query.has("cam")) return null;
  state.follow = true; return moodNow(d).time;
}
// The season and hour it is now, where the visitor is.
export function moodNow(d = new Date()) {
  const mo = d.getMonth(), h = d.getHours() + d.getMinutes() / 60;
  return { season: SEASONS[Math.floor(((mo + 10) % 12) / 3)], time: h < 5 ? "night" : h < 8 ? "dawn" : h < 16.5 ? "day" : h < 19 ? "dusk" : "night" };
}
// While a visit follows the clock (the default; a hour chosen by hand is for that visit only), the hour it should now be, or
// null when it is already right.
export function hourFollow(state, d = new Date()) {
  if (!state.follow) return null;
  const t = moodNow(d).time; return t === state.time ? null : t;
}
