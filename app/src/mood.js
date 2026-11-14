// The hour and the season, as numbers: where the sun stands and what colour it is, how thick the air,
// how much cloud, whether there is snow, what falls through the air. Everything visible reads from one of these.
export const SEASONS = ["spring", "summer", "autumn", "winter"], TIMES = ["dawn", "day", "dusk", "night"];
export const NAMES = { spring: "春", summer: "夏", autumn: "秋", winter: "冬", dawn: "晨", day: "昼", dusk: "暮", night: "夜" };

const TIME = {
  dawn:  { sun: [0.8, 0.2, 0.5], sunCol: [1, 0.72, 0.5], sunI: 3.0, hemiS: [0.72, 0.76, 0.9], hemiG: [0.34, 0.3, 0.28], hemiI: 0.8, fog: [0.82, 0.77, 0.74], fogD: 0.0125,
           zen: [0.38, 0.5, 0.72], hor: [1, 0.8, 0.62], cloud: -0.15, stars: 0, glow: 1.5, exp: 1.1, lamp: 0.55, sh: [0.94, 0.98, 1.07], hi: [1.07, 1, 0.92], sat: 1.08, lift: 0.014, bloom: 0.3, mist: 1.3 },
  day:   { sun: [0.5, 0.72, 0.5], sunCol: [1, 0.95, 0.86], sunI: 3.2, hemiS: [0.86, 0.91, 0.95], hemiG: [0.3, 0.31, 0.28], hemiI: 1.1, fog: [0.72, 0.77, 0.79], fogD: 0.0085,
           zen: [0.3, 0.48, 0.76], hor: [0.8, 0.87, 0.92], cloud: 0, stars: 0, glow: 0.6, exp: 1.12, lamp: 0, sh: [0.93, 1, 1.035], hi: [1.03, 1, 0.965], sat: 1.06, lift: 0.012, bloom: 0.22, mist: 1 },
  dusk:  { sun: [-0.82, 0.17, 0.42], sunCol: [1, 0.5, 0.24], sunI: 3.4, hemiS: [0.62, 0.56, 0.74], hemiG: [0.32, 0.24, 0.2], hemiI: 0.7, fog: [0.84, 0.6, 0.47], fogD: 0.008,
           zen: [0.2, 0.27, 0.54], hor: [1, 0.58, 0.3], cloud: -0.1, stars: 0.12, glow: 1.9, exp: 1.12, lamp: 1.0, sh: [0.9, 0.93, 1.12], hi: [1.1, 0.98, 0.85], sat: 1.14, lift: 0.012, bloom: 0.36, mist: 0.9 },
  night: { sun: [-0.4, 0.62, 0.55], sunCol: [0.5, 0.64, 1], sunI: 1.0, hemiS: [0.15, 0.21, 0.38], hemiG: [0.04, 0.05, 0.07], hemiI: 0.75, fog: [0.055, 0.085, 0.15], fogD: 0.0072,
           zen: [0.01, 0.022, 0.065], hor: [0.055, 0.095, 0.19], cloud: -0.3, stars: 1, glow: 0.55, exp: 1.3, lamp: 1.5, sh: [0.88, 0.97, 1.14], hi: [1.04, 1, 0.96], sat: 0.96, lift: 0.006, bloom: 0.48, mist: 0.45 },
};
const SEASON = {
  spring: { cloud: 0.36, wet: 0.6, snow: 0, leaf: [0.98, 1.08, 0.84], hills: [0.12, 0.2, 0.12], fogK: 1.1, drift: "petal" },
  summer: { cloud: 0.86, wet: 1, snow: 0, leaf: [1, 1, 1], hills: [0.1, 0.16, 0.13], fogK: 1.05, drift: "none" },
  autumn: { cloud: 0.22, wet: 0.3, snow: 0, leaf: [1.1, 1.0, 0.78], hills: [0.2, 0.16, 0.09], fogK: 0.8, drift: "leaf" },
  winter: { cloud: 0.8, wet: 0, snow: 1, leaf: [0.84, 0.9, 0.9], hills: [0.3, 0.33, 0.36], fogK: 1.3, drift: "snow" },
};
// One line for the foot of a photograph, by season, for the light hours and the dark.
const LINES = {
  spring: ["一树花开，无人亦香", "花落夜钟迟"], summer: ["雨过竹声凉", "流萤照石阶"],
  autumn: ["叶落知山空", "一灯红叶深"], winter: ["雪深不闻钟", "雪夜一灯明"],
};

export function moodOf(season, time) {
  if (!TIME[time]) time = "day"; if (!SEASON[season]) season = "summer";
  const t = TIME[time], s = SEASON[season], dark = time === "night" || time === "dusk";
  const cloud = Math.min(1, Math.max(0.05, s.cloud + t.cloud));
  const m = { ...t, season, time, cloud, wet: s.wet, snow: s.snow, leaf: s.leaf, hills: s.hills, fogD: t.fogD * s.fogK, disk: 1 };
  m.sunI = t.sunI * (1 - 0.62 * cloud);                 // cloud takes the edge off the sun and gives it back as skylight
  m.hemiI = t.hemiI * (1 + 0.15 * cloud);
  // Summer by day is the picture the place is judged by (J01 in docs/ART-SPEC.md): overcast, just after rain. No sun
  // to speak of, a grey sky darker than the white walls, thin cool mist that leaves what is near perfectly clear.
  if (season === "summer" && time === "day") Object.assign(m, { cloud: 1, sunI: 0.5, sunCol: [0.62, 0.65, 0.66], hills: [0.05, 0.085, 0.07], hemiI: 1.15, hemiS: [0.8, 0.86, 0.87], hemiG: [0.38, 0.4, 0.36],
    fog: [0.6, 0.65, 0.63], fogD: 0.0056, zen: [0.3, 0.335, 0.35], hor: [0.42, 0.455, 0.45], exp: 1.16, sat: 0.98, lift: 0.006, bloom: 0.14, mist: 0.8, glow: 0.3 });
  if (s.snow && time !== "night") m.fog = t.fog.map((v, i) => v * 0.6 + [0.86, 0.88, 0.92][i] * 0.4);
  m.drift = s.drift === "none" && time === "night" ? "firefly" : s.drift;
  m.line = LINES[season][dark ? 1 : 0];
  m.label = `${NAMES[season]} · ${NAMES[time]}`;
  return m;
}
// The season and hour it is now, where the visitor is.
export function moodNow() {
  const d = new Date(), mo = d.getMonth(), h = d.getHours() + d.getMinutes() / 60;
  return { season: SEASONS[Math.floor(((mo + 10) % 12) / 3)], time: h < 5 ? "night" : h < 8 ? "dawn" : h < 16.5 ? "day" : h < 19 ? "dusk" : "night" };
}
