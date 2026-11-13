// Everything beyond the walls: bamboo, then three ranges of hills lost progressively in the mist.
import * as THREE from "../v/build/three.module.js";
import { NOISE, fogMix, U } from "./glsl.js";
import { FOG } from "./sky.js";

const bambooMat = (seed, tone) => new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uT: { value: 0 }, uFog: { value: FOG }, uSeed: { value: seed }, uTone: { value: tone }, uFogD: U.uFogD, uLeaf: U.uLeaf, uLight: U.uLight },
  vertexShader: "varying vec2 vU; varying vec3 vWP; void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: NOISE + /* glsl */`
    varying vec2 vU; varying vec3 vWP; uniform float uT, uSeed, uTone, uFogD; uniform vec3 uFog, uLeaf, uLight;
    void main(){
      float x=vU.x+uSeed*37., y=vU.y, sway=sin(uT*.35+x*.2)*.12*smoothstep(4.,13.,y);
      float top=10.5+4.5*fbm2(vec2(x*.16,uSeed))+1.2*n2(vec2(x*1.1,3.));
      // Culms: thin, slightly leaning.
      float cw=.42, cid=floor(x/cw), cx=(fract(x/cw)-.5)*cw+(h21(vec2(cid,uSeed))-.5)*.3+sway*.4+(y*.02)*(h21(vec2(cid,9.))-.5)*3.;
      float culm=(1.-smoothstep(.022,.04,abs(cx)))*step(y,top-1.5)*step(.25,h21(vec2(cid,4.)));
      // Leaves: drooping feathery masses, denser toward the crown.
      vec2 lp=vec2(x*1.6+sway*2., y*.85+n2(vec2(x*.5,y*.2))*2.);
      float leaf=fbm2(lp)*.62+fbm2(lp*3.1+7.)*.38;
      float crown=smoothstep(2.5,7.,y)*(1.-smoothstep(top-2.2,top,y));
      float a=smoothstep(.5,.56,leaf*.75+crown*.42)*step(y,top+fbm2(vec2(x*2.3,1.))*1.6-.8);
      a=max(a,step(y,4.6+n2(vec2(x*.8,7.))*1.2));
      if(max(a,culm)<.5) discard;
      vec3 c=mix(vec3(.025,.06,.03),vec3(.17,.3,.1),smoothstep(.35,.8,leaf))*uTone; c=mix(c,vec3(.22,.28,.12)*uTone,culm*(1.-a));
      c*=.55+.6*smoothstep(0.,12.,y);                                  // darker inside the grove near the ground
      c*=uLeaf*uLight; float d=length(vWP-cameraPosition);
      ${fogMix("c", "d")}
      c=mix(c,uFog,.3*(1.-uTone));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

// The land itself outside the walls and on the hill: leaf litter and moss under the bamboo.
function createEarth(scene, M, terrain) {
  const g = new THREE.PlaneGeometry(280, 360, 140, 180).rotateX(-Math.PI / 2).translate(0, 0, -50), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrain(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  g.setAttribute("ao", new THREE.BufferAttribute(new Float32Array(p.count).fill(1), 1));
  const m = new THREE.Mesh(g, M.earth); m.receiveShadow = true; scene.add(m);
}

export function createBackdrop(scene, M, bounds, levels, terrain) {
  createEarth(scene, M, terrain);
  const mats = [], hills = [], H = 17, X = bounds.x, zS = bounds.apron;
  const band = (x0, z0, x1, z1, seed, tone, base = 0) => {
    const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, H);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * H);
    const mat = bambooMat(seed, tone); mats.push(mat);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, base + H / 2 - 0.6, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    scene.add(m);
  };
  // The grove follows the land uphill in steps, on both sides, and closes behind the approach and above the summit.
  const L1 = levels[0], L2 = levels[1];
  const steps = [[zS + 14, bounds.fore, -13], [bounds.fore, L1.zS + 6, 0], [L1.zS + 6, L1.zN, L1.y - 0.4], [L1.zN, (L1.zN + L2.zS) / 2, L1.y + 1.2], [(L1.zN + L2.zS) / 2, L2.zS, L2.y - 2.2], [L2.zS, L2.zN - 16, L2.y + 0.6]];
  [[2.2, 1.0], [5.5, 0.82], [10, 0.62]].forEach(([o, tone], i) => {
    steps.forEach(([za, zb, base], k) => {
      const x = (k >= 3 ? X + 9 : X) + o + (k === 0 ? 16 : 0);
      band(x, zb, x, za, i + k * 3 + 1, tone, base + o * 0.09); band(-x, za, -x, zb, i + k * 3 + 20, tone, base + o * 0.09);
    });
    band(X + o + 28, zS + o + 2, -X - o - 28, zS + o + 2, i + 40, tone, -19);
    band(-X - o - 14, L2.zN - 3 - o, X + o + 14, L2.zN - 3 - o, i + 50, tone, L2.y + 1.5 + o * 0.3);
  });
  // Five peaks stand round the temple, each range fainter than the one before.
  [[150, 46, 0.5], [215, 74, 2.1], [300, 110, 4.4]].forEach(([R, Hm, ph]) => {
    const g = new THREE.CylinderGeometry(R, R, 1, 120, 1, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const h = Hm * (0.42 + 0.34 * Math.pow(0.5 + 0.5 * Math.sin(a * 5 + ph), 1.6) + 0.1 * Math.sin(a * 11 + ph * 3) + 0.22 * Math.max(0, -Math.sin(a)));   // higher to the north
      p.setY(i, p.getY(i) > 0 ? Math.max(8, h) : -4);
    }
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.16, 0.13), side: THREE.BackSide })); hills.push(m.material);
    m.position.z = -45; scene.add(m);
  });
  return {
    update: (t) => { for (const m of mats) m.uniforms.uT.value = t; },
    setMood(m) { for (const h of hills) h.color.setRGB(m.hills[0] * U.uLight.value.r, m.hills[1] * U.uLight.value.g, m.hills[2] * U.uLight.value.b); },
  };
}
