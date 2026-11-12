// Everything beyond the walls: bamboo, then three ranges of hills lost progressively in the mist.
import * as THREE from "../v/build/three.module.js";
import { NOISE, fogMix } from "./glsl.js";
import { FOG } from "./sky.js";

const bambooMat = (seed, tone) => new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uT: { value: 0 }, uFog: { value: FOG }, uSeed: { value: seed }, uTone: { value: tone } },
  vertexShader: "varying vec2 vU; varying vec3 vWP; void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: NOISE + /* glsl */`
    varying vec2 vU; varying vec3 vWP; uniform float uT, uSeed, uTone; uniform vec3 uFog;
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
      float d=length(vWP-cameraPosition);
      ${fogMix("c", "d")}
      c=mix(c,uFog,.3*(1.-uTone));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

export function createBackdrop(scene, bounds) {
  const mats = [], H = 16, { x: X, zN } = bounds, zS = bounds.apron;   // the grove closes behind the approach, not at the gate
  const band = (x0, z0, x1, z1, seed, tone) => {
    const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, H);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * H);
    const mat = bambooMat(seed, tone); mats.push(mat);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    scene.add(m);
  };
  [[2.2, 1.0], [5.5, 0.82], [10, 0.62]].forEach(([o, tone], i) => {
    band(-X - o - 12, zN - o, X + o + 12, zN - o, i + 1, tone); band(X + o, zN - o - 12, X + o, zS + o + 12, i + 4, tone);
    band(-X - o, zS + o + 12, -X - o, zN - o - 12, i + 7, tone); band(X + o + 12, zS + o + 3, -X - o - 12, zS + o + 3, i + 10, tone);
  });
  [[110, 34, 0.5], [165, 58, 2.1], [240, 86, 4.4]].forEach(([R, Hm, ph]) => {
    const g = new THREE.CylinderGeometry(R, R, 1, 96, 1, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const h = Hm * (0.45 + 0.3 * Math.sin(a * 2 + ph) + 0.16 * Math.sin(a * 5 + ph * 2) + 0.09 * Math.sin(a * 11 + ph * 3));
      p.setY(i, p.getY(i) > 0 ? Math.max(6, h) : -2);
    }
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.16, 0.13), side: THREE.BackSide }));
    m.position.z = (zN + zS) / 2; scene.add(m);
  });
  return { update: (t) => { for (const m of mats) m.uniforms.uT.value = t; } };
}
