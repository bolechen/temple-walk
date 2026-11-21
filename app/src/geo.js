// Small geometry helpers.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Bring any geometry to one layout (non-indexed; position, normal, uv) so it can be merged with others.
export function plain(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv", "stair"].includes(k)) n.deleteAttribute(k);   // (`stair`: what a flight's stone shader reads, see stairGeo)
  if (!n.attributes.uv) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(n.attributes.position.count * 2).fill(0), 2));
  if (!n.attributes.normal) n.computeVertexNormals();   // a turned shape keeps its round normals; only what has none is given flat ones
  return n;
}
export const merge = (list) => mergeGeometries(list.map(plain));

// Tell a wall how high its foot stands: plaster is damp and green at its foot wherever that is, and one material
// serves every wall by reading the height from here (kept in the first texture coordinate, which walls do not use).
export function footAt(geo, base) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, base); return geo; }

// Bake an occlusion value into every vertex. `fn(x, y, z, nx, ny, nz)` returns 0..1 (a little over 1 where a surface
// takes more light back from what it faces than the open sky would give it); omit it for "fully lit". The normal is
// there for a surface that is shut off from the sky but not from the ground in front of it.
export function bakeAO(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal, a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = fn ? fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0) : 1;
  geo.setAttribute("ao", new THREE.BufferAttribute(a, 1));
  return geo;
}
export function mesh(geo, mat, { cast = true, receive = true, ao } = /** @type {{ cast?: boolean, receive?: boolean, ao?: any }} */ ({})) {
  if (!geo.attributes.ao || ao) bakeAO(geo, ao);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
// A flight of stone steps with sloped cheeks. Top edge at z = 0, descending toward +z, rising `rise` from y = 0.
// `steps` and `hurry`: how many steps a second he takes on a flight, walking and with Shift (issue #270). Grown men go up
// and down at about 1.7–1.85 a second; the step rate of a leg scales with the root of its length, which gives a child with
// 0.44 m legs about 2.4–2.6, and the rise is four tenths of his leg where an adult's is two, so he goes slower than that.
export const STAIR = Object.freeze({ rise: 0.18, tread: 0.34, nosing: 0.05, steps: 2.1, hurry: 2.8 });
// How far the novice reaches from the point he stands on: his sleeves, his hands when he walks, the hat on his back.
// The walker moves a point; everything that stands in his way keeps that point this far off, so that no part of
// him enters it. (tools/edges.mjs measures the model, a unit test holds this to it, and the sweep checks the whole plan.)
export const BODY = 0.38;
// A stair's cheek stones stand outside its treads, from the edge of the treads to this far beyond.
export const CHEEK = 0.55;

// What he may sit on, as outlines turned about an upright axis ([radius, height above the floor] in metres): a turned
// stool of the height a grown man sits at, and a round straw cushion (a 蒲团), wide and low. The courts and the rooms
// build theirs from these, and the tests hold his seated body out of them.
export const STOOL = Object.freeze([[0, 0], [0.17, 0], [0.2, 0.06], [0.215, 0.22], [0.2, 0.38], [0.17, 0.44], [0, 0.44]]);
export const CUSHION = Object.freeze([[0, 0], [0.25, 0], [0.288, 0.028], [0.292, 0.06], [0.262, 0.092], [0.1, 0.104], [0, 0.104]]);
/** How far a turned outline reaches from its axis at a height above its foot (0 above or below it). */
export const radiusAt = (outline, y) => {
  let r = 0;
  for (let i = 1; i < outline.length; i++) {
    const [r0, y0] = outline[i - 1], [r1, y1] = outline[i];
    if (y < Math.min(y0, y1) || y > Math.max(y0, y1)) continue;
    r = Math.max(r, y1 === y0 ? Math.max(r0, r1) : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0));
  }
  return r;
};
export function stairProfile(rise) {
  const count = Math.max(1, Math.round(rise / STAIR.rise));
  return { count, height: rise / count, tread: STAIR.tread, run: STAIR.tread * count, nosing: STAIR.nosing };
}
// A cheek stone lies along the slope beside the treads, a little proud of their noses; at its head it runs level
// into the platform's edge, at its foot it is cut square with the lowest nose. Under it the side of the flight is
// closed: a pier against the platform, and between pier and stone a panel set back from their face.
// All of it keeps within CHEEK of the treads and between the head of the flight and 6 cm past its foot, which is
// the ground the plan's `walk.posts` close to the walker for every flight (a unit test holds it to that).
// `base`: how far under the foot of the flight the pier, the panel and the stone's square foot go down into the ground;
// `square`: how far the stone's foot stands square on it.
export const CHEEK_STONE = Object.freeze({ width: 0.42, over: 0.05, lip: 0.02, pier: 0.2, back: 0.035, band: 0.12, base: -0.4, square: 0.12 });
export function cheekProfile(rise) {
  const { height: sh, tread: sd, run, nosing } = stairProfile(rise), k = sh / sd, C = CHEEK_STONE;
  const top = (z) => Math.min(rise + C.lip, rise + C.over + k * (sd + nosing - z));   // level at the head, then the line of the noses and a little over
  const thick = sh + C.over + 0.02;                                                     // so that its foot stands in the ground
  return { top, under: (z) => top(z) - thick, head: sd + nosing + (C.over - C.lip) / k, foot: run + nosing, slope: k, ...C };
}
// What is left of a convex outline (counter-clockwise) on the inner side of a line through `a` along `d`, moved in by `m`.
function keep(poly, [ax, ay], [dx, dy], m = 0) {
  const l = Math.hypot(dx, dy), side = ([x, y]) => ((y - ay) * dx - (x - ax) * dy) / l - m, out = [];
  poly.forEach((p, j) => { const q = poly[(j + 1) % poly.length], dp = side(p), dq = side(q);
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } });
  return out;
}
// The same outline with every side moved in by `m`.
const inset = (pts, m) => pts.reduce((poly, a, i) => { const b = pts[(i + 1) % pts.length]; return keep(poly, a, [b[0] - a[0], b[1] - a[1]], m); }, pts);
// An outline with a smaller one, standing on the same foot line, taken out of it: what is left is a band round its
// other sides. Both run counter-clockwise and begin at the left end of the foot line.
const banded = (outer, inner) => [outer[0], inner[0], ...inner.slice(2).reverse(), inner[1], ...outer.slice(1)];
// An outline drawn in the flight's side view (z across, y up), made a slab from `x0` to `x1`.
function slab(outline, x0, x1) {
  const sh = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  return new THREE.ExtrudeGeometry(sh, { depth: Math.abs(x1 - x0), bevelEnabled: false }).rotateY(-Math.PI / 2).translate(Math.max(x0, x1), 0, 0);
}
// What the stone shader (materials.js, `steps`) needs to lay stones on a flight, written into every vertex as the
// attribute `stair`, so that a flight reads as courses of cut stone without one more triangle. Four numbers:
//   x     a tread's part: metres across from the flight's axis. A cheek's part: metres outward from the tread's edge.
//   a     a tread's part: its number from the head (0) plus how far along it the vertex lies (0.03 to 0.97), so that
//         `floor(a)` is the tread and `fract(a)` the depth. A cheek's part: -1 minus the metres down from the head.
//   h     a tread's part: the height over the foot of its riser. A cheek's part: the height over the ground at the foot.
//   code  what is the same all over the flight, as one whole number (`stairCode`): treads, how little sun it sees
//         (0 sunny, 1 side-on, 2 turned from the sun), a seed from where it stands, and its width in twentieths of a metre.
// Everything is in the flight's own frame, so a flight turned any way (a hall's back stair, the approach's bend) is laid
// the same. The same flight gives the same stones every time: nothing here is random.
export const stairCode = (count, shade, seed, w) => count + 64 * (shade + 4 * (seed + 16 * Math.round(w * 20)));
export const stairDecode = (c) => { const n = c % 64, r = Math.floor(c / 64), shade = r % 4, r2 = Math.floor(r / 4); return { count: n, shade, seed: r2 % 16, w: Math.floor(r2 / 16) / 20 }; };
// How little sun a flight sees follows from which way it comes down: one that comes down toward the north has the building
// or the slope at its back and the sun behind that; one that comes down toward the south faces it. `place` is the matrix
// that stands the flight where it is (rotation only matters); a flight with none is taken side-on.
function stairLight(place) {
  if (!place) return { shade: 1, seed: 0 };
  const e = place.elements, dz = e[10], x = e[12], z = e[14];   // (the flight's own +z, which is the way down, turned into the world)
  return { shade: dz < -0.5 ? 2 : dz > 0.5 ? 0 : 1, seed: (Math.imul(Math.round(x * 4) | 0, 73856093) ^ Math.imul(Math.round(z * 4) | 0, 19349663)) >>> 28 };
}
function stamp(geo, fn) {
  const p = geo.attributes.position, a = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) a.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 4);
  geo.setAttribute("stair", new THREE.BufferAttribute(a, 4));
  return geo;
}
// `sides`: which sides have a cheek (-1 and +1 in x). A flight of one or two steps has none.
// `place`: the matrix that stands the flight where it is; the geometry comes back already placed.
export function stairGeo(w, rise, { sides = [-1, 1], place } = /** @type {{ sides?: number[], place?: THREE.Matrix4 }} */ ({})) {
  const { count: N, height: sh, tread: sd, run, nosing } = stairProfile(rise), parts = [];
  const { shade, seed } = stairLight(place), code = stairCode(N, shade, seed, w), clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Each tread is a slab that oversails its riser by a thumb's length: the dark line under it is what lets a flight
  // be read as steps from below, even on a day without shadows.
  for (let i = 0; i < N; i++) {
    const top = sh * (N - i), foot = sh * (N - i - 1);
    for (const g of [box(w, top - 0.06, sd, 0, (top - 0.06) / 2, sd * (i + 0.5)), box(w, 0.06, sd + nosing, 0, top - 0.03, sd * (i + 0.5) + nosing / 2)])
      parts.push(stamp(g, (x, y, z) => [x, i + clamp((z - sd * i) / (sd + nosing), 0.03, 0.97), y - foot, code]));
  }
  if (N > 2 && sides.length) {
    const c = cheekProfile(rise), flat = rise + c.lip, under = c.under(0), base = c.base, end = c.foot - 0.01, sq = c.foot - c.square;
    // The stone and the pier, one piece the full width. At its foot the stone is cut square and stands a hand's length
    // on the ground, carried down with the pier and the panel into it (#272): where the ground beside a flight lies a
    // little lower than its foot, no slot of air shows under the stone.
    const stone = [[0, base], [c.pier, base], [c.pier, under], [c.head, under], [sq, c.under(sq)], [sq, base], [c.foot, base], [c.foot, c.top(c.foot)], [c.head, flat], [0, flat]];
    // The panel under the stone, let a finger into the pier and the stone. On a flight tall enough to show it, it
    // is cut back twice more toward its middle, each cut a hand in from the pier and from the stone and running
    // down into the ground: what shows is a line of shadow along those two sides, and no ledge to catch the light.
    const panel = [[c.pier - 0.01, base], [end, base], [end, c.under(end) + 0.01], [c.head, under + 0.01], [c.pier - 0.01, under + 0.01]];
    const deep = [[c.pier, -50], [c.head + (under + 50) / c.slope, -50], [c.head, under], [c.pier, under]];   // the same field, carried far below the ground
    const cut = (m) => { if (rise < 0.85) return null;
      const q = keep(keep(inset(deep, m), [0, base], [1, 0]), [end, 0], [0, 1]), i = q.findIndex(([z, y]) => y < base + 1e-6 && z < c.pier + m + 1e-6);   // (in the ground it stops where the panel does)
      const seen = keep(q, [0, 0], [1, 0]), zs = seen.map(([z]) => z), ys = seen.map(([, y]) => y);   // what of it stands above the ground
      return i >= 0 && seen.length >= 3 && Math.max(...zs) - Math.min(...zs) > 0.3 && Math.max(...ys) > 0.2 ? [...q.slice(i), ...q.slice(0, i)] : null; };   // too small to read as a panel
    const cut1 = cut(c.band), cut2 = cut1 && cut(c.band * 2);
    const side = (g) => stamp(g, (x, y, z) => [Math.abs(x) - w / 2, -1 - z, y, code]);
    for (const sx of sides) {
      const at = (d) => [sx * w / 2, sx * (w / 2 + c.width - d)];
      parts.push(side(slab(stone, ...at(0))), side(slab(cut1 ? banded(panel, cut1) : panel, ...at(c.back))));
      if (cut1) parts.push(side(slab(cut2 ? banded(cut1, cut2) : cut1, ...at(c.back * 2))));
      if (cut2) parts.push(side(slab(cut2, ...at(c.back * 3))));
    }
  }
  const geo = merge(parts);
  return { geo: place ? geo.applyMatrix4(place) : geo, run };
}
// Once the place is built, everything that never moves and shares a material becomes one mesh per stretch
// of the axis: a few hundred draws become a few dozen, and what is behind you is still culled.
// Meshes marked `userData.keep`, and anything not drawn with a procedural material, are left alone.
export function mergeStatic(root, zones, weld = true) {
  root.updateMatrixWorld(true);
  const groups = new Map(), gone = [], c = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.keep || Array.isArray(o.material)) return;
    const a = o.geometry.attributes; if (!a.ao || !a.uv || !a.normal) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv", "ao", "stair"].includes(k)) g.deleteAttribute(k);
    g.computeBoundingBox(); g.boundingBox.getCenter(c);
    const zone = zones.findIndex((z) => c.z > z), key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${zone}`;
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
    groups.get(key).geos.push(g); gone.push(o);
  });
  for (const o of gone) { o.parent.remove(o); o.geometry.dispose(); }
  // Corners that several faces share exactly (same place, same normal, same everything) are kept once and pointed
  // to: a flat-shaded box keeps its twenty-four, a curved roof or a column loses most of its repeats.
  let v0 = 0, v1 = 0; const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  for (const g of groups.values()) { let geo = mergeGeometries(g.geos); v0 += geo.attributes.position.count; if (weld) geo = mergeVertices(geo, 1e-4); v1 += geo.attributes.position.count;
    const m = new THREE.Mesh(geo, g.mat); m.castShadow = g.cast; m.receiveShadow = g.recv; root.add(m); }
  return { before: gone.length, after: groups.size, vertices: [v0, v1], weldMs: Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0) };
}
export const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 8, false);
