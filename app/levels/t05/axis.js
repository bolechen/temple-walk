// The axis of 奉明寺 before the court (T05, docs/t05/PLAN.md item 8, issue #435): the way in from the outer gate's place, the
// raised terrace that the inner gate, the archway and the Wuliang hall share, the walls round both, and the two places
// held for what comes later (the monument pavilion west of the terrace before the great hall, the lamp table inside its
// door). The order along the axis is the real temple's; where each stands is our proposal, since OSM outlines only the
// great hall and the Wuliang hall (docs/t05/SCOPE-OPTIONS.md §二 B, docs/t05/SITE.md §1.1, §4.2). Every number here, and
// how far it is a published measurement, a summary or our own, is in docs/t05/SOURCES.md §13.
//
// What this file draws is ground and stone, and, from ./gates.js, the three buildings on it: the outer gate, the inner gate
// and the Wuliang hall (item 9). The archway between the inner gate and the hall is item 10's: its place is held.
//
// Heights are from the court's paving (y = 0), as site.js has them; x east, z south, the great hall's front column line
// is z = 0 and the court's paving stops at the court's south wall, z = +62.
import * as THREE from "three";
import { box, merge, mesh, BODY } from "../../src/geo.js";
import { buildShells } from "./gates.js";
import { RIDGE } from "./hall.js";
import { dryMaterials } from "./dry.js";

/** Where each of the axis's buildings stands along it (z, x = 0). Proposals but for the Wuliang hall's z, which is OSM's (S26, an inference). */
/**
 * How far the inner gate (and cam07 in its passage) stands south of where the first white box put it (z = +120). From cam07 the Wuliang hall's
 * ridge hides the Great Hall's roof; the farther the eye from the hall, the lower the hall's ridge looks against the Great Hall's (#482). The
 * hall's ridge cannot come down much (docs/t05/DECISIONS.md: the roof's rise is the Yingzao Fashi's lowest ratio, 1:4, and the columns stay), so the gate
 * moves instead: the way between the gates is shorter by this much and the second terrace longer. The art director chose 20 m (13, 25 and 30 were measured too); `docs/t05/evidence/axis-482-r2/`.
 */
export const INNER_SHIFT = 20;
// The archway stands where the eye in the inner gate's passage looks under its lowest beams at the Great Hall's ridge: the line to the ridge rises about
// 7.5 degrees, so that 23 m before the archway it is 5.5 m up, under the 雀替 (5.76 m) that hang from the beam; 2 m nearer than +116, where it grazes them (#482).
export const AXIS = Object.freeze({ outerZ: 208, innerZ: 120 + INNER_SHIFT, paifangZ: 118, hallZ: 67.2 });

/** The second terrace (SITE.md §4.2: +1.0 m, a proposal; S22, a summary: the front gate, the archway and the Wuliang hall are one group on a higher terrace than the great hall's). */
export const SECOND = Object.freeze({ y: 1.0, hw: 14, zN: 62, wallT: 0.8, wallH: 3.2 });
/** The way between the gates: the walls' centres, how thick and how high they are (a proposal: SITE.md has no outline for them). */
export const LANE = Object.freeze({ hw: 8, t: 0.8, h: 3.2 });
/** The Wuliang hall (S03: 16.14 × 12.22 m; S26: OSM 17.2 × 13.0 m, centre z = +67.2, x = +2.6, which is put on the axis): five bays, columns on a 16.14 × 12.22 m plan. Bays and platform are a proposal. */
export const HALL = Object.freeze({
  xs: Object.freeze([-8.07, -5.57, -2.07, 2.07, 5.57, 8.07]),
  zs: Object.freeze([6.11, 2.04, -2.04, -6.11]),
  // The roof's rise is a quarter of the distance between the front and back eave purlins (`juzhe`, the Yingzao Fashi's lowest ratio, for a two-rafter house, which
  // the Liao halls come near: Fengguosi's 0.245; the structure review of #482), not a third as for a hall; the ornaments and the corners are smaller (the art director).
  platOut: 1.2, platH: SECOND.y, stepsBack: 4.0, colTop: 4.0, G: 3.3, liftLen: 2.7, lift: 0.15, crest: 1.7, juzhe: 0.25,
});
/** One gate house, as the outer and the inner gate are laid out: three bays, the platform's flanks meet the walls of the way. A proposal. */
export const GATE = Object.freeze({ xs: Object.freeze([-6.4, -2.2, 2.2, 6.4]), zs: Object.freeze([3, -3]), platOut: 1.2, steps: 3.8, lift: 0.2, liftLen: 2.7, crest: 1.5 });

/** The inner gate's wickets: a door leaf set in a niche in the terrace's south wall, between jambs and under a lintel. A proposal. */
export const WICKET = Object.freeze({ w: 1.5, h: 2.4, jamb: 0.2, lintel: 0.22, depth: 0.25 });
const half = (xs, out) => xs[xs.length - 1] + out;
/** The platforms' footprints, from the numbers above. */
export const FOOT = Object.freeze({
  hall: Object.freeze({ x0: -half(HALL.xs, HALL.platOut), x1: half(HALL.xs, HALL.platOut), z0: AXIS.hallZ - HALL.zs[0] - HALL.platOut, z1: AXIS.hallZ + HALL.zs[0] + HALL.platOut }),
  inner: Object.freeze({ x0: -half(GATE.xs, GATE.platOut), x1: half(GATE.xs, GATE.platOut), z0: AXIS.innerZ - GATE.zs[0] - GATE.platOut, z1: AXIS.innerZ + GATE.zs[0] + GATE.platOut }),
  outer: Object.freeze({ x0: -half(GATE.xs, GATE.platOut), x1: half(GATE.xs, GATE.platOut), z0: AXIS.outerZ - GATE.zs[0] - GATE.platOut, z1: AXIS.outerZ + GATE.zs[0] + GATE.platOut }),
});
/** The paved way down the middle of the way and of the terrace (art director's review of #457: a path, not wall-to-wall slabs; the target picture's is about 6 m) and the tree trunks that stand beside it. A proposal. */
export const PATH = Object.freeze({ hw: 3 });
// A trunk takes a radius of 0.25 to 0.5 m and carries a crown (an ellipsoid, a placeholder for the trees to come). They must not stand in a line of sight
// the axis is made for (art director's reviews of #464 and #482): from cam07, the eye in the inner gate's passage, none may stand in the lines to the Great Hall's
// ridge or its ornaments, nor in the archway's middle bay seen from there. Seeded, so that every build and every picture is the same.
const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const CAM07 = Object.freeze({ x: 0, y: SECOND.y + 1.6, z: AXIS.innerZ + 1 });
/** The lines cam07 must see along: to the Great Hall's ridge (every half metre, and the ornaments' fronts) and through the archway's middle bay (a grid of points in its opening, carried on to z = -20). */
export const SIGHTS = (() => {
  const lines = [], { rx, zm, height, ornamentTop } = RIDGE, eye = [CAM07.x, CAM07.y, CAM07.z];
  for (let x = -rx; x <= rx + 1e-9; x += 0.5) lines.push({ kind: "ridge", to: [x, height + 0.4, zm] });
  for (const s of [-1, 1]) lines.push({ kind: "ridge", to: [s * rx, ornamentTop - 0.05, zm + 0.64] });
  for (let x = -2.1; x <= 2.1 + 1e-9; x += 0.525) for (let y = SECOND.y + 0.3; y <= SECOND.y + 4.7; y += 0.55) {
    const k = (-20 - eye[2]) / (AXIS.paifangZ - eye[2]); lines.push({ kind: "door", to: [eye[0] + (x - eye[0]) * k, eye[1] + (y - eye[1]) * k, -20] });
  }
  return Object.freeze({ eye, lines: Object.freeze(lines) });
})();
/** Does the line from the eye to `to` pass through the tree: its crown (an ellipsoid) or its trunk (a cone from r at the foot to 0.8 r at 11 m)? */
export function treeBlocks(eye, to, t) {
  const d = [to[0] - eye[0], to[1] - eye[1], to[2] - eye[2]];
  { // crown
    const c = [t.x, t.y + (t.base ?? 7.6) + t.ry, t.z], o = [eye[0] - c[0], eye[1] - c[1], eye[2] - c[2]], k = [t.rx, t.ry, t.rx];   // (a crown's underside: its own `base`, or 7.6 m)
    const a = d.reduce((s, v, i) => s + (v / k[i]) ** 2, 0), b = 2 * d.reduce((s, v, i) => s + (v * o[i]) / k[i] ** 2, 0), cc = o.reduce((s, v, i) => s + (v / k[i]) ** 2, 0) - 1, disc = b * b - 4 * a * cc;
    if (disc >= 0) { const s0 = (-b - Math.sqrt(disc)) / (2 * a), s1 = (-b + Math.sqrt(disc)) / (2 * a); if (s1 > 0 && s0 < 1) return true; }
  }
  { // trunk: the circle of the trunk in plan, where the line is within the trunk's height (its radius at the foot, to be safe)
    const ox = eye[0] - t.x, oz = eye[2] - t.z, a = d[0] ** 2 + d[2] ** 2, b = 2 * (d[0] * ox + d[2] * oz), cc = ox * ox + oz * oz - t.r * t.r, disc = b * b - 4 * a * cc;
    if (disc >= 0 && a > 0) for (const s of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) { const y = eye[1] + d[1] * s; if (s > 0 && s < 1 && y > t.y && y < t.y + (t.base ?? 11)) return true; }
  }
  return false;
}
const clear = (t) => !SIGHTS.lines.some((l) => treeBlocks(SIGHTS.eye, l.to, t));
/**
 * The two lines kept for the terrace's rows of old arborvitae (the art director, 2026-11-25, when #482/#492's lines were set aside for this stretch):
 * the archway's middle bay shows the hall (every `door` line), and the middle 60% of the hall's ridge is not stopped (the ornaments at its ends may be).
 */
export const KEPT_SIGHTS = Object.freeze(SIGHTS.lines.filter((l) => l.kind === "door" || (l.kind === "ridge" && Math.abs(l.to[0]) <= 0.6 * RIDGE.rx && l.to[1] < RIDGE.ornamentTop - 1)));
const keptClear = (t) => !KEPT_SIGHTS.some((l) => treeBlocks(SIGHTS.eye, l.to, t));
/** No tree within 17 m of the archway, north or south, whose trunk or crown comes within 8 m of the axis: such crowns stood behind its ridges seen from cam07 and from the hall, like a pair of ears (the T05 lead's review of #492; a trunk at 8 m with a crown 3 m wide still did). */
export const ARCHWAY_CLEAR = Object.freeze({ z: 17, x: 8 });
export const nearArchway = (t) => Math.abs(t.z - AXIS.paifangZ) < ARCHWAY_CLEAR.z && Math.abs(t.x) - t.rx < ARCHWAY_CLEAR.x;
/**
 * The east rows' trees left out so that the low winter sun reaches the archway's front (#722's first art review, the art director's choice of 2026-11-25,
 * A of three tried): J01's sun stands at 152°, 17° up, almost straight up the axis from the gate, so any tall crown near the path on the east side of this
 * stretch lays its shadow over the archway's middle bay. Of the east eight the inner row's second to fourth and the outer row's third go: the bay is then
 * lit over 55% of it (`t05-axis`), its left half in the sun and its right in the trees' shade, light that comes from somewhere. The west rows stand whole.
 */
export const SUNWARD_GAP = Object.freeze(["inner1", "inner2", "inner3", "outer2"]);
/** J01's sun (level.js: 152°, 17° up), and the archway's middle bay its rays must reach: its front, 2 m either side of the axis, 1.5 to 8.5 m up. */
export const SUN = (() => { const el = (17 * Math.PI) / 180, az = (152 * Math.PI) / 180; return Object.freeze([Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]); })();
const BAY = (() => { const pts = []; for (let x = -2; x <= 2.001; x += 0.5) for (let y = 1.5; y <= 8.5; y += 0.5) pts.push([x, y, AXIS.paifangZ + 0.6]); return pts; })();
/** Whether a tree's crown stops none of the sun's rays to the archway's middle bay. */
export const sunClear = (t) => { const w = { ...t, rx: t.rx + SUN_MARGIN, ry: t.ry + SUN_MARGIN }; return BAY.every((P) => !treeBlocks(P, P.map((v, i) => v + SUN[i] * 120), w)); };
/** How far past its crown a tree's shadow still darkens (the soft shadow's half-shade, as the T4 shows it): the crown is cleared by this much more. */
const SUN_MARGIN = 0.8;
/**
 * Where the east outer row's last tree stands along the axis: north of the line the check walks across the gate's foot (z 132.8), not south of it as the
 * west's does. By the wall its crown is narrowed to 1.4 m and still the low sun's rays to the archway's east middle post (x 2.4, its face 2.65 m out)
 * pass through it south of that line; the T4 of 2410f50 showed that post in its shade once the near crowns were drawn as whole masses (#722).
 */
const EAST_LAST = 131.5;
/** How far out an east tree may step: its trunk a metre and a half inside the terrace's east wall. */
const SUN_WALL = SECOND.hw - SECOND.wallT / 2 - 1.5;
const grow = () => {
  const rnd = seeded(482), out = [], rr = () => +(0.25 + rnd() * 0.25).toFixed(2), crown = () => ({ rx: +(2.7 + rnd() * 0.9).toFixed(2), ry: +(2.1 + rnd() * 0.7).toFixed(2) });
  const add = (tree, push) => { for (let k = 0; k <= 7; k++) { const t = { ...tree, x: +(tree.x + Math.sign(tree.x) * push * k).toFixed(2) }; if (clear(t) && !nearArchway(t)) { out.push(Object.freeze(t)); return; } } };   // moved out until it stands clear (of the lines of sight and of the archway's neighbourhood), else left out
  // the way between the gates: pairs about 9 m apart, each off its place a little, two places left empty
  const lane = []; for (let z = FOOT.inner.z1 + 7.8; z <= FOOT.outer.z0 - 8; z += 9) lane.push(z);
  lane.forEach((z, n) => { for (const sx of [-1, 1]) { const dz = (rnd() * 2 - 1) * 0.8, dx = (rnd() * 2 - 1) * 0.5, r = rr(), c = crown(); if ((sx === 1 && n === 2) || (sx === -1 && n === 4)) continue; add({ x: sx * (5.5 + dx), z: +(z + dz).toFixed(2), y: 0, r, ...c }, 0.4); } });
  // The stretch between the inner gate and the archway (the art director, 2026-11-25, after the concept picture for cam07 and then the owner's photographs,
  // #573 comment 7166589253: about eight to ten a side in the real temple, conical, dark, crown against crown, two continuous dark walls seen from above, a
  // second row outside them): old arborvitae in two staggered rows each side, the inner 2.2 to 2.8 m off the path's edge, the outer about 5.5 m, trunks about
  // 2.8 m apart along each, 0.6 to 0.9 m through, 14 to 18 m tall, the crowns from 3.5 to 4.5 m up and 5 to 6 m across. Our stretch is shorter than the
  // temple's (the inner gate stands 20 m south of the first white box, INNER_SHIFT): between the archway's roof (to z 120) and the gate's eave (from z 134.7,
  // 4.75 m up) a crown has about eleven metres, so the rows are eight a side in two lines rather than one long one; the last of each outer row stands beyond
  // the eave's width, nearer the gate. The two kept lines (KEPT_SIGHTS) push a tree out if it stops one.
  const SOUTH = { inner: [123.2, 126.0, 128.9, 131.6], outer: [124.5, 127.3, 130.1, 134.3] };   // (the last of each outer row past the eave's width and past the line the check walks across the terrace at the gate's foot, z 132.8; on the east, where the sun comes from, it stands north of that line instead, EAST_LAST)
  for (const sx of [-1, 1]) for (const row of /** @type {const} */ (["inner", "outer"])) for (const [k, z0] of SOUTH[row].entries()) {
    const r = +(0.3 + rnd() * 0.15).toFixed(2), h = +(14 + rnd() * 4).toFixed(2), base = +(3.5 + rnd()).toFixed(2), rx = +(2.55 + rnd() * 0.45).toFixed(2), ry = +((h - base) / 2).toFixed(2);
    const x = row === "inner" ? PATH.hw + 2.2 + rnd() * 0.6 : k === 3 ? 11.9 : PATH.hw + 5.3 + rnd() * 0.6, z = +((sx > 0 && row === "outer" && k === 3 ? EAST_LAST : z0) + (sx < 0 ? 0.35 : -0.2) + 0.3 * (rnd() - 0.5)).toFixed(2);
    if (sx > 0 && SUNWARD_GAP.includes(`${row}${k}`)) continue;   // (drawn after its numbers, so that every other tree keeps its own)
    // an east tree kept steps out until its crown stops none of the sun's rays to the archway's middle bay, its crown narrowing by the wall if it must
    const sunward = sx > 0;
    for (let j = 0; j <= 40; j++) { const xj = Math.min(x + 0.3 * j, SUN_WALL), narrow = sunward ? Math.max(1.4, rx - Math.max(0, x + 0.3 * j - SUN_WALL) * 0.5) : rx; const t = { x: +(sx * xj).toFixed(2), z, y: SECOND.y, r, rx: +narrow.toFixed(2), ry, base, h, old: true, kind: "cypress", back: row === "outer", near: true }; if (keptClear(t) && (!sunward || sunClear(t) || narrow <= 1.4)) { out.push(Object.freeze(t)); break; } }
  }
  // North of the archway to the Wuliang hall (the same comment, from the owner's photograph 11): not rows of cypress but broad pines, scattered, their crowns
  // round, wide and layer on layer, of uneven heights, standing where no row would put them. Six, three a side, pushed out of the kept lines as the cypresses are.
  const PINES = [[-7.6, 109.4, 11.6], [8.9, 106.0, 13.2], [-10.4, 95.8, 12.4], [7.2, 92.2, 10.8], [-8.1, 84.4, 13.8], [10.6, 80.8, 12.0]];
  for (const [px, pz, h] of PINES) {
    const r = +(0.32 + rnd() * 0.12).toFixed(2), base = +(3.0 + rnd() * 0.8).toFixed(2), rx = +(3.4 + rnd() * 0.8).toFixed(2), ry = +((h - base) / 2).toFixed(2);
    for (let j = 0; j <= 16; j++) { const t = { x: +(px + Math.sign(px) * 0.3 * j).toFixed(2), z: pz, y: SECOND.y, r, rx, ry, base, h, old: true, kind: "pine" }; if (keptClear(t)) { out.push(Object.freeze(t)); break; } }
  }
  return Object.freeze(out);
};
export const TRUNKS = Object.freeze({ h: 11, canopyBase: 7.6, list: grow() });
/** What each of the axis's trees is grown as: a cypress along the way between the gates; on the terrace a pine or a cypress, by turns down each side (ours). */
/** The way's arborvitae (the art director, 2026-11-25): narrow columns branched from low, the needles from `crownFrom` m up, `radius` round at most, `height` tall (6 to 10 m); the views along the axis are all north of them, so no crown base is asked of them. */
export const WAY_CYPRESS = Object.freeze({ crownFrom: 2.6, radius: 1.2, height: [8.2, 9.8] });   // (`crownFrom` is where the lumps' middles start: their undersides come to about 2 m)
/** The axis's trees as ./flora.js grows them: on the terrace each crown in its ellipsoid over a clean bole; along the way a low-branched column (WAY_CYPRESS). */
const way01 = (t) => { const v = Math.sin(t.x * 12.9898 + t.z * 78.233 + 14 * 37.719) * 43758.5453; return v - Math.floor(v); };
export const AXIS_TREES = Object.freeze(TRUNKS.list.map((t) => Object.freeze(t.y === 0
  ? { kind: "cypress", x: t.x, z: t.z, y: t.y, h: +(WAY_CYPRESS.height[0] + (WAY_CYPRESS.height[1] - WAY_CYPRESS.height[0]) * way01(t)).toFixed(2), r: Math.min(t.r, 0.3), crownFrom: WAY_CYPRESS.crownFrom, crownR: Math.min(WAY_CYPRESS.radius, Math.abs(t.x) - PATH.hw - 1 - 0.2) }   // (its crown's edge at least a metre from the paved path's: the lumps reach a little past the radius)
  : { kind: t.kind || "cypress", x: t.x, z: t.z, y: t.y, h: t.h, r: t.r, old: true, back: !!t.back, near: !!t.near, env: Object.freeze({ base: t.base, rx: t.rx, ry: t.ry }) })));
/** Half the hall's platform: where the court's south wall meets the hall. */
export const HALL_HALF = FOOT.hall.x1;

/** The monument pavilion's form (white box, own sizes: SOURCES.md): base height, column height and radius, their span centre to centre, the tie-beam's depth, how far the roof's edge reaches from the middle, and the pyramid's height. */
export const MONUMENT_FORM = Object.freeze({ base: 0.45, column: 3.0, colR: 0.17, span: 3.1, beam: 0.3, eave: 2.5, roofH: 2.0 });
/**
 * The monument's stele (docs/t05/SOURCES.md): the shaft and the head in the Yingzao Fashi's proportions for a bixi aozuo stele (chapter 3: the shaft 4/10 wide and 1.5/10 thick
 * to every unit of its length, the head 0.44 square-wide and 0.18 thick, under it a cloud plate 0.15 of the shaft's width high: read), with no tortoise. The shaft's
 * length is kept at the 2.3 m the white box had; the head's crown (a plain block under a low arch, in place of the six
 * entwined dragons and the seal-script panel) and its height are the white box's own.
 */
export const STELE = (() => { const L = 2.3, w = 0.4 * L, cloud = 0.15 * w, block = 0.22, arch = 0.12; return Object.freeze({ L, w, t: 0.15 * L, headW: 0.44 * L, headT: 0.18 * L, cloud, block, arch, headH: cloud + block + arch }); })();
/** The monument pavilion's place (月台西; ARCHITECTURE.md §3.2: 4–5 m square, off the 20 m middle way), against the terrace's west parapet, moved out 2.25 m from the hall (z 7.9 to 12.4) so that its eave stands clear of the great hall's (the structure review of #573, second batch). Held, not built. */
export const MONUMENT = Object.freeze({ x0: -18.25, x1: -13.75, z0: 7.9, z1: 12.4, y: 3.0 });
/** The lamp table's place inside the great hall's door (SCOPE-OPTIONS.md (b)): a low table on the floor against the front wall, in the bay east of the three doors. Held, not built. */
export const LAMP = Object.freeze({ x: 11.3, z: -1.2, y: 3.0, w: 1.4, d: 0.6, h: 0.85 });

const FAR = 3000;

/**
 * The slab of a terrace with the platforms of buildings cut out of it: boxes of a given top, whose faces never share a
 * plane with a platform's own.
 */
export function slabAround(rect, holes, top) {
  const zs = [...new Set([rect.z0, rect.z1, ...holes.flatMap((h) => [h.z0, h.z1]).filter((z) => z > rect.z0 && z < rect.z1)])].sort((a, b) => a - b), out = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const za = zs[i], zb = zs[i + 1], zm = (za + zb) / 2;
    let open = [[rect.x0, rect.x1]];
    for (const h of holes) if (zm > h.z0 && zm < h.z1) open = open.flatMap(([a, b]) => (h.x1 <= a || h.x0 >= b ? [[a, b]] : [[a, Math.min(b, h.x0)], [Math.max(a, h.x1), b]])).filter(([a, b]) => b - a > 1e-6);
    for (const [a, b] of open) out.push(box(b - a, top + 0.005, zb - za, (a + b) / 2, (top - 0.005) / 2, zm));   // (5 mm into the ground, below the walls' feet, #688)
  }
  return out;
}

/**
 * The axis as the site takes it: geometry by material (stone, plaster, steps), the written plan's rectangles, the paving
 * strip of the way, the plain outside the walls, named views, and a group for the two places held.
 * @param {*} M the level's materials
 * @param {{ C: { x: number, zN: number, zS: number, t: number }, W: { x: number, zS: number, wallH: number, t: number } }} at the court's walls and the way's end, which site.js owns
 */
export function buildAxis(M, { C, W }) {
  const stone = [], plaster = [], shade = [[], []];
  const walk = { solids: [], decks: [], ramps: [], posts: [], roofs: [] };
  const top = SECOND.y;

  // A wall between two points, from the ground to h. Plaster on a stone plinth, with the written plan's rectangle (drawn wider by his width).
  const wall = (x0, z0, x1, z1, h, t, into, niches = []) => {
    const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (alongX && niches.length) {
      // A recess in the north face (the terrace's side) for each niche: the wall in full thickness either side and over it, the back part below.
      let a = x0;
      for (const n of [...niches].sort((p, q) => p.x - q.x)) {
        plaster.push(box(n.x - n.w / 2 - a, h, t, (a + n.x - n.w / 2) / 2, h / 2, cz), box(n.w, h - n.top, t, n.x, (n.top + h) / 2, cz), box(n.w, n.top, t - n.depth, n.x, n.top / 2, cz + n.depth / 2));
        a = n.x + n.w / 2;
      }
      plaster.push(box(x1 - a, h, t, (a + x1) / 2, h / 2, cz));
    } else plaster.push(alongX ? box(len, h, t, cx, h / 2, cz) : box(t, h, len, cx, h / 2, cz));
    stone.push(alongX ? box(len + 0.2, 0.355, t + 0.2, cx, 0.1725, cz) : box(t + 0.2, 0.355, len + 0.2, cx, 0.1725, cz));   // (the plinth goes 5 mm into the ground, so that its foot and the wall's are not two faces on one plane, #688)
    // a coping on the wall's top (art director's review of #457: the wall takes a cap, not bays)
    stone.push(alongX ? box(len + 0.1, 0.16, t + 0.24, cx, h + 0.08, cz) : box(t + 0.24, 0.16, len + 0.1, cx, h + 0.08, cz));
    const r = alongX ? { x0, x1, z0: cz - t / 2, z1: cz + t / 2 } : { x0: cx - t / 2, x1: cx + t / 2, z0, z1 };
    walk.solids.push({ x0: r.x0 - BODY, x1: r.x1 + BODY, z0: r.z0 - BODY, z1: r.z1 + BODY, eyeTop: h + 0.3 });
    shade[into].push(r);
  };
  // ---- The second terrace: the slab, the two platforms cut out of it, and their steps ----
  const T = { x0: -SECOND.hw, x1: SECOND.hw, z0: SECOND.zN, z1: AXIS.innerZ + SECOND.wallT / 2 };
  // (Under the walls the slab stops a hair short of their outer faces and of the side walls' ends, and it reaches a hair into the
  // platforms it is cut round: on those planes it flickered against the walls' own faces and ends, #688.)
  const into = (f) => ({ x0: f.x0 + 0.003, x1: f.x1 - 0.003, z0: f.z0 + 0.003, z1: f.z1 - 0.003 });
  stone.push(...slabAround({ ...T, z0: T.z0 - 0.003, z1: T.z1 - 0.003 }, [into(FOOT.hall), into(FOOT.inner)], top));
  walk.decks.push({ ...T, h: top, floor: "stone" });
  // The three buildings (./gates.js): each on its own platform, which the slab is cut round; the hall's back steps lead down into
  // the court, the inner gate's front steps down into the way.
  const sh = buildShells(M, { AXIS, GATE, HALL, FOOT, SECOND, WICKET });
  for (const k of Object.keys(walk)) walk[k].push(...sh.walk[k]);
  shade[0].push(...sh.shade[0]); shade[1].push(...sh.shade[1]);

  // ---- Walls: the terrace's two sides and the stub either side of the gate; the way's two sides; the forecourt's, low, and the wall that closes it ----
  const wt = SECOND.wallT, wh = top + SECOND.wallH, gx = FOOT.inner.x1;
  wall(-SECOND.hw, SECOND.zN, -SECOND.hw, AXIS.innerZ, wh, wt, 0); wall(SECOND.hw, SECOND.zN, SECOND.hw, AXIS.innerZ, wh, wt, 0);
  // (the wickets of the inner gate are niches in these two stubs, ./gates.js fits their doors)
  const wx = (gx + SECOND.hw) / 2, niche = (x) => ({ x, w: WICKET.w + 2 * WICKET.jamb, top: SECOND.y + WICKET.h + WICKET.lintel, depth: WICKET.depth });
  wall(-SECOND.hw - wt / 2, AXIS.innerZ, -gx, AXIS.innerZ, wh, wt, 0, [niche(-wx)]); wall(gx, AXIS.innerZ, SECOND.hw + wt / 2, AXIS.innerZ, wh, wt, 0, [niche(wx)]);
  for (const sx of [-1, 1]) {
    wall(sx * LANE.hw, AXIS.innerZ + wt / 2, sx * LANE.hw, AXIS.outerZ, LANE.h, LANE.t, 1);
    wall(sx * LANE.hw, AXIS.outerZ, sx * LANE.hw, W.zS, W.wallH, W.t, 1);
  }
  wall(-LANE.hw, W.zS, LANE.hw, W.zS, W.wallH, W.t, 1);
  walk.decks.push({ x0: -LANE.hw, x1: LANE.hw, z0: AXIS.innerZ, z1: W.zS, h: 0, floor: "paving" });
  // Only the middle is paved, a path PATH.hw either side of the axis; either side of it the ground is earth (below).
  const paving = [{ level: 1, y: 0.012, x: PATH.hw, zS: W.zS, zN: FOOT.inner.z1 }, { level: 1, y: top + 0.012, x: PATH.hw, zS: FOOT.inner.z0, zN: FOOT.hall.z1 }];
  const earthSides = [], earthAt = (x0, x1, z0, z1, y) => { for (const [a, b] of [[x0, x1], [-x1, -x0]]) earthSides.push(new THREE.PlaneGeometry(b - a, z1 - z0).rotateX(-Math.PI / 2).translate((a + b) / 2, y, (z0 + z1) / 2)); };
  {
    const lx = LANE.hw - LANE.t / 2, tx = SECOND.hw - wt / 2;
    earthAt(PATH.hw, lx, FOOT.inner.z1, FOOT.outer.z0, 0); earthAt(PATH.hw, lx, FOOT.outer.z1, W.zS, 0);
    earthAt(PATH.hw, tx, FOOT.hall.z1, FOOT.inner.z0, top + 0.01);
    earthAt(FOOT.hall.x1, tx, SECOND.zN, FOOT.hall.z1, top + 0.01); earthAt(FOOT.inner.x1, tx, FOOT.inner.z0, AXIS.innerZ - wt / 2, top + 0.01);
  }
  // Trees stand in the earth either side of the path, grown (./flora.js): along the way between the gates cypresses (ce bai: the scope's "cypresses
  // either side", invented, SCOPE-OPTIONS.md §二 B), on the terrace pines and cypresses by turns. Each is an old tree with a tall clean bole,
  // its crown kept inside the ellipsoid the views along the axis are cleared against (`treeBlocks`: under its underside, over six metres up, only
  // the upright trunk). The trunk is in his way (the baked floor and the eye meet it) and has its written-plan rectangle; the boughs and needles are over his head.
  for (const t of TRUNKS.list) {
    walk.solids.push({ x0: t.x - t.r - BODY, x1: t.x + t.r + BODY, z0: t.z - t.r - BODY, z1: t.z + t.r + BODY, eyeTop: t.y + TRUNKS.h });
  }

  // ---- The plain outside the walls (the county is flat, SITE.md §4.1): everything but what lies inside them ----
  const cx = C.x + C.t / 2, cn = C.zN - C.t / 2, cs = C.zS + C.t / 2, tx = SECOND.hw + wt / 2, lx = LANE.hw + LANE.t / 2, zT = AXIS.innerZ + wt / 2, ze = W.zS + W.t / 2;
  /** @type {number[][]} x0, x1, z0, z1 */
  const outside = [[-FAR, FAR, -FAR, cn], [-FAR, -cx, cn, cs], [cx, FAR, cn, cs], [-FAR, -tx, cs, zT], [tx, FAR, cs, zT], [-FAR, -lx, zT, ze], [lx, FAR, zT, ze], [-FAR, FAR, ze, FAR]];

  // ---- The two places held: the monument pavilion and the lamp table ----
  const group = new THREE.Group(), M0 = MONUMENT, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2, mw = M0.x1 - M0.x0;
  group.add(sh.group, mesh(merge(earthSides), dryMaterials(M).grass, { cast: false }));   // (the trees themselves are grown with the court's, in site.js: AXIS_TREES)
  // The monument pavilion as it stands, open on all four sides (a Qing four-cornered pavilion with a pyramid roof: ARCHITECTURE.md §3.2,
  // SOURCES.md): a stone base, four columns, a tie-beam round their heads, a ceiling plate and fascia under the roof, and under it a
  // blank stele on its plinth. Nothing is walled: from the terrace the eye sees through between the columns under the eaves.
  const PAV = MONUMENT_FORM, by = M0.y + PAV.base, ct = by + PAV.column, ceil = ct + 0.3 + PAV.beam, ch = PAV.span / 2;
  const cols = [[-ch, -ch], [ch, -ch], [-ch, ch], [ch, ch]];
  const pwood = [
    ...cols.map(([dx, dz]) => new THREE.CylinderGeometry(PAV.colR * 0.92, PAV.colR, PAV.column, 12).translate(mx + dx, by + PAV.column / 2, mz + dz)),
    ...cols.map(([dx, dz]) => box(0.5, 0.3, 0.5, mx + dx, ct + 0.15, mz + dz)),   // a block on each column's head
    box(PAV.span + 0.5, PAV.beam, 0.26, mx, ct + PAV.beam / 2 + 0.3, mz - ch), box(PAV.span + 0.5, PAV.beam, 0.26, mx, ct + PAV.beam / 2 + 0.3, mz + ch),
    box(0.26, PAV.beam, PAV.span + 0.5, mx - ch, ct + PAV.beam / 2 + 0.3, mz), box(0.26, PAV.beam, PAV.span + 0.5, mx + ch, ct + PAV.beam / 2 + 0.3, mz),
    box(2 * PAV.eave, 0.1, 2 * PAV.eave, mx, ceil + 0.05, mz),   // the ceiling plate, seen from below
    ...[-1, 1].flatMap((sg) => [box(2 * PAV.eave, 0.25, 0.12, mx, ceil + 0.12, mz + sg * PAV.eave), box(0.12, 0.25, 2 * PAV.eave, mx + sg * PAV.eave, ceil + 0.12, mz)]),   // the fascia
  ];
  const pstone = [box(mw, PAV.base, mw, mx, M0.y + PAV.base / 2, mz), box(1.6, 0.45, 0.95, mx, by + 0.225, mz)];   // the base and the stele's plinth, coursed stone
  // The stele itself, shaft and head, is one piece cut from one block (the Yingzao Fashi cuts it so: 碑身 and 碑首 each of a stone): the monolith's grain a little darker (M.steleMono), no courses, no joints
  const pstele = [box(STELE.w, STELE.L, STELE.t, mx, by + 0.45 + STELE.L / 2, mz),   // the shaft
    box(STELE.headW, STELE.cloud, STELE.headT, mx, by + 0.45 + STELE.L + STELE.cloud / 2, mz), box(STELE.headW, STELE.block, STELE.headT, mx, by + 0.45 + STELE.L + STELE.cloud + STELE.block / 2, mz),   // the head: its cloud plate and its block
    new THREE.CylinderGeometry(STELE.headW / 2, STELE.headW / 2, STELE.headT, 24, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, STELE.arch / (STELE.headW / 2), 1).translate(mx, by + 0.45 + STELE.L + STELE.cloud + STELE.block, mz)];   // and the low arch over it
  group.add(
    mesh(merge(pstone), M.stone),
    mesh(merge(pstele), M.steleMono),
    mesh(merge(pwood), M.woodX),
    // (The roof is open underneath: its base lay on the ceiling plate's top, one face on another, #688.)
    mesh(merge([new THREE.ConeGeometry(PAV.eave * Math.SQRT2, PAV.roofH, 4, 1, true).rotateY(Math.PI / 4).translate(mx, ceil + 0.1 + PAV.roofH / 2, mz), new THREE.ConeGeometry(0.22, 0.6, 8).translate(mx, ceil + 0.1 + PAV.roofH + 0.25, mz)]), M.tile),
  );
  // (What the written plan says of the pavilion, its base a floor reached by three steps, its columns and the stele in the way, is ./stele.js's.)
  const L = LAMP, table = mesh(merge([box(L.w, L.h, L.d, L.x, L.y + L.h / 2, L.z)]), M.woodX);
  group.add(table);
  walk.solids.push({ x0: L.x - L.w / 2 - BODY, x1: L.x + L.w / 2 + BODY, z0: L.z - L.d / 2 - BODY, z1: L.z + L.d / 2 + BODY, eyeTop: L.y + L.h });

  // ---- Named places on the axis (shots.js draws each; the floor's bake checks that each can be walked to) ----
  const views = {
    outer: [0, AXIS.outerZ, 0, 0.05],
    inner: [0, AXIS.innerZ, 0, 0.06],
    // cam07, 内山门望殿 (docs/t05/PRD.md §3): in the inner gate's passage, four metres behind its north face (the opening then fills about seven tenths of a wide picture, as the target's does), looking up the axis: the gate's frame round the picture,
    // the archway, the Wuliang hall and over its ridge the Great Hall's roof (the target is refs/t05-concept-2026-11-20/03-axis-from-inner-gate.webp)
    cam07: [0, AXIS.innerZ + 1, 0, 0.15],
    paifang: [0, AXIS.paifangZ, 0, 0.1],
    passage: [0, AXIS.hallZ, 0, 0.08],
    // (mouth: just beyond the foot of the hall's back steps, where its north door lets out on the court)
    mouth: [0, FOOT.hall.z0 - 2.9, 0, 0.12],
  };
  const buildings = [
    ...sh.buildings,
    { name: "碑亭位", x0: M0.x0, x1: M0.x1, z0: M0.z0, z1: M0.z1, y: M0.y },
    { name: "二层高台", ...T, y: 0 },
  ];
  return { stone, plaster, walk, shade, paving, outside, group, views, buildings, closed: sh.closed };
}
