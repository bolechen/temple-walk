// The sky at any hour, and the light that comes from it.
import * as THREE from "three";
import { NOISE, U } from "./glsl.js";

// Shared by reference with every shader that fogs or lights by hand; `setMood` changes them in place.
export const FOG = new THREE.Color(0.70, 0.745, 0.74);
// The temple faces south-east down the mountain (+z); morning light comes from the east, front and right.
export const SUN_DIR = new THREE.Vector3(0.5, 0.68, 0.53).normalize();
// What the sun's shadow camera covers, in metres (across, up the mountain, and from its near plane to its far):
// the soft shadows (shadows.js) measure their penumbra in these.
export const SHADOW_BOX = { width: 124, height: 256, depth: 410 };

export function createSky(renderer, scene, quality, focus) {
  const u = {
    uSun: { value: SUN_DIR }, uT: { value: 0 }, uFog: { value: FOG },
    uZen: { value: new THREE.Color(0.36, 0.52, 0.74) }, uHor: { value: new THREE.Color(0.8, 0.86, 0.9) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.86) },
    uCloud: { value: 0.9 }, uStars: { value: 0 }, uGlow: { value: 0.6 }, uDisk: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: "varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: NOISE + /* glsl */`
      varying vec3 vD; uniform vec3 uSun, uFog, uZen, uHor, uSunCol; uniform float uT, uCloud, uStars, uGlow, uDisk;
      void main(){
        vec3 d=normalize(vD); float up=max(d.y,0.), s=max(dot(d,uSun),0.);
        vec3 c=mix(uHor,uZen,pow(max(smoothstep(0.,.85,up),0.),.55));
        c+=uSunCol*(pow(max(s,0.),5.)*.22+pow(max(s,0.),40.)*.5)*uGlow;                      // the glow round the sun, or the moon
        // Stars: one to a cell of the sphere, each with its own slow shimmer.
        vec3 q=d*190.; float h=h31(floor(q));
        c+=step(.9968,h)*smoothstep(.5,.05,length(fract(q)-.5))*uStars*(.55+.45*sin(uT*1.7+h*90.))*smoothstep(.03,.3,d.y)*vec3(.9,.95,1.)*1.6;
        float disk=smoothstep(.99935,.99965,dot(d,uSun))*uDisk;
        // Clouds: a deck that thins to wisps as the weather clears, lit from the side the sun is on.
        vec2 cp=d.xz/(up+.18)*1.1+vec2(uT*.004,0.);
        float deck=fbm2(cp)*.65+fbm2(cp*2.7+3.)*.35;
        float cov=smoothstep(.95-uCloud*.75,1.2-uCloud*.75,deck+.22)*smoothstep(0.,.16,d.y);
        vec3 cloud=mix(uHor*.82+uZen*.12,uSunCol*1.05,pow(max(s,0.),2.5)*.65+.12)*mix(.74,1.06,smoothstep(.25,.85,deck));
        c=mix(c+uSunCol*disk*3.*(1.-cov),cloud,cov*.92);
        c=mix(uFog,c,smoothstep(-.02,.14,d.y));
        gl_FragColor=vec4(min(c,vec3(6.)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat);
  scene.add(dome);
  const env = new THREE.Scene(); env.add(new THREE.Mesh(dome.geometry, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  let envRT = pm.fromScene(env, 0.02); scene.environment = envRT.texture;

  const at = new THREE.Vector3(focus[0], 0, focus[1]);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
  sun.target.position.set(focus[0], 3, focus[1]);
  // The shadow map is long, like the temple: its long side runs up the mountain (the camera's "up" is north), so
  // the foot of the approach and the summit are both inside it at every hour.
  sun.castShadow = true; sun.shadow.mapSize.set(quality.shadow, quality.shadowLong); sun.shadow.radius = 2.5; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  Object.assign(sun.shadow.camera, { left: -SHADOW_BOX.width / 2, right: SHADOW_BOX.width / 2, top: SHADOW_BOX.height / 2, bottom: -SHADOW_BOX.height / 2, near: 10, far: 10 + SHADOW_BOX.depth }); sun.shadow.camera.up.set(0, 0, -1);
  const hemi = new THREE.HemisphereLight(new THREE.Color(0.86, 0.91, 0.93), new THREE.Color(0.3, 0.31, 0.28), 1.15);
  sun.position.copy(SUN_DIR).multiplyScalar(170).add(at);
  scene.add(sun, sun.target, hemi);

  return {
    // The dome is finite. A door-view cube camera on the summit porch is more than a hundred metres from the
    // middle of the mountain; from there its far side lies beyond that camera's 700 m far plane, leaving a black
    // hole above the hills. For one capture the sphere is centred on the cube camera, so every face sees sky.
    // The shader reads local position as the view direction, so no direction is changed by the move.
    at(x, y, z) { dome.position.set(x, y, z); },
    update: (t) => { u.uT.value = t; },
    // Indoors neither the sun nor much of the sky reaches: the lamps do the work. The next setMood restores them.
    indoors() { sun.intensity = 0; hemi.intensity *= 0.3; },
    // The soft shadows (shadows.js) on or off while walking: a negative radius sends the shader back to plain PCF.
    soft(on) { sun.shadow.radius = on ? Math.abs(sun.shadow.radius) : -Math.abs(sun.shadow.radius); },
    get softOn() { return sun.shadow.radius > 0; },
    // Everything the hour and the season decide about light. The caller redraws the shadows afterwards.
    setMood(m) {
      SUN_DIR.fromArray(m.sun).normalize(); FOG.fromArray(m.fog);
      u.uZen.value.fromArray(m.zen); u.uHor.value.fromArray(m.hor); u.uSunCol.value.fromArray(m.sunCol);
      u.uCloud.value = m.cloud; u.uStars.value = m.stars; u.uGlow.value = m.glow; u.uDisk.value = m.disk;
      sun.position.copy(SUN_DIR).multiplyScalar(190).add(at); sun.color.fromArray(m.sunCol); sun.intensity = m.sunI;
      hemi.color.fromArray(m.hemiS); hemi.groundColor.fromArray(m.hemiG); hemi.intensity = m.hemiI;
      U.uAmb.value.fromArray(m.hemiS).multiplyScalar(m.hemiI * 0.82); U.uSunC.value.fromArray(m.sunCol).multiplyScalar(m.sunI * 0.2);
      const l = U.uLight.value.fromArray(m.hemiS).multiplyScalar(m.hemiI * 0.6); l.r += m.sunCol[0] * m.sunI * 0.14; l.g += m.sunCol[1] * m.sunI * 0.14; l.b += m.sunCol[2] * m.sunI * 0.14;
      scene.fog.color.copy(FOG); scene.fog.density = U.uFogD.value = m.fogD;
      const next = pm.fromScene(env, 0.02); scene.environment = next.texture; envRT.dispose(); envRT = next;
    },
  };
}
