// The picture after the render: a little bloom with a film's warm halation round the lights, ambient occlusion where
// things meet (high tier), a clear landscape finish, a colour table for the season and the hour, and on a photograph
// or a photograph (when the visitor switches 虚化 on) a very shallow depth of field.
//
// Each part can be switched off on its own to see what it costs (`?off=` at load, `__part()` while walking):
// gtao, halation, lut, dof (and bloom, as before). The high tier keeps the scene's depth with its colour, which is
// what the occlusion and the depth of field read; the low and middle tiers keep no depth and draw neither.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { NOISE } from "./glsl.js";
import { bakeLut, isIdentity, LUT_SIZE, IDENTITY } from "./lut.js";

// Halation: film's red-orange glow round a bright light, from light scattered back off the base. Laid on the wide
// levels of the bloom only, so the near bloom stays neutral and the far glow warms.
const HALATION = [1, 0.64, 0.42], HAL_LEVELS = [0, 0.25, 0.6, 1, 1];

// One pixel that is not a number (a NaN or an infinity, in colour or alpha; the bloom's high pass mixes by alpha) becomes, through the
// bloom's widest blurs, a dark slab over most of the picture: on a T4 the T05 hall seen 10 m before its fifth figure came out three
// quarters dark, and only with the bloom on (#762; software rendering never showed it). Such a pixel gives the bloom nothing.
export const BLOOM_GUARD = "vec4 texel = texture2D( tDiffuse, vUv ); if ( any( isnan( texel ) ) || any( isinf( texel ) ) ) texel = vec4( 0.0 );";
export function guardBloom(bloom) {
  const m = bloom.materialHighPassFilter, line = "vec4 texel = texture2D( tDiffuse, vUv );";
  if (m.fragmentShader.includes(BLOOM_GUARD)) return bloom;
  if (!m.fragmentShader.includes(line)) throw new Error("post: the bloom's high pass no longer reads its texel as it did; the guard cannot be laid");
  m.fragmentShader = m.fragmentShader.replace(line, BLOOM_GUARD); m.needsUpdate = true;
  return bloom;
}

export function createPost(renderer, scene, camera, quality, off = new Set()) {
  const depth = !!quality.depth, rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality.msaa });
  if (depth) rt.depthTexture = new THREE.DepthTexture(4, 4);
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  // Ambient occlusion from the depth the scene has just written, normals worked out from that depth: the scene is not
  // drawn a second time (the frame is bound by triangles). Worked at half the size and denoised; laid on in the finish,
  // fading with distance so the mist is not darkened.
  let gtao = null;
  if (quality.gtao && depth) {
    gtao = new GTAOPass(scene, camera, 4, 4);
    gtao.setGBuffer(composer.renderTarget1.depthTexture);
    gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 8, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
    gtao.output = GTAOPass.OUTPUT.Off; gtao.needsSwap = false;
    const size = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => size(Math.max(1, w >> 1), Math.max(1, h >> 1));
    composer.addPass(gtao);
  }
  const bloom = guardBloom(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.7, 0.92));
  composer.addPass(bloom);
  const lut = new THREE.Data3DTexture(bakeLut(IDENTITY), LUT_SIZE, LUT_SIZE, LUT_SIZE);
  Object.assign(lut, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, wrapR: THREE.ClampToEdgeWrapping, unpackAlignment: 1, needsUpdate: true });
  // The finish, in one pass and in the light's own terms: exposure, the colour of the shadows and of the lights,
  // contrast about middle grey, saturation, a film's shoulder, and only then the screen's encoding, the colour table
  // and a little grain. The values are planned like an ink painting: paper-white walls, one heavy dark for roofs and
  // timber, mist between.
  const defines = {}; if (depth) defines.DEPTH = 1; if (gtao) defines.AO = 1;
  const grade = new ShaderPass({
    defines,
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uExp: { value: 1 }, uCon: { value: 1.1 },
      uSh: { value: new THREE.Vector3(0.93, 1, 1.035) }, uHi: { value: new THREE.Vector3(1.03, 1, 0.965) }, uSat: { value: 1.06 }, uLift: { value: 0.012 },
      tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 800 }, tAO: { value: null }, uAO: { value: 0 },
      uDof: { value: new THREE.Vector3(0, 0, 0) }, tLut: { value: null }, uLut: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }",
    fragmentShader: "#include <packing>\n" + NOISE + /* glsl */`
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uT, uSat, uLift, uExp, uCon, uAO, uLut, uNear, uFar; uniform vec2 uRes; uniform vec3 uSh, uHi, uDof;
      uniform highp sampler3D tLut;
      #ifdef DEPTH
        uniform sampler2D tDepth;
        float viewDist(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,uNear,uFar); }
      #endif
      #ifdef AO
        uniform sampler2D tAO;
      #endif
      vec3 film(vec3 x){ return x*(2.36*x+.035)/(x*(2.18*x+.66)+.16); }
      void main(){
        vec3 c=max(texture2D(tDiffuse,vUv).rgb,0.);
        #ifdef DEPTH
          float z=viewDist(vUv);
          // Depth of field, very shallow, for a photograph only, when switched on: uDof = (focus in metres, blur at
          // infinity in pixels, on). A thin lens: the blur grows as |1 - focus / distance|.
          if(uDof.z>.5){
            float coc=min(abs(1.-uDof.x/z),1.5)*uDof.y;
            if(coc>.35){ vec3 s=c; float n=1.; float ph=h21(vUv*uRes)*6.283;
              for(int i=0;i<12;i++){ float r=sqrt((float(i)+.5)/12.), a=float(i)*2.39996+ph; /* nan-ok: of a loop count, always above zero */ vec2 o=vec2(cos(a),sin(a))*r*coc/uRes;
                float zs=viewDist(vUv+o); float w=zs<z-.5?min(1.,abs(1.-uDof.x/zs)*uDof.y/max(coc,.01)):1.;   // a sharp thing in front is not smeared over what lies behind it
                s+=max(texture2D(tDiffuse,vUv+o).rgb,0.)*w; n+=w; }
              c=s/n; }
          }
        #endif
        #ifdef AO
          c*=mix(1.,texture2D(tAO,vUv).r,uAO*(1.-smoothstep(18.,70.,z)));      // where things meet; not in the mist
        #endif
        c*=uExp; float l=dot(c,vec3(.2126,.7152,.0722));
        c*=mix(uSh,vec3(1.),smoothstep(0.,.3,l));                 // the colour of the shadows
        c*=mix(vec3(1.),uHi,smoothstep(.22,1.3,l));               // and of the lights
        c=pow(max(c/.18,0.),vec3(uCon))*.18;                              // contrast, turning about middle grey
        l=dot(c,vec3(.2126,.7152,.0722)); c=max(mix(vec3(l),c,uSat*mix(1.,.8,smoothstep(.8,3.,l))),0.);   // saturation, easing off in the lights
        vec2 d=vUv-.5; c*=1.-dot(d,d)*.5;                         // vignette
        float m=max(c.r,max(c.g,c.b)); c=mix(film(c),c*(film(vec3(m)).r/max(m,1e-4)),.3);   // the shoulder, partly keeping hue
        c=c*(1.-uLift)+uLift;                                     // lifted blacks: the air is wet
        c=mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(.0031308,c));
        if(uLut>.5) c=texture(tLut,clamp(c,0.,1.)*${((LUT_SIZE - 1) / LUT_SIZE).toFixed(6)}+${(0.5 / LUT_SIZE).toFixed(6)}).rgb;   // the season's colour table
        c+=(h21(vUv*uRes+fract(uT)*91.)-.5)*.018;                 // grain, and dither against banding in the sky
        gl_FragColor=vec4(c,1.);
      }`,
  });
  composer.addPass(grade);
  const g = grade.uniforms;
  // A pass copies its uniforms; the textures it must share are handed over afterwards.
  g.tLut.value = lut; if (gtao) g.tAO.value = gtao.pdRenderTarget.texture;
  let mood = null, dof = 0;
  // What can be switched while walking; the shadow's softness and the leaves' shadows are decided at load.
  const on = { gtao: !!gtao && !off.has("gtao"), halation: !off.has("halation"), lut: !off.has("lut"), dof: depth && !!quality.dof && !off.has("dof") };
  // `bake`: the hour has changed, so the colour table is baked again (32³ colours on the CPU: never every frame).
  let baked = null, bakes = 0;
  const apply = () => {
    if (!mood) return;
    const hal = on.halation ? mood.hal ?? 0 : 0;
    bloom.bloomTintColors.forEach((v, i) => v.set(1 + (HALATION[0] - 1) * hal * HAL_LEVELS[i], 1 + (HALATION[1] - 1) * hal * HAL_LEVELS[i], 1 + (HALATION[2] - 1) * hal * HAL_LEVELS[i]));
    bloom.strength = mood.bloom * (1 + 0.6 * hal);
    const p = mood.lut || IDENTITY;
    g.uLut.value = on.lut && !isIdentity(p) ? 1 : 0;
    if (g.uLut.value && baked !== p) { lut.image.data.set(bakeLut(p)); lut.needsUpdate = true; baked = p; bakes++; }
    g.uAO.value = on.gtao ? mood.ao ?? 0.6 : 0; if (gtao) gtao.enabled = on.gtao;
    g.uDof.value.z = on.dof && dof > 0 ? 1 : 0;
  };
  return {
    size: () => [composer.renderTarget1.width, composer.renderTarget1.height],   // the frame as the scene is drawn into it (doorway-live.js draws a room the same size)
    resize(w, h, k) { composer.setPixelRatio(k); composer.setSize(w, h); g.uRes.value.set(w * k, h * k); g.uDof.value.y = 2.2 * (h * k) / 1080; bloom.enabled = quality.bloom; },
    render(t) {
      // The scene is always drawn into the first buffer, whose depth the occlusion and the depth of field read.
      if (composer.readBuffer !== composer.renderTarget1) composer.swapBuffers();
      g.uT.value = t; g.uNear.value = camera.near; g.uFar.value = camera.far; g.tDepth.value = depth ? composer.renderTarget1.depthTexture : null;
      composer.render();
    },
    setMood(m) { mood = m; g.uSh.value.set(...m.sh); g.uHi.value.set(...m.hi); g.uSat.value = m.sat; g.uLift.value = m.lift; g.uExp.value = m.exp; g.uCon.value = m.con ?? 1.1; apply(); },
    // The depth of field's focus, in metres (0: none). Only a raised camera with 虚化 on sets it.
    focus(metres) { dof = metres; g.uDof.value.x = Math.max(0.5, metres || 1); g.uDof.value.z = on.dof && dof > 0 ? 1 : 0; },
    // Switch one of the passes while walking; returns whether it is now drawn (null: no such pass on this tier).
    part(name, state) { if (!(name in on) || (name === "gtao" && !gtao) || (name === "dof" && !depth)) return null; on[name] = !!state; apply(); return on[name]; },
    parts: () => ({ ...on }),
    // What the quality governor gives up (quality.js): put out for the rest of the visit.
    off(name) { if (name in on) { on[name] = false; apply(); } },
    state: () => ({ depth, gtao: !!gtao && on.gtao, halation: on.halation && (mood?.hal ?? 0) > 0, lut: !!g.uLut.value, dof: !!g.uDof.value.z, focus: dof, bakes }),
  };
}
