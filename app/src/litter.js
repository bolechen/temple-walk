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
// square metre: the stone covered). POOL: how many leaves are kept each in its own place at once, by tier (as a game keeps a
// fixed ring of decals): when a new one comes down and the pool is full, the oldest goes onto its cell's heap. FADE: seconds
// in which a heap sinks to a third, into the old leaves the paving draws anyway (litterLayer), so that the ground does not
// go on filling. RISE: a step up this high stops a scuffed leaf. KICK: how far round a shoe leaves are scuffed, how far they
// go, and the share of the heap under it pushed on.
export const MEM = {
  PER: 4, SLOTS: 7, DMAX: 12,
  POOL: { high: 1000, medium: 1000, low: 500 }, FADE: 180, RISE: 0.05,
  KICK: { r: 0.17, push: [0.08, 0.2], heap: 0.2 },
};
const NO = -1000;
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 12.9898) * 43758.5453);
// `span`: the side of the square in metres; `ground(x, z)`: the height of the ground (fall.js's groundAt, the same cells),
// NO_GROUND (-1000) where there is none.
/** @param {{ span?: number, ground?: (x: number, z: number) => number, pool?: number }} [o] */
export function createMemory({ span = 32, ground = (x, z) => 0, pool = MEM.POOL.high } = {}) {
  const PER = MEM.PER, N = Math.round(span * PER), S = MEM.SLOTS, half = span / 2, step = span / 8;
  const dens = new Float32Array(N * N), gnd = new Float32Array(N * N), ownX = new Int32Array(N * N).fill(-1 << 30), ownZ = new Int32Array(N * N);
  const slots = new Int32Array(N * N * S).fill(-1);
  const P = pool, lx = new Float64Array(P), lz = new Float64Array(P), lid = new Uint8Array(P), lborn = new Float64Array(P), lcell = new Int32Array(P).fill(-1);
  const free = []; for (let i = P - 1; i >= 0; i--) free.push(i);
  // The leaves now lying, packed at the front of one list, so that the breeze and the feet look only at those.
  const live = new Int32Array(P), at = new Int32Array(P).fill(-1); let nLive = 0;
  const take = () => { const i = free.pop(); at[i] = nLive; live[nLive++] = i; return i; };
  const release = (i) => { lcell[i] = -1; free.push(i); const k = at[i], j = live[--nLive]; live[k] = j; at[j] = k; at[i] = -1; };
  let cx = 0, cz = 0, placed = false, clock = 0, since = 0, dirty = true;
  // The order they came down in, oldest first, so that the oldest can give up its place when the pool is full.
  const order = new Int32Array(P); let head = 0, tail = 0, queued = 0;
  const count = { landed: 0, heaped: 0, kicked: 0, blown: 0, stopped: 0, full: 0, faded: 0 };
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
      while (!free.length && queued) { const j = order[head]; head = (head + 1) % P; queued--; if (lcell[j] >= 0) { const cj = lcell[j]; kill(j); heapUp(cj, 1); count.heaped++; } }
      if (!free.length) { heapUp(c, 1); count.heaped++; return true; }
      const i = take(); lx[i] = x; lz[i] = z; lid[i] = Math.max(1, Math.min(255, id | 0)); lborn[i] = clock;
      if (queued === P) { head = (head + 1) % P; queued--; }
      order[tail] = i; tail = (tail + 1) % P; queued++;
      placeIn(c, i); return true;
    },
    // Time going by (`dt` seconds): the heaps sink slowly into the old leaves, a tenth of a second at a time.
    tick(dt) {
      clock += dt; since += dt; if (since < 0.1) return; const T = since; since = 0;
      const k = Math.exp(-T / MEM.FADE); let any = false;
      for (let c = 0; c < N * N; c++) if (dens[c] > 0) { const d = dens[c] * k; count.faded += dens[c] - d; dens[c] = d < 0.01 ? 0 : d; any = true; }
      if (any) dirty = true;
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
        let w = 0;   // the places are written one after another, so that a cell of three or fewer needs only its first point
        for (let k = 0; k < S; k++) {
          const i = slots[c * S + k]; if (i < 0) continue;
          const qx = Math.min(15, Math.max(0, Math.floor((lx[i] * PER - ownX[c]) * 16))), qz = Math.min(15, Math.max(0, Math.floor((lz[i] * PER - ownZ[c]) * 16)));
          out[o + 1 + w++] = (qx * 16 + qz) * 256 + lid[i];
        }
      }
      return true;
    },
  };
}

// The record on the card, and the uniforms the paving reads it by: (centre x, centre z, cells to a metre, cells across).
/** @param {{ span?: number, ground?: (x: number, z: number) => number, pool?: number }} [o] */
export function createLitter({ span = 32, ground = undefined, pool = undefined } = {}) {
  const mem = createMemory({ span, ground, pool }), N = mem.N, data = new Uint16Array(2 * N * N * 4), sent = new Uint16Array(data.length);
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
uniform highp usampler2D tLitMem; uniform sampler2D tLitCover; uniform vec4 uLitMem; uniform float uLitOn, uLitMode;
bool litIn(vec2 p){ vec2 d=abs(p-uLitMem.xy)*uLitMem.z; return uLitOn>.5&&max(d.x,d.y)<uLitMem.w*.5-1.; }
ivec2 litCell(vec2 c){ return ivec2(int(mod(c.x,uLitMem.w))*2,int(mod(c.y,uLitMem.w))); }
// (heap, whether a kept leaf lies within the 2×2 cells round p): one smooth look-up of the cover picture.
vec2 litCover(vec2 p){ vec2 c=texture(tLitCover,p*uLitMem.z/uLitMem.w).rg; return vec2(c.x*${(MEM.DMAX * MEM.PER * MEM.PER / 166).toFixed(4)},c.y); }   // the heap in leaves to the square metre over 166 (a leaf to a cell of each of litterLayer's three grids)
// The kept leaves over p: the cell p lies in, and a neighbour only where p is within a leaf's reach (5 cm) of the edge
// they share. One loop over those cells and one over a cell's places, so the shader holds the leaf's sums only once
// (written out four times they made the whole paving dearer to draw, even where no leaf lay). A cell's first point holds
// three places, the second the other four, read only when the third is taken.
vec4 freshLeaves(vec2 p, float gk){
  vec4 best=vec4(0.); vec2 g=p*uLitMem.z, c0=floor(g), f=g-c0; float r=.05*uLitMem.z;
  vec2 sd=vec2(f.x<r?-1.:f.x>1.-r?1.:0., f.y<r?-1.:f.y>1.-r?1.:0.);
  for(int n=0;n<4;n++){
    vec2 o=vec2(n==1||n==3?sd.x:0., n>=2?sd.y:0.);
    if((n==1||n==3)&&sd.x==0.) continue; if(n>=2&&sd.y==0.) continue;
    vec2 c=c0+o; ivec2 t=litCell(c); uvec4 A=texelFetch(tLitMem,t,0); if(A.g==0u) continue;
    uvec4 B=A.a!=0u?texelFetch(tLitMem,t+ivec2(1,0),0):uvec4(0u);
    for(int k=0;k<${MEM.SLOTS};k++){
      uint sl=k==0?A.g:k==1?A.b:k==2?A.a:k==3?B.r:k==4?B.g:k==5?B.b:B.a; if(sl==0u) break;
      vec2 q=vec2(float(sl>>12u),float((sl>>8u)&15u)), lp=(c+(q+.5)/16.)/uLitMem.z, d0=p-lp; if(dot(d0,d0)>.0026) continue;   // no leaf reaches past 5 cm from its middle
      float id=float(sl&255u), ang=h21(vec2(id,3.7))*6.2832, big=h21(vec2(id,31.7)), tree=step(h21(vec2(id,8.8)),gk);
      vec2 l=mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*d0;
      float len=mix(.02,.05,big*big), wid=len*mix(.4,.62,h21(vec2(id,2.2)))*mix(1.,1.5,tree);
      float m=(h21(vec2(id,44.4))<.25?step(-.1*len,l.y):1.)*smoothstep(1.,.7,length(l/vec2(len,wid)));
      if(m>best.z) best=vec4(h21(vec2(id,21.9)),.15*h21(vec2(id,5.5)),m,tree);
    }
  }
  return best;
}`;
