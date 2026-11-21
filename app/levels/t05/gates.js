// The three buildings of the axis before the court, as shells (docs/t05/PLAN.md item 9, issue #446): the outer gate, the
// inner gate and the Wuliang hall, each one `buildHall` (app/src/building.js) with its parameters: three bays of columns,
// bracket sets, a hip-and-gable roof, a passage through the middle bay front and back, and the bays either side shut.
// Nothing here is a Liao vocabulary (docs/t05/ARCHITECTURE.md §0 is about the great hall): these are Qing gate houses and a
// hall rebuilt in the Qing, on the same Song-style generator the prologue's gate is, which is what the owner's brief for this
// item asked for (item 9: "用 buildHall 的参数出"). Where each stands, and every number, is in axis.js and docs/t05/SOURCES.md §13.
//
// The platforms stand on the ground, 0.5 m for the outer gate and the terrace's +1.0 m for the other two, which are flush
// with the terrace they stand on (axis.js cuts the slab round them). Written plan: the building's own rectangles, moved to its
// place, with its platform as a mass whose top is a floor (app/src/plan-walker.js), and the rooms either side of the passage
// shut as walls, since the passage is the only way through.
import * as THREE from "three";
import { box, merge, mesh, BODY } from "../../src/geo.js";
import { buildHall, PURLIN } from "../../src/building.js";
import { buildPaifang } from "../../src/paifang.js";
import { buildWuliangFrame } from "./wuliang-frame.js";

// How high a ridge stands over the eave purlins on a hall (Yingzao Fashi, juan 5): a third of the distance between the front and back purlins.
const ju = (o) => (o.zs[0] - o.zs[o.zs.length - 1] + (2 * PURLIN * (o.cai || 0.21)) / 0.21) / 3;

/** The Wuliang hall's `buildHall` options (a table of axis.js's `HALL`), shared with the test that looks at its frame. @param {any} HALL */
export const hallOptions = (HALL) => ({ cai: 0.232, xs: [...HALL.xs], zs: [...HALL.zs], platH: HALL.platH, platOut: HALL.platOut, colTop: HALL.colTop, overhang: 2.2, G: HALL.G, lift: HALL.lift, liftLen: HALL.liftLen, crest: HALL.crest, rise: HALL.juzhe ? HALL.juzhe * (HALL.zs[0] - HALL.zs[HALL.zs.length - 1] + (2 * PURLIN * 0.232) / 0.21) : undefined, front: "pass", back: "pass", dark: false, lamps: false, steps: 0, stepsBack: HALL.stepsBack });

/**
 * Stand a building at (x, z) on ground at y0, facing south; its meshes in a group and its rectangles for the written plan.
 * @param {*} M @param {any} opts buildHall's options @param {[number, number]} at @param {number} y0
 */
function put(M, opts, [x, z], y0 = 0) {
  const b = buildHall(M, { ...opts, rise: opts.rise ?? ju(opts), ground: y0 });
  b.group.position.set(x, y0, z);
  const mv = (r) => ({ ...r, x0: r.x0 + x, x1: r.x1 + x, z0: r.z0 + z, z1: r.z1 + z }), pt = ([a, c]) => [a + x, c + z];
  const walk = {
    // The platform is a mass whose top is the floor (`own`: its own platform), as is each stair's side; without a `top` a solid is a wall.
    solids: b.walk.solids.map((r) => (r.h !== undefined ? { ...mv(r), top: r.h + y0 } : r.own ? { ...mv(r), top: b.platH + y0 } : mv(r))),
    decks: b.walk.decks.map((r) => ({ ...mv(r), h: r.h + y0 })),
    ramps: b.walk.ramps.map((r) => ({ ...mv(r), base: y0, low: pt(r.low), high: pt(r.high) })),
    posts: b.walk.posts.map((r) => (r.r !== undefined ? { ...r, x: r.x + x, z: r.z + z } : r.h === undefined ? mv(r) : { ...mv(r), eyeTop: r.h + y0 })),
    roofs: b.walk.roofs.map((r) => ({ ...mv(r), bottom: r.bottom + y0, inner: r.inner + y0, top: r.top + y0, floor: r.floor + y0, edge: r.edge + y0, body: r.body && mv(r.body), core: mv(r.core), crest: r.crest && r.crest.map(([cx, cy, cz]) => [cx + x, cy + y0, cz + z]) })),
  };
  return { b, walk, plat: mv(b.plat) };
}

/**
 * The shells. `P` is axis.js's table of where and how big (AXIS, GATE, HALL, FOOT), handed in so that this file imports no
 * level file: x = 0 on the axis, z south.
 * @param {*} M the level's materials
 * @param {{ AXIS: any, GATE: any, HALL: any, FOOT: any, SECOND: any, WICKET: any }} P
 */
export function buildShells(M, P) {
  const { AXIS, GATE, HALL, FOOT, SECOND, WICKET } = P;
  const group = new THREE.Group(), walk = { solids: [], decks: [], ramps: [], posts: [], roofs: [] }, closed = [], buildings = [], shade = [[], []];
  const take = (name, built, level, y) => {
    group.add(built.b.group);
    for (const k of Object.keys(walk)) walk[k].push(...built.walk[k]);
    walk.decks.push({ ...built.plat, h: built.b.platH + y, floor: "stone" });
    buildings.push({ name, ...built.plat, y });
    shade[level].push(built.plat);
  };
  // What shuts the rooms either side of a passage through the middle bay: for the written plan a wall each side, and, where the
  // drawn floor inside is open (a gate's bays are closed by their doors at the faces only), a rectangle he is kept out of.
  const sides = (at, xs, zs, planked) => {
    const mid = Math.floor((xs.length - 1) / 2), gap = (xs[mid + 1] - xs[mid]) / 2, hw = planked ? gap - (0.25 + 0.2 + BODY + 0.01) : gap - 0.15 - BODY;
    for (const sx of [-1, 1]) {
      const [a, c] = sx > 0 ? [hw, xs[xs.length - 1] + 0.2] : [-xs[xs.length - 1] - 0.2, -hw];
      walk.solids.push({ x0: a, x1: c, z0: at[1] + zs[zs.length - 1] - 0.2, z1: at[1] + zs[0] + 0.05 });
      if (planked) closed.push({ x0: sx > 0 ? at[0] + xs[mid + 1] + 0.25 : at[0] - xs[xs.length - 1] - 0.3, x1: sx > 0 ? at[0] + xs[xs.length - 1] + 0.3 : at[0] - xs[mid + 1] - 0.25, z0: at[1] + zs[zs.length - 1] + 0.05, z1: at[1] + zs[0] - 0.05, why: "the gate's shut side bays" });
    }
  };

  // ---- The gates: three bays, planked, the middle bay a passage, a platform and steps each way (the inner one flush with the terrace behind) ----
  const gate = { cai: 0.232, xs: [...GATE.xs], zs: [...GATE.zs], platOut: GATE.platOut, colTop: 4.3, overhang: 2.0, lift: GATE.lift, liftLen: GATE.liftLen, crest: GATE.crest, front: "pass", back: "pass", dark: false, timber: true };
  const outer = put(M, { ...gate, platH: 0.5, steps: GATE.steps, stepsBack: GATE.steps }, [0, AXIS.outerZ]);
  take("外山门", outer, 1, 0); sides([0, AXIS.outerZ], GATE.xs, GATE.zs, true);
  const inner = put(M, { ...gate, platH: HALL.platH, steps: GATE.steps, stepsBack: 0 }, [0, AXIS.innerZ]);
  take("内山门", inner, 1, 0); sides([0, AXIS.innerZ], GATE.xs, GATE.zs, true);

  // The wickets either side of the inner gate (SCOPE-OPTIONS.md §二 B: three bays "带两侧便门"): a small planked door kept shut, set in a niche
  // in the wall that closes the terrace's south end (axis.js cuts the niche): between two jambs, under a lintel, over a low stone sill, on the
  // side he sees it from. Outside that wall is the town, which is not built: there is nowhere for it to open on.
  {
    const W = WICKET, y = SECOND.y, zf = AXIS.innerZ - SECOND.wallT / 2, zb = zf + W.depth, wx = (GATE.xs[GATE.xs.length - 1] + GATE.platOut + SECOND.hw) / 2, leaf = [], frame = [], sill = [];
    for (const sx of [-1, 1]) {
      const x = sx * wx, mw = W.w + 2 * W.jamb;
      leaf.push(box(W.w, W.h, 0.1, x, y + W.h / 2, zb - 0.07), box(W.w, 0.12, 0.14, x, y + 0.9, zb - 0.1), box(W.w, 0.12, 0.14, x, y + 1.7, zb - 0.1));
      frame.push(box(mw, W.lintel, W.depth + 0.04, x, y + W.h + W.lintel / 2, zf + W.depth / 2 - 0.02), box(W.jamb, W.h, W.depth + 0.04, x - (W.w + W.jamb) / 2, y + W.h / 2, zf + W.depth / 2 - 0.02), box(W.jamb, W.h, W.depth + 0.04, x + (W.w + W.jamb) / 2, y + W.h / 2, zf + W.depth / 2 - 0.02));
      sill.push(box(mw, 0.12, W.depth, x, y + 0.06, zf + W.depth / 2));
    }
    group.add(mesh(merge(leaf), M.woodV), mesh(merge(frame), M.woodX), mesh(merge(sill), M.monolith));
  }

  // ---- The Wuliang hall: five bays, a passage through the middle one, the rooms either side walled off from it ----
  const hall = put(M, hallOptions(HALL), [0, AXIS.hallZ]);
  take("无量殿", hall, 0, 0);
  // Inside, two walls along the middle bay's columns close the side rooms (the exhibition of the third phase, SCOPE-OPTIONS.md (b)'s neighbours): the passage is the only floor.
  const wallH = HALL.platH + HALL.colTop, mid = Math.floor((HALL.xs.length - 1) / 2), ix = HALL.xs[mid + 1], t = 0.3, zN = HALL.zs[HALL.zs.length - 1], zS = HALL.zs[0];
  const room = merge([-1, 1].map((sx) => box(t, wallH - HALL.platH, zS - zN, sx * ix, (HALL.platH + wallH) / 2, (zS + zN) / 2 + AXIS.hallZ)));
  group.add(mesh(room, M.plaster()));
  sides([0, AXIS.hallZ], HALL.xs, HALL.zs, false);
  group.add(buildWuliangFrame(M, hall.b, HALL, AXIS.hallZ));   // overhead, the roof open to its timber, so that the passage's ceiling is not one black sheet

  // ---- The archway (docs/t05/PAIFANG.md): on the terrace between the inner gate and the hall, its posts' plane at AXIS.paifangZ, facing the way in ----
  {
    const y = SECOND.y, z = AXIS.paifangZ, pf = buildPaifang(M);
    pf.group.position.set(0, y, z); group.add(pf.group);
    for (const q of pf.walk.posts) walk.posts.push({ x0: q.x0, x1: q.x1, z0: q.z0 + z, z1: q.z1 + z, eyeTop: q.h + y });
    for (const r of pf.walk.roofs) walk.roofs.push({ ...r, z0: r.z0 + z, z1: r.z1 + z, bottom: r.bottom + y, inner: r.inner + y, top: r.top + y, core: { ...r.core, z0: r.core.z0 + z, z1: r.core.z1 + z } });
    buildings.push({ name: "牌坊", x0: pf.bounds.min.x, x1: pf.bounds.max.x, z0: pf.bounds.min.z + z, z1: pf.bounds.max.z + z, y });
  }
  return { group, walk, closed, buildings, shade };
}
