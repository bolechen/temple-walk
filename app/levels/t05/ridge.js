// The great hall's ridges, end ornaments and end tiles: grey fired clay, as its tiles are, made for T05 alone so that the prologue's
// shared ridge material is never touched. That one (materials.js, `ridge`) is a little glossy, lit as though nothing shaded it (it
// sets its own shade to none, whatever the mesh says) and grows a green moss: on the great hall it strung the end tiles along the
// eave into a row of pale beads, brighter than the tiles beside them, and in winter laid a bright green line along the ridge and the
// ornaments (the art review of #742, points 1 and 6). This one is as rough as the tiles, takes the shade the mesh is given (the eave's,
// for the end tiles, `hall.roof.ao`), and has no moss: the ridge stands high and dry above the slopes, where nothing grows on it.
// Its colour lies in the tiles' own range (materials.js, `tile`), so that an end tile reads as the head of the tile behind it.
import { procMat } from "../../src/materials.js";

// The clay's colour and how rough it is, for the ridges, the ornaments and the beasts (`ridge`) and for the end tiles (`ends`). The
// ridges are as dark as the tiles beside them or darker: under the winter's blue sky the first clay, the end tiles' still, read a
// good deal lighter than the tiles (lightness in the T4 close-up, #742's art review: the main ridge's side 39.5, the ornament 42.5,
// the tiles 33.7), so that the ridge and the ornaments drew a pale outline round the roof, as though cut from paper; the review asks
// their lit faces to be no more than 3 L* lighter than the tiles beside them. The end tiles keep the clay they passed the review
// in (darker still, they read as holes under the eave).
const CLAY = Object.freeze({
  ridge: { lo: [0.034, 0.037, 0.04], hi: [0.075, 0.078, 0.08], rough: [0.84, 0.1] },
  ends: { lo: [0.05, 0.054, 0.058], hi: [0.11, 0.115, 0.118], rough: [0.74, 0.1] },
});
const v3 = (/** @type {number[]} */ c) => `vec3(${c.map((x) => x.toFixed(3)).join(",")})`;
const clay = (/** @type {string} */ key, /** @type {{ lo: number[], hi: number[], rough: number[] }} */ c) => {
  const m = procMat(key, { roughness: c.rough[0], envMapIntensity: 0.3 }, `
      col=mix(${v3(c.lo)},${v3(c.hi)},fbm3(vWP*2.)*.75+fbm3(vWP*9.)*.25);
      rough_=${c.rough[0].toFixed(3)}+${c.rough[1].toFixed(3)}*fbm3(vWP*5.+3.); bump_=fbm3(vWP*14.)*.003;`);
  m.name = key;
  return m;
};

const made = new WeakMap();
/** The great hall's ridge clay for this set of materials, made once: `ridge` for the ridges, the ornaments and the beasts, `ends` for the end tiles. @param {object} M */
export function ridgeMaterials(M) {
  if (!made.has(M)) made.set(M, { ridge: clay("liaoRidge", CLAY.ridge), ends: clay("liaoEnds", CLAY.ends) });
  return made.get(M);
}
