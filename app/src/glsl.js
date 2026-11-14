// Shader building blocks shared by every procedural material.
import * as THREE from "../v/build/three.module.js";

// What every shader needs to know about the hour and the season. One object each, shared by reference.
export const U = {
  uFogD: { value: 0.009 }, uSnow: { value: 0 }, uLamp: { value: 0 }, uWet: { value: 1 },
  uAmb: { value: new THREE.Color(0.78, 0.83, 0.84) }, uSunC: { value: new THREE.Color(0.42, 0.39, 0.34) },
  uLeaf: { value: new THREE.Color(1, 1, 1) }, uLight: { value: new THREE.Color(1, 1, 1) }, uT: { value: 0 },
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
  vec3 c=mix(vec3(.11,.062,.036),vec3(.27,.165,.095),g); c*=.82+.36*fine;
  float w=smoothstep(.42,.72,fbm3(p*.6+3.)); c=mix(c,vec3(.25,.225,.195),w*.42);
  return c*vec3(.63,.42,.4);     // toward the dark red-brown the real halls are stained
}`;

// Perturb a normal from a height value, using screen-space derivatives.
export const BUMP = /* glsl */`
vec3 bumpN(vec3 sp, vec3 N, float h){
  vec3 dpdx=dFdx(sp), dpdy=dFdy(sp); float dhx=dFdx(h), dhy=dFdy(h);
  vec3 r1=cross(dpdy,N), r2=cross(N,dpdx); float det=dot(dpdx,r1);
  vec3 g=sign(det)*(dhx*r1+dhy*r2); return normalize(abs(det)*N-g);
}`;

// Distance fog, matching THREE.FogExp2 so hand-written shaders sit in the same air.
export const FOG_DENSITY = 0.009;
export const fogMix = (c, d) => `${c}=mix(${c},uFog,1.-exp(-pow(${d}*uFogD,2.)));`;   // needs `uniform float uFogD`
