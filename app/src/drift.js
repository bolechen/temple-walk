// What falls through the air: petals in spring, leaves in autumn, snow in winter, and on summer nights
// fireflies that rise instead. A cloud of points that follows the visitor, wrapping round as they walk.
import * as THREE from "three";
import { U } from "./glsl.js";
import { SHELTER } from "./shelter.js";
import { SOURCES, bakeFall } from "./fall.js";

// col: three hues a kind comes in; part: how many of the cloud are shown; near: none closer to the eye than this.
export const KINDS = {
  none:    { col: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], size: 0, fall: 0, sway: 0, op: 0, glow: 0, part: 0, near: 1, point: 0 },
  petal:   { col: [[1.0, 0.98, 0.94], [0.97, 0.94, 0.9], [1, 0.97, 0.96]], size: 0.06, fall: 0.5, sway: 0.7, op: 0.9, glow: 0, part: 0.45, near: 1.6, point: 0.12 },
  leaf:    { col: [[0.62, 0.15, 0.05], [0.86, 0.42, 0.08], [0.8, 0.58, 0.12]], size: 0.085, fall: 0.75, sway: 1.0, op: 0.95, glow: 0, part: 0.38, near: 1.6, point: 0.24 },
  snow:    { col: [[1, 1, 1], [0.95, 0.97, 1], [1, 1, 1]], size: 0.06, fall: 1.0, sway: 0.35, op: 0.9, glow: 0, part: 1, near: 0.7, point: 0 },
  firefly: { col: [[0.75, 1.0, 0.35], [0.8, 1.0, 0.4], [0.7, 1.0, 0.3]], size: 0.09, fall: -0.05, sway: 0.5, op: 1, glow: 1, part: 0.5, near: 0.5, point: 0 },
};

// Leaves and petals come from trees (fall.js): under a crown the cloud is this much denser than its even share, and
// `d` (0 to 1, the source map) scales that. Snow and fireflies take no map: d is 1 and they are as they were.
export const BOOST = 2.4;
export const shown = (kind, d) => Math.min(1, KINDS[kind].part * (SOURCES[kind] ? BOOST * d : 1));

export function createDrift(scene, count, trees = []) {
  const seed = new Float32Array(count * 4); for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
  const u = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() }, uSize: { value: 0 }, uFall: { value: 0 }, uSway: { value: 0 }, uOp: { value: 0 }, uGlow: { value: 0 }, uPx: { value: 800 }, uLight: { value: new THREE.Color(1, 1, 1) },
    uCol2: { value: new THREE.Color() }, uCol3: { value: new THREE.Color() }, uPart: { value: 1 }, uNear: { value: 1 }, uPoint: { value: 0 },
    tFall: { value: null }, uSrc: { value: new THREE.Vector4() }, uFromTrees: { value: 0 }, uBoost: { value: BOOST }, tShelter: U.tShelter, uShelter: U.uShelter };
  const maps = {};   // one source map for each kind that has trees to fall from, baked when first wanted
  const one = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat); one.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      ${SHELTER}
      uniform sampler2D tFall; uniform vec4 uSrc; uniform float uFromTrees, uBoost;
      attribute vec4 seed; uniform float uT, uSize, uFall, uSway, uPx, uGlow, uPart, uNear; uniform vec3 uCam; varying float vA; varying float vS; varying float vH;
      void main(){
        vec3 B=vec3(34.,13.,34.), p=seed.xyz*B;
        p.y-=uT*uFall*(.6+.8*seed.w); p.x+=sin(uT*.7+seed.w*40.)*uSway; p.z+=cos(uT*.53+seed.w*31.)*uSway*.7;
        p=mod(p-uCam+B*.5,B)-B*.5+uCam; p.y+=3.5;
        // Where it may be seen: near the trees it comes from (none a dozen metres off) and never under a roof.
        vec2 fuv=(p.xz-uSrc.xy)*uSrc.zw; float d=mix(1.,texture2D(tFall,fuv).r*uBoost*step(0.,min(fuv.x,fuv.y))*step(max(fuv.x,fuv.y),1.),uFromTrees)*(1.-shelter(p));
        vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=min(uSize*(.55+.9*seed.w)*uPx/max(-mv.z,.3),uPx*.022)*step(fract(seed.x*7.31+seed.z*3.7),uPart*d)*step(.001,d);
        float blink=mix(1.,smoothstep(.2,.9,sin(uT*(1.+seed.w*2.)+seed.x*30.)),uGlow);
        vA=blink*smoothstep(17.,11.,length(p.xz-uCam.xz))*smoothstep(uNear,uNear+1.4,-mv.z); vS=seed.w; vH=seed.z;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol, uCol2, uCol3, uLight; uniform float uOp, uGlow, uPoint, uT; varying float vA; varying float vS; varying float vH;
      void main(){
        // Each is turned its own way, and turns over as it falls: now broad, now edge-on.
        vec2 q=gl_PointCoord-.5; float a=vS*6.3+uT*(.4+vS), c=cos(a), s=sin(a); q=mat2(c,-s,s,c)*q;
        q.x/=mix(.3+.7*abs(sin(uT*1.7+vS*40.)),1.,uGlow);
        // A leaf is where two circles overlap: pointed at both ends. Snow and fireflies are round.
        float d=mix(length(q*vec2(1.,1.)),max(length(q-vec2(uPoint,0.)),length(q+vec2(uPoint,0.))),step(.001,uPoint));
        float m=mix(smoothstep(.5,.44,d),smoothstep(.5,0.,d),uGlow);
        vec3 hue=vH<.34?uCol:vH<.67?uCol2:uCol3;
        vec3 col=mix(hue*uLight*(.8+.4*vS)*(1.-.3*smoothstep(.05,0.,abs(q.x))*step(.001,uPoint)),hue*3.,uGlow);
        gl_FragColor=vec4(col,m*uOp*vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  return {
    setMood(m, light) {
      const k = KINDS[m.drift] || KINDS.none;
      u.uCol.value.fromArray(k.col[0]); u.uCol2.value.fromArray(k.col[1]); u.uCol3.value.fromArray(k.col[2]); u.uPart.value = k.part; u.uNear.value = k.near; u.uPoint.value = k.point; u.uSize.value = k.size; u.uFall.value = k.fall; u.uSway.value = k.sway; u.uOp.value = k.op; u.uGlow.value = k.glow;
      const key = SOURCES[m.drift] ? m.drift : null;
      if (key && !(key in maps)) { const b = bakeFall(trees, key); maps[key] = b && Object.assign(new THREE.DataTexture(b.data, b.W, b.H, THREE.RedFormat), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, needsUpdate: true, box: b.box }); }
      const mp = key && maps[key]; u.uFromTrees.value = key ? 1 : 0; u.tFall.value = mp || one; u.uSrc.value.fromArray(mp ? mp.box : [0, 0, 1, 1]);
      u.uLight.value.copy(light); pts.visible = k.op > 0; mat.blending = k.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    },
    update(t, cam, px) { u.uT.value = t; u.uCam.value.copy(cam); u.uPx.value = px; },
  };
}
