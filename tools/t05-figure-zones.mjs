// Any of the seven Buddhas' paint zones drawn from any side with no browser, in a second or two (#763): the figure's shipped mesh, each
// pixel painted with the pigment its zone has in app/levels/t05/figures/recipe.json (tools/t05-paint-eval.mjs works the zone out as the
// page's shader does), shaded only enough to read the form. For finding where a zone runs over its edge (a band of the curls' blue on a
// brow, a patch of the robe's red on a bare forearm) before anything is drawn in the hall; the colours in the hall are tools/t05-zones.cjs's.
//
//   node tools/t05-figure-zones.mjs <figure> <out.png> [--at=x,y,z] [--yaw=deg] [--pitch=deg] [--half=m] [--size=px] [--anchors=<json file>] [--holes]
//
// The eye looks at `at` (figure's frame, metres; the head's middle when left out) from the front turned `yaw` degrees toward the figure's
// own left (the viewer's right; 90 looks at it from its left side, -90 from its right, 180 from behind) and raised `pitch` degrees; the
// picture is `2 × half` metres square, drawn without perspective. `--anchors` tries another anchors file than the shipped one. Only the side
// a triangle is wound to show is drawn, as the page draws it; `--holes` paints magenta wherever the wrong side of something stands nearest.
import fs from "node:fs";
import sharp from "sharp";
import { loadFigure, loadMasks, anchorsOf, painter, recipe } from "./t05-paint-eval.mjs";

/** Draw one view; returns { png: Buffer, zones: { name: pixels } }. */
export async function drawZones(fig, P, { at, yaw = 0, pitch = 0, half = 1, size = 800, holes = false }) {
  const cy = Math.cos((yaw * Math.PI) / 180), sy = Math.sin((yaw * Math.PI) / 180), cp = Math.cos((pitch * Math.PI) / 180), sp = Math.sin((pitch * Math.PI) / 180);
  const f = [sy * cp, sp, cy * cp];   // from the point looked at toward the eye
  const r = [cy, 0, -sy], u = [-sy * sp, cp, -cy * sp];
  const { pos, nor, index } = fig, W = size, depth = new Float32Array(W * W).fill(-1e9), back = new Float32Array(W * W).fill(-1e9), tri = new Int32Array(W * W).fill(-1), bu = new Float32Array(W * W), bv = new Float32Array(W * W);
  const sx = new Float32Array(pos.length / 3), syy = new Float32Array(pos.length / 3), sz = new Float32Array(pos.length / 3), k = W / (2 * half);
  for (let i = 0, j = 0; i < pos.length; i += 3, j++) {
    const x = pos[i] - at[0], y = pos[i + 1] - at[1], z = pos[i + 2] - at[2];
    sx[j] = (x * r[0] + y * r[1] + z * r[2]) * k + W / 2; syy[j] = W / 2 - (x * u[0] + y * u[1] + z * u[2]) * k; sz[j] = x * f[0] + y * f[1] + z * f[2];
  }
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c]))), x1 = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
    const y0 = Math.max(0, Math.floor(Math.min(syy[a], syy[b], syy[c]))), y1 = Math.min(W - 1, Math.ceil(Math.max(syy[a], syy[b], syy[c])));
    if (x0 > x1 || y0 > y1) continue;
    const d = (sx[b] - sx[a]) * (syy[c] - syy[a]) - (sx[c] - sx[a]) * (syy[b] - syy[a]); if (Math.abs(d) < 1e-9) continue;
    const facing = d < 0;   // the page draws only the side a triangle is wound to show (y runs down the picture here)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - sx[a], py = y + 0.5 - syy[a];
      const uu = (px * (syy[c] - syy[a]) - (sx[c] - sx[a]) * py) / d, vv = ((sx[b] - sx[a]) * py - px * (syy[b] - syy[a])) / d;
      if (uu < 0 || vv < 0 || uu + vv > 1) continue;
      const z = sz[a] * (1 - uu - vv) + sz[b] * uu + sz[c] * vv, q = y * W + x;
      if (!facing) { if (z > back[q]) back[q] = z; continue; }
      if (z > depth[q]) { depth[q] = z; tri[q] = t; bu[q] = uu; bv[q] = vv; }
    }
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), cols = P.zones.map((z) => hex(z.color)), base = hex(recipe.base.color);
  // `through`: pixels where the nearest thing is the wrong side of a triangle (more than 2 mm before any right side): the page shows whatever
  // lies behind there, the far inside of the figure or the hall; with `holes` they are drawn magenta
  const out = Buffer.alloc(W * W * 3), count = {}, p = [0, 0, 0], n = [0, 0, 0]; let through = 0;
  for (let q = 0; q < W * W; q++) {
    const gap = back[q] > depth[q] + 0.002; if (gap) through++;
    if (gap && holes) { out[q * 3] = 255; out[q * 3 + 1] = 0; out[q * 3 + 2] = 255; continue; }
    if (tri[q] < 0) { out[q * 3] = out[q * 3 + 1] = out[q * 3 + 2] = 24; continue; }
    const t = tri[q], a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3, w = 1 - bu[q] - bv[q];
    for (let i = 0; i < 3; i++) { p[i] = pos[a + i] * w + pos[b + i] * bu[q] + pos[c + i] * bv[q]; n[i] = nor[a + i] * w + nor[b + i] * bu[q] + nor[c + i] * bv[q]; }
    const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l;
    const zi = P.zoneIndex(p, n), col = zi < 0 ? base : cols[zi], name = zi < 0 ? recipe.base.name : P.zones[zi].name; count[name] = (count[name] ?? 0) + 1;
    const shade = 0.45 + 0.55 * Math.max(0, n[0] * f[0] + n[1] * f[1] + n[2] * f[2]) ** 0.8 + 0.25 * Math.max(0, n[1]) * 0.5;
    for (let i = 0; i < 3; i++) out[q * 3 + i] = Math.min(255, Math.round(col[i] * shade * 1.35));
  }
  return { png: await sharp(out, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer(), zones: count, through };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""))) {
  const [id, file] = process.argv.slice(2), arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || d;
  if (!id || !file) { console.error("usage: node tools/t05-figure-zones.mjs <figure> <out.png> [--at=x,y,z] [--yaw=deg] [--pitch=deg] [--half=m] [--size=px] [--anchors=file]"); process.exit(2); }
  const A = arg("anchors") ? JSON.parse(fs.readFileSync(arg("anchors"), "utf8")).anchors : anchorsOf(id), fig = await loadFigure(id), P = painter(A, await loadMasks(A));
  const at = arg("at") ? arg("at").split(",").map(Number) : [0, (A.eyeL[1] + A.eyeR[1]) / 2 + 0.2, A.eyeL[2] - 0.5];
  const r = await drawZones(fig, P, { at, yaw: +arg("yaw", 0), pitch: +arg("pitch", 0), half: +arg("half", 1.1), size: +arg("size", 800), holes: process.argv.includes("--holes") });
  fs.writeFileSync(file, r.png); console.log(JSON.stringify({ zones: r.zones, through: r.through }));
}
