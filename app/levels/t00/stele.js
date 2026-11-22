// The imperial stele in the stele pavilion: a Song "huotou jie", a notched-head stone on a stepped base (the Yingzao Fashi, juan 3, stonework:
// the rule for the huotou jie, the stele with a rounded top and a low base). Drawn in the pavilion's frame: x across the face, y up from the
// platform, z out of the face (the stele's front). The first white model, a dragon-headed stele on a tortoise, is kept as stele-turtle.js.
//
// What the book gives (read by the structure review, #520): 9.6 chi in all, of which the body, its notched top included, is 8 chi, and the
// base is 0.2 of the body's height. At 0.3104 m to the chi that is 2.98 m in all, the body 2.48 m and the base 0.50 m; the review gives the body
// as 0.99 m wide and 0.37 m thick. Ours, and the sources table says so: the base's length across the face (the Siku text has lost the
// character: 1.24 m, the art review's reading) and its depth (0.77 m), its three corbelled tiers, the shape of the notch (a low arc, 0.11 m
// of rise, with its corners rounded), the 7 cm border round the face and the shallow sunk frame for the title at its top, and the 1.5 cm
// chamfer on the arrises.
import * as THREE from "three";
import { box, merge, mesh } from "../../src/geo.js";

/** The measures of the stone, in metres. */
export const STELE = Object.freeze({
  total: 2.98, bodyH: 2.48, bodyW: 0.99, bodyT: 0.37, baseH: 0.5,
  rise: 0.11, round: 0.08,                              // the notch: the arc's rise over the shoulders, and the radius that rounds its corners
  baseW: 1.24, baseD: 0.77,                             // the base, across the face and in depth (its lowest tier)
  tiers: Object.freeze([[1.0, 1.0, 0.2], [0.92, 0.84, 0.15], [0.855, 0.69, 0.15]]),   // each tier: its share of the base's width and depth, and its height
  border: 0.07, recess: 0.015,                          // the border round the face, and how far the field lies behind it
  title: Object.freeze({ w: 0.46, h: 0.4, top: 0.06, recess: 0.015 }),   // the title's frame: size, distance below the field's top, how much deeper again
  chamfer: 0.015, embed: 0.03,                          // the arrises' chamfer, and how far the body's foot goes down into the base
});

/** A shape in x, y: the stone's outline, a rectangle with a low arc on top, its corners rounded by `round` (0 leaves them sharp). */
function outline(hw, h, rise, round, y0 = 0) {
  const sh = new THREE.Shape(), arc = (x) => h - rise + rise * (1 - (x / hw) ** 2), hs = h - rise, r = round;
  sh.moveTo(-hw, y0); sh.lineTo(hw, y0);
  if (r > 0) {
    sh.lineTo(hw, hs - r); sh.quadraticCurveTo(hw, hs, hw - r, arc(hw - r));
    for (let i = 1; i <= 4; i++) { const x = hw - r - (2 * (hw - r) * i) / 4; sh.lineTo(x, arc(x)); }
    sh.quadraticCurveTo(-hw, hs, -hw, hs - r);
  } else {
    sh.lineTo(hw, hs);
    for (let i = 1; i <= 3; i++) { const x = hw - (2 * hw * i) / 4; sh.lineTo(x, arc(x)); }
    sh.lineTo(-hw, hs);
  }
  sh.lineTo(-hw, y0);
  return sh;
}

/** The stele, as one mesh per part group (so that a view can black them out), standing on y = 0. Returns { group, parts, height }. */
export function buildStele(M) {
  const S = STELE, b = S.chamfer, T = S.bodyT, H = S.bodyH + S.embed, hw = S.bodyW / 2;
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const parts = { base: [], body: [] };
  // The base: three tiers, each drawn in as it rises, the top and foot of each cut back by a chamfer (a footprint extruded upward with a bevel).
  let y = 0;
  for (const [fw, fd, th] of S.tiers) {
    const w = S.baseW * fw, d = S.baseD * fd, foot = new THREE.Shape(); foot.moveTo(-(w - 2 * b) / 2, -(d - 2 * b) / 2); foot.lineTo((w - 2 * b) / 2, -(d - 2 * b) / 2); foot.lineTo((w - 2 * b) / 2, (d - 2 * b) / 2); foot.lineTo(-(w - 2 * b) / 2, (d - 2 * b) / 2);
    const g = new THREE.ExtrudeGeometry(foot, { depth: th - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, y + b, 0); parts.base.push(g); y += th;
  }
  const y0 = S.baseH - S.embed;   // the body's foot
  // The body: a ring (the border and the notched head) round a field sunk a little behind it, and in the field's top the title's frame, sunk again.
  // The outline's own arrises are chamfered by the bevel, which also takes the face's outer edge in by `b` all round.
  const ring = outline(hw - b, H - b, S.rise, S.round);
  const fh = hw - S.border, fTop = H - S.border, fy0 = S.embed + 0.05, inner = new THREE.Path();
  // the field: sharp-cornered, a low arc on top, from just above the foot to the border
  const arc = (x) => fTop - S.rise + S.rise * (1 - (x / fh) ** 2);
  inner.moveTo(-fh, fy0); inner.lineTo(-fh, fTop - S.rise); for (let i = 1; i <= 3; i++) { const x = -fh + (2 * fh * i) / 4; inner.lineTo(x, arc(x)); } inner.lineTo(fh, fTop - S.rise); inner.lineTo(fh, fy0); inner.lineTo(-fh, fy0);
  const field = new THREE.Shape(inner.getPoints()), ringShape = ring;
  ringShape.holes.push(new THREE.Path(inner.getPoints()));
  const bodyG = new THREE.ExtrudeGeometry(ringShape, { depth: T - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 2 });
  bodyG.translate(0, y0, -(T - 2 * b) / 2); parts.body.push(bodyG);
  // the field, from the back plane to a little behind the border's face, with the title's window cut out of it
  const t = S.title, tx = t.w / 2, ty1 = fTop - S.rise - t.top + 0.0, ty0 = ty1 - t.h;
  const win = new THREE.Path(); win.moveTo(-tx, ty0); win.lineTo(tx, ty0); win.lineTo(tx, ty1); win.lineTo(-tx, ty1); win.lineTo(-tx, ty0);
  field.holes.push(win);
  const fieldG = new THREE.ExtrudeGeometry(field, { depth: T - S.recess, bevelEnabled: false, curveSegments: 1 });
  fieldG.translate(0, y0, -T / 2); parts.body.push(fieldG);
  parts.body.push(box(t.w, t.h, T - S.recess - t.recess, 0, y0 + (ty0 + ty1) / 2, -T / 2 + (T - S.recess - t.recess) / 2));
  const group = new THREE.Group(); group.name = "stele";
  const out = {};
  for (const [k, list] of Object.entries(parts)) { const m = mesh(merge(list), M.monolith); m.name = `stele-${k}`; m.userData.keep = true; group.add(m); out[k] = m; }
  return { group, parts: out, height: y0 + H, S, foot: { hx: S.baseD / 2, hz: S.baseW / 2 } };   // (foot: half the base along the way up and across, in the stele's own frame)
}
