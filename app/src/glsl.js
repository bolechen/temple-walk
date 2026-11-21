// Shader building blocks shared by every procedural material.
import * as THREE from "three";

// What every shader needs to know about the hour and the season. One object each, shared by reference.
// A texture of one empty point, so that a sampler always has something of its own kind to read (an integer sampler left
// with three's default texture makes the whole draw invalid).
function oneTexel(data, format, type, internal = null) { const t = new THREE.DataTexture(data, 1, 1, format, type); if (internal) t.internalFormat = /** @type {any} */ (internal); t.unpackAlignment = 1; t.needsUpdate = true; return t; }
export const U = {
  uFogD: { value: 0.009 }, uSnow: { value: 0 }, uLamp: { value: 0 }, uWet: { value: 1 },
  // the breeze (wind.js): how it blows now, in m/s along x and z, and how far it has carried the air since the page opened
  uWind: { value: new THREE.Vector2(0, 0) }, uWindPath: { value: new THREE.Vector2(0, 0) },
  uAmb: { value: new THREE.Color(0.78, 0.83, 0.84) }, uSunC: { value: new THREE.Color(0.42, 0.39, 0.34) },
  uLeaf: { value: new THREE.Color(1, 1, 1) }, uLight: { value: new THREE.Color(1, 1, 1) }, uT: { value: 0 },
  // Where he has walked in the snow (trail.js): the picture of his prints, and where it lies.
  tTrail: { value: null }, uTrail: { value: new THREE.Vector4(0, 0, 1 / 32, 0) },
  // What the roofs keep dry (shelter.js): the map, and where it lies (zero until the place is built).
  tShelter: { value: null }, uShelter: { value: new THREE.Vector4(0, 0, 0, 0) },
  // Where leaves and petals come from (fall.js, set by drift.js), and so where they lie on the paving: the map, where it
  // lies, how much lies there this season (0 when none), which channel of the map (leaf or petal) and the three colours.
  tFallMap: { value: null }, uFallBox: { value: new THREE.Vector4(0, 0, 0, 0) }, uLitter: { value: 0 }, uLitterCh: { value: new THREE.Vector3() }, uLitterCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
  // The ground's record of the leaves and petals that came down while he was here (litter.js): the texture, its square, whether it is read.
  tLitMem: { value: oneTexel(new Uint16Array(4), THREE.RGBAIntegerFormat, THREE.UnsignedShortType, "RGBA16UI") }, tLitCover: { value: oneTexel(new Uint8Array(2), THREE.RGFormat, THREE.UnsignedByteType) }, uLitMem: { value: new THREE.Vector4(0, 0, 4, 1) }, uLitOn: { value: 0 }, uLitBase: { value: 1 }, uLitMode: { value: 3 },
  // The colour of lamplight seen through paper (the lattice's glow after dusk), set by the hour (mood.js `win`).
  uWin: { value: new THREE.Color(0.8, 0.47, 0.18) },
  // The mist lies in layers (fog.js): how much of it follows the height (0: none, the air the same at every height),
  // the height it is thickest below, one over the height in which it thins by e, and how many times thicker it may
  // grow below that height.
  uFogLayer: { value: new THREE.Vector4(0, 0, 0.04, 2.5) },
  // A closed hall the mist does not fill (fog.js, FOGSHUT): its inside as a box, x0, z0, x1, z1 and the heights from
  // and to. The part of a line of sight that runs inside it takes no mist, for the air in a shut hall is barely lit.
  // A level that has no such hall sets none, and an empty box (x0 >= x1, as here) changes nothing.
  uFogShut: { value: new THREE.Vector4(0, 0, 0, 0) },
  uFogShutY: { value: new THREE.Vector2(0, 0) },
};

export const NOISE = /* glsl */`
float h21(vec2 p){ p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y); }
float h31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float n3(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm2(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n2(p); p=mat2(1.62,1.22,-1.22,1.62)*p+17.; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.03+7.; a*=.5; } return s; }
`;

// Old unpainted timber: warm dark brown, bleached silver-grey where weather reaches it.
export const WOOD = /* glsl */`
vec3 woodCol(vec3 p, vec3 grain){
  float g=fbm3(p*grain), fine=n3(p*grain*7.);
  vec3 c=mix(vec3(.085,.055,.038),vec3(.2,.135,.09),g); c*=.82+.36*fine;
  float w=smoothstep(.42,.72,fbm3(p*.6+3.)); c=mix(c,vec3(.25,.225,.195),w*.42);
  return c*vec3(.63,.42,.4);     // toward the dark red-brown the real halls are stained
}`;

// Perturb a normal from a height value, using screen-space derivatives.
export const BUMP = /* glsl */`
vec3 bumpN(vec3 sp, vec3 N, float h){
  vec3 dpdx=dFdx(sp), dpdy=dFdy(sp); float dhx=dFdx(h), dhy=dFdy(h);
  vec3 r1=cross(dpdy,N), r2=cross(N,dpdx); float det=dot(dpdx,r1);
  vec3 g=sign(det)*(dhx*r1+dhy*r2); return normalize(abs(det)*N-g); /* nan-ok: of no length only on a degenerate face; its one caller (procMat) keeps the old normal unless the result's length is sane */
}`;

// Layered mist: how much thicker (or thinner) the air is along a line of sight from a height yc to a height yp than
// the mist's plain density says. The density falls off upward as exp(-(y - base) / H); this is its mean along the line,
// worked out exactly, then mixed with the plain air by the layer's strength. With no layer (L.x = 0) it is 1.
export const FOGLAYER = /* glsl */`
float fogLayer(float yc, float yp, vec4 L){
  if(L.x<=0.) return 1.;
  float a=clamp((yc-L.y)*L.z,-L.w,24.), b=clamp((yp-L.y)*L.z,-L.w,24.), d=b-a;
  float mean=abs(d)<1e-3?exp(-a):(exp(-a)-exp(-b))/d;
  return 1.-L.x+L.x*mean;
}`;

// How much of a line of sight, from the eye c to the point p, runs inside the shut hall's box (uFogShut, uFogShutY), as a
// share of its length from 0 to 1: the slab test, clipped to the segment. An empty box (x0 >= x1) answers 0 before any
// sum, so a level without a hall draws exactly as before. `fogShut` below is the same sum in JavaScript, for the tests.
export const FOGSHUT = /* glsl */`
uniform vec4 uFogShut; uniform vec2 uFogShutY;
float fogShut(vec3 c, vec3 p){
  if(uFogShut.x>=uFogShut.z) return 0.;
  vec3 d=p-c, lo=vec3(uFogShut.x,uFogShutY.x,uFogShut.y), hi=vec3(uFogShut.z,uFogShutY.y,uFogShut.w);
  vec3 inv=1./mix(d,vec3(1e-6),vec3(lessThan(abs(d),vec3(1e-6))));
  vec3 t0=(lo-c)*inv, t1=(hi-c)*inv, a=min(t0,t1), b=max(t0,t1);
  return clamp(min(min(b.x,b.y),min(b.z,1.))-max(max(a.x,a.y),max(a.z,0.)),0.,1.);
}`;
/** @param {number[]} c @param {number[]} p @param {{ x0: number, z0: number, x1: number, z1: number, y0: number, y1: number } | null} box */
export function fogShut(c, p, box) {
  if (!box || box.x0 >= box.x1) return 0;
  const lo = [box.x0, box.y0, box.z0], hi = [box.x1, box.y1, box.z1];
  let a = 0, b = 1;
  for (let i = 0; i < 3; i++) {
    const d = p[i] - c[i], inv = 1 / (Math.abs(d) < 1e-6 ? 1e-6 : d), t0 = (lo[i] - c[i]) * inv, t1 = (hi[i] - c[i]) * inv;
    a = Math.max(a, Math.min(t0, t1)); b = Math.min(b, Math.max(t0, t1));
  }
  return Math.min(1, Math.max(0, b - a));
}

// Distance fog, matching THREE.FogExp2 so hand-written shaders sit in the same air; given the height of the point,
// the mist's layers too (needs FOGLAYER and `uniform vec4 uFogLayer`); given the point in the world, none along the part of
// the line inside a shut hall (needs FOGSHUT).
export const FOG_DENSITY = 0.009;
export const fogMix = (c, d, y, wp) => {
  const dd = wp ? `(${d})*(1.-fogShut(cameraPosition,${wp}))` : d;
  return y
    ? `${c}=mix(${c},uFog,1.-exp(-pow(abs(${dd}*uFogD),2.)*fogLayer(cameraPosition.y,${y},uFogLayer)));`
    : `${c}=mix(${c},uFog,1.-exp(-pow(abs(${dd}*uFogD),2.)));`;   // needs `uniform float uFogD`
};
