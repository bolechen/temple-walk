// The imperial stele in the stele pavilion: a Song stone with a coiled-dragon head on a tortoise, set on a plinth of two slabs
// (the Yingzao Fashi's "bixi aozuo" stele, juan 3, stonework). Everything is measured in the stele's own length L, the way the book
// measures it, and drawn in the pavilion's frame: x across the face, y up from the platform, z out of the face (the stele's
// front); the tortoise lies along z with its head out to the front.
//
// What the book gives (the reading of the Siku quanshu text by the structure review, #520): the body is 0.40 L wide and 0.15 L thick; the
// head is 0.44 L square and 0.18 L thick over a cloud plate 0.06 L high; the tortoise is twice the body's width long and 0.44 L
// high; the plinth is two slabs of 0.6 L by 0.3 L by 0.1 L; from the tortoise to the head the stone is 1.8 L high, the plinth not
// counted. Three things are ours, and the sources table says so: the head's height is taken as its width (the book writes it square);
// the plinth is 1.92 m by 0.96 m, two slabs end to end and as wide as it takes to carry the tortoise (the book's 0.3 L would leave it
// narrower than the tortoise, and the Siku text is not consistent there); and the tortoise is 0.5 L wide, from memory and not checked
// against the book, which gives its length and height but not its breadth, its feet standing in the middle of the plinth's top and its
// belly raised a little off it.
// L is 1.60 m, so that the whole stands 3.17 m: the pavilion's columns are 3.3 m.
import * as THREE from "three";
import { box, merge, mesh } from "../../src/geo.js";

export const L = 1.6;
/** The measures of the stone, in metres, from L. `turtleH` is the one thing still open: 0.44 L by the book, or lower (the Dongyue stele at Dai Temple, 1013, has its tortoise at about 0.22 of the body's length). */
export const STELE = Object.freeze({
  L,
  bodyW: 0.4 * L, bodyT: 0.15 * L,
  headW: 0.44 * L, headH: 0.44 * L, headT: 0.18 * L, cloudH: 0.06 * L,
  turtleLen: 0.8 * L, turtleH: 0.44 * L,
  plinthH: 0.1 * L, plinthLen: 1.2 * L, plinthW: 0.6 * L,
});

/** The stele, as one mesh per part group (so that a view can black them out), standing on y = 0. Returns { group, parts, height }. */
export function buildStele(M, { turtleH = STELE.turtleH } = {}) {
  const S = { ...STELE, turtleH }, y0 = S.plinthH;
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const parts = {};
  // The plinth: two slabs, end to end along the tortoise, a little wider than the tortoise.
  parts.plinth = [box(S.plinthW, S.plinthH, S.plinthLen / 2, 0, S.plinthH / 2, -S.plinthLen / 4), box(S.plinthW, S.plinthH, S.plinthLen / 2, 0, S.plinthH / 2, S.plinthLen / 4)];
  // The tortoise: a low dome of a shell over four blocks of feet, a thick neck and a head wider than it is high, held out level.
  const shellH = S.turtleH - 0.06, shellR = 0.4, shellLen = S.turtleLen * 0.72;
  // (the shell is a dome pressed toward a flat top, as a tortoise's carapace is, not a ball)
  const dome = (rx, ry, rz, x, y, z, w = 20, h = 8) => { const g = new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.pow(Math.max(0, p.getY(i)), 0.55)); g.computeVertexNormals(); return g.scale(rx, ry, rz).translate(x, y, z); };
  const blob = (rx, ry, rz, x, y, z, w = 12, h = 8) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz).translate(x, y, z);
  const baseY = y0 + 0.06;
  /** @type {THREE.BufferGeometry[]} */
  const turtle = [dome(shellR, shellH, shellLen / 2, 0, baseY, -0.04)];
  const neckY = baseY + shellH * 0.34, headY = neckY - 0.01;
  turtle.push(blob(0.2, 0.17, 0.22, 0, neckY, shellLen / 2 - 0.05, 12, 8));                       // the neck, thick
  turtle.push(blob(0.25, 0.16, 0.28, 0, headY, shellLen / 2 + 0.2, 14, 8));                        // the head: broader than high, a blunt snout
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turtle.push(box(0.2, 0.16, 0.34, sx * (shellR - 0.05), y0 + 0.08, sz * 0.36 - 0.04));   // the feet: blocks against the ground
  turtle.push(box(0.14, 0.1, 0.2, 0, y0 + 0.07, -shellLen / 2 - 0.04));
  turtle.push(box(0.8, 0.1, 0.42, 0, y0 + S.turtleH - 0.03, -0.04));                              // the hump the stele stands in, flat on top                         // the short tail
  parts.turtle = turtle;
  // The stele: a plain slab, standing in the shell's hump.
  const bodyY = y0 + S.turtleH, bodyL = S.L;
  parts.body = [box(S.bodyW, bodyL, S.bodyT, 0, bodyY + bodyL / 2, 0)];
  // The head over a cloud plate: a round top, a little wider than the body, with a dragon's head hanging at each lower corner.
  const headY0 = bodyY + bodyL, arcRy = S.headH * 0.40, sideH = S.headH - S.cloudH - arcRy;
  /** @type {THREE.BufferGeometry[]} */
  const headParts = [box(S.headW, S.cloudH, S.headT, 0, headY0 + S.cloudH / 2, 0)];
  const shape = new THREE.Shape(); shape.moveTo(-S.headW / 2, 0); shape.lineTo(S.headW / 2, 0); shape.lineTo(S.headW / 2, sideH);
  shape.absellipse(0, sideH, S.headW / 2, arcRy, 0, Math.PI, false); shape.lineTo(-S.headW / 2, 0);
  // The panel is the thinner arch; over it stands a band of the dragons' coiled bodies along its edge, a little thicker, framing the recessed panel
  // where the title is cut (the head's depth is the book's 0.18 L).
  const panelT = S.headT - 0.07, ringW = 0.085;
  const panel = new THREE.ExtrudeGeometry(shape, { depth: panelT, bevelEnabled: false, curveSegments: 6 });
  panel.translate(0, headY0 + S.cloudH, -panelT / 2); headParts.push(panel);
  const ring = new THREE.Shape(); ring.moveTo(-S.headW / 2, 0); ring.lineTo(S.headW / 2, 0); ring.lineTo(S.headW / 2, sideH); ring.absellipse(0, sideH, S.headW / 2, arcRy, 0, Math.PI, false); ring.lineTo(-S.headW / 2, 0);
  const hole = new THREE.Path(); hole.moveTo(-S.headW / 2 + ringW, 0.0); hole.lineTo(S.headW / 2 - ringW, 0.0); hole.lineTo(S.headW / 2 - ringW, sideH); hole.absellipse(0, sideH, S.headW / 2 - ringW, arcRy - ringW, 0, Math.PI, false); hole.lineTo(-S.headW / 2 + ringW, 0.0);
  ring.holes.push(hole);
  const band = new THREE.ExtrudeGeometry(ring, { depth: S.headT - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1, curveSegments: 6 });
  band.translate(0, headY0 + S.cloudH, -(S.headT - 0.04) / 2); headParts.push(band);
  for (const sx of [-1, 1]) headParts.push(blob(0.06, 0.12, 0.12, sx * (S.headW / 2 - 0.005), headY0 + S.cloudH + sideH * 0.55, 0.01, 6, 5));   // a dragon's head at each lower corner, standing out of the edge
  parts.head = headParts;
  const group = new THREE.Group(); group.name = "stele";
  const out = {};
  for (const [k, list] of Object.entries(parts)) { const m = mesh(merge(list), M.monolith); m.name = `stele-${k}`; m.userData.keep = true; group.add(m); out[k] = m; }
  return { group, parts: out, height: headY0 + S.headH, S };
}
