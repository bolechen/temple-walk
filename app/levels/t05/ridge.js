// The great hall's ridges, end ornaments and end tiles: grey fired clay, as its tiles are, made for T05 alone so that the prologue's
// shared ridge material is never touched. That one (materials.js, `ridge`) is a little glossy, lit as though nothing shaded it (it
// sets its own shade to none, whatever the mesh says) and grows a green moss: on the great hall it strung the end tiles along the
// eave into a row of pale beads, brighter than the tiles beside them, and in winter laid a bright green line along the ridge and the
// ornaments (the art review of #742, points 1 and 6). This one is as rough as the tiles, takes the shade the mesh is given (the eave's,
// for the end tiles, `hall.roof.ao`), and has no moss: the ridge stands high and dry above the slopes, where nothing grows on it.
// Its colour lies in the tiles' own range (materials.js, `tile`), so that an end tile reads as the head of the tile behind it.
import { procMat } from "../../src/materials.js";

const made = new WeakMap();
/** The great hall's ridge material for this set of materials, made once. @param {object} M */
export function ridgeMaterial(M) {
  if (!made.has(M)) {
    const m = procMat("liaoRidge", { roughness: 0.78, envMapIntensity: 0.3 }, `
      col=mix(vec3(.05,.054,.058),vec3(.11,.115,.118),fbm3(vWP*2.)*.75+fbm3(vWP*9.)*.25);
      rough_=.74+.1*fbm3(vWP*5.+3.); bump_=fbm3(vWP*14.)*.003;`);
    m.name = "liaoRidge";
    made.set(M, m);
  }
  return made.get(M);
}
