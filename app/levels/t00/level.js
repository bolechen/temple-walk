// The prologue, 云径禅寺, as the engine asks for a level (app/src/level.js; #369). Its plan is ./site.js; this file only
// gathers what the engine's parts need to know of it, so that none of them has to know the temple's terraces, bamboo or
// screen wall by name. The plan is imported through app/src/site.js, as everything else imports it, so that the unit
// tests' swap of the walker (tools/walk/swap-hook.mjs) still finds every import of it.
import { buildSite, createWalker, SITE, LEVELS, APPROACH, SCREEN, GROVE, terrain } from "../../src/site.js";
import { zoneBounds } from "../../src/score.js";

/** @type {import("../../src/level.js").Level} */
export default {
  id: "t00",
  build: buildSite,
  createWalker,
  land: terrain,
  // The far hills are laid round the walls and follow the first and the top terrace.
  backdrop: { site: SITE, terraces: [LEVELS[0], LEVELS[2]] },
  grove: { areas: GROVE.areas, keep: GROVE.keep },
  // The eye from behind him does not go into the bamboo, as it does not go into a wall (#515): where the grove grows, from a
  // metre under the land to the tops of the culms, under any part of the eye's sphere. The grove is drawn as culms and
  // cut-out sprays, which the eye's gathering passes over, so it is said here instead.
  eyeKeepOut: (x, y, z, r) => {
    const m = r;
    for (const [dx, dz] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m], [m * 0.7, m * 0.7], [-m * 0.7, m * 0.7], [m * 0.7, -m * 0.7], [-m * 0.7, -m * 0.7]]) {
      const px = x + dx, pz = z + dz;
      if (GROVE.grows(px, pz)) { const land = terrain(px, pz); if (y > land - 1 && y < land + GROVE.top) return true; }
    }
    return false;
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
  // The title page's foot: a region, never a real city, and one sentence that holds in every season (#445).
  how: { place: "江南 · 古道", line: "路在竹林里，寺在云里。" },
};
