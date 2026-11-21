// The heightmaps the terrain spike (#183) draws the far land from: one cut from a real DEM, one made by hand after the
// five peaks of docs/JINGSHAN.md. Both are written in the scene's own frame (x east, z south, 1 unit = 1 m, centred on
// the hill rings' centre, 0, -45) as a square of little-endian int16 decimetres, with a JSON that says how big it is.
//
//   node tools/terrain/heightmap.mjs dem <window.f32> [--at=x,y --turn=deg]   → app/shared/terrain/dem.bin(.json)
//   node tools/terrain/heightmap.mjs made                                     → app/shared/terrain/made.bin(.json)
//
// For the DEM, where the temple stands in the window and which way its axis runs is searched: the place whose land
// best fits the courts and the approach as site.js has drawn them (the fewest metres to blend away at the seam), then,
// among the close fits, the one most closed in by hills and highest to the north (五峰环抱，北面最高).
import fs from "node:fs";
import path from "node:path";
import "../../tests/unit/dom-stub.mjs";
const { terrain, LEVELS, SITE } = await import("../../app/src/site.js");

const OUT = path.resolve(import.meta.dirname, "../../app/shared/terrain");
const N = 512, EXTENT = 9000, CX = 0, CZ = -45;   // 17.6 m a sample over 9 km
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];

// The ground of the plan where it is drawn (the courts, the terraces), elsewhere the written land.
export function ground(x, z) {
  for (const L of LEVELS) if (Math.abs(x) < L.x && z < L.zS && z > L.zN) return L.y;
  if (Math.abs(x) < SITE.x && z < SITE.zS && z > LEVELS[0].zS) return 0;
  return terrain(x, z);
}
const fit = [];
for (let x = -40; x <= 40; x += 10) for (let z = -150; z <= 130; z += 10) fit.push([x, z, ground(x, z)]);

function write(name, h, extra) {
  fs.mkdirSync(OUT, { recursive: true });
  const q = new Int16Array(N * N); for (let i = 0; i < q.length; i++) q[i] = Math.max(-32768, Math.min(32767, Math.round(h[i] * 10)));
  fs.writeFileSync(path.join(OUT, `${name}.bin`), Buffer.from(q.buffer));
  const meta = { n: N, extent: EXTENT, centre: [CX, CZ], unit: 0.1, ...extra };
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(meta, null, 1) + "\n");
  let lo = Infinity, hi = -Infinity; for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  console.log(`${name}: ${N}² over ${EXTENT} m, ${lo.toFixed(0)}..${hi.toFixed(0)} m`, extra);
}
// The sample grid in scene coordinates.
const at = (i, j) => [CX + ((j + 0.5) / N - 0.5) * EXTENT, CZ + ((i + 0.5) / N - 0.5) * EXTENT];

if (process.argv[2] === "dem") {
  const file = process.argv[3], meta = JSON.parse(fs.readFileSync(file + ".json", "utf8")), W = meta.n, cell = meta.cell;
  const win = new Float32Array(fs.readFileSync(file).buffer.slice(0));
  // window metres (east, north) from its centre → height
  const dem = (e, n) => {
    const c = e / cell + (W - 1) / 2, r = -n / cell + (W - 1) / 2;
    if (c < 0 || r < 0 || c >= W - 1 || r >= W - 1) return NaN;
    const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0, k = r0 * W + c0;
    return win[k] * (1 - fr) * (1 - fc) + win[k + 1] * (1 - fr) * fc + win[k + W] * fr * (1 - fc) + win[k + W + 1] * fr * fc;
  };
  // scene (x, z) → window (e, n), for the temple at window point (pe, pn) with its uphill axis (-z) turned `t` from north
  const to = (x, z, pe, pn, t) => { const c = Math.cos(t), s = Math.sin(t); return [pe + x * c - z * s, pn - x * s - z * c]; };
  const score = (pe, pn, t) => {
    let s = 0, s2 = 0;
    for (const [x, z, g] of fit) { const d = dem(...to(x, z, pe, pn, t)) - g; s += d; s2 += d * d; }
    const off = s / fit.length, rms = Math.sqrt(Math.max(0, s2 / fit.length - off * off));
    // how closed in: the mean angle up to the land on a ring 0.5–2 km out, and how much higher it is to the north
    let up = 0, north = 0, k = 0;
    for (let a = 0; a < 24; a++) { const b = (a / 24) * Math.PI * 2; let best = -1;
      for (const r of [500, 800, 1200, 1600, 2000]) { const h = dem(...to(Math.sin(b) * r, CZ - Math.cos(b) * r, pe, pn, t)) - off - 20; best = Math.max(best, Math.atan2(h, r)); }
      up += best; north += best * Math.cos(b); k++; }
    return { rms, off, up: up / k, north: north / k };
  };
  let best = [];
  if (arg("at")) { const [pe, pn] = arg("at").split(",").map(Number), t = (Number(arg("turn") || 0) * Math.PI) / 180; best = [{ pe, pn, t, ...score(pe, pn, t) }]; }
  else {
    for (let pe = -3000; pe <= 3000; pe += 100) for (let pn = -3000; pn <= 3000; pn += 100) for (let d = 0; d < 360; d += 15) {
      const t = (d * Math.PI) / 180, r = score(pe, pn, t); if (Number.isFinite(r.rms)) best.push({ pe, pn, t, ...r });
    }
    best = best.filter((b) => b.off > Number(arg("above") || -1e9)); best.sort((a, b) => a.rms - b.rms); best = best.slice(0, 400);
    best.sort((a, b) => (b.up + 0.5 * b.north) - (a.up + 0.5 * a.north));
  }
  for (const b of best.slice(0, 8)) console.log(`at ${b.pe},${b.pn} turn ${Math.round((b.t * 180) / Math.PI)}°: rms ${b.rms.toFixed(1)} m, offset ${b.off.toFixed(0)} m, enclosure ${((b.up * 180) / Math.PI).toFixed(1)}°, north ${((b.north * 180) / Math.PI).toFixed(1)}°`);
  const { pe, pn, t, off, rms } = best[0], h = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = dem(...to(...at(i, j), pe, pn, t)); h[i * N + j] = Number.isFinite(v) ? v - off : -off; }
  write("dem", h, { source: "Copernicus DEM GLO-30", at: [pe, pn], turn: Math.round((t * 180) / Math.PI), offset: Math.round(off), seamRms: +rms.toFixed(1) });
} else if (process.argv[2] === "made") {
  // Five peaks round the temple, the north one highest; a valley opening south, down which the path came; far ranges.
  let seed = 183; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ox = rnd() * 1000, oz = rnd() * 1000;
  const hash = (i, j) => { const s = Math.sin((i + ox) * 127.1 + (j + oz) * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = sm(x - i), fz = sm(z - j);
    return (hash(i, j) * (1 - fx) + hash(i + 1, j) * fx) * (1 - fz) + (hash(i, j + 1) * (1 - fx) + hash(i + 1, j + 1) * fx) * fz; };
  const ridged = (x, z) => { let a = 0, w = 0.5, f = 1; for (let o = 0; o < 6; o++) { a += w * (1 - Math.abs(vn(x * f, z * f))) ** 2; w *= 0.5; f *= 2.03; } return a; };
  const fbm = (x, z) => { let a = 0, w = 0.5, f = 1; for (let o = 0; o < 5; o++) { a += w * vn(x * f + 11, z * f - 7); w *= 0.5; f *= 2.1; } return a; };
  // bearing (degrees from north, clockwise), distance, height above the court
  const peaks = [[0, 1150, 360], [64, 980, 230], [132, 1400, 190], [-122, 1300, 205], [-56, 920, 250]];
  const h = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const [x, z] = at(i, j), dx = x - CX, dz = z - CZ, r = Math.hypot(dx, dz), b = Math.atan2(dx, -dz);
    let v = 0;
    for (const [bd, d, H] of peaks) { const px = Math.sin((bd * Math.PI) / 180) * d, pz = -Math.cos((bd * Math.PI) / 180) * d;
      const q = Math.hypot(dx - px, dz - pz); v = Math.max(v, H * Math.exp(-((q / (d * 0.42)) ** 1.6))); }
    // the ring of ridges between them, low in the south where the valley opens
    const south = Math.max(0, Math.cos(b - Math.PI));   // 1 due south
    v = Math.max(v, (110 - 90 * south ** 2) * Math.exp(-(((r - 1050) / 420) ** 2)));
    // the land falls away beyond the ring, most to the south (the valley and the plain below), and far ranges close the view
    v -= Math.max(0, r - 700) * (0.05 + 0.1 * south ** 1.5);
    v += 260 * Math.exp(-(((r - 4000) / 900) ** 2)) * (0.6 + 0.4 * (1 - south));
    const wx = x + 400 * fbm(x / 1500, z / 1500), wz = z + 400 * fbm(x / 1500 + 5, z / 1500 - 3);   // the ridges wander
    v += (ridged(wx / 1300, wz / 1300) - 0.5) * 110 * Math.min(1, r / 600) + fbm(x / 220, z / 220) * 18 * Math.min(1, r / 300);
    h[i * N + j] = v;
  }
  // in the basin the land is the plan's own
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const [x, z] = at(i, j), w = Math.min(1, Math.max(0, (Math.hypot(x - CX, (z - CZ) * 0.7) - 160) / 260)); h[i * N + j] = ground(x, z) * (1 - w) + h[i * N + j] * w; }
  write("made", h, { source: "made here (tools/terrain/heightmap.mjs made, seed 183)" });
} else console.log("node tools/terrain/heightmap.mjs dem <window.f32> | made");
