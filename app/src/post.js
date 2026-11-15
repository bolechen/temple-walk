// The picture after the render: a little bloom and a clear landscape finish.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { NOISE } from "./glsl.js";

export function createPost(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality.msaa }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.7, 0.92);
  composer.addPass(bloom);
  // The finish, in one pass and in the light's own terms: exposure, the colour of the shadows and of the lights,
  // contrast about middle grey, saturation, a film's shoulder, and only then the screen's encoding and a little grain.
  // The values are planned like an ink painting: paper-white walls, one heavy dark for roofs and timber, mist between.
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uExp: { value: 1 }, uCon: { value: 1.1 },
      uSh: { value: new THREE.Vector3(0.93, 1, 1.035) }, uHi: { value: new THREE.Vector3(1.03, 1, 0.965) }, uSat: { value: 1.06 }, uLift: { value: 0.012 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }",
    fragmentShader: NOISE + /* glsl */`
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uT, uSat, uLift, uExp, uCon; uniform vec2 uRes; uniform vec3 uSh, uHi;
      vec3 film(vec3 x){ return x*(2.36*x+.035)/(x*(2.18*x+.66)+.16); }
      void main(){
        vec3 c=max(texture2D(tDiffuse,vUv).rgb,0.)*uExp; float l=dot(c,vec3(.2126,.7152,.0722));
        c*=mix(uSh,vec3(1.),smoothstep(0.,.3,l));                 // the colour of the shadows
        c*=mix(vec3(1.),uHi,smoothstep(.22,1.3,l));               // and of the lights
        c=pow(c/.18,vec3(uCon))*.18;                              // contrast, turning about middle grey
        l=dot(c,vec3(.2126,.7152,.0722)); c=max(mix(vec3(l),c,uSat*mix(1.,.8,smoothstep(.8,3.,l))),0.);   // saturation, easing off in the lights
        vec2 d=vUv-.5; c*=1.-dot(d,d)*.5;                         // vignette
        float m=max(c.r,max(c.g,c.b)); c=mix(film(c),c*(film(vec3(m)).r/max(m,1e-4)),.3);   // the shoulder, partly keeping hue
        c=c*(1.-uLift)+uLift;                                     // lifted blacks: the air is wet
        c=mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));
        c+=(h21(vUv*uRes+fract(uT)*91.)-.5)*.018;                 // grain, and dither against banding in the sky
        gl_FragColor=vec4(c,1.);
      }`,
  });
  composer.addPass(grade);
  return {
    resize(w, h, k) { composer.setPixelRatio(k); composer.setSize(w, h); grade.uniforms.uRes.value.set(w * k, h * k); bloom.enabled = quality.bloom; },
    render(t) { grade.uniforms.uT.value = t; composer.render(); },
    setMood(m) { const u = grade.uniforms; u.uSh.value.set(...m.sh); u.uHi.value.set(...m.hi); u.uSat.value = m.sat; u.uLift.value = m.lift; u.uExp.value = m.exp; u.uCon.value = m.con ?? 1.1; bloom.strength = m.bloom; },
  };
}
