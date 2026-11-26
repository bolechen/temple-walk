// The timber of the great hall's inside, its beams, purlins and frames over the seven, made for T05 alone. It was the court's
// wood, which is old dark timber bleached silver-grey where the rain runs down it: under the door's light those streaks read as
// grey patches on a red-brown ground, rusted iron rather than wood (the independent first review of #762, 2026-11-26), and the
// beam over the seven's heads, lit face on by the door's spots that hang at its own height, as light as their faces (L* 32.6 at
// cam03, 35.6 at cam06; the line is 27, the art director, comment 7188278358). No rain reaches inside, and the light that does
// is the door's, so the inside's timber is the same grain without the weather, smoked darker: the colour of old timber under
// a roof that has had lamps and incense under it for centuries (按常理). A cone cannot keep the door's light off that beam and
// on the faces: from the door both lie within five degrees of each other (docs/t05/DECISIONS.md, 殿内木色).
import { procMat } from "../../src/materials.js";

/** The inside timber's colour (linear), before the scanned grain; the court's wood is .125, .07, .05 with its weathering. */
export const HALL_TIMBER = Object.freeze({ base: [0.066, 0.043, 0.032] });

const made = new WeakMap();
/** The inside timber for this set of materials, along x and along z (their grain as M.woodX's and M.woodZ's), made once. @param {object} M */
export function hallTimber(M) {
  if (!made.has(M)) {
    const base = HALL_TIMBER.base.map((x) => x.toFixed(3)).join(",");
    const one = (key, grain, turn) => {
      const m = procMat(key, { roughness: 0.82, envMapIntensity: 0 }, `
        vec3 q=vWP.${turn}*vec3(.95,.5,.95), w=triW(vWN.${turn});
        vec3 A=triA(tWoodA,q,w)/mWood; vec4 Nr=triN(tWoodN,q,w);
        col=vec3(${base})*mix(vec3(1.),A,.9)*(.72+.56*n3(vWP*vec3(${grain})*.22));   // each member its own tone, as the court's
        rough_=Nr.w*.92; nd_=Nr.xyz.${turn}*1.5;`, { tex: ["wood"], snow: false });
      m.name = key; return m;
    };
    made.set(M, { x: one("hallTimberX", "1.1,9.,9.", "yxz"), z: one("hallTimberZ", "9.,9.,1.1", "xzy") });
  }
  return made.get(M);
}
