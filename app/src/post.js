// The picture after the render: a little bloom, tone mapping, then a grade.
import * as THREE from "../v/build/three.module.js";
import { EffectComposer } from "../v/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../v/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../v/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../v/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "../v/jsm/postprocessing/OutputPass.js";
import { NOISE } from "./glsl.js";

export function createPost(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality.msaa }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.7, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }",
    fragmentShader: NOISE + /* glsl */`
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRes;
      void main(){
        vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722));
        c=mix(c,c*vec3(.93,1.,1.035),(1.-l)*.55);          // cool, slightly green shadows
        c=mix(c,c*vec3(1.03,1.,.965),l*.45);               // warm highlights
        c=mix(vec3(l),c,1.06);
        c=mix(c,c*c*(3.-2.*c),.6);                         // S-curve
        c=c*.97+.012;                                      // lifted blacks: the air is wet
        vec2 d=vUv-.5; c*=1.-dot(d,d)*.6;                  // vignette
        c+=(h21(vUv*uRes+fract(uT)*91.)-.5)*.02;           // grain, and dither against banding in the sky
        gl_FragColor=vec4(c,1.);
      }`,
  });
  composer.addPass(grade);
  return {
    resize(w, h, k) { composer.setPixelRatio(k); composer.setSize(w, h); grade.uniforms.uRes.value.set(w * k, h * k); bloom.enabled = quality.bloom; },
    render(t) { grade.uniforms.uT.value = t; composer.render(); },
  };
}
