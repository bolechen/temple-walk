// Everything beyond the walls: bamboo, then three ranges of hills lost progressively in the mist.
import * as THREE from "three";
import { NOISE, FOGLAYER, fogMix, U } from "./glsl.js";
import { FOG } from "./sky.js";

const bambooMat = (seed, tone) => new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uLen: { value: 1 }, uEnds: { value: new THREE.Vector2(0, 0) }, uT: { value: 0 }, uFog: { value: FOG }, uSeed: { value: seed }, uTone: { value: tone }, uFogD: U.uFogD, uFogLayer: U.uFogLayer, uLeaf: U.uLeaf, uLight: U.uLight },
  vertexShader: "varying vec2 vU; varying vec3 vWP; void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: NOISE + FOGLAYER + /* glsl */`
    varying vec2 vU; varying vec3 vWP; uniform float uT, uSeed, uTone, uFogD, uLen; uniform vec2 uEnds; uniform vec3 uFog, uLeaf, uLight; uniform vec4 uFogLayer;
    void main(){
      float x=vU.x+uSeed*37., y=vU.y, sway=sin(uT*.35+x*.2)*.12*smoothstep(4.,13.,y);
      // A free end of a band is not cut: the grove thins out over its last metres, the crowns sink and the rest goes into the mist.
      float ed=min(mix(1., smoothstep(0., 22., vU.x), uEnds.x), mix(1., smoothstep(0., 22., uLen-vU.x), uEnds.y));
      float thin=ed+(fbm2(vec2(x*.9,y*.35+uSeed))-.5)*.7;
      float top=(10.5+4.5*fbm2(vec2(x*.16,uSeed))+1.2*n2(vec2(x*1.1,3.)))-(1.-ed)*7.;
      // Culms: thin, slightly leaning.
      float cw=.42, cid=floor(x/cw), cx=(fract(x/cw)-.5)*cw+(h21(vec2(cid,uSeed))-.5)*.3+sway*.4+(y*.02)*(h21(vec2(cid,9.))-.5)*3.;
      float culm=(1.-smoothstep(.022,.04,abs(cx)))*step(y,top-1.5)*step(.25,h21(vec2(cid,4.)));
      // Leaves: drooping feathery masses, denser toward the crown.
      vec2 lp=vec2(x*1.6+sway*2., y*.85+n2(vec2(x*.5,y*.2))*2.);
      float leaf=fbm2(lp)*.62+fbm2(lp*3.1+7.)*.38;
      float crown=smoothstep(2.5,7.,y)*(1.-smoothstep(top-2.2,top,y));
      float a=smoothstep(.5,.56,leaf*.75+crown*.42)*step(y,top+fbm2(vec2(x*2.3,1.))*1.6-.8);
      a=max(a,step(y,4.6+n2(vec2(x*.8,7.))*1.2));
      a*=step(.3,thin); culm*=step(.3,thin);
      if(max(a,culm)<.5) discard;
      vec3 c=mix(vec3(.016,.034,.02),vec3(.06,.105,.05),smoothstep(.35,.8,leaf))*uTone; c=mix(c,vec3(.09,.12,.065)*uTone,culm*(1.-a));
      c*=.55+.6*smoothstep(0.,12.,y);                                  // darker inside the grove near the ground
      c*=uLeaf*uLight; float d=length(vWP-cameraPosition);
      ${fogMix("c", "d", "vWP.y")}
      c=mix(c,uFog,.3*(1.-uTone)); c=mix(c,uFog,(1.-ed)*.55);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

// The land itself outside the walls and on the hill: leaf litter and moss under the bamboo.
function createEarth(scene, M, terrain) {
  const g = new THREE.PlaneGeometry(280, 360, 140, 178).rotateX(-Math.PI / 2).translate(0, 0, -50), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrain(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  g.setAttribute("ao", new THREE.BufferAttribute(new Float32Array(p.count).fill(1), 1));
  const m = new THREE.Mesh(g, M.earth); m.receiveShadow = true; scene.add(m);
}

export function createBackdrop(scene, M, bounds, levels, terrain) {
  createEarth(scene, M, terrain);
  const mats = [], hills = [], H = 17, FOOT = 10,   // the grove stands on the slope, so its foot goes ten metres under the lowest ground it meets
     X = bounds.x, zS = bounds.apron;
  const band = (x0, z0, x1, z1, seed, tone, base = 0, ends = [0, 0]) => {
    const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, H + FOOT);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * (H + FOOT) - FOOT);   // the band's height above its foot; the thicket under it is solid
    const mat = bambooMat(seed, tone); mat.uniforms.uLen.value = len; mat.uniforms.uEnds.value.set(...ends); mats.push(mat);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, base + (H - FOOT) / 2 - 0.6, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    scene.add(m);
  };
  // The grove follows the land uphill in steps, on both sides, and closes behind the approach and above the summit.
  const L1 = levels[0], L2 = levels[1];
  const steps = [[zS + 14, bounds.fore, -13], [bounds.fore, L1.zS + 6, 0], [L1.zS + 6, L1.zN, L1.y - 0.4], [L1.zN, (L1.zN + L2.zS) / 2, L1.y + 1.2], [(L1.zN + L2.zS) / 2, L2.zS, L2.y - 2.2], [L2.zS, L2.zN - 16, L2.y + 0.6]];
  [[2.2, 1.0], [5.5, 0.82], [10, 0.62]].forEach(([o, tone], i) => {
    steps.forEach(([za, zb, base], k) => {
      const x = (k >= 3 ? X + 9 : X) + o + (k === 0 ? 16 : 0);
      // Neighbouring runs of the grove overlap by a stride and each thins out over it, so no run ends in a cut and the two make one stand.
      const north = k < steps.length - 1 ? 11 : 0, south = k > 0 ? 11 : 0;
      band(x, zb - north, x, za + south, i + k * 3 + 1, tone, base + o * 0.09, [1, k === 0 ? 0 : 1]); band(-x, za + south, -x, zb - north, i + k * 3 + 20, tone, base + o * 0.09, [k === 0 ? 0 : 1, 1]);   // the south corner is closed by the band across it
    });
    band(X + o + 28, zS + o + 2, -X - o - 28, zS + o + 2, i + 40, tone, -19);
    band(-X - o - 14, L2.zN - 3 - o, X + o + 14, L2.zN - 3 - o, i + 50, tone, L2.y + 1.5 + o * 0.3, [1, 1]);
  });
  // Five peaks stand round the temple, each range fainter than the one before.
  // The fourth ring, R190, is the skirt: it stands behind the grove's southern bands and goes down into the mist, so that an eye under the hills' feet sees wood and haze, not sky.
  [[150, 54, 0.5, 0.5, -4], [190, 34, 3.3, 0.62, -140], [215, 78, 2.1, 0.74, -4], [300, 112, 4.4, 0.88, -4]].forEach(([R, Hm, ph, k, foot]) => {   // the nearest is the wooded hill the temple sits in
    const g = new THREE.CylinderGeometry(R, R, 1, foot < -4 ? 180 : 360, 1, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const h = Hm * (0.42 + 0.34 * Math.pow(0.5 + 0.5 * Math.sin(a * 5 + ph), 1.6) + 0.1 * Math.sin(a * 11 + ph * 3) + 0.22 * Math.max(0, -Math.sin(a)));   // higher to the north
      const tops = Hm * (0.022 * Math.sin(a * 83 + ph * 7) + 0.016 * Math.sin(a * 211 + ph) + 0.012 * Math.sin(a * 137 + 1.7));   // the ragged line of tree tops
      p.setY(i, p.getY(i) > 0 ? Math.max(8, h + tops) : foot);
    }
    // A hill is not a flat cut-out: it stands in mist at its foot and darkens toward its crest, and the wood on it has a grain.
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uSk: { value: foot < -4 ? 1 : 0 }, uK: { value: k }, uFogD: U.uFogD, uTop: { value: new THREE.Color(0.1, 0.16, 0.13) }, uMist: { value: new THREE.Color(0.6, 0.65, 0.63) }, uH: { value: Hm } },
      vertexShader: "varying vec3 vP, vW; void main(){ vP=position; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: NOISE + `varying vec3 vP, vW; uniform vec3 uTop, uMist; uniform float uH, uFogD, uSk;
        // Noise round the circle: the angle jumps from pi to -pi behind the west, and noise on the raw angle jumps with it (a vertical hard edge).
        float ang(float a,float y,float f){ return fbm3(vec3(cos(a),sin(a),0.)*f+vec3(0.,0.,y)); }
        void main(){ float a=atan(vP.z,vP.x), up=clamp(vP.y/uH,0.,1.);
          float wood=ang(a,vP.y*.22,60.)*.5+ang(a,vP.y*.7,190.)*.5;
          float fg=1.-exp(-pow(abs(uFogD*length(vW-cameraPosition)),2.));
          float veil=smoothstep(.55,.05,up+(ang(a,up*3.,9.)-.5)*.35);            // mist lying in the folds, thickest low down
          vec3 c=mix(uTop*(.7+.6*wood),uMist,clamp(veil*.85,0.,1.));
          // Below the land the hill goes on down into the mist: wooded slope, hazed by the distance it is really at (the scene's own fog), not a white curtain.
          c=mix(c,mix(uTop*(.55+.4*wood),uMist,fg),smoothstep(3.,-6.,vP.y)*uSk);
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const m = new THREE.Mesh(g, mat); hills.push(mat);
    m.position.z = -45; scene.add(m);
  });
  return {
    update: (t) => { for (const m of mats) m.uniforms.uT.value = t; },
    setMood(m) { hills.forEach((h) => { const k = h.uniforms.uK.value * (m.haze ?? 1), L = U.uLight.value, c = [L.r, L.g, L.b].map((l, j) => m.hills[j] * l * (1 - k) + m.fog[j] * k); h.uniforms.uTop.value.setRGB(c[0], c[1], c[2]); h.uniforms.uMist.value.setRGB(m.fog[0], m.fog[1], m.fog[2]); }); },
  };
}
