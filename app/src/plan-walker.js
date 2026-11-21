// The walker of a written plan that knows no level (#409, the lead's call of 2026-11-21). The floor baked from what is
// drawn (shared/walk/<level>.bin, app/src/gridwalker.js) says where he walks; the grid walker still asks a written plan
// what the eye may not be in, what his steps sound on and where a railing stands. The prologue keeps its own written
// plan (app/levels/t00/site.js createWalker), which knows its terraces and its hillside. Every other level hands this one
// its rectangles and nothing else: no level's constants, no terrain, no terraces. Outside the floors it is given there
// is nothing to stand on.
//
// What a level gives it, in `site.walk` (the same shapes the prologue's plan writes, so a level can be laid out with the
// same helpers):
//   decks  [{ x0, x1, z0, z1, h, floor? }]       floors he may stand on, at height h; `floor` says what his steps sound
//                                                on ("paving", "stone", "wood", "path"; "path" if not said). The highest
//                                                deck over a spot is the floor there.
//   ramps  [{ x0, x1, z0, z1, base, h, low: [x, z], high: [x, z], floor? }]   a flight of steps from `low` (at base) to
//                                                `high` (at base + h), stood on tread by tread as stairProfile lays them
//   solids [{ x0, x1, z0, z1, top?, eyeTop? }]  what stops him (drawn already wider by his width, BODY): with `top`, a
//                                                mass whose top is a floor (a platform: walked on from its own floor,
//                                                kept out of below it); without, a wall, which the eye keeps out of up to
//                                                `eyeTop` (3.5 m if not said)
//   posts  [{ x0, x1, z0, z1 }]                 what stands in his way even on a floor (a parapet, a stair's cheek)
//   rails  [{ x0, x1, z0, z1, bottom, top }]    railings and parapets: the eye passes over them, a swing keeps clear
//   drops  []                                   porch edges written by hand (the grid walker finds its own)
// tests/unit/plan-walker.test.mjs holds it, and holds it to importing no level.
import { stairProfile } from "./geo.js";

/** @param {{ walk: { decks?: any[], ramps?: any[], solids?: any[], posts?: any[], rails?: any[], drops?: any[] } }} site */
export function createPlanWalker(site) {
  const { decks = [], ramps = [], solids = [], posts = [], rails = [], drops = [] } = site.walk;
  const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  let room = null, floor = null;
  // The floor here, if there is one: the highest deck, or the tread of a flight (`even`: the flight as the slope it follows, for the eye).
  function carved(x, z, even = false) {
    let height = null; floor = null;
    const take = (h, f) => { if (height === null || h > height) { height = h; floor = f || "path"; } };
    for (const d of decks) if (inRect(d, x, z)) take(d.h, d.floor);
    for (const r of ramps) if (inRect(r, x, z)) {
      const dx = r.high[0] - r.low[0], dz = r.high[1] - r.low[1], { count: n, nosing } = stairProfile(r.h), len = Math.hypot(dx, dz);
      const f = Math.min(1, Math.max(0, ((x - r.low[0]) * dx + (z - r.low[1]) * dz) / (len * len) + nosing / len));
      take((r.base || 0) + r.h * (even ? f : Math.ceil(f * n - 1e-6) / n), r.floor);
    }
    return height;
  }
  const post = (x, z) => posts.some((p) => inRect(p, x, z));
  // Indoors the plan is set aside: a room is one level floor inside four walls, with its own things in the way.
  const shut = (x, z) => x < room.x0 || x > room.x1 || z < room.z0 || z > room.z1 || room.solids.some((s) => inRect(s, x, z));
  return {
    kind: "old",
    drops,
    setRoom(r) { room = r || null; }, get room() { return room; },
    setLoft() {}, get loft() { return null; },   // no balcony walked round: a level that has one keeps its own plan for now
    heightAt(x, z) { return room ? room.y : carved(x, z) ?? 0; },
    floorAt(x, z) { if (room) return "room"; return carved(x, z) !== null ? floor : "earth"; },
    eyeAt(x, z) { return room ? room.y : carved(x, z, true) ?? 0; },
    landAt(x, z) { return room ? room.y : carved(x, z) ?? 0; },
    wall(x, z) { if (room) return shut(x, z); if (post(x, z)) return true; return carved(x, z) === null && solids.some((s) => inRect(s, x, z)); },
    railNear(x, y, z, m = 0) { if (room) return false; return rails.some((r) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m && y > r.bottom - m && y < r.top + m); },
    // The eye may be anywhere over the floors; it keeps out of a wall up to a little over its top and out of a mass below its floor.
    eyeShut(x, y, z) {
      if (room) return shut(x, z);
      for (const s of solids) if (inRect(s, x, z) && y < (s.top ?? s.eyeTop ?? 3.5)) return true;
      return false;
    },
    onGround: (x, z) => !room && carved(x, z) === null,
    onStairs: (x, z) => !room && ramps.some((r) => inRect(r, x, z) && carved(x, z) <= (r.base || 0) + r.h + 0.01),
    blocked(x, z) {
      if (room) return shut(x, z);
      if (post(x, z)) return true;
      const c = carved(x, z);
      if (c === null) return true;                           // nothing to stand on where no floor is given
      if (ramps.some((r) => inRect(r, x, z))) return false;  // a flight is cut through the mass it climbs; its cheeks are posts
      // A solid stops him, unless it is a mass and the floor here is its top.
      for (const s of solids) if (inRect(s, x, z) && !(s.top !== undefined && c >= s.top - 1e-6)) return true;
      return false;
    },
  };
}
