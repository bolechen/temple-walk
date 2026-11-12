// Overcast sky after rain, and the light that comes from it.
import * as THREE from "../v/build/three.module.js";
import { NOISE } from "./glsl.js";

export const FOG = new THREE.Color(0.70, 0.745, 0.74);
export const SUN_DIR = new THREE.Vector3(-0.45, 0.72, 0.53).normalize();

export function createSky(renderer, scene, quality, focus) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR }, uT: { value: 0 }, uFog: { value: FOG } },
    vertexShader: "varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: NOISE + /* glsl */`
      varying vec3 vD; uniform vec3 uSun, uFog; uniform float uT;
      void main(){
        vec3 d=normalize(vD); float up=max(d.y,0.);
        // A bright milky horizon, a heavier deck overhead, one thinner patch where the sun sits.
        vec2 cp=d.xz/(up+.18)*1.1+vec2(uT*.004,0.);
        float deck=fbm2(cp)*.65+fbm2(cp*2.7+3.)*.35;
        vec3 c=mix(uFog*1.08,vec3(.5,.545,.57),smoothstep(0.,.75,up));
        c*=mix(.82,1.18,smoothstep(.3,.75,deck));
        float s=max(dot(d,uSun),0.); c+=vec3(1.,.94,.82)*(pow(s,8.)*.22+pow(s,60.)*.35)*smoothstep(.35,.7,deck+.25);
        c=mix(uFog,c,smoothstep(-.02,.14,d.y));
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat);
  scene.add(dome);
  const env = new THREE.Scene(); env.add(new THREE.Mesh(dome.geometry, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();

  // A weak sun through the deck, just enough for form, and the whole sky as one soft light.
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
  sun.position.copy(SUN_DIR).multiplyScalar(140).add(new THREE.Vector3(focus[0], 0, focus[1]));
  sun.target.position.set(focus[0], 3, focus[1]);
  sun.castShadow = true; sun.shadow.mapSize.set(quality.shadow, quality.shadow); sun.shadow.radius = 5; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05;
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 92, bottom: -92, near: 10, far: 320 });
  scene.add(sun, sun.target, new THREE.HemisphereLight(new THREE.Color(0.86, 0.91, 0.93), new THREE.Color(0.3, 0.31, 0.28), 1.15));
  return { update: (t) => { mat.uniforms.uT.value = t; } };
}
