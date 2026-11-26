// 奉明寺 (T05), as the engine asks for a level (app/src/level.js; #409). Its plan is ./site.js, a white box for now: the
// court, the great hall's platform, the terrace and the flight, and the way in from the outer gate's place. The
// county is flat (docs/t05/SITE.md §4.1): no bamboo, no censer, and no backdrop of mountains (the one low hill line far to the north and the town beyond the
// walls are the level's own, ./distance.js, revised 2026-11-25). It keeps no place, plays no opening and
// raises no title of its own yet, and the prologue's music is not played here (score.js zoneOf with no zones).
import { buildSite, createWalker, COMPOUND, WAY } from "./site.js";
import { PAGE } from "./page.js";
import ja from "./locales/ja.js";
import en from "./locales/en.js";
import ko from "./locales/ko.js";
import { XS, HALL } from "./hall.js";

// J01, the first look of T05: an early-winter morning, clear and cold, no snow (docs/t05/ART.md §4.2, PRD.md §4). The sun is
// where #280's white box worked it out for 9:45 on a day in early December at 41.5° N: 17° up, 152° from north (a calculation, not a record), which in
// the plan's frame (north is -z, east +x) is toward the south-south-east. Its light is cold white, the sky's shade blue, the air
// clean (no layered mist, thin haze). The numbers other than the sun's position are the project's own, set against ART.md's words and
// judged on the named views (docs/t05/DECISIONS.md, 2026-11-24). Only winter by day is changed; the engine's other hours stand.
// On 2026-11-25 the sky and the air were set against a photograph of the real temple on a clear morning after snow (internal
// reference, not shipped): a blue zenith over a horizon still pale, the far roofs clear, and the sun a little warmer and stronger on
// the walls than the sky's light, so the shadows read. The zenith, the haze (0.5) and the fog are the art director's numbers (#740):
// a dry early-winter clear day, between the T05 lead's research (a cold county, often a little haze) and the photograph's deep blue.
// The shade under the eaves keeps a little of the sky's cold: the sun is only a touch warm, the light thrown up from the court is
// cool, and the thin air left over the far roofs is a darker blue than the horizon, so the hall through the arch is not lifted by it.
const J01_ELEV = (17 * Math.PI) / 180, J01_AZ = (152 * Math.PI) / 180;
const J01 = {
  sun: [Math.cos(J01_ELEV) * Math.sin(J01_AZ), Math.sin(J01_ELEV), -Math.cos(J01_ELEV) * Math.cos(J01_AZ)],
  sunCol: [1, 0.975, 0.93], sunI: 3.2, cloud: 0.12, snow: 0, wet: 0,
  hemiS: [0.66, 0.79, 1], hemiG: [0.22, 0.26, 0.34], hemiI: 1.0,
  fog: [0.52, 0.61, 0.78], fogD: 0.0034, zen: [0.14, 0.28, 0.62], hor: [0.78, 0.85, 0.92], haze: 0.5,
  exp: 1.1, bloom: 0.16, glow: 0.35, hal: 0.12, mist: 0.35, fogLayer: [0.06, -6, 20, 2],
  sh: [0.93, 1, 1.035], hi: [1.01, 1, 0.97], sat: 1,
  lut: { lift: [0, 0.002, 0.006], gamma: [1, 1, 1.01], gain: [1, 1, 1], sat: 1.02, shadow: [0, 0, 0.005], light: [0.004, 0.002, -0.003] },
  leaf: [1.75, 0.95, 0.5],   // dry earth and olive evergreens: what app/levels/t05/dry.js multiplies by on a dry day without snow
  drift: "none", line: "寒霜清晨，钟声独远",
};

/** @type {import("../../src/level.js").Level} */
export default {
  id: "t05",
  name: "奉明寺",   // docs/t05/DECISIONS.md §2, I18N.md: Fengming Temple
  seal: "奉明",
  cardLink: false,   // no address or code on its pictures until the public page lists it (the lead, 2026-11-25); add it back when it does
  ownVerse: true,    // the card prints J01's own line in early winter by day, and no verse at any other hour (the art review, 2026-11-25)
  build: buildSite,
  createWalker,
  // The paving's mirror only where the stone is wet: on J01's dry stone it shows nothing (cam07 0.07/255, cam01 0.36/255 between drawn and not, SwiftShader)
  // and its pass costs 1.0 to 1.2 ms on a T4 (#722's breakdown; the T05 lead's rule of 2026-11-25: any view over 12 ms and it goes with #722)
  mirror: (m) => (m.wet || 0) > 0,
  // Its written plan (site.walk) is not kept up to what is drawn (docs/t05/DECISIONS.md, 2026-11-21): it is walked on the baked floor
  // whatever the address asks, and the plan serves only the eye before its hierarchy is built and the sound of his steps.
  keepsOwnPlace: true,                 // where he stood is kept under yunjing.levels.v1, apart from the prologue's keys (S4)
  page: PAGE,                          // its own page, kept beside its place (yunjing.levels.v1): the observation's stroke and the line copied from the stele (./page.js, src/levelpage.js)
  // One line said once as the walk begins, in the foot line: the first edition has no seals and no book yet (the lead's and the owner's step one, 2026-11-25). No temple's name in it.
  intro: "这座寺还在修建，眼下没有朱印，也没有朱印帐。慢慢走一走就好。",
  tr: { ja, en, ko },   // its own words in the other languages, kept with the level
  writtenPlan: false,
  land: () => 0,                       // a flat plain: the land outside the walls is the court's own level
  backdrop: null,
  grove: null,
  propsAt: 0,
  // Its sound field (docs/t05/SOUND.md §1; PRD.md §8): two layers, no melody. The court is everywhere; the great hall's box is the
  // inside of its walls, from its own numbers: the end and back walls' inner faces (a wall's thickness in from the outer face, which
  // lies `out` beyond the column line) and the front wall's (its outer face just behind the front column line, a thickness in). The
  // shell stands on its platform, so he is "in" it by where he stands, not by a door into a room (score.js `layerOf`).
  zones: { layers: { hall: { x0: XS[0] - HALL.out + HALL.wall, x1: XS[XS.length - 1] + HALL.out - HALL.wall, z0: -HALL.depth - HALL.out + HALL.wall, z1: HALL.front - HALL.wall } } },
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
