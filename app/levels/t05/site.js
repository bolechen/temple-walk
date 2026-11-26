// 奉明寺 (T05, the first chapter after the prologue), as a white box (#409, #422; docs/t05/PLAN.md items 5 and 6): the
// court between the Wuliang hall and the great hall, the great hall's 3 m platform, the terrace before it and the flight
// up, the hall's shell on the platform (./hall.js), walled round, and a paved way from the outer gate's place far to the
// south. The hall's seven Buddhas and the axis of gates and halls come in later items (7 to 10). Every size here, and whether it is a published measurement, a summary
// or our own proposal, is in docs/t05/SITE.md and docs/t05/SOURCES.md.
//
// Heights are taken from the court's paving (y = 0; SITE.md §4.2), so the platform, the terrace and the hall's floor are
// at +3.0. x runs east, z south; the great hall's front column line is z = 0.
import * as THREE from "three";
import { box, merge, mesh, stairGeo, stairProfile, BODY, CHEEK } from "../../src/geo.js";
import { createPlanWalker } from "../../src/plan-walker.js";
import { buildHall, OUTER, FILL, HALL_DOORS } from "./hall.js";
import { buildAltar, benchFigures } from "./altar.js";
import { buildAxis, HALL_HALF, LANE, AXIS_TREES } from "./axis.js";
import { buildTower } from "./tower.js";
import { buildDistance } from "./distance.js";
import { buildStele } from "./stele.js";
import { buildSurround, eaveCap } from "./surround.js";
import { buildFlora, buildTreeGround } from "./flora.js";
import { dryMaterials } from "./dry.js";
import { ridgeMaterials } from "./ridge.js";
import { debugGate } from "../../src/debuggate.js";

/** The great hall's platform (SITE.md §3.1, S03/S10: 55.80 × 25.91 m, about 3 m high), its south edge just before the front columns. 0.3 m deeper here (26.21): its back edge 0.2 m out to hold the back wall,
 * now 1.0 m thick and wrapping its 0.81 m columns, and its south edge 0.1 m out so that the front corner columns, 0.405 m
 * round, stand on it (#493). */
export const PLATFORM = Object.freeze({ w: 55.8, d: 26.21, h: 3.0, zS: 0.5 });
/** The terrace before it (SITE.md §3.1, S10/S22, a summary: about 37 × 15 m), from the platform's south edge. */
export const TERRACE = Object.freeze({ w: 37, d: 14.9, zN: 0.5, zS: 15.4 });   // (its north edge on the platform's south edge, #493)
/** The flight up the terrace's middle (SITE.md §6: proposed 8–10 m wide, about 18 steps; stairGeo lays 0.18 m steps, so 17). */
export const FLIGHT = Object.freeze({ w: 9, rise: PLATFORM.h });
/** The compound's walls (our proposal: OSM gives no outline for them, SITE.md §2); the south one stops at the Wuliang hall's platform, `gate` either side of the axis (./axis.js). */
export const COMPOUND = Object.freeze({ x: 42, zN: -40, zS: 62, h: 3.2, t: 0.8, gate: HALL_HALF });
/** The way from the outer gate's place (PLAN item 5: the arrival stays where it is, 0, +215), between the walls of ./axis.js: x is the walls' centre, wallH the forecourt's, south of the outer gate. */
export const WAY = Object.freeze({ x: LANE.hw, zS: 221, wallH: 1.2, t: LANE.t });
export const ARRIVE = [0, 215];
/**
 * The court's own trees (ours: "old pines and cypresses tower in the court" (docs/t05/SOURCES.md §15) is a news report quoted second-hand, with no place or number;
 * docs/t05/ART.md §4.2 "院树落叶，枝干清楚", the court's trees bare in winter): three pines and two old arborvitae (no pagoda trees inside the walls: none is on record, the general director's research of 2026-11-25), off the axis and out of cam01's and cam02's
 * pictures (two in the court's south corners), standing in square stone pits in the paving. The two on the east stand where the low morning sun (from the south-south-east, 17° up) lays their
 * shadows north-west across the court before cam01 (ART-SPEC: light that comes from somewhere; the art director's #665 note 4: shadows in the court wait for trees).
 */
/** @type {ReadonlyArray<any>} */
export const COURT_TREES = Object.freeze([
  Object.freeze({ kind: "pine", x: 27.5, z: 48.5, h: 10.4, r: 0.42 }),
  Object.freeze({ kind: "pine", x: 38.3, z: 58.3, h: 11.2, r: 0.4 }),   // (in the court's south-east corner, behind cam01: its shadow lies across the court before it; beside the platform it stood in cam01's picture or before the houses seen from B)
  Object.freeze({ kind: "pine", x: -29.5, z: 43.5, h: 10.2, r: 0.38 }),
  // north of the rows the temple's trees are broad pines, scattered, not in lines (the art director, #573 comment 7166589253, from the owner's photographs: round,
  // wide, layer on layer, of uneven heights, before the great hall's platform): the court's front corners by the terrace, one each side, framing the hall in cam01
  // below its eave line, and two more set about the court
  Object.freeze({ kind: "pine", old: true, x: -21.6, z: 16.9, h: 7.6, r: 0.42, base: 2.9, rx: 3.3 }),
  Object.freeze({ kind: "pine", old: true, x: 21.6, z: 16.4, h: 8.6, r: 0.44, base: 3.1, rx: 3.5 }),
  Object.freeze({ kind: "pine", x: -27.2, z: 31.4, h: 9.4, r: 0.4 }),
  Object.freeze({ kind: "pine", x: 31.8, z: 35.6, h: 8.7, r: 0.38 }),
]);
/**
 * Old arborvitae standing just outside the terrace's east wall, their crowns over its top (the art director, 2026-11-25, with A of #722's three: where the
 * east rows were thinned to let the sun onto the archway, the east side seen from the path is still a dark ground, but of crowns 13 m and more off the path
 * whose shadows fall short of the archway; no tall tree near the path). They stand on the town's ground, the crown from 4.6 m, over the wall's top at 4.2 m;
 * the three north of the archway are the ones seen from cam07, over the wall to the right of the archway (the four south of it stand beyond the gate's opening).
 */
export const EAST_WALL_TREES = Object.freeze([[16.4, 120.8, 13.6], [16.9, 124.4, 14.8], [16.3, 128.6, 13.2], [16.7, 132.3, 14.4], [16.3, 102.2, 14.6], [16.6, 106.2, 15.4], [16.2, 113.6, 14.2]].map(([x, z, h], i) => Object.freeze({ kind: "cypress", old: true, back: true, x, z, y: 0, h, r: 0.34 + 0.04 * (i % 2), env: Object.freeze({ base: 4.6, rx: 2.6 - 0.15 * (i % 2), ry: +((h - 4.6) / 2).toFixed(2) }) })));
/** A court tree's pit: edge stones `rim` wide standing `up` over the paving round a square of earth `side` across (two of the Yingzao Fashi's three-chi blocks, as the prologue's pits, three for a pine; by analogy, not a source). */
export const COURT_PIT = Object.freeze({ side: 1.86, pine: 2.79, rim: 0.2, up: 0.065 });   // (a pine's pit three blocks across: its flared trunk is the thickest in the court)   // (edge stones 0.2 m wide: at 0.15 their top was exactly the baked floor's foothold and one side counted as a low thing his shoes were kept off)
// Where each station stands. A (cam01) is 44 m out, where the nine bays fill about four fifths of a wide picture with the
// ridge whole, as the reference picture has them, and B (cam02) on the court's paving 12 m out from the flight's foot,
// the platform over his head and the eave columns and doors still in sight over the terrace's parapet (the lead's calls
// of 2026-11-21 on the art reviews of #425; DECISIONS.md, ART.md §5).
export const STATION = Object.freeze({ A: [0, 44], B: [0, 27], C: [0, 0.6], D: [19, -8], E: [0, -9], F: [0, -2] });
/** The parapet round the platform and the terrace (SITE.md §6: a railing or a low wall; a low wall here). */
const PARAPET = Object.freeze({ h: 0.85, t: 0.25 });

/**
 * How this level's stairs are laid (STAIR_STYLE in src/materials.js lists what can be changed and what it starts as). T05 has
 * no bamboo (docs/t05/ART.md §4.2: the court's trees drop leaves, there is "no T00 bamboo or cedar"), so no bamboo leaf lies on
 * a tread, and no moss grows (the art director, #486: an early-winter clear cold day, the south-facing flight is dry); the
 * stones' size (about 1.8 m a slab on the 9 m flight, none to be made smaller) and the cheek's run stay the prologue's until the
 * structure review has checked the Liao numbers.
 */
export const STAIR_STYLE = Object.freeze({ leaves: false, moss: false, crest: 0.25 });   // crest: the worn, polished lip at each tread's nose. 1 is the prologue's; in J01's real low light it made a full-width white line down the flight (up and down), 0.25 reads as a thin worn edge (docs/t05/DECISIONS.md, 2026-11-25)

/**
 * The lens a named view is seen through where it is not the fixed views' 52° from his eyes and 44° from behind him (app/yard.js `baseFov`: `?show=<name>` reads this table;
 * tools/cameras.mjs writes it into the manifest). cam06, back on the axis, is 65° from his eyes, as docs/t05/PRD.md §3 has it: the middle five of the seven and half of the one at
 * each end are in the picture (the reference picture's), where 52° holds three and a half either side, almost cam03's. From behind him it is 50°, the angle the walk is seen at
 * from there: 65° from his eyes is the walk's own angle, and the same reason makes 50° the walk's from behind (the T05 lead, after the art director's ruling, 2026-11-21).
 */
export const LENS = Object.freeze({ cam06: Object.freeze({ first: 65, third: 50 }) });

/**
 * The named views that stand inside the great hall, which a visitor cannot reach while its doors are shut (HALL_DOORS in ./hall.js; the first release,
 * docs/t05/DECISIONS.md, 先行版关殿门). They stay in `views` (the pictures are still drawn from them, and come back with the hall), but
 * `site.closedViews` tells the floor's bake not to ask that they be walked to (tools/walk/scene.mjs) and tools/cameras.mjs to mark them closed.
 */
export const INSIDE_VIEWS = Object.freeze(["d", "e", "f", "sakya", "cam04", "cam05", "cam06"]);

export function buildSite(M) {
  Object.assign((M.steps.userData.stairStyle ||= {}), STAIR_STYLE);   // (one page walks one level, so the material is this level's for good)
  const root = new THREE.Group();
  const walk = { solids: [], decks: [], ramps: [], posts: [], drops: [], roofs: [], rails: [] }, shade = [[], []];
  const stone = [], plaster = [], steps = [], earth = [];
  const P = PLATFORM, T = TERRACE, F = FLIGHT, C = COMPOUND, W = WAY, top = P.h;
  const pX = P.w / 2, pN = P.zS - P.d, tX = T.w / 2;

  // The platform and the terrace: two masses of stone, their tops one floor.
  stone.push(box(P.w, top, P.d, 0, top / 2, P.zS - P.d / 2), box(T.w, top, T.d, 0, top / 2, (T.zN + T.zS) / 2));
  walk.decks.push({ x0: -pX, x1: pX, z0: pN, z1: P.zS, h: top, floor: "stone" }, { x0: -tX, x1: tX, z0: T.zN - 0.01, z1: T.zS, h: top, floor: "stone" });
  shade[0].push({ x0: -pX, x1: pX, z0: pN, z1: P.zS }, { x0: -tX, x1: tX, z0: T.zN, z1: T.zS });

  // The flight down the terrace's south face, its head at the terrace's edge.
  const at = new THREE.Matrix4().makeTranslation(0, 0, T.zS);
  const flight = stairGeo(F.w, F.rise, { place: at }), run = flight.run ?? stairProfile(F.rise).run;
  steps.push(flight.geo); (root.userData.flights ||= []).push({ w: F.w, rise: F.rise, sides: [-1, 1], m: at });
  const pad = BODY + 0.02;   // the treads are walked clear of the cheek stones by his own width
  walk.ramps.push({ x0: -F.w / 2 + pad, x1: F.w / 2 - pad, z0: T.zS - 0.8, z1: T.zS + run + 0.3, base: 0, h: F.rise, low: [0, T.zS + run], high: [0, T.zS], floor: "stone" });
  for (const sx of [-1, 1]) walk.posts.push({ x0: sx > 0 ? F.w / 2 - BODY - 0.021 : -F.w / 2 - CHEEK - BODY, x1: sx > 0 ? F.w / 2 + CHEEK + BODY : -F.w / 2 + BODY + 0.021, z0: T.zS + 0.02, z1: T.zS + run + BODY + 0.06, h: top });

  // The parapet along every outer edge of the platform and the terrace, open where the flight comes up. Where the
  // hall's walls stand at the platform's edge (its back, its front between the terrace and the hall's ends) the wall is
  // the edge; the parapet runs only beside the hall's ends, where a walk goes round.
  const open = F.w / 2 + CHEEK, hX = OUTER.x;
  const runs = [
    [-pX, pN, -hX, pN], [hX, pN, pX, pN], [-pX, pN, -pX, P.zS], [pX, pN, pX, P.zS],   // the platform's back beside the hall, and its two ends
    [-pX, P.zS, -hX, P.zS], [hX, P.zS, pX, P.zS],                         // its front beside the hall
    [-tX, T.zN, -tX, T.zS], [tX, T.zN, tX, T.zS],                         // the terrace's sides
    [-tX, T.zS, -open, T.zS], [open, T.zS, tX, T.zS],                     // its front either side of the flight
  ];
  for (const [x0, z0, x1, z1] of runs) {
    const along = x0 === x1 ? "z" : "x", len = along === "x" ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const inX = along === "z" ? -Math.sign(x0) * PARAPET.t / 2 : 0, inZ = along === "x" ? (z0 === pN ? PARAPET.t / 2 : -PARAPET.t / 2) : 0;
    const cx = (x0 + x1) / 2 + inX, cz = (z0 + z1) / 2 + inZ;
    stone.push(along === "x" ? box(len, PARAPET.h, PARAPET.t, cx, top + PARAPET.h / 2, cz) : box(PARAPET.t, PARAPET.h, len, cx, top + PARAPET.h / 2, cz));
    const r = along === "x" ? { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: cz - PARAPET.t / 2, z1: cz + PARAPET.t / 2 } : { x0: cx - PARAPET.t / 2, x1: cx + PARAPET.t / 2, z0: Math.min(z0, z1), z1: Math.max(z0, z1) };
    walk.posts.push({ x0: r.x0 - BODY, x1: r.x1 + BODY, z0: r.z0 - BODY, z1: r.z1 + BODY, h: top });   // drawn wider by his width
    walk.rails.push({ ...r, bottom: top, top: top + PARAPET.h });
  }
  // Below the platform's edge the court is not walked into the stone: the mass itself, with his width round it.
  walk.solids.push({ x0: -pX - BODY, x1: pX + BODY, z0: pN - BODY, z1: P.zS + BODY, top }, { x0: -tX - BODY, x1: tX + BODY, z0: T.zN, z1: T.zS + BODY, top });

  // The compound's walls: plaster on a stone plinth, with the gap of a gate in the south one.
  const wall = (x0, z0, x1, z1, h, t) => {
    const along = z0 === z1 ? "x" : "z", len = along === "x" ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    plaster.push(along === "x" ? box(len, h, t, cx, h / 2, cz) : box(t, h, len, cx, h / 2, cz));
    stone.push(along === "x" ? box(len + 0.2, 0.355, t + 0.2, cx, 0.1725, cz) : box(t + 0.2, 0.355, len + 0.2, cx, 0.1725, cz));   // (the plinth goes 5 mm into the ground, so that its foot and the wall's are not two faces on one plane, #688)
    const r = along === "x" ? { x0, x1, z0: cz - t / 2, z1: cz + t / 2 } : { x0: cx - t / 2, x1: cx + t / 2, z0, z1 };
    walk.solids.push({ x0: r.x0 - BODY, x1: r.x1 + BODY, z0: r.z0 - BODY, z1: r.z1 + BODY, eyeTop: h + 0.3 });
    shade[along === "z" || z0 < 62 ? 0 : 1].push(r);
  };
  wall(-C.x, C.zN, C.x, C.zN, C.h, C.t); wall(-C.x, C.zN, -C.x, C.zS, C.h, C.t); wall(C.x, C.zN, C.x, C.zS, C.h, C.t);
  wall(-C.x, C.zS, -C.gate, C.zS, C.h, C.t); wall(C.gate, C.zS, C.x, C.zS, C.h, C.t);
  walk.decks.push({ x0: -C.x, x1: C.x, z0: C.zN, z1: C.zS + 0.2, h: 0, floor: "paving" });

  // The axis before the court (./axis.js): the way from the outer gate's place, the second terrace that the inner gate, the
  // archway and the Wuliang hall stand on, the walls round both, and the places held for the monument pavilion and the lamp.
  const ax = buildAxis(M, { C, W });
  stone.push(...ax.stone); plaster.push(...ax.plaster);
  for (const k of ["solids", "decks", "ramps", "posts", "roofs"]) walk[k].push(...ax.walk[k]);
  shade[0].push(...ax.shade[0]); shade[1].push(...ax.shade[1]);
  const paving = ax.paving;

  // The town's plain round the walls (the county is flat, SITE.md §4.1), laid outside the walls only: inside them is the paving.
  const lift = 0.06, flat = (x0, x1, z0, z1) => earth.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, lift, (z0 + z1) / 2));
  for (const r of ax.outside) flat(...r);

  // The great hall's shell (./hall.js): its walls, timber, columns and roof, and what the written plan's walker is told of it.
  const hall = buildHall(M), hp = hall.parts;
  for (const k of ["solids", "decks", "posts"]) walk[k].push(...hall.walk[k]);
  // The wall ring's timber (hall.js, `ring`) in meshes of their own beside the roof's timber: the brackets keep the walls' share of the sky, the purlins and beams rise above it.
  const splitRing = (/** @type {any[]} */ list, /** @type {any} */ mat, /** @type {any} */ own, /** @type {any} */ ringAo) => [[list.filter((g) => !hp.ring.has(g)), own], [list.filter((g) => hp.ring.has(g)), ringAo]].filter(([l]) => l.length).map(([l, o]) => mesh(merge(l), mat, o));
  // While the doors are shut nothing inside is to be read from outside, the bars of a window included (the art director's call on the first pictures): what is inside takes a seventh of the share it would, a deep dark behind the bars (HALL_DOORS; open, as it was).
  const inside = HALL_DOORS.shut ? (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z, nx = 0, ny = 1, nz = 0) => { const v = hall.shut(x, y, z, nx, ny, nz); return v < 0.999 ? v * 0.15 : v; } : hall.shut;
  const sh = { ao: inside };   // inside the walls the sky's light is mostly shut out (hall.js)
  const shT = { ao: hall.timberShut }, shRing = { ao: hall.ringShut }, shBeam = { ao: hall.beamShut }, shBoard = { ao: hall.boardShut };   // the timber overhead takes more of it (hall.js, TIMBER)
  root.add(...splitRing(hp.wood, M.woodX, shT, shRing), ...splitRing(hp.woodZ, M.woodZ, shT, shRing), mesh(merge(hp.frame), M.woodZ, shBeam), mesh(merge(hp.columns), M.woodV, sh), mesh(merge(hp.dark), M.woodX, sh),
    mesh(merge(hp.tiles), M.tile), mesh(merge(hp.underside), M.woodX, { ...shBoard, cast: false }), mesh(merge(hp.ridge), ridgeMaterials(M).ridge));   // (the eave's underside casts nothing the tiles over it do not: #742)   // (T05's own ridge clay, ./ridge.js)
  // The bracket sets (./dougong.js), the column-head beams over them and the eave purlin, in the ring's shade as the wall's own
  // timber is, each grain along its side. They stand in the eave's shadow over the wall, where the floor's mirror would show
  // next to nothing of them, so the mirror pass is not asked to draw them (the T05 lead's frame budget for #741's second PR): a
  // mesh of its own, kept apart from the merge, that draws nothing for a camera under the ground, which only the mirror's is.
  for (const [list, mat] of [[hp.bracketsX, M.woodX], [hp.bracketsZ, M.woodZ]]) {
    if (!list.length) continue;
    const m = mesh(merge(list), mat, shRing), g = m.geometry; m.userData.keep = true;
    m.onBeforeRender = (_r, _s, cam) => { if (cam.position.y < 0) g.setDrawRange(0, 0); else g.setDrawRange(0, Infinity); };
    m.onBeforeShadow = () => g.setDrawRange(0, Infinity);   // (the sun's shadow map, drawn on a change of mood, always takes them whole)
    root.add(m);
  }
  // The eave (./roof.js): the board along its edge and the small one at the flying rafters' end, the two layers of rafters and
  // the corner beams, in the shade the roof gives them; the round end tiles and the drip tiles along the edge, of the ridges' clay
  // and in the eave's shade as the rafters are (an end tile is the head of a tile, not a lamp: #742's art review).
  const eaveAo = { ao: hall.roof.ao, cast: false };
  root.add(mesh(merge([...hp.fascia, ...hp.step]), M.fascia, { ao: () => 0.8 }), mesh(merge([...hp.rafters, ...hp.flyers]), M.woodZ, eaveAo), mesh(merge(hp.beams), M.woodX, eaveAo),
    mesh(merge([...hp.ends, ...hp.drips]), ridgeMaterials(M).ends, eaveAo));
  shade[0].push(hall.box);
  // The murals' ground inside the walls: plaster, darkened by the hall's shut-out sky like everything inside, until the
  // walls are painted (ART.md, phase two).
  // The shut doors' leaves face the court: they take the open air's light, not the inside's (hall.js, HALL_DOORS).
  if (hp.leaves.length) root.add(mesh(merge(hp.leaves), M.woodV, { ao: () => 1 }), mesh(merge(hp.ledges), M.woodX, { ao: () => 1 }), mesh(merge(hp.iron), M.iron, { ao: () => 1, cast: false }));   // (the planks' vertical grain, the ledges across, the iron of the ring and the studs: as the prologue's shut doors, building.js)
  if (hp.windowShade.length) {   // (the windows of a shut hall: a sheet that casts the sun's shadow and draws nothing; hall.js)
    const veil = mesh(merge(hp.windowShade), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), { receive: false });
    veil.userData.keep = true; veil.userData.bake = false; root.add(veil);
  }
  root.add(mesh(merge(hp.mural), M.plaster(), sh), mesh(merge(hp.floor), M.stone, sh));
  // The hall's own walls in a mesh of their own, so that their inner faces take the inside's share of the sky as the murals'
  // ground does (merged with the court's walls they were lit as out of doors: the end walls' and the front wall's inner
  // faces read eight to ten times the back wall, the art review of #481); their outer faces lie outside the shut box.
  root.add(mesh(merge(hp.plaster), M.plaster(), sh));
  // The altar, the seven on it with their attendants, and the two kings at its ends (./altar.js), all in the hall's shut-out sky.
  const altar = buildAltar(), ap = altar.parts;
  walk.posts.push(...altar.walk.posts);
  // `?off=altar` leaves the altar, the figures, their halos and the kings undrawn (they are merged with the hall's own stone,
  // plaster and wood, so the page's `?off=` cannot reach them): what they cost a frame, measured apart (#493). Still walked round.
  const offAltar = typeof location !== "undefined" && (new URLSearchParams(location.search).get("off") || "").split(",").includes("altar");
  // The debug panel's 「物件」 (#684, src/objects-debug.js): where it is open, the seven are parts of their own and the houses outside the walls too, so that the panel
  // can draw one again (the hooks are `window.__t05Objects`); nowhere else, and the picture is the same either way. Read as `?off=altar` is.
  const bench = typeof location !== "undefined" && debugGate({ dev: !!import.meta.env?.DEV, hostname: location.hostname, search: location.search });
  const hooks = bench ? (/** @type {any} */ (globalThis).__t05Objects = /** @type {Record<string, any>} */ ({})) : null;
  if (!offAltar && !bench) root.add(mesh(merge(ap.stone), M.stone, sh), mesh(merge(ap.clay), M.plaster(), sh), mesh(merge(ap.halo), M.woodX, sh));
  if (!offAltar && bench) { const fg = benchFigures(M, altar, sh); root.add(mesh(merge(ap.stone), M.stone, sh), mesh(merge(fg.rest), M.plaster(), sh), fg.group); hooks.figures = fg; }
  const fills = hall.fill.map((/** @type {any[]} */ f) => {
    const [x, y, z, i, d, c] = /** @type {number[]} */ (f), aim = /** @type {number[] | undefined} */ (f[6]);
    const l = aim ? new THREE.SpotLight(c, 0, d, /** @type {number} */ (f[7] ?? 1.2), 1, 1.6) : new THREE.PointLight(c, 0, d, 1.6);
    l.position.set(x, y, z); l.userData.full = i; root.add(l);
    if (l instanceof THREE.SpotLight && aim) { l.target.position.set(aim[0], aim[1], aim[2]); root.add(l.target); }
    return l;
  });
  // Each frame (yard.js): the fill follows how far inside the eye is, eased, so that from the court the doorway stays dark
  // and walking in the hall's timber comes up out of the dark over two or three seconds. A still picture takes it settled.
  // (A jump of the eye, a door or a tool's pose, is a cut: it takes the light of where it lands at once.)
  const lit = { k: 0, at: /** @type {number[] | null} */ (null) };
  const tick = (dt, eye, still) => {
    const want = hall.within(eye.x, eye.y, eye.z), cut = !lit.at || Math.hypot(eye.x - lit.at[0], eye.y - lit.at[1], eye.z - lit.at[2]) > 1.5;
    lit.at = [eye.x, eye.y, eye.z];
    lit.k = still || cut ? want : lit.k + (want - lit.k) * (1 - Math.exp(-dt / FILL.ease));
    if (Math.abs(lit.k - want) < 1e-3) lit.k = want;
    for (const l of fills) l.intensity = l.userData.full * lit.k;
    return lit.k;
  };

  root.add(ax.group);
  // The stele in the monument pavilion, the steps up to it and the place where a line of it is copied (./stele.js; PRD.md §1.3 (a)).
  const st = buildStele(M); root.add(st.group);
  for (const k of ["solids", "decks", "ramps", "posts"]) walk[k].push(.../** @type {any} */ (st.walk)[k]);
  (root.userData.flights ||= []).push(...st.group.userData.flights);
  // The trees inside the walls (./flora.js): the axis's (./axis.js AXIS_TREES) and the court's, one set: the trunks in his way, with their written-plan
  // rectangles, the boughs and needles over his head. The court's stand in stone pits.
  const pitStones = [], pitEarth = [];
  for (const t of COURT_TREES) {
    walk.solids.push({ x0: t.x - t.r - BODY, x1: t.x + t.r + BODY, z0: t.z - t.r - BODY, z1: t.z + t.r + BODY, eyeTop: t.h * 0.42 });
    const { rim, up } = COURT_PIT, side = t.kind === "pine" || t.old ? COURT_PIT.pine : COURT_PIT.side, half = side / 2 + rim / 2, long = side + 2 * rim, h = up + 0.1, cy = up - h / 2;
    pitStones.push(box(long, h, rim, t.x, cy, t.z - half), box(long, h, rim, t.x, cy, t.z + half), box(rim, h, side, t.x - half, cy, t.z), box(rim, h, side, t.x + half, cy, t.z));
    pitEarth.push(new THREE.PlaneGeometry(side, side).rotateX(-Math.PI / 2).translate(t.x, 0.025, t.z));
  }
  const inner = buildFlora(M, [...AXIS_TREES, ...COURT_TREES.map((t) => { const h = Math.min(t.h, eaveCap(t.x, t.z)); return t.old ? { ...t, h, env: { base: t.base, rx: t.rx, ry: (h - t.base) / 2 } } : { ...t, h }; }), ...EAST_WALL_TREES], { name: "trees", cast: true, walk: true, chunk: (t) => (t.z < COMPOUND.zS + 8 ? "court" : "axis") });
  { const st = mesh(merge(pitStones), M.stone); st.userData.walk = "floor"; st.name = "court-pits-stones"; root.add(inner.group, st); }   // (a pit's edge stones are stood on, as a low curb is: the baked floor rises to their top within his shoes' reach)
  { const e = mesh(merge(pitEarth), dryMaterials(M).earth, { cast: false }); e.name = "court-pits-earth"; root.add(e); }   // (the pit's earth is floor, as the prologue's pits are: the edge stones are then a step with a foothold behind them, not a low thing his shoes are kept off)
  root.add(buildTreeGround([...AXIS_TREES, ...COURT_TREES]));   // fallen leaves and needles and the dark at each trunk's foot (./flora.js)
  const surround = buildSurround(M, C, { bench }); root.add(surround);
  // What was grown, for the tests and for the page (the `t05-treeseed` scenario compares the page's with Node's).
  const flora = { inner: { tris: inner.tris, hash: inner.hash, count: inner.census.length }, surround: { tris: surround.userData.flora.tris, hash: surround.userData.flora.hash, count: surround.userData.flora.census.length }, census: [...inner.census, ...surround.userData.flora.census] };
  if (typeof globalThis !== "undefined") /** @type {any} */ (globalThis).__flora = () => ({ inner: flora.inner, surround: flora.surround, tris: flora.inner.tris + flora.surround.tris }); if (hooks) hooks.houses = surround.userData.houses;   // the trees and low roofs of the town outside the walls (./surround.js, #548): nothing walked, nothing held
  // The old town's pagoda far to the west-south-west (./tower.js, #548 step two): a part of its own, left out by ?off=tower, nothing else reads it.
  const offTower = typeof location !== "undefined" && (new URLSearchParams(location.search).get("off") || "").split(",").includes("tower");
  if (!offTower) root.add(buildTower());
  // The middle town and the far layers beyond it (./distance.js, the art director's lines of 2026-11-25): the north hill line (`?off=farhills`), the town's middle band and the southern plain (`?off=farland`).
  root.add(buildDistance());
  // `?off=trees` (the page only, for measuring a frame's cost on a graphics card): every tree grown here and outside the walls left out; the ground under them stays.
  if (typeof location !== "undefined" && (new URLSearchParams(location.search).get("off") || "").split(",").includes("trees")) { const cut = []; root.traverse((/** @type {any} */ o) => { if (o.isMesh && /^(trees|surround-(near|far)-trees)-/.test(o.name)) cut.push(o); }); for (const o of cut) o.parent?.remove(o); }
  root.add(mesh(merge(stone), M.stone), mesh(merge(steps), M.steps), mesh(merge(plaster), M.plaster()));
  const land = mesh(merge(earth), dryMaterials(M).earth, { cast: false }); land.userData.walk = false; root.add(land);

  const buildings = [{ name: "台基", x0: -pX, x1: pX, z0: pN, z1: P.zS, y: 0 }, { name: "月台", x0: -tX, x1: tX, z0: T.zN, z1: T.zS, y: 0 }, { name: "大雄殿", ...hall.box, y: top }, ...ax.buildings];
  // Named views (shots.js draws each): the arrival, the two stations, and the court seen from the terrace.
  const views = {
    arrive: [ARRIVE[0], ARRIVE[1], 0, 0.05],
    a: [STATION.A[0], STATION.A[1], 0, 0.1],           // cam01: the whole front with its ridge, raised 6°
    "a-tall": [0, 30, 0, 0.17],                        // cam01 for a picture held upright: nearer, the middle bays from the platform's foot to the ridge, raised 10° (ART-SPEC.md: an upright picture has its own camera, not a crop)
    b: [STATION.B[0], STATION.B[1], 0, 0.244],         // cam02: out from the flight's foot, raised 14°: the steps, the platform over his head, the eave columns and the doors' dark
    c: [STATION.C[0], STATION.C[1], 0, 0.14],         // the threshold, raised 8° (cam03, PRD.md §3). Its still is taken in third person (&view=third): the following eye, a few steps behind him, has the door's jambs at the picture's edges; from his own eyes in the doorway they are beside him (DECISIONS.md, 2026-11-21)
    d: [STATION.D[0], STATION.D[1], -0.96, 0.09],      // down the east side, looking west across the hall (cam04's 305°)
    e: [STATION.E[0], STATION.E[1], 0, 1.15],          // under the roof, raised 66° (cam05; the art director, #549: from 3 m further south the heads of the three keep to the picture's lowest 18%)
    f: [STATION.F[0], STATION.F[1], 0, 0.17],
    ...ax.views,
    ...st.views,
    // The observation's two places, where its stroke is written (./page.js): his frame there and the eye on its shot (`?show=shot-p1a`).
    "shot-p1a": [STATION.A[0], STATION.A[1], 0, 0.05], "shot-p1b": [STATION.B[0], STATION.B[1], 0, 0.05],
    gateway: [0, C.zS + 6, 0, 0.08],
    terrace: [12, 8, -0.6, 0.05],
    corner: [12, 30, 0.36, 0.3],                       // the hall's south-east corner from the court: the eave's lift, the fanned rafters, the hip ridge and the east ornament (roof.js)
    eave: [16, 7, 0.4, 0.7],                           // up under the front eave near its east end, from the platform: the bracket sets, the column-head beams and the rafters (dougong.js)
    back: [0, 6, Math.PI, -0.08],
    // Shakyamuni at the west end, from the worship band 9.9 m before him and a little east of his middle, raised to his lap: his left hand
    // and his lotus seat are in view, which from the west aisle within 4.4 m of his middle his own right knee and arm hide (#370, #547).
    // Nothing (an attendant, a king, a column) stands between the eye and his seat or his lap (t05-plan.test).
    sakya: [-14.5, -7, -0.181, 0.4],
  };
  // The seven fixed views of the handoff (docs/t05/PRD.md §3, docs/t05/camera-manifest.json written by tools/cameras.mjs): cam01–cam06 are the six
  // stations' views above under the handoff's names, the same poses so that the two can never part; cam07 is the axis's own, in the inner gate's passage.
  Object.assign(views, { cam01: views.a, cam02: views.b, cam03: views.c, cam04: views.d, cam05: views.e, cam06: views.f });
  return {
    root, walk, shade, closed: [...ax.closed, ...hall.closed], closedViews: HALL_DOORS.shut ? [...INSIDE_VIEWS] : [], paving, hall: null, halls: [], buildings, lofts: {}, doorways: {}, views, viewUp: {}, lens: LENS,
    places: { ...st.places }, seats: [], drawnSeats: [], cedars: [], trees: [], flora, strikers: [], start: views.arrive, censer: null, sunFocus: [0, 10], fogShut: hall.fogShut, tick, lit,
  };
}

/** The walker of the written plan: the one that knows no level, over this plan's rectangles (app/src/plan-walker.js). */
export const createWalker = createPlanWalker;
