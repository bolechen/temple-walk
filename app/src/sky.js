// The sky at any hour, and the light that comes from it.
import * as THREE from "three";
import { NOISE, U } from "./glsl.js";
import { SKY_TRIAL } from "./atmosphere.js";

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
    // Trial B (#592, atmosphere.js): the sky's colour over the sphere from where the sun stands; `uSkyK` sets its lightness to the table's, `uSkyOver` is how much of the sky is still the table's own (cloud), `uSkyOn` 0 for the sky as it was.
    tSky: { value: new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType) }, uSkyK: { value: 1 }, uSkyOver: { value: 1 }, uSkyOn: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: "varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: NOISE + /* glsl */`
      varying vec3 vD; uniform vec3 uSun, uFog, uZen, uHor, uSunCol; uniform float uT, uCloud, uStars, uGlow, uDisk, uSkyK, uSkyOver, uSkyOn; uniform sampler2D tSky;
      void main(){
        vec3 d=normalize(vD); float up=max(d.y,0.), s=max(dot(d,uSun),0.);
        vec3 c=mix(uHor,uZen,pow(max(smoothstep(0.,.85,up),0.),.55));
        c+=uSunCol*(pow(max(s,0.),5.)*.22+pow(max(s,0.),40.)*.5)*uGlow;                      // the glow round the sun, or the moon
        if(uSkyOn>.5){   // trial B: the colour the air gives (atmosphere.js), over the table's own as far as there is no cloud
          float el_=asin(clamp(d.y,-1.,1.)); vec2 hs_=normalize(d.xz+1e-5), sh_=normalize(uSun.xz+1e-5);
          vec2 tuv=vec2(acos(clamp(dot(hs_,sh_),-1.,1.))/3.14159265, sqrt(clamp((el_+.1)/(1.5707963+.1),0.,1.)));
          vec3 L=texture2D(tSky,tuv).rgb*uSkyK; L=mix(L,1.+log(max(L,vec3(1.))),step(vec3(1.),L));   // above 1 the aureole is let in softly
          c=mix(L,c,uSkyOver);
        }
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
  u.tSky.value.needsUpdate = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat);
  scene.add(dome);
  // No light is taken from the sky as an environment map. One was baked here from the dome until #749, by a cube camera that
  // sees 100 m while the dome stands at 600: it saw only the clear colour, black, so every lit surface looked up two mip levels
  // of nothing in every frame. Leaving it out leaves the picture exactly as it was. A sky that truly lights the surfaces is a
  // change of the picture, for the art review (the figures in T05's hall keep their own probe of the hall, figures/load.js).
  scene.environment = null;

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
  let sunI = sun.intensity, sunK = 1, last = null, skyTex = null;   // the hour's strength, and a tool's multiplier on it (`scaleSun`)
  // What the sun gives the surfaces that are lit by hand (the paving, the trees' leaves, the novice) and the light of the
  // air they all read, from the hour's table; `sunK` is 1 but for a measuring tool.
  const lit = (m) => {
    U.uSunC.value.fromArray(m.sunCol).multiplyScalar(m.sunI * sunK * 0.2);
    const l = U.uLight.value.fromArray(m.hemiS).multiplyScalar(m.hemiI * 0.6); l.r += m.sunCol[0] * m.sunI * sunK * 0.14; l.g += m.sunCol[1] * m.sunI * sunK * 0.14; l.b += m.sunCol[2] * m.sunI * sunK * 0.14;   // as it was written before `sunK`: with 1 the same numbers to the last bit (J01, #488)
  };

  return {
    // The dome is finite. A door-view cube camera on the summit porch is more than a hundred metres from the
    // middle of the mountain; from there its far side lies beyond that camera's 700 m far plane, leaving a black
    // hole above the hills. For one capture the sphere is centred on the cube camera, so every face sees sky.
    // The shader reads local position as the view direction, so no direction is changed by the move.
    at(x, y, z) { dome.position.set(x, y, z); },
    update: (t) => { u.uT.value = t; },
    // Indoors neither the sun nor much of the sky reaches: the lamps do the work. The next setMood restores them.
    indoors() { sun.intensity = 0; hemi.intensity *= 0.3; },
    // For measuring tools only (tools/sun-lit.cjs): the sun's light times `k`, 0 for none, on everything it lights, the sky and the lamps as they are.
    scaleSun(k) { sunK = k; sun.intensity = sunI * sunK; if (last) lit(last); },
    // The soft shadows (shadows.js) on or off while walking: a negative radius sends the shader back to plain PCF.
    soft(on) { sun.shadow.radius = on ? Math.abs(sun.shadow.radius) : -Math.abs(sun.shadow.radius); },
    get softOn() { return sun.shadow.radius > 0; },
    // Everything the hour and the season decide about light. The caller redraws the shadows afterwards.
    setMood(m) {
      SUN_DIR.fromArray(m.sun).normalize(); FOG.fromArray(m.fog);
      u.uZen.value.fromArray(m.zen); u.uHor.value.fromArray(m.hor); u.uSunCol.value.fromArray(m.sunCol);
      u.uCloud.value = m.cloud; u.uStars.value = m.stars; u.uGlow.value = m.glow; u.uDisk.value = m.disk;
      if (SKY_TRIAL.on && m.sky) {   // trial B: this hour's table of the sky's colour, as half floats
        const a = m.sky.table, h = new Uint16Array(a.data.length); for (let i = 0; i < h.length; i++) h[i] = THREE.DataUtils.toHalfFloat(Math.min(a.data[i], 6e4));
        if (skyTex) skyTex.dispose(); skyTex = new THREE.DataTexture(h, a.W, a.H, THREE.RGBAFormat, THREE.HalfFloatType); skyTex.minFilter = skyTex.magFilter = THREE.LinearFilter; skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping; skyTex.needsUpdate = true;
        u.tSky.value = skyTex; u.uSkyK.value = m.sky.k; u.uSkyOver.value = m.sky.over; u.uSkyOn.value = 1;
      } else u.uSkyOn.value = 0;
      sun.position.copy(SUN_DIR).multiplyScalar(190).add(at); sun.color.fromArray(m.sunCol); sunI = m.sunI; sun.intensity = sunI * sunK;
      hemi.color.fromArray(m.hemiS); hemi.groundColor.fromArray(m.hemiG); hemi.intensity = m.hemiI;
      U.uAmb.value.fromArray(m.hemiS).multiplyScalar(m.hemiI * 0.82); last = m; lit(m);
      scene.fog.color.copy(FOG); scene.fog.density = U.uFogD.value = m.fogD;
    },
  };
}
