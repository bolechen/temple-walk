// The prologue, 云径禅寺, as the engine asks for a level (app/src/level.js; #369). Its plan is ./site.js; this file only
// gathers what the engine's parts need to know of it, so that none of them has to know the temple's terraces, bamboo or
// screen wall by name. The plan is imported through app/src/site.js, as everything else imports it, so that the unit
// tests' swap of the walker (tools/walk/swap-hook.mjs) still finds every import of it.
import { buildSite, createWalker, SITE, LEVELS, APPROACH, SCREEN, GROVE, terrain } from "../../src/site.js";
import { zoneBounds } from "../../src/score.js";

/** The direction toward the sun at autumn dusk in the plan's frame (north is -z): 15.7° west of north, 15° above the horizon. */
const AUTUMN_DUSK_SUN = [-0.2614, 0.2588, -0.9298];

/** @type {import("../../src/level.js").Level} */
export default {
  id: "t00",
  build: buildSite,
  createWalker,
  land: terrain,
  // The far hills are laid round the walls and follow the first and the top terrace.
  backdrop: { site: SITE, terraces: [LEVELS[0], LEVELS[2]] },
  grove: { areas: GROVE.areas, keep: GROVE.keep },
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
  // the whole court in shade. This one comes from the north, a little west of the axis (15.7° from north), 15° up: it
  // clears the west halls' roofs and the great hall's ridge at the south-west of the court, so a band of sun lies across
  // the paving toward the camera and the trees' long shadows cross it; the evening stays against the light, and the
  // novice's own shadow falls toward the camera. Chosen by measuring the share of lit paving over many directions (`tools/sun-lit.cjs`); nothing else of the mood changes.
  moodFor: (season, time) => (season === "autumn" && time === "dusk" ? { sun: AUTUMN_DUSK_SUN } : null),
  // The title page's foot: a region, never a real city, and one sentence that holds in every season (#445).
  how: { place: "江南 · 古道", line: "路在竹林里，寺在云里。" },
};
