// What falls through the air: petals in spring, leaves in autumn, snow in winter, and on summer nights
// fireflies that rise instead. A cloud of points that follows the visitor, wrapping round as they walk.
import * as THREE from "../v/build/three.module.js";

const KINDS = {
  none:    { col: [1, 1, 1], size: 0, fall: 0, sway: 0, op: 0, glow: 0 },
  petal:   { col: [1.0, 0.84, 0.9], size: 0.085, fall: 0.55, sway: 0.7, op: 0.92, glow: 0 },
  leaf:    { col: [0.92, 0.5, 0.1], size: 0.11, fall: 0.8, sway: 1.0, op: 0.95, glow: 0 },
  snow:    { col: [1, 1, 1], size: 0.07, fall: 1.0, sway: 0.35, op: 0.9, glow: 0 },
  firefly: { col: [0.75, 1.0, 0.35], size: 0.09, fall: -0.05, sway: 0.5, op: 1, glow: 1 },
};

export function createDrift(scene, count) {
  const seed = new Float32Array(count * 4); for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
  const u = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() }, uSize: { value: 0 }, uFall: { value: 0 }, uSway: { value: 0 }, uOp: { value: 0 }, uGlow: { value: 0 }, uPx: { value: 800 }, uLight: { value: new THREE.Color(1, 1, 1) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec4 seed; uniform float uT, uSize, uFall, uSway, uPx, uGlow; uniform vec3 uCam; varying float vA; varying float vS;
      void main(){
        vec3 B=vec3(34.,13.,34.), p=seed.xyz*B;
        p.y-=uT*uFall*(.6+.8*seed.w); p.x+=sin(uT*.7+seed.w*40.)*uSway; p.z+=cos(uT*.53+seed.w*31.)*uSway*.7;
        p=mod(p-uCam+B*.5,B)-B*.5+uCam; p.y+=3.5;
        vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=uSize*(.55+.9*seed.w)*uPx/max(-mv.z,.3);
        float blink=mix(1.,smoothstep(.2,.9,sin(uT*(1.+seed.w*2.)+seed.x*30.)),uGlow);
        vA=blink*smoothstep(17.,11.,length(p.xz-uCam.xz))*smoothstep(.2,1.2,-mv.z); vS=seed.w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol, uLight; uniform float uOp, uGlow; varying float vA; varying float vS;
      void main(){
        vec2 q=gl_PointCoord-.5; float a=vS*6.3, c=cos(a), s=sin(a); q=mat2(c,-s,s,c)*q; q.y*=mix(1.9,1.,uGlow);   // petals and leaves are longer than wide, each turned its own way
        float d=length(q); float m=mix(smoothstep(.5,.36,d),smoothstep(.5,0.,d),uGlow);
        vec3 col=mix(uCol*uLight*(.8+.4*vS),uCol*3.,uGlow);
        gl_FragColor=vec4(col,m*uOp*vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  return {
    setMood(m, light) {
      const k = KINDS[m.drift] || KINDS.none;
      u.uCol.value.setRGB(...k.col); u.uSize.value = k.size; u.uFall.value = k.fall; u.uSway.value = k.sway; u.uOp.value = k.op; u.uGlow.value = k.glow;
      u.uLight.value.copy(light); pts.visible = k.op > 0; mat.blending = k.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    },
    update(t, cam, px) { u.uT.value = t; u.uCam.value.copy(cam); u.uPx.value = px; },
  };
}
