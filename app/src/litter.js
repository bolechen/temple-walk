// What lies on the ground: the leaves and petals that have come down while he has been here. The ground keeps them, as
// it keeps his prints in the snow (trail.js): a falling leaf that touches the paving is handed to it where it touched,
// and stays there until something moves it — a gust strong enough to slide it along the stone toward the foot of a wall
// or a step, which stops it, or his own feet scuffing through. Nothing here fades by the clock (#267).
//
// It is kept as a record, not as a picture, because a leaf is a thing with a place: the record is a square of the
// ground round him (the same square that wraps round as he walks, an eighth of its width at a time, that the prints
// keep), in cells of a quarter metre, the cells of the source map in fall.js. Each cell keeps up to SLOTS leaves each
// exactly where it lies (to a sixteenth of the cell) with a number of its own that says how it is turned and how big it
// is, so the paving draws the very leaf that came down where it came down; and under them a heap, a count of older
// leaves drawn the way the paving has always drawn its leaves (litterLayer in ground.js), which takes a cell's oldest
// leaf when a new one needs its place. Everything here is plain numbers, worked out on the page's thread and in Node
// alike, so the tests run the same record the page draws; the page sends it to the card as one small texture.
import * as THREE from "three";

// PER: cells to a metre. SLOTS: leaves kept each where it lies, in a cell. DMAX: most leaves a cell's heap holds (192 to the
// square metre: the stone covered). GRIP: the breeze (m/s, wind.js) a lying leaf begins to slide at, 0.5 to 0.95, its own;
// on the lane's large smooth slabs a leaf grips less (LANE), in the kerb's joints more (KERB). SLIDE: metres a second it
// slides for each m/s of breeze over its grip. HEAP and HEAP_GRIP: the share of a heap the breeze moves on to the next
// cell each second for each m/s over HEAP_GRIP (2: a heap moves as fast as its leaves would slide, a quarter metre a cell). RISE: a step up this high stops a leaf (the foot of a wall, a platform, a
// stair). LIFT: of what the breeze drives against such a rise, the share it lifts up over it and away, as the eddy at the
// foot of a wall lifts leaves (what is left heaps there). KEEP: seconds a leaf is kept each in its own place before it
// goes onto its cell's heap (the heap is drawn as many leaves as it holds, the way the old leaves are). KICK: how far round a shoe leaves are scuffed, how far they go, and the share of the heap under it pushed on.
export const MEM = {
  PER: 4, SLOTS: 7, DMAX: 12,
  GRIP: [0.5, 0.45], LANE: 0.6, KERB: 2.2, SLIDE: 0.5,
  HEAP: 2, HEAP_GRIP: 0.7, RISE: 0.05, TICK: 0.1,
  KICK: { r: 0.17, push: [0.08, 0.2], heap: 0.2 },
  LIFT: 0.5, KEEP: 300,
  POOL: 20000,
};
// The swept lane down the middle of the courts and its kerbs, as the paving draws them (ground.js: `path`, `kerb`).
export const AXIS = { path: 1.7, kerb: 2.02, z0: -0.95, z1: 53.9 };
const NO = -1000;
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 12.9898) * 43758.5453);
// How readily a leaf moves on this stone: the lane's slabs are smooth and swept, the kerb's joints catch.
export function surface(x, z) {
  if (z <= AXIS.z0 || z >= AXIS.z1) return 1;
  const a = Math.abs(x); return a < AXIS.path ? MEM.LANE : a < AXIS.kerb ? MEM.KERB : 1;
}

// `span`: the side of the square in metres; `ground(x, z)`: the height of the ground (fall.js's groundAt, the same cells),
// NO_GROUND (-1000) where there is none.
/** @param {{ span?: number, ground?: (x: number, z: number) => number }} [o] */
export function createMemory({ span = 32, ground = (x, z) => 0 } = {}) {
  const PER = MEM.PER, N = Math.round(span * PER), S = MEM.SLOTS, half = span / 2, step = span / 8;
  const dens = new Float32Array(N * N), gnd = new Float32Array(N * N), ownX = new Int32Array(N * N).fill(-1 << 30), ownZ = new Int32Array(N * N);
  const slots = new Int32Array(N * N * S).fill(-1), flow = new Float32Array(N * N);
  const P = MEM.POOL, lx = new Float64Array(P), lz = new Float64Array(P), lid = new Uint8Array(P), lgrip = new Float32Array(P), lborn = new Float64Array(P), lcell = new Int32Array(P).fill(-1);
  const free = []; for (let i = P - 1; i >= 0; i--) free.push(i);
  // The leaves now lying, packed at the front of one list, so that the breeze and the feet look only at those.
  const live = new Int32Array(P), at = new Int32Array(P).fill(-1); let nLive = 0;
  const take = () => { const i = free.pop(); at[i] = nLive; live[nLive++] = i; return i; };
  const release = (i) => { lcell[i] = -1; free.push(i); const k = at[i], j = live[--nLive]; live[k] = j; at[j] = k; at[i] = -1; };
  let cx = 0, cz = 0, placed = false, clock = 0, since = 0, dirty = true;
  const count = { landed: 0, heaped: 0, slid: 0, kicked: 0, blown: 0, stopped: 0, full: 0, lifted: 0 };
  // A heap at DMAX covers the stone: a leaf more on it cannot be seen, and is counted as `full` rather than kept.
  const heapUp = (c, a) => { const room = MEM.DMAX - dens[c]; if (a > room) count.full += a - room; dens[c] = Math.min(MEM.DMAX, dens[c] + a); };
  const mod = (a) => ((a % N) + N) % N;
  const idx = (ix, iz) => mod(ix) + mod(iz) * N;
  const inSquare = (ix, iz) => placed && Math.abs((ix + 0.5) / PER - cx) < half && Math.abs((iz + 0.5) / PER - cz) < half;
  const kill = (i) => { const c = lcell[i]; if (c < 0) return; for (let k = 0; k < S; k++) if (slots[c * S + k] === i) slots[c * S + k] = -1; release(i); };
  const clearCell = (c) => { dens[c] = 0; for (let k = 0; k < S; k++) { const i = slots[c * S + k]; if (i >= 0) { release(i); slots[c * S + k] = -1; } } };
  // The cell for a world cell, taken over from whatever ground it last held (the square wraps round).
  const claim = (ix, iz) => {
    const c = idx(ix, iz);
    if (ownX[c] !== ix || ownZ[c] !== iz) { clearCell(c); ownX[c] = ix; ownZ[c] = iz; gnd[c] = ground((ix + 0.5) / PER, (iz + 0.5) / PER); }
    return c;
  };
  // A leaf takes a place in a cell; if the cell's places are full its oldest leaf goes onto the heap.
  const placeIn = (c, i) => {
    let k = -1, old = -1;
    for (let q = 0; q < S; q++) { const j = slots[c * S + q]; if (j < 0) { k = q; break; } if (old < 0 || lborn[j] < lborn[slots[c * S + old]]) old = q; }
    if (k < 0) { const j = slots[c * S + old]; release(j); heapUp(c, 1); count.heaped++; k = old; }
    slots[c * S + k] = i; lcell[i] = c;
  };
  const cellOf = (x, z) => [Math.floor(x * PER), Math.floor(z * PER)];
  // Moves a lying leaf; a rise in the ground stops it, and off the square it is gone with the ground it lay on.
  const move = (i, nx, nz) => {
    const ix = Math.floor(nx * PER), iz = Math.floor(nz * PER), c0 = lcell[i];
    if (!inSquare(ix, iz)) { kill(i); count.blown++; dirty = true; return true; }
    const c = idx(ix, iz);
    if (c !== c0 || ownX[c] !== ix || ownZ[c] !== iz) {
      const g1 = ownX[c] === ix && ownZ[c] === iz ? gnd[c] : ground((ix + 0.5) / PER, (iz + 0.5) / PER);
      if (g1 <= NO / 2 || g1 - gnd[c0] > MEM.RISE) { count.stopped++; return false; }
      for (let k = 0; k < S; k++) if (slots[c0 * S + k] === i) slots[c0 * S + k] = -1;
      placeIn(claim(ix, iz), i);
    }
    lx[i] = nx; lz[i] = nz; dirty = true; return true;
  };
  const alive = function* () { for (let k = 0; k < nLive; k++) yield live[k]; };

  return {
    N, span, PER,
    // Keeps the square round him, moving it an eighth of its width at a time; what it leaves behind is forgotten.
    follow(x, z) {
      const nx = Math.round(x / step) * step, nz = Math.round(z / step) * step;
      if (placed && nx === cx && nz === cz) return;
      placed = true; cx = nx; cz = nz;
      for (let c = 0; c < N * N; c++) if (ownX[c] !== -1 << 30 && !inSquare(ownX[c], ownZ[c])) { clearCell(c); ownX[c] = -1 << 30; }
      dirty = true;
    },
    // A leaf has come down at x, z (`id`: 1 to 255, its own turn and size). False where the ground does not keep it.
    land(x, z, id) {
      const [ix, iz] = cellOf(x, z); if (!inSquare(ix, iz)) return false;
      const c = claim(ix, iz); if (gnd[c] <= NO / 2) return false;
      count.landed++; dirty = true;
      if (!free.length) { heapUp(c, 1); count.heaped++; return true; }
      const i = take(); lx[i] = x; lz[i] = z; lid[i] = Math.max(1, Math.min(255, id | 0)); lgrip[i] = MEM.GRIP[0] + MEM.GRIP[1] * hash(i * 1.37 + id * 0.11 + count.landed * 0.013); lborn[i] = clock;
      placeIn(c, i); return true;
    },
    // The breeze for `dt` seconds, (wx, wz) in m/s: each leaf whose grip it beats slides on along it, a little to one
    // side or the other of the wind as a leaf skitters; and a tenth of a second at a time the heaps move on downwind.
    // Below every grip nothing moves at all.
    wind(dt, wx, wz) {
      clock += dt;
      // Leaves that have lain KEEP seconds join the heap of the cell they lie in: as many leaves, drawn as the heap is.
      for (let k = nLive - 1; k >= 0; k--) { const i = live[k]; if (clock - lborn[i] > MEM.KEEP) { const c = lcell[i]; kill(i); heapUp(c, 1); count.heaped++; dirty = true; } }
      const w = Math.hypot(wx, wz); if (!(w > 0) || dt <= 0) return;
      if (w > MEM.GRIP[0] * MEM.LANE) {
        const ux = wx / w, uz = wz / w;
        for (let k = nLive - 1; k >= 0; k--) {
          const i = live[k]; if (k >= nLive) continue;
          const g = lgrip[i] * surface(lx[i], lz[i]); if (w <= g) continue;
          const a = (hash(lid[i] + 0.5) - 0.5) * 0.9 + 0.35 * Math.sin(clock * 1.3 + lid[i]), ca = Math.cos(a), sa = Math.sin(a), d = MEM.SLIDE * (w - g) * dt;
          if (move(i, lx[i] + (ux * ca - uz * sa) * d, lz[i] + (ux * sa + uz * ca) * d)) count.slid++;
        }
      }
      since += dt; if (since < MEM.TICK) return; const T = since; since = 0;
      if (w <= MEM.HEAP_GRIP * MEM.LANE) return;
      const ax = Math.abs(wx) / (Math.abs(wx) + Math.abs(wz)), sx = Math.sign(wx), sz = Math.sign(wz);
      flow.fill(0); let moved = false;
      for (let c = 0; c < N * N; c++) {
        if (!(dens[c] > 0) || ownX[c] === -1 << 30) continue;
        const ix = ownX[c], iz = ownZ[c], m = 1 / surface((ix + 0.5) / PER, (iz + 0.5) / PER), over = w - MEM.HEAP_GRIP / m; if (over <= 0) continue;
        const f = Math.min(0.5, MEM.HEAP * over * T * m) * dens[c];
        for (let e = 0; e < 2; e++) {
          const jx = e ? ix : ix + sx, jz = e ? iz + sz : iz, a = f * (e ? 1 - ax : ax); if (a <= 0) continue;
          if (!inSquare(jx, jz)) { flow[c] -= a; count.blown += a; moved = true; continue; }
          const j = claim(jx, jz);
          if (gnd[j] <= NO / 2 || gnd[j] - gnd[c] > MEM.RISE || dens[j] >= MEM.DMAX) { flow[c] -= a * MEM.LIFT; count.lifted += a * MEM.LIFT; moved = true; continue; }
          flow[c] -= a; flow[j] += a; moved = true;
        }
      }
      if (moved) { for (let c = 0; c < N * N; c++) if (flow[c]) dens[c] = Math.max(0, Math.min(MEM.DMAX, dens[c] + flow[c])); dirty = true; }
    },
    // A shoe has come down at x, z, its toes toward `yaw` (0 is +z): the leaves round it are scuffed on and aside, and a
    // share of the heap under it is pushed on into the next cell.
    kick(x, z, yaw) {
      if (!placed) return;
      const fx = Math.sin(yaw), fz = Math.cos(yaw), R = MEM.KICK.r;
      for (let k = nLive - 1; k >= 0; k--) {
        const i = live[k];
        const dx = lx[i] - x, dz = lz[i] - z, r = Math.hypot(dx, dz); if (r > R) continue;
        let ux = dx / (r || 1) + fx * 0.8, uz = dz / (r || 1) + fz * 0.8; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
        const d = MEM.KICK.push[0] + (MEM.KICK.push[1] - MEM.KICK.push[0]) * hash(lid[i] + clock) * (1 - 0.5 * r / R);
        if (move(i, lx[i] + ux * d, lz[i] + uz * d)) count.kicked++;
      }
      const [ix, iz] = cellOf(x, z); if (!inSquare(ix, iz)) return;
      const c = idx(ix, iz); if (ownX[c] !== ix || ownZ[c] !== iz || !(dens[c] > 0)) return;
      const [jx, jz] = Math.abs(fx) > Math.abs(fz) ? [ix + Math.sign(fx), iz] : [ix, iz + Math.sign(fz)];
      if (!inSquare(jx, jz)) return;
      const j = claim(jx, jz); if (gnd[j] <= NO / 2 || gnd[j] - gnd[c] > MEM.RISE) return;
      const a = Math.min(dens[c] * MEM.KICK.heap, MEM.DMAX - dens[j]); if (a > 0) { dens[c] -= a; dens[j] += a; dirty = true; count.kicked += a; }
    },
    // How many leaves lie within r of x, z: those kept each in its place, and the heaps' share of the circle.
    amountAt(x, z, r = 0.1) {
      let n = 0;
      for (let k = 0; k < nLive; k++) { const i = live[k]; if (Math.hypot(lx[i] - x, lz[i] - z) <= r) n++; }
      const PERr = Math.max(1, Math.ceil(r * PER));
      const [ix, iz] = cellOf(x, z);
      let h = 0;
      for (let a = -PERr; a <= PERr; a++) for (let b = -PERr; b <= PERr; b++) {
        const c = idx(ix + a, iz + b); if (ownX[c] !== ix + a || ownZ[c] !== iz + b) continue;
        // the part of the cell inside the circle, by a 4×4 sampling of it
        let k = 0; for (let u = 0; u < 4; u++) for (let v = 0; v < 4; v++) if (Math.hypot((ix + a + (u + 0.5) / 4) / PER - x, (iz + b + (v + 0.5) / 4) / PER - z) <= r) k++;
        h += dens[c] * k / 16;
      }
      return n + h;
    },
    // Every leaf kept in its place: [x, z, id], for the tests and `__litter()`.
    leaves() { const out = []; for (const i of alive()) out.push([lx[i], lz[i], lid[i]]); return out; },
    heap() { let s = 0; for (let c = 0; c < N * N; c++) if (ownX[c] !== -1 << 30) s += dens[c]; return s; },
    stats() { return { kept: nLive, heap: +this.heap().toFixed(2), ...Object.fromEntries(Object.entries(count).map(([k, v]) => [k, +(+v).toFixed(2)])), centre: [cx, cz], span, cells: N }; },
    clear() { for (let c = 0; c < N * N; c++) { clearCell(c); ownX[c] = -1 << 30; } for (const k in count) count[k] = 0; dirty = true; },
    centre: () => [cx, cz],
    // Writes the record as the paving reads it: a picture 2N × N of four 16-bit numbers a point, two points to a cell.
    // The first number is the heap (0 to DMAX as 0 to 65535); each of the other seven is a place: its spot in the cell
    // (x and z, a sixteenth each) in the high byte and the leaf's own number (1 to 255; 0: empty) in the low. Returns
    // whether anything changed since the last time. `cover` (N × N, two bytes a cell), if given, gets the heap again
    // (0 to DMAX as 0 to 255) and 255 where any place in the cell is taken: one smooth look-up there tells the paving
    // how deep the heap is and whether any kept leaf lies near enough to look for.
    pack(out, cover = null) {
      if (!dirty) return false; dirty = false; out.fill(0); if (cover) cover.fill(0);
      for (let c = 0; c < N * N; c++) {
        if (ownX[c] === -1 << 30) continue;
        const ci = c % N, cj = (c / N) | 0, o = (cj * 2 * N + ci * 2) * 4;
        out[o] = Math.round((dens[c] / MEM.DMAX) * 65535);
        if (cover) { cover[c * 2] = Math.round((dens[c] / MEM.DMAX) * 255); for (let k = 0; k < S; k++) if (slots[c * S + k] >= 0) { cover[c * 2 + 1] = 255; break; } }
        for (let k = 0; k < S; k++) {
          const i = slots[c * S + k]; if (i < 0) continue;
          const qx = Math.min(15, Math.max(0, Math.floor((lx[i] * PER - ownX[c]) * 16))), qz = Math.min(15, Math.max(0, Math.floor((lz[i] * PER - ownZ[c]) * 16)));
          out[o + 1 + k] = (qx * 16 + qz) * 256 + lid[i];
        }
      }
      return true;
    },
  };
}

// The record on the card, and the uniforms the paving reads it by: (centre x, centre z, cells to a metre, cells across).
/** @param {{ span?: number, ground?: (x: number, z: number) => number }} [o] */
export function createLitter({ span = 32, ground = undefined } = {}) {
  const mem = createMemory({ span, ground }), N = mem.N, data = new Uint16Array(2 * N * N * 4), sent = new Uint16Array(data.length);
  const tex = new THREE.DataTexture(data, 2 * N, N, THREE.RGBAIntegerFormat, THREE.UnsignedShortType);
  tex.internalFormat = "RGBA16UI"; tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  const cdata = new Uint8Array(N * N * 2), cover = new THREE.DataTexture(cdata, N, N, THREE.RGFormat, THREE.UnsignedByteType);
  cover.minFilter = cover.magFilter = THREE.LinearFilter; cover.wrapS = cover.wrapT = THREE.RepeatWrapping; cover.generateMipmaps = false; cover.unpackAlignment = 1; cover.needsUpdate = true;
  const box = new THREE.Vector4(0, 0, MEM.PER, N);
  return {
    mem, tex, cover, box,
    // Only the rows of the record that changed go to the card (one row of the picture is one row of cells).
    upload() {
      if (mem.pack(data, cdata)) {
        const row = 2 * N * 4; let changed = 0;
        for (let j = 0; j < N; j++) {
          let same = true; for (let o = j * row, e = o + row; o < e; o++) if (data[o] !== sent[o]) { same = false; break; }
          if (!same) { tex.addUpdateRange(j * row, row); sent.set(data.subarray(j * row, (j + 1) * row), j * row); changed++; }
        }
        if (changed) tex.needsUpdate = true; cover.needsUpdate = true;
      }
      const [x, z] = mem.centre(); box.x = x; box.y = z;
    },
    bytes: data.byteLength + cdata.byteLength,
  };
}

// The paving's reading of the record. `freshLeaves(p, gk)`: the leaves kept each in its place that cover the point p,
// as litterLayer returns a leaf (colour pick, age, coverage, which tree; `gk` the source map's say of whose leaves fall
// here); `litCover(p)`: the heap there, in the units litterLayer's amount is measured in, and whether to look for kept leaves.
export const LITTER_MEM = /* glsl */`
uniform highp usampler2D tLitMem; uniform sampler2D tLitCover; uniform vec4 uLitMem; uniform float uLitOn;
bool litIn(vec2 p){ vec2 d=abs(p-uLitMem.xy)*uLitMem.z; return uLitOn>.5&&max(d.x,d.y)<uLitMem.w*.5-1.; }
ivec2 litCell(vec2 c){ return ivec2(int(mod(c.x,uLitMem.w))*2,int(mod(c.y,uLitMem.w))); }
// (heap, whether a kept leaf lies within the 2×2 cells round p): one smooth look-up of the cover picture.
vec2 litCover(vec2 p){ vec2 c=texture(tLitCover,p*uLitMem.z/uLitMem.w).rg; return vec2(c.x*${(MEM.DMAX * MEM.PER * MEM.PER / 166).toFixed(4)},c.y); }   // the heap in leaves to the square metre over 166 (a leaf to a cell of each of litterLayer's three grids)
vec4 freshLeaves(vec2 p, float gk){
  vec4 best=vec4(0.); vec2 c0=floor(p*uLitMem.z-.5);
  for(int j=0;j<2;j++) for(int i=0;i<2;i++){
    vec2 c=c0+vec2(float(i),float(j)); ivec2 t=litCell(c);
    uvec4 A=texelFetch(tLitMem,t,0), B=texelFetch(tLitMem,t+ivec2(1,0),0);
    if((A.g|A.b|A.a|B.r|B.g|B.b|B.a)==0u) continue;
    for(int k=0;k<${MEM.SLOTS};k++){
      uint sl=k==0?A.g:k==1?A.b:k==2?A.a:k==3?B.r:k==4?B.g:k==5?B.b:B.a; if(sl==0u) continue;
      float id=float(sl&255u), pb=float(sl>>8u); vec2 q=vec2(floor(pb/16.),mod(pb,16.));
      vec2 lp=(c+(q+.5)/16.)/uLitMem.z, d0=p-lp; if(dot(d0,d0)>.0026) continue;   // no leaf reaches past 5 cm from its middle
      float ang=h21(vec2(id,3.7))*6.2832, ca=cos(ang), sa=sin(ang), big=h21(vec2(id,31.7)), tree=step(h21(vec2(id,8.8)),gk);
      vec2 l=mat2(ca,-sa,sa,ca)*d0;
      float len=mix(.02,.05,big*big), wid=len*mix(.4,.62,h21(vec2(id,2.2)))*mix(1.,1.5,tree);
      float d=length(l/vec2(len,wid)), fold=h21(vec2(id,44.4))<.25?step(-.1*len,l.y):1.;
      float m=fold*smoothstep(1.,.7,d);
      if(m>best.z) best=vec4(h21(vec2(id,21.9)),.15*h21(vec2(id,5.5)),m,tree);
    }
  }
  return best;
}`;
