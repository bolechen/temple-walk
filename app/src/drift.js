// What falls through the air: petals in spring, leaves in autumn, snow in winter, and on summer nights
// fireflies that rise instead. A cloud of points that follows the visitor, wrapping round as they walk.
// Leaves and petals come from the trees that bear them and the grove's few narrow bamboo leaves from the grove, and they
// come down to the ground (fall.js says where and how long; the sums below are its `leafAt` line for line). A tree's leaf
// or a petal that touches the ground is handed to it there (litter.js keeps it and the paving draws it), and the point
// that carried it settles for a moment and goes back up; a bamboo leaf lies a few seconds and fades. Snow and fireflies
// keep to the whole sky and the old even cloud.
import * as THREE from "three";
import { U } from "./glsl.js";
import { mulberry32 } from "./blink.js";
import { SHELTER } from "./shelter.js";
import { SOURCES, CHANNEL, LAND, NO_GROUND, PER_M, bakeFall, leafAt, leafTimes, spotOf, densityAt, groundAt, fallAt } from "./fall.js";
import { shelterAt } from "./shelter.js";
import { createLitter, MEM } from "./litter.js";
import { shedAt, SHED_GLSL } from "./wind.js";

// col: three hues a kind comes in; part: how many of the cloud are shown; near: none closer to the eye than this.
export const KINDS = {
  none:    { col: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], size: 0, fall: 0, sway: 0, op: 0, glow: 0, part: 0, near: 1, point: 0 },
  petal:   { col: [[1.0, 0.98, 0.94], [0.97, 0.94, 0.9], [1, 0.97, 0.96]], size: 0.06, fall: 0.5, sway: 0.7, op: 0.9, glow: 0, part: 0.45, near: 1.6, point: 0.12 },
  leaf:    { col: [[0.62, 0.15, 0.05], [0.86, 0.42, 0.08], [0.8, 0.58, 0.12]], size: 0.085, fall: 0.75, sway: 1.0, op: 0.95, glow: 0, part: 0.38, near: 1.6, point: 0.24 },
  snow:    { col: [[1, 1, 1], [0.95, 0.97, 1], [1, 1, 1]], size: 0.06, fall: 1.0, sway: 0.35, op: 0.9, glow: 0, part: 1, near: 0.7, point: 0 },
  firefly: { col: [[0.75, 1.0, 0.35], [0.8, 1.0, 0.4], [0.7, 1.0, 0.3]], size: 0.09, fall: -0.05, sway: 0.5, op: 1, glow: 1, part: 0.5, near: 0.5, point: 0 },
};
// The bamboo's own: a few narrow leaves, green going to yellow, that glide down slowly from the grove in every season
// the sky is not snowing or lit by fireflies. `share` of the cloud are theirs, `part` of those shown where the grove is.
export const BAMBOO = { col: [[0.42, 0.5, 0.15], [0.62, 0.56, 0.17]], size: 0.11, fall: 0.4, sway: 1.3, op: 0.9, part: 0.35, share: 0.06, near: 1.6 };
// What lies on the paving, as albedo (the stone is 0.17 to 0.34): fresh and aged for the maple's, fresh and aged for the ginkgo's.
// Darker and warmer than the falling ones, which are seen against the sky; leaves lying a while go brown. Petals fade to the
// colour of old paper (the ginkgo is only green in spring, so it shares the petal's).
export const LITTER = {
  leaf: [[0.25, 0.085, 0.04], [0.15, 0.09, 0.055], [0.27, 0.2, 0.05], [0.16, 0.115, 0.055]],
  petal: [[0.5, 0.43, 0.42], [0.27, 0.21, 0.18], [0.5, 0.43, 0.42], [0.27, 0.21, 0.18]],
};
// Under a crown the cloud is this much denser than its even share, scaled by the source map. Snow and fireflies take no map.
export const BOOST = 2.4;
export const shown = (kind, d) => Math.min(1, KINDS[kind].part * (SOURCES[kind] ? BOOST * d : 1));
// Is the grove's leaf in the air in this kind of weather?
export const bambooOn = (kind) => kind !== "snow" && kind !== "firefly";

// `opts`: `areas` (the grove's), `land` (the walker's landAt: the ground's height), `shelter` (shelter.js's map, for `report`).
export function createDrift(scene, count, trees = [], opts = {}) {
  // (Seeded, not Math.random: the air over a place is the same each time the page opens, so that the trailer's frame is a function of its number, #610.)
  const seed = new Float32Array(count * 4), rnd = mulberry32(0x5eed); for (let i = 0; i < seed.length; i++) seed[i] = rnd();
  const map = bakeFall(trees, opts.areas || [], opts.land || null);
  const tex = (data, W, H, fmt, type, filter) => { const x = new THREE.DataTexture(data, W, H, fmt, type); x.minFilter = x.magFilter = filter; x.unpackAlignment = 1; x.needsUpdate = true; return x; };
  const tMap = map ? tex(map.data, map.W, map.H, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter) : tex(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.NearestFilter);
  const tGround = map && map.ground ? tex(map.ground, map.W, map.H, THREE.RedFormat, THREE.FloatType, THREE.NearestFilter) : tex(new Float32Array([NO_GROUND]), 1, 1, THREE.RedFormat, THREE.FloatType, THREE.NearestFilter);
  const box = map ? new THREE.Vector4(...map.box) : new THREE.Vector4(0, 0, 0, 0);
  U.tFallMap.value = tMap; U.uFallBox.value.copy(box);   // the paving reads the same map for the leaves that lie on it
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
  const u = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() }, uSize: { value: 0 }, uFall: { value: 0 }, uSway: { value: 0 }, uOp: { value: 0 }, uGlow: { value: 0 }, uPx: { value: 800 }, uLight: { value: new THREE.Color(1, 1, 1) },
    uCol2: { value: new THREE.Color() }, uCol3: { value: new THREE.Color() }, uPart: { value: 1 }, uNear: { value: 1 }, uPoint: { value: 0 },
    uWS: { value: 0 }, uFallK: { value: 1 }, tMap: { value: tMap }, tGround: { value: tGround }, uMapBox: { value: box }, uCh: { value: new THREE.Vector3() }, uFromTrees: { value: 0 }, uBoost: { value: BOOST }, uLand: { value: 0 },
    uBam: { value: 0 }, uBPart: { value: BAMBOO.part }, uBSize: { value: BAMBOO.size }, uBFall: { value: BAMBOO.fall }, uBSway: { value: BAMBOO.sway }, uBCol: { value: new THREE.Color(...BAMBOO.col[0]) }, uBCol2: { value: new THREE.Color(...BAMBOO.col[1]) },
    tShelter: U.tShelter, uShelter: U.uShelter, uWind: U.uWind, uWindPath: U.uWindPath };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      ${SHELTER}
      ${SHED_GLSL}
      uniform sampler2D tMap, tGround; uniform vec4 uMapBox; uniform vec3 uCh; uniform float uWS, uFallK, uFromTrees, uBoost, uLand, uBam, uBPart, uBSize, uBFall, uBSway;
      attribute vec4 seed; uniform float uT, uSize, uFall, uSway, uPx, uGlow, uPart, uNear; uniform vec3 uCam; uniform vec2 uWind, uWindPath; varying float vA; varying float vS; varying float vH; varying float vB; varying float vTum; varying float vRest;
      void main(){
        vec3 B=vec3(34.,13.,34.), p; float want, life=1., ph=uT, Tf=1e9;
        float isB=step(fract(seed.x*13.7+seed.w*3.1),uBam), fl=mix(uFall,uBFall,isB), sw=mix(uSway,uBSway,isB);
        if(uLand>.5){
          // Down to the ground and a few seconds there (fall.js, leafAt): a spot is picked each time round, snapped to the
          // middle of a point of the map, and the sway dies away as the leaf comes down onto it.
          // A tree's leaf does not lie: the ground takes it as it touches (litter.js) and it settles into that over SETTLE.
          float v=fl*(.6+.8*seed.w); Tf=${LAND.HEIGHT.toFixed(1)}/v; float Tr=isB*(${LAND.REST[0].toFixed(1)}+${LAND.REST[1].toFixed(1)}*fract(seed.y*13.7)), P=Tf+Tr+mix(${LAND.SETTLE.toFixed(2)},${LAND.FADE.toFixed(1)},isB);
          float off=fract(seed.y*7.7)*P, cyc=floor((uT+off)/P); ph=mod(uT+off,P);
          vec2 b=fract(seed.xz+cyc*vec2(.7548776,.5698403))*B.xz; b=mix(b,(floor(b*${PER_M.toFixed(1)})+.5)/${PER_M.toFixed(1)},isB);   // the grove's leaves still come down on the middle of a map point
          b=mod(b-uCam.xz+B.xz*.5,B.xz)-B.xz*.5+uCam.xz;
          vec2 muv=(b-uMapBox.xy)*uMapBox.zw; vec4 m=texture2D(tMap,muv); float gr=texture2D(tGround,muv).r;
          float inb=step(0.,min(muv.x,muv.y))*step(max(muv.x,muv.y),1.)*step(-500.,gr), k=min(ph/Tf,1.);
          p=vec3(b.x+sin(ph*.7+seed.w*40.)*sw*(1.-k), gr+${LAND.LIE.toFixed(2)}+${LAND.HEIGHT.toFixed(1)}*(1.-k), b.y+cos(ph*.53+seed.w*31.)*sw*.7*(1.-k));
          p.xz-=uWind*${LAND.HEIGHT.toFixed(1)}*(1.-k)*.6;   // it comes down on the breeze (wind.js), as the censer's smoke leans, to where it lies
          // A tree lets go of a leaf only as readily as the breeze says (wind.js, shedAt), asked of the moment the leaf is half way down, so the flurry is in the air while the gust blows: a few in still air, a flurry in a gust.
          want=mix(uPart*mix(1.,uBoost*dot(m.rgb,uCh),uFromTrees)*mix(1.,uFallK<0.?1.:shedAt(uWS,cyc*P-off+Tf*.5)*uFallK,uFromTrees),uBPart*m.b,isB)*inb*(1.-shelter(p));
          life=smoothstep(0.,${LAND.IN.toFixed(1)},ph)*(1.-smoothstep(Tf+Tr,P,ph)); vRest=step(Tf,ph); ph=min(ph,Tf);
        } else {
          p=seed.xyz*B;
          p.y-=uT*fl*(.6+.8*seed.w); p.x+=sin(uT*.7+seed.w*40.)*sw; p.z+=cos(uT*.53+seed.w*31.)*sw*.7;
          p.xz+=uWindPath*(.45+.3*seed.w)*step(0.,fl);   // carried off by the breeze (wind.js), as the censer's smoke leans; not the fireflies
          p=mod(p-uCam+B*.5,B)-B*.5+uCam; p.y+=3.5;
          want=uPart*(1.-shelter(p)); vRest=0.;
        }
        vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=min(mix(uSize,uBSize,isB)*(.55+.9*seed.w)*uPx/max(-mv.z,.3),uPx*.022)*step(fract(seed.x*7.31+seed.z*3.7),want)*step(.001,want);
        float blink=mix(1.,smoothstep(.2,.9,sin(uT*(1.+seed.w*2.)+seed.x*30.)),uGlow);
        vA=blink*life*smoothstep(17.,11.,length(p.xz-uCam.xz))*smoothstep(uNear,uNear+1.4,-mv.z); vS=seed.w; vH=seed.z; vB=isB; vTum=ph;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol, uCol2, uCol3, uLight, uBCol, uBCol2; uniform float uOp, uGlow, uPoint, uT; varying float vA; varying float vS; varying float vH; varying float vB; varying float vTum; varying float vRest;
      void main(){
        // Each is turned its own way, and turns over as it falls: now broad, now edge-on. On the ground it lies broad and still.
        vec2 q=gl_PointCoord-.5; float a=vS*6.3+vTum*(.4+vS), c=cos(a), s=sin(a); q=mat2(c,-s,s,c)*q;
        q.x/=mix(.3+.7*abs(sin(vTum*1.7+vS*40.)),1.,max(uGlow,vRest));
        // A leaf is where two circles overlap: pointed at both ends. Snow and fireflies are round. A bamboo leaf is long and thin.
        float d=mix(length(q*vec2(1.,1.)),max(length(q-vec2(uPoint,0.)),length(q+vec2(uPoint,0.))),step(.001,uPoint));
        d=mix(d,length(q*vec2(.85,3.6)),vB);
        float m=mix(smoothstep(.5,.44,d),smoothstep(.5,0.,d),uGlow);
        vec3 hue=vB>.5?(vH<.5?uBCol:uBCol2):vH<.34?uCol:vH<.67?uCol2:uCol3;
        vec3 col=mix(hue*uLight*(.8+.4*vS)*(1.-.3*smoothstep(.05,0.,abs(q.x))*step(.001,uPoint))*mix(1.,.5,vRest),hue*3.,uGlow);
        gl_FragColor=vec4(col,m*mix(uOp,${BAMBOO.op.toFixed(2)},vB)*vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  let cur = KINDS.none, curName = "none", bam = 0;
  const cfg = () => ({ fall: cur.fall, sway: cur.sway });
  // The leaves handed to the ground (opts.memory, litter.js's record): for every point of the cloud that is a tree's leaf
  // or a petal, the count of its cycles whose fall has ended; when that count goes up between two frames, that leaf has
  // just touched the ground, and if it was one the shader shows (its source, no roof over it), the ground keeps it where
  // it touched. Over a jump of the clock (a photograph held, a hidden tab) nothing is handed over: the leaves that fell
  // while nobody looked are not heaped up at once.
  const lit = opts.keep && map && map.ground ? createLitter({ span: opts.keep, ground: (x, z) => groundAt(map, x, z), pool: opts.keep >= 32 ? MEM.POOL.high : MEM.POOL.low, heap: opts.keep >= 32 }) : null, mem = lit && lit.mem, landed = new Float64Array(count).fill(NaN); let lastT = null, handed = 0, skew = 0, sent = 0, sentAt = -1, kicked = false;
  // (The low tier, a 24 m square, keeps no heaps: its oldest leaves fade where they lie. The lead, 2026-11-19, for its frame.)
  if (lit) { U.tLitMem.value = lit.tex; U.tLitCover.value = lit.cover; }
  // Each point's timing for this kind of weather, worked out once (fall.js, leafTimes): no sums are redone every frame.
  const sTf = new Float64Array(count), sP = new Float64Array(count), sOff = new Float64Array(count), sTree = new Uint8Array(count); let timed = null;
  const retime = () => {
    timed = cur.fall + ":" + bam;
    for (let i = 0; i < count; i++) {
      const s = [seed[i * 4], seed[i * 4 + 1], seed[i * 4 + 2], seed[i * 4 + 3]], T = leafTimes(s, cur.fall || 1, false);
      sTree[i] = fract13(s) < bam ? 0 : 1; sTf[i] = T.Tf; sP[i] = T.P; sOff[i] = T.off;
    }
  };
  // How readily the trees let go at time t: the breeze's say (wind.js) times `uFallK`; a negative `uFallK` is the old
  // steady fall, for setting the densities side by side (`__fall(k)`).
  const fallK = (t) => (u.uFallK.value < 0 ? 1 : shedAt(u.uWS.value, t) * u.uFallK.value);
  const handOver = (t, cam) => {
    if (timed !== cur.fall + ":" + bam) retime();
    const ok = mem && u.uLand.value > 0 && SOURCES[curName] && lastT !== null && t > lastT && t - lastT < 0.25;
    for (let i = 0; i < count; i++) {
      if (!sTree[i]) continue;
      const L = Math.floor((t + sOff[i] - sTf[i]) / sP[i]);
      if (ok && L > landed[i]) {
        const s = [seed[i * 4], seed[i * 4 + 1], seed[i * 4 + 2], seed[i * 4 + 3]];
        const [x, z] = spotOf(s, L, [34, 13, 34], cam), g = groundAt(map, x, z);
        const want = KINDS[curName].part * BOOST * densityAt(map, CHANNEL[curName], x, z) * fallK(L * sP[i] - sOff[i] + sTf[i] * 0.5) * (1 - shelterAt(opts.shelter, x, g + LAND.LIE, z));
        if (g > NO_GROUND / 2 && want > 0.001 && fract(s[0] * 7.31 + s[2] * 3.7) <= want && mem.land(x, z, 1 + Math.floor(fract(s[0] * 91.7 + s[3] * 13.1 + L * 0.618) * 254))) handed++;
      }
      landed[i] = L;
    }
    lastT = t;
  };
  return {
    setMood(m, light) {
      const k = KINDS[m.drift] || KINDS.none, key = SOURCES[m.drift] ? m.drift : null;
      if (m.drift !== curName && mem) { mem.clear(); landed.fill(NaN); lastT = null; }   // a new season's ground starts bare (what it had was another kind)
      cur = k; curName = m.drift; bam = bambooOn(m.drift) ? BAMBOO.share : 0; U.uLitOn.value = mem && key ? 1 : 0; u.uWS.value = m.wind ?? 0;
      u.uCol.value.fromArray(k.col[0]); u.uCol2.value.fromArray(k.col[1]); u.uCol3.value.fromArray(k.col[2]); u.uPart.value = k.part; u.uNear.value = k.near; u.uPoint.value = k.point; u.uSize.value = k.size; u.uFall.value = k.fall; u.uSway.value = k.sway; u.uOp.value = k.op; u.uGlow.value = k.glow;
      u.uFromTrees.value = key ? 1 : 0; u.uCh.value.set(key === "leaf" ? 1 : 0, key === "petal" ? 1 : 0, 0); u.uBam.value = bam;
      u.uLand.value = bambooOn(m.drift) ? 1 : 0;   // snow and fireflies keep the old cloud
      // The paving's leaves: autumn's and spring's, not on the low tier, and in place only where trees stand to drop them.
      // (On the low tier the ground draws only what it has kept, none of the leaves that lay there before he came: uLitBase.)
      U.uLitter.value = (opts.litter || mem) && key ? (key === "leaf" ? 1 : 0.7) : 0; U.uLitBase.value = opts.litter ? 1 : 0; U.uLitterCh.value.copy(u.uCh.value); (LITTER[key] || LITTER.leaf).forEach((c, i) => U.uLitterCol.value[i].fromArray(c));
      u.uLight.value.copy(light); pts.visible = k.op > 0 || bam > 0; mat.blending = k.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    },
    update(t, cam, px) { t += skew; u.uT.value = t; u.uCam.value.copy(cam); u.uPx.value = px; if (mem && map && t !== lastT) handOver(t, cam.toArray()); },
    // Runs the cloud on by `secs` (for a tool or test that wants the ground as it will be): every leaf that comes down
    // meanwhile is handed over as it would have been, a tenth of a second at a time (`windAt` is no longer used: what
    // lies is not moved by the breeze); then the cloud's own clock is moved on to match, so none is handed over twice.
    runOn(secs, cam, windAt, dt = 0.1) {
      if (!mem) return;
      let t = u.uT.value; const c = cam.toArray(); mem.follow(c[0], c[2]); if (lastT === null) handOver(t, c);
      for (let k = 0; k < secs / dt; k++) { t += dt; handOver(t, c); mem.tick(dt); }
      skew += t - u.uT.value; u.uT.value = t;
    },
    handed: () => handed,
    fall(k) { if (k !== undefined) u.uFallK.value = k; return u.uFallK.value; },
    // The ground round him for this frame: the square follows him, the heaps sink a little, and the record goes to the
    // card. `dt` 0 (a still picture) keeps everything as it is. (wx, wz: the breeze, which no longer moves what lies.)
    keep(x, z, dt, wx, wz) {
      // The breeze is worked and the record sent to the card ten times a second (at once after a scuff): a leaf that has
      // just come down shows within a tenth of a second, under the falling one still settling (0.4 s), and a slide of a
      // centimetre a tenth of a second is not seen as steps.
      if (!lit) return; mem.follow(x, z); sent += dt;
      if (sent >= 0.1) { mem.tick(sent); lit.upload(); sent = 0; }
      else if (kicked || (dt === 0 && handed !== sentAt)) lit.upload();
      kicked = false; sentAt = handed;
      U.uLitMem.value.copy(lit.box);
    },
    // A shoe has come down (monk.steps): the leaves under it are scuffed aside.
    kick(f) { if (mem && U.uLitOn.value) { mem.kick(f.x, f.z, f.yaw); kicked = true; } },
    litter: (at) => (mem ? { ...mem.stats(), handed, bytes: lit.bytes, ...(Array.isArray(at) ? { at: +mem.amountAt(at[0], at[1], at[2] ?? 0.1).toFixed(3) } : at === true ? { leaves: mem.leaves().slice(0, 400).map((l) => [+l[0].toFixed(4), +l[1].toFixed(4), l[2]]) } : {}) } : null),
    memory: mem,
    // For `__drift()`: what the leaves of the cloud are doing at the shader's time, worked out in Node's way (fall.js).
    report(n = 200) {
      const t = u.uT.value, cam = u.uCam.value.toArray(), out = { kind: curName, landing: u.uLand.value > 0, count, bamboo: bam, leaves: [] };
      if (!map || !u.uLand.value) return out;
      let sum = 0;
      for (let i = 0; i < count && out.leaves.length < n; i++) {
        const s = [seed[i * 4], seed[i * 4 + 1], seed[i * 4 + 2], seed[i * 4 + 3]], isB = fract13(s) < bam;
        const L = leafAt(map, s, t, isB ? { fall: BAMBOO.fall, sway: BAMBOO.sway, bamboo: true } : cfg(), cam);
        const d = isB ? fallAt(map, "bamboo", opts.shelter, L.bx, L.y, L.bz) : curName in SOURCES ? fallAt(map, curName, opts.shelter, L.bx, L.y, L.bz) : 0;
        const want = (isB ? BAMBOO.part * d : KINDS[curName].part * (SOURCES[curName] ? BOOST * d * fallK(t - L.ph + L.Tf * 0.5) : 1));
        if (!L.live || !(fract(s[0] * 7.31 + s[2] * 3.7) <= want) || want <= 0.001) continue;
        out.leaves.push({ bamboo: isB, x: +L.x.toFixed(3), y: +L.y.toFixed(3), z: +L.z.toFixed(3), ground: +L.ground.toFixed(3), rest: L.rest, restFor: +L.Tr.toFixed(2), alpha: +L.alpha.toFixed(3), phase: +L.ph.toFixed(3) }); sum += L.x * 3 + L.y * 5 + L.z * 7;
      }
      out.resting = out.leaves.filter((l) => l.rest).length; out.aloft = out.leaves.filter((l) => !l.rest).length; out.hash = +sum.toFixed(4); out.handed = handed;
      return out;
    },
  };
}
const fract = (x) => x - Math.floor(x);
const fract13 = (s) => { const x = s[0] * 13.7 + s[3] * 3.1; return x - Math.floor(x); };
