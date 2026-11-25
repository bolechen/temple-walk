// 奉明寺 (T05), as the engine asks for a level (app/src/level.js; #409). Its plan is ./site.js, a white box for now: the
// court, the great hall's platform, the terrace and the flight, and the way in from the outer gate's place. The
// county is flat (docs/t05/SITE.md §4.1): no far hills, no bamboo, no censer. It keeps no place, plays no opening and
// raises no title of its own yet, and the prologue's music is not played here (score.js zoneOf with no zones).
import { buildSite, createWalker, COMPOUND, WAY } from "./site.js";

// J01, the first look of T05: an early-winter morning, clear and cold, no snow (docs/t05/ART.md §4.2, PRD.md §4). The sun is
// where #280's white box worked it out for 9:45 on a day in early December at 41.5° N: 17° up, 152° from north (a calculation, not a record), which in
// the plan's frame (north is -z, east +x) is toward the south-south-east. Its light is cold white, the sky's shade blue, the air
// clean (no layered mist, thin haze). The numbers other than the sun's position are the project's own, set against ART.md's words and
// judged on the named views (docs/t05/DECISIONS.md, 2026-11-24). Only winter by day is changed; the engine's other hours stand.
const J01_ELEV = (17 * Math.PI) / 180, J01_AZ = (152 * Math.PI) / 180;
const J01 = {
  sun: [Math.cos(J01_ELEV) * Math.sin(J01_AZ), Math.sin(J01_ELEV), -Math.cos(J01_ELEV) * Math.cos(J01_AZ)],
  sunCol: [1, 0.985, 0.95], sunI: 2.95, cloud: 0.12, snow: 0, wet: 0,
  hemiS: [0.74, 0.84, 1], hemiG: [0.3, 0.31, 0.3], hemiI: 1.1,
  fog: [0.66, 0.73, 0.8], fogD: 0.0058, zen: [0.27, 0.43, 0.72], hor: [0.78, 0.85, 0.92], haze: 0.8,
  exp: 1.1, bloom: 0.16, glow: 0.35, hal: 0.12, mist: 0.7, fogLayer: [0.15, -6, 20, 2],
  sh: [0.93, 1, 1.035], hi: [1.01, 1, 0.97], sat: 1,
  lut: { lift: [0, 0.002, 0.006], gamma: [1, 1, 1.01], gain: [1, 1, 1], sat: 1.02, shadow: [0, 0, 0.005], light: [0.004, 0.002, -0.003] },
  leaf: [1.75, 0.95, 0.5],   // dry earth and olive evergreens: what app/levels/t05/dry.js multiplies by on a dry day without snow
  drift: "none", line: "寒霜清晨，钟声独远",
};

/** @type {import("../../src/level.js").Level} */
export default {
  id: "t05",
  name: "奉明寺",   // docs/t05/DECISIONS.md §2, I18N.md: Fengming Temple
  names: { ja: "奉明寺", en: "Fengming Temple", ko: "奉明寺" },   // docs/t05/I18N.md §1 gives the Hangul reading; it is not in the Korean faces yet, so the hanja stand until tools/fonts.py --lang ko is run with the original TTFs (T05 lead);  here and not in app/locales, which production bundles whole
  seal: "奉明",
  build: buildSite,
  createWalker,
  // Its written plan (site.walk) is not kept up to what is drawn (docs/t05/DECISIONS.md, 2026-11-21): it is walked on the baked floor
  // whatever the address asks, and the plan serves only the eye before its hierarchy is built and the sound of his steps.
  writtenPlan: false,
  land: () => 0,                       // a flat plain: the land outside the walls is the court's own level
  backdrop: null,
  grove: null,
  propsAt: 0,
  zones: null,
  groveSound: () => 0,
  // Everything built that the following eye may meet: the compound and the way, with room round them.
  eyeBox: { x0: -COMPOUND.x - 20, x1: COMPOUND.x + 20, y0: -20, y1: 60, z0: COMPOUND.zN - 20, z1: WAY.zS + 20 },
  firstMood: { season: "winter", time: "day" },   // the first look is early winter by day, J01 (the owner, 2026-11-25: agreed that T05's first look is early winter by day; docs/t05/DECISIONS.md); an address, a crossing's carried visit or a hand's choice still comes before it
  eyeThickWalls: true,                 // its gable walls are 1 m thick: the following eye does not sweep through them when he turns out of an aisle (#562)
  moodFor: (season, time) => (season === "winter" && time === "day" ? J01 : null),
  hallTapZ: -Infinity,                 // no hall to tap yet
  // The sky's dome stands half way along the compound and the way, so that its far side is in view from either end.
  skyAt: [0, (COMPOUND.zN + WAY.zS) / 2],
};
