// T05's outdoor ground and evergreen crowns on a dry early-winter day (J01): copies of the shared earth and cedar materials, so that the
// prologue's own are never touched. The shared ones are the damp dark ground and the summer-green needle of the prologue's mountain; on
// J01's clear dry morning the ground is dry earth and withered grass, and the pines' and cypresses' sunlit tops are an olive grey
// (docs/t05/DECISIONS.md, 2026-11-25: the art director's lines; the colours themselves are the project's own).
//
// Each copy multiplies its colour by the mood's `leaf` (the shared `uLeaf`, set by yard.js from mood.leaf, which nothing else in T05 reads:
// it has no bamboo and no hills), raised to a power, and for the crowns takes some of the colour out. It does so only where the day is dry
// and without snow (the mood's wetness and snow both 0: J01 and no other hour or season of T05); every other mood leaves the material as
// it was. No new uniform, no new pass: three values the page already holds.
import { U } from "../../src/glsl.js";

/** A copy of `base` tinted by the mood's leaf colour to the power `pow` and desaturated by `grey` (0 to 1), in a dry day without snow only. */
function dryCopy(base, key, pow, grey) {
  const m = base.clone(), was = base.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => {
    was.call(base, sh, rr);
    sh.uniforms.uLeafD = U.uLeaf; sh.uniforms.uWetD = U.uWet; sh.uniforms.uSnowD = U.uSnow;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uLeafD; uniform float uWetD, uSnowD;")
      .replace("diffuseColor.rgb=col;", `{ float g_ = 1. - smoothstep(0., .05, uWetD + uSnowD); float l_ = dot(col, vec3(.2126, .7152, .0722)); vec3 t_ = pow(max(uLeafD, vec3(.001)), vec3(${pow.toFixed(3)}));
          diffuseColor.rgb = mix(col, mix(col, vec3(l_), ${grey.toFixed(3)}) * t_, g_); }`);
  };
  m.customProgramCacheKey = () => key; m.name = key;
  return m;
}

/** The dry-day earth and crown materials of this set of materials, made once (the site, the surround and the axis all ask). */
const made = new WeakMap();
export function dryMaterials(M) {
  if (!made.has(M)) made.set(M, { earth: dryCopy(M.earth, "dryEarth", 1, 0.2), cedar: dryCopy(M.cedar, "dryCedar", 0.58, 0.6) });
  return made.get(M);
}
