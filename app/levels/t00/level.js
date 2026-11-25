// The prologue, 云径禅寺, as the engine asks for a level (app/src/level.js; #369). Its plan is ./site.js; this file only
// gathers what the engine's parts need to know of it, so that none of them has to know the temple's terraces, bamboo or
// screen wall by name. The plan is imported through app/src/site.js, as everything else imports it, so that the unit
// tests' swap of the walker (tools/walk/swap-hook.mjs) still finds every import of it.
import { buildSite, createWalker, SITE, LEVELS, APPROACH, SCREEN, GROVE, START_SIGHT, START_CULM, terrain } from "../../src/site.js";
import { zoneBounds } from "../../src/score.js";

// How far into the grove's edge the eye that follows him may stand (#518: 0.5 m, where it stood before #295).
export const EYE_EDGE = 0.5;
/** The direction toward the sun at autumn dusk in the plan's frame (north is -z): 65° west of north, 18° above the horizon; how much brighter than the hour's own it burns; and the sky's own glow, bloom and disk, drawn down to a small tight halo so that the low sun does not wash the great hall's roof out (under 2% of the court's pixels at full white). The numbers come from the T4 scans in docs/t00/evidence/488-autumn-dusk-sun/. */
const AUTUMN_DUSK_SUN = [-0.8619, 0.309, -0.4019], AUTUMN_DUSK_SUN_K = 0.8, AUTUMN_DUSK_SKY = { glow: 0.1, bloom: 0.2, disk: 0.25 };

/** @type {import("../../src/level.js").Level} */
export default {
  id: "t00",
  name: "云径禅寺",
  seal: "云径",
  book: true,
  build: buildSite,
  createWalker,
  land: terrain,
  // The far hills are laid round the walls and follow the first and the top terrace.
  backdrop: { site: SITE, terraces: [LEVELS[0], LEVELS[2]] },
  grove: { areas: GROVE.areas, keep: GROVE.keep, clearUnder: GROVE.underClear, clearCulm: GROVE.cullSight, extraCulms: [START_CULM] },
  // The eye from behind him does not go into the bamboo, as it does not go into a wall (#515): where the grove grows more
  // than `EYE_EDGE` deep, from a metre under the land to the tops of the culms. The grove is drawn as culms and cut-out
  // sprays, which the eye's gathering passes over, so it is said here instead. Into its edge the eye may go that far, as
  // it went before #295 (by the ink-stone pool it then stood 1.99 m behind him, the art review's choice for #518); and in
  // the strip behind the start of the walk (the one #454 clears of culms) it is not kept out at all, so that the title,
  // the first picture after 入山 and the opening's last frame stand where they always stood, six metres back.
  eyeKeepOut: (x, y, z) => {
    if (Math.abs(x - APPROACH.xC) < START_SIGHT.hw && z > APPROACH.zC1 && z < APPROACH.zC1 + START_SIGHT.back) return false;
    if (!GROVE.grows(x, z)) return false;
    for (let k = 0; k < 8; k++) if (!GROVE.grows(x + Math.cos((k * Math.PI) / 4) * EYE_EDGE, z + Math.sin((k * Math.PI) / 4) * EYE_EDGE)) return false;
    const land = terrain(x, z); return y > land - 1 && y < land + GROVE.top;
  },
  // The mist and the props gather half way up the walled part of the axis.
  propsAt: (SITE.zN + SITE.zS) / 2,
  zones: zoneBounds(SITE, LEVELS, APPROACH, SCREEN),
  // Deepest in the bamboo on the way up, a little again beyond the tea, faint in the courts.
  groveSound: (x, z) => (z > SITE.fore - 6 ? Math.min(1, (z - SITE.fore + 6) / 10) : z < LEVELS[1].zN ? 0.55 : 0.12),
  // Everything built that the following eye may meet, from the summit's back wall to the foot of the path.
  eyeBox: { x0: -SITE.x - 30, x1: SITE.x + 30, y0: -90, y1: 90, z0: SITE.zN - 30, z1: APPROACH.end + 30 },
  // From the first court a tap on the great hall means "go to its door"; from the forecourt south of the gate it does not.
  hallTapZ: SITE.zS - 4,
  // The prologue keeps the visitor's place (yunjing.place.v1), plays its opening and raises its title (#385).
  keepsPlace: true,
  opening: true,
  title: true,
  // Autumn dusk keeps part of the first court in the low sun, as prototype 03 has it (#488): the hours' own sun for that
  // evening stands west-south-west, behind the walker's left shoulder, and the west halls, the cedars and the great hall put
  // the whole court in shade. This one stands low in the west-north-west of the plan (65° from north, 18° up, near where a
  // real autumn sunset falls in the walls' own frame): it slips between the great hall and the west halls, so bands of
  // sun lie across the paving and the tea house front, and the trees' long shadows cross them. Chosen by measuring the
  // lit share of three views over a scan of directions (`tools/sun-lit.cjs`); only the sun and the glow round it change.
  moodFor: (season, time, m) => (season === "autumn" && time === "dusk" ? { sun: AUTUMN_DUSK_SUN, sunI: m.sunI * AUTUMN_DUSK_SUN_K, ...AUTUMN_DUSK_SKY } : null),
  // The title page's foot: a region, never a real city, and one sentence that holds in every season (#445).
  how: { place: "江南 · 古道", line: "路在竹林里，寺在云里。" },
};
