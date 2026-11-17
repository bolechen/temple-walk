// Soft shadows that harden where they touch: the shadow of an eave is a soft band twenty or thirty centimetres wide
// where it falls far below the roof, and the foot of a column is sharp where it meets the stone. That is what
// percentage-closer soft shadows (PCSS) do: find how far above the point the thing that shades it stands, and blur by
// that much.
//
// three draws the sun's shadow into a depth texture read through a comparing sampler, which answers "lit or not" and
// cannot say how deep the blocker is. So the search asks it the same question at four depths: is anything nearer the
// sun than this point by more than 0.6, 2.5 or 8 metres? The fraction that answers yes at each depth gives the
// blocker's mean distance, close enough to size the penumbra; eight taps over that width then make the shadow (each a
// hardware-filtered comparison of four texels). Where nothing in the search disc shades the point (most of what is
// lit), four taps are all it costs.
//
// It replaces three's own PCF function in the shader chunk, so every material that takes shadows takes these,
// the hand-lit paving included. It must be called before anything is compiled; the shadow map is still drawn only
// when the hour changes. `?off=softshadow` leaves three's PCF as it was; a negative shadow radius on the light (`sky.soft(false)`)
// falls back to it while walking.
import * as THREE from "three";

const SIGNATURE = "float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {";

// width, height: what the sun's shadow camera covers, in metres; depth: from its near plane to its far;
// spread: how wide the penumbra grows for each metre between the blocker and the point (the sun's disc, widened by
// haze); min, max: the narrowest and widest penumbra, in metres.
export function softShadowChunk(chunk, { width, height, depth, spread = 0.022, min = 0.05, max = 0.6 }) {
  if (!chunk.includes(SIGNATURE)) throw new Error("shadows.js: three's PCF shadow function is not where it was; check the chunk after an upgrade");
  const f = (v) => v.toFixed(6);
  const soft = /* glsl */`
  float getShadowPCF( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord );
  float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
    // A negative radius asks for three's plain PCF: how the quality governor gives the softness up without recompiling.
    if ( shadowRadius < 0.0 ) return getShadowPCF( shadowMap, shadowMapSize, shadowIntensity, shadowBias, - shadowRadius, shadowCoord );
    shadowCoord.xyz /= shadowCoord.w; shadowCoord.z += shadowBias;
    bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
    if ( !( inFrustum && shadowCoord.z <= 1.0 ) ) return 1.0;
    const vec2 perM = vec2( ${f(1 / width)}, ${f(1 / height)} );       // shadow-map uv per metre
    const float ZM = ${f(1 / depth)};                                       // shadow depth per metre
    float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
    vec2 search = perM * ${f(max * 0.75)};
    float near0 = 0.0;
    for ( int i = 0; i < 4; i ++ ) near0 += 1.0 - texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, 4, phi ) * search, shadowCoord.z ) );
    if ( near0 < 0.01 ) return 1.0;
    float near1 = 0.0, near2 = 0.0, near3 = 0.0;
    for ( int i = 0; i < 4; i ++ ) {
      vec2 p = shadowCoord.xy + vogelDiskSample( i, 4, phi ) * search;
      near1 += 1.0 - texture( shadowMap, vec3( p, shadowCoord.z - 0.6 * ZM ) );
      near2 += 1.0 - texture( shadowMap, vec3( p, shadowCoord.z - 2.5 * ZM ) );
      near3 += 1.0 - texture( shadowMap, vec3( p, shadowCoord.z - 8.0 * ZM ) );
    }
    // The blocker's mean distance in metres: each slice it lies beyond adds the step to the next slice's middle.
    float d = 0.3 + ( 1.25 * near1 + 3.7 * near2 + 6.75 * near3 ) / near0;
    float w = clamp( d * ${f(spread)}, ${f(min)}, ${f(max)} );
    vec2 r = perM * w * 0.5;
    float lit = 0.0;
    for ( int i = 0; i < 8; i ++ ) lit += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, 8, phi + 1.3 ) * r, shadowCoord.z ) );
    return mix( 1.0, lit / 8.0, shadowIntensity );
  }
  float getShadowPCF( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {`;
  return chunk.replace(SIGNATURE, soft);
}

let done = false;
export function softShadows(box) {
  if (done) return; done = true;
  THREE.ShaderChunk.shadowmap_pars_fragment = softShadowChunk(THREE.ShaderChunk.shadowmap_pars_fragment, box);
}
