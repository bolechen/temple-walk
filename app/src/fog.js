// The mist in layers. three's fog is the same at every height: a hill far off is as white at its crest as at its foot.
// Mountain air is not like that. Mist lies in the valleys and thins upward, so that from the summit the ranges stand
// one behind another with mist between them, and the near court is clear while the far hollows are full.
//
// This rewrites three's own fog chunks, so every material that takes fog takes the layers: the mean density along
// the line of sight is worked out from the heights of the eye and of the point (`fogLayer` in glsl.js). The strength
// and shape of the layer come from the hour (`fogLayer` in mood.js) through one shared uniform, `U.uFogLayer`, which
// every material is handed as it is compiled. With the strength at zero (summer by day, J01) nothing changes.
//
// A level may also name a closed hall the mist does not fill (`U.uFogShut`, FOGSHUT in glsl.js): the part of a line of sight
// inside it takes no mist, since the air in a shut hall is barely lit. T05's great hall is one; the prologue names none,
// and with none the sums are as before.
import * as THREE from "three";
import { U, FOGLAYER, FOGSHUT } from "./glsl.js";

let done = false;
export function layerFog() {
  if (done) return; done = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = "#ifdef USE_FOG\n varying float vFogDepth; varying float vFogY; varying vec3 vFogW;\n#endif\n";
  // The height of the point in the world, from its place before the eye: the view's rotation turned back and the eye's
  // own position added (a view matrix has no scale), so no model matrix is needed and instancing changes nothing.
  C.fog_vertex = "#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogY = cameraPosition.y + dot( viewMatrix[ 1 ].xyz, mvPosition.xyz );\n vFogW = cameraPosition + vec3( dot( viewMatrix[ 0 ].xyz, mvPosition.xyz ), dot( viewMatrix[ 1 ].xyz, mvPosition.xyz ), dot( viewMatrix[ 2 ].xyz, mvPosition.xyz ) );\n#endif\n";
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying float vFogY; varying vec3 vFogW; uniform vec4 uFogLayer;
  ${FOGLAYER}
  ${FOGSHUT}
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
#endif
`;
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogDepth = vFogDepth * ( 1.0 - fogShut( cameraPosition, vFogW ) );
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth * fogLayer( cameraPosition.y, vFogY, uFogLayer ) );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth * ( 1.0 - fogShut( cameraPosition, vFogW ) ) );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;
  // Every material is handed the shared uniform as it is compiled. Most of the scene's materials keep their own
  // onBeforeCompile (procMat, the crowns), so the hook sits under whatever is assigned: the prototype's property
  // becomes an accessor that wraps each assigned function. The wrapper prints as the function it wraps, because three
  // tells programs apart by that text (customProgramCacheKey). A material compiled without the uniform reads it as
  // zero, which is no layer at all.
  const proto = THREE.Material.prototype, base = proto.onBeforeCompile, OWN = Symbol("onBeforeCompile");
  const give = (sh) => { if (!sh.uniforms) return; if (!sh.uniforms.uFogLayer) sh.uniforms.uFogLayer = U.uFogLayer; if (!sh.uniforms.uFogShut) { sh.uniforms.uFogShut = U.uFogShut; sh.uniforms.uFogShutY = U.uFogShutY; } };
  const plain = function (sh) { give(sh); }; plain.toString = () => base.toString();
  Object.defineProperty(proto, "onBeforeCompile", {
    configurable: true,
    get() { return this[OWN] || plain; },
    set(fn) {
      if (typeof fn !== "function" || fn === plain) { this[OWN] = null; return; }
      const wrap = function (sh, r) { give(sh); return fn.call(this, sh, r); }; wrap.toString = () => fn.toString();
      this[OWN] = wrap;
    },
  });
}
