// T05's outdoor ground and evergreen crowns on a dry early-winter day (J01): copies of the shared earth and cedar materials, so that the
// prologue's own are never touched. The shared ones are the damp dark ground and the summer-green needle of the prologue's mountain; on
// J01's clear dry morning the ground is dry earth and withered grass, and the pines' and cypresses' sunlit tops are an olive grey
// (docs/t05/DECISIONS.md, 2026-11-25: the art director's lines; the colours themselves are the project's own).
//
// The earth multiplies its colour by the mood's `leaf` (the shared `uLeaf`, set by yard.js from mood.leaf, which nothing else in T05 reads:
// it has no bamboo and no hills); the crowns take most of their colour out and are given a fixed olive (#573, the art director's second
// lines of 2026-11-25: the sunlit tops a grey olive, hue 120–155°; the leaf colour to a power could not move them there without turning
// the earth too). Where the low sun strikes either, the sun's own light on it is drawn part way to grey: a sunlit patch of dry earth or a sunlit
// crown otherwise came out the most saturated thing outside the walls. All of it only where the day is dry and without snow (the mood's
// wetness and snow both 0: J01 and no other hour or season of T05); every other mood leaves the material as it was. No new uniform, no
// new pass: three values the page already holds.
import { U } from "../../src/glsl.js";

/**
 * A copy of `base`, on a dry day without snow only: its colour desaturated by `grey` (0 to 1) and multiplied by `tint`, either the mood's
 * leaf colour raised to that power (a number) or a fixed colour (three numbers); and the light the sun itself throws on it (the direct
 * diffuse light, nothing of the sky's) drawn toward grey by `bleach`, so that the low winter sun pales dry earth and needles rather than
 * gilding them, while what lies in shade keeps its colour.
 */
function dryCopy(base, key, tint, grey, bleach = 0) {
  const m = base.clone(), was = base.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => {
    was.call(base, sh, rr);
    sh.uniforms.uLeafD = U.uLeaf; sh.uniforms.uWetD = U.uWet; sh.uniforms.uSnowD = U.uSnow;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uLeafD; uniform float uWetD, uSnowD;")
      .replace("diffuseColor.rgb=col;", `{ float g_ = 1. - smoothstep(0., .05, uWetD + uSnowD); float l_ = dot(col, vec3(.2126, .7152, .0722)); vec3 t_ = ${Array.isArray(tint) ? `vec3(${tint.map((v) => v.toFixed(3)).join(", ")})` : `pow(max(uLeafD, vec3(.001)), vec3(${tint.toFixed(3)}))`};
          diffuseColor.rgb = mix(col, mix(col, vec3(l_), ${grey.toFixed(3)}) * t_, g_); }`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
        { float g_ = 1. - smoothstep(0., .05, uWetD + uSnowD); vec3 s_ = reflectedLight.directDiffuse;
          reflectedLight.directDiffuse = mix(s_, vec3(dot(s_, vec3(.2126, .7152, .0722))), ${bleach.toFixed(3)} * g_); }`);
  };
  m.customProgramCacheKey = () => key; m.name = key;
  return m;
}

/** The dry-day earth and crown materials of this set of materials, made once (the site, the surround and the axis all ask). */
const made = new WeakMap();
export function dryMaterials(M) {
  if (!made.has(M)) made.set(M, { earth: dryCopy(M.earth, "dryEarth", 1, 0, 0.4), cedar: dryCopy(M.cedar, "dryCedar", [1.2, 1, 0.64], 0.7, 0.5),
    // the earth inside the walls, beside the path: withered grass, lighter and yellower than the town's dark earth (the art director, 2026-11-25: L* up by about 8, hue 75-90°, chroma 9 or less)
    grass: dryCopy(M.earth, "dryGrass", [2.5, 1.48, 0.84], 0.2, 0.4) });
  return made.get(M);
}
