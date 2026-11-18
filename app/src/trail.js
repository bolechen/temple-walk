// Where he has walked in the snow. Each time a shoe comes down, its sole is pressed into a picture of the ground
// round him (a square of `span` metres that moves with him, wrapping round as he walks, like the drifting snow).
// The red of a point is how deep it has been trodden; the green holds the height of the ground that was trodden,
// multiplied by the red, so that the snow on a roof above a porch does not take the prints made on the porch.
// Every shader that lays snow reads it (TRAIL below): the print is a dent, darker and a little blue at its floor,
// with a lit rim and a shaded one. Falling snow fills the prints again over a couple of minutes.
import * as THREE from "three";
import { U } from "./glsl.js";

// The heights the green can tell apart: the foot of the old path to the top of the summit tower's platform.
const Y0 = -24, Y1 = 40;
// The sole of a child's straw-soled shoe, a little larger than the shoe so that the snow is pushed aside.
const SOLE = { w: 0.11, l: 0.21 };

// How deep he has trodden at a point of a surface (x), and how the floor of the print slopes across x and z (y, z),
// in metres of depth per metre. Zero away from his prints, beyond the square, and when no snow lies.
export const TRAIL = /* glsl */`
uniform sampler2D tTrail; uniform vec4 uTrail;
vec3 trail(vec3 wp){
  if(uTrail.w<=0.) return vec3(0.);
  vec2 d=abs(wp.xz-uTrail.xy)*uTrail.z; if(max(d.x,d.y)>.48) return vec3(0.);
  vec2 uv=wp.xz*uTrail.z; vec2 s=texture2D(tTrail,uv).rg; if(s.r<.004) return vec3(0.);
  float h=mix(${Y0}.,${Y1}.,clamp(s.g/s.r,0.,1.)), k=smoothstep(.03,.5,s.r)*smoothstep(1.,.5,abs(wp.y-h));
  float sx=texture2D(tTrail,uv+vec2(uTrail.w,0.)).r, sz=texture2D(tTrail,uv+vec2(0.,uTrail.w)).r;
  float m=.04/(uTrail.w/uTrail.z);   // four centimetres deep at most, over one point of the picture
  return vec3(smoothstep(.03,.6,s.r),(sx-s.r)*m,(sz-s.r)*m)*k;
}`;

export function createTrail(renderer, { size = 2048, span = 32 } = {}) {
  const rt = new THREE.WebGLRenderTarget(size, size, { format: THREE.RGFormat, type: THREE.UnsignedByteType, depthBuffer: false,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  U.tTrail.value = rt.texture;
  const uT = U.uTrail.value;   // centre x, centre z, 1/span, 1/size (0 while no snow lies)
  // The picture is drawn on a sheet one unit square: u along x, v along z.
  const cam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1), scene = new THREE.Scene();
  // A sole: the ball of the foot and the heel, joined at the instep; deepest under the heel and the ball.
  const soleM = new THREE.ShaderMaterial({
    uniforms: { uH: { value: 0 }, uK: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 vQ; void main(){ vQ=(uv-.5)*vec2(" + SOLE.w + "," + SOLE.l + "); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: /* glsl */`
      uniform float uH, uK; varying vec2 vQ;
      float el(vec2 p, vec2 c, vec2 r){ return (length((p-c)/r)-1.)*min(r.x,r.y); }
      void main(){
        float ball=el(vQ,vec2(0.,.035),vec2(.043,.058)), heel=el(vQ,vec2(0.,-.052),vec2(.034,.04)), arch=el(vQ,vec2(.006,-.01),vec2(.03,.05));
        float k=.012, a=min(ball,heel), h=clamp(.5+.5*(arch-a)/k,0.,1.); float sdf=mix(arch,a,h)-k*h*(1.-h);
        float cover=smoothstep(.006,-.004,sdf), deep=.72+.28*max(smoothstep(.0,-.02,ball),smoothstep(.0,-.018,heel));
        float a2=cover*deep*uK; if(!(a2>=.002)) discard;
        gl_FragColor=vec4(1.,uH,0.,a2);
      }`,
  });
  const soles = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), soleM); m.scale.set(SOLE.w / span, SOLE.l / span, 1); scene.add(m); return m; });
  // Falling snow: once in a while the whole picture is laid over with a thin black, which takes a little off every print.
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.08, depthTest: false, depthWrite: false }));
  const fillScene = new THREE.Scene(); fillScene.add(fill);

  const queue = []; let on = false, cx = 0, cz = 0, placed = false, since = 0, count = 0, last = null;
  const step = span / 8, frac = (v) => v - Math.floor(v), clear0 = new THREE.Color(), was = new THREE.Color();
  // Draws into the picture, leaving the renderer as it found it. `rects`: [u0, v0, u1, v1] of the sheet to clear first.
  function into(fn, rects) {
    const target = renderer.getRenderTarget(), auto = renderer.autoClear, alpha = renderer.getClearAlpha(); renderer.getClearColor(was);
    renderer.autoClear = false; renderer.setClearColor(clear0, 0);
    for (const [u0, v0, u1, v1] of rects || []) {
      const x = Math.floor(u0 * size), y = Math.floor(v0 * size), w = Math.ceil(u1 * size) - x, h = Math.ceil(v1 * size) - y;
      rt.scissor.set(x, y, w, h); rt.scissorTest = !(x === 0 && y === 0 && w >= size && h >= size);
      renderer.setRenderTarget(rt); renderer.clear(true, false, false);
    }
    rt.scissorTest = false; renderer.setRenderTarget(rt);
    fn?.();
    renderer.setRenderTarget(target); renderer.autoClear = auto; renderer.setClearColor(was, alpha);
  }
  // A strip of the sheet between two coordinates (in sheet units, any number of turns round), split where it wraps.
  const strip = (a, b, along) => {
    if (b - a >= 1) return [[0, 0, 1, 1]];
    const s = frac(a), e = s + (b - a), parts = e <= 1 ? [[s, e]] : [[s, 1], [0, e - 1]];
    return parts.map(([p, q]) => (along ? [p, 0, q, 1] : [0, p, 1, q]));
  };
  return {
    // A shoe has come down: `x, z` the middle of its sole, `y` the ground under it, `yaw` the way the toes point
    // (0 is +z, as `heading` in yard.js).
    stamp(f) { if (on) queue.push(f); },
    // Whether snow lies: without it the prints are forgotten.
    enable(v) {
      if (v === on) return; on = v; queue.length = 0; uT.w = 0; placed = false;
      if (on) { into(null, [[0, 0, 1, 1]]); uT.z = 1 / span; }
    },
    // Keeps the square round him. It moves an eighth of its width at a time, and clears what comes into it from
    // beyond its far side (the same points of the picture held the ground that has just gone out behind him).
    follow(x, z) {
      if (!on) return;
      const nx = Math.round(x / step) * step, nz = Math.round(z / step) * step;
      if (!placed) { placed = true; cx = nx; cz = nz; into(null, [[0, 0, 1, 1]]); }
      else if (nx !== cx || nz !== cz) {
        const rects = [];
        if (nx !== cx) rects.push(...strip(((nx > cx ? cx : nx) + (nx > cx ? span / 2 : -span / 2)) / span, ((nx > cx ? nx : cx) + (nx > cx ? span / 2 : -span / 2)) / span, true));
        if (nz !== cz) rects.push(...strip(((nz > cz ? cz : nz) + (nz > cz ? span / 2 : -span / 2)) / span, ((nz > cz ? nz : cz) + (nz > cz ? span / 2 : -span / 2)) / span, false));
        cx = nx; cz = nz; into(null, rects);
      }
      uT.x = cx; uT.y = cz; uT.w = 1 / size;
    },
    // Presses the shoes that came down since the last frame, and lets the snow fill the old prints.
    update(dt) {
      if (!on || !placed) { queue.length = 0; return; }
      since += dt; const filling = since > 3;
      if (!queue.length && !filling) return;
      into(() => {
        if (filling) { since = 0; renderer.render(fillScene, cam); }
        for (const f of queue.splice(0)) {
          if (Math.abs(f.x - cx) > span * 0.45 || Math.abs(f.z - cz) > span * 0.45) continue;
          last = [+f.x.toFixed(2), +f.z.toFixed(2)];
          const u = frac(f.x / span), v = frac(f.z / span), r = SOLE.l / span;
          soleM.uniforms.uH.value = Math.min(1, Math.max(0, (f.y - Y0) / (Y1 - Y0))); soleM.uniforms.uK.value = f.k ?? 1;
          // Near an edge of the sheet the sole is drawn again on the far side, where the picture wraps round.
          const us = [u, ...(u < r ? [u + 1] : u > 1 - r ? [u - 1] : [])], vs = [v, ...(v < r ? [v + 1] : v > 1 - r ? [v - 1] : [])]; let i = 0;
          for (const s of soles) s.visible = false;
          for (const a of us) for (const b of vs) { const s = soles[i++]; s.visible = true; s.position.set(a, b, 0); s.rotation.z = -f.yaw; }
          renderer.render(scene, cam); count++;
        }
      });
    },
    // For the tests: the next picture drawn without the prints (the next frame shows them again).
    hide() { uT.w = 0; },
    state: () => ({ on, placed, centre: [cx, cz], stamps: count, last, size, span }),
  };
}
