// How wide the edge of a puddle is on the screen, worked from the shader's own mask rather than from the picture (#496).
//   node tools/puddle-edge.cjs [--cols=300,340,…] [--rows=100,330] ['<json: [{ "name", "q": "cam=…&season=summer&time=day&view=third" }, …]>']
// A picture cannot say how wide the water's edge is: the stone's grain and what the water mirrors have steps of their own.
// The mask can. For each view the page is opened (the lowest tier: the ground is the same on every tier) at 1280×720 and
// `__pick` is asked where the ground lies under each pixel of some columns; the field the paving draws water from (steps.js's
// `fbm2`, with `(wet - 1) * .34` added) is worked out there, and so is the mask as the shader of the main branch drew it
// (smoothstep(.57, .61)) and as it draws it now (about the same edge, widened to a few pixels of ground where the eye is raised: `rise` and `edgeW` in ground.js,
// whose formulas are repeated here: keep the two together; the view's `eye` is the eye's height above the paving in metres:
// 0.8 the following eye looking level (the default), 1.6 his own eyes, 2.77 the following eye looking 17° down, 3.35 looking 23° down). A crossing is a run of pixels where the mask
// goes from under a tenth to over nine tenths without turning back; its width is the pixels between those, so that a hard edge
// is one pixel. `--sweep=-0.1,-0.45,0.05` takes the view from above (?cam=0,22,0,<pitch>) at each pitch from the first to the second by the third,
// finds the eye's height itself (`eye: "auto"`: the camera is where the distances to a dozen ground points cross) and prints the eye, `rise` and the
// widths for each, over the whole picture below the horizon. Printed: how many crossings, and their median, smallest and largest width, for each of the two masks.
const { chromium } = require("playwright");
const { site, serve } = require("./site.cjs");
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const cols = arg("cols", "").split(",").filter(Boolean).map(Number), rows = arg("rows", "100,400").split(",").map(Number), W = 1280, H = 720;
// VARIANTS='[{"name":"…","r0":2.4,"r1":3.4,"k":1.2,"w":0.22}]' also counts other settings of `rise` and `edgeW`, for choosing them.
const variants = JSON.parse(process.env.VARIANTS || "[]");
const sweep = arg("sweep", "");
const sweepViews = () => { const [a, z, d] = sweep.split(",").map(Number), out = []; for (let p = a; (d < 0 ? p >= z - 1e-9 : p <= z + 1e-9); p += d) out.push({ name: `pitch ${p.toFixed(2)}`, eye: "auto", rows: [150, 719], q: `cam=0,22,0,${p.toFixed(3)}&season=summer&time=day&view=third&show=court` }); return out; };
const views = sweep ? sweepViews() : JSON.parse(process.argv.find((x) => x.startsWith("[")) || JSON.stringify([
  { name: "under the maple", eye: 3.5, q: "cam=-6.5,30,0.9,-0.3&season=summer&time=day&view=third&show=court" },
  { name: "from above", eye: 5, q: "cam=0,22,0,-0.4&season=summer&time=day&view=third&show=court" },
  { name: "cam06 (his own eyes: unchanged)", eye: 1.6, rows: [380, 700], q: "show=cam06&season=summer&time=day&view=first" }]));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// The camera's place from the distances `__pick` gives to ground points [x, y, z, d] (least squares, Gauss-Newton).
function cameraAt(P) {
  let c = [P[0][0], 3, P[0][2] + 6];
  for (let it = 0; it < 100; it++) {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], g = [0, 0, 0];
    for (const [x, y, z, d] of P) { const v = [c[0] - x, c[1] - y, c[2] - z], n = Math.hypot(...v) || 1, r = n - d, j = v.map((t) => t / n); for (let a = 0; a < 3; a++) { g[a] += j[a] * r; for (let b = 0; b < 3; b++) A[a][b] += j[a] * j[b]; } }
    for (let a = 0; a < 3; a++) A[a][a] += 1e-9;
    const [[a, b, k], [d, e, f], [h, i, l]] = A, D = a * (e * l - f * i) - b * (d * l - f * h) + k * (d * i - e * h);
    const inv = [[(e * l - f * i) / D, (k * i - b * l) / D, (b * f - k * e) / D], [(f * h - d * l) / D, (a * l - k * h) / D, (k * d - a * f) / D], [(d * i - e * h) / D, (b * h - a * i) / D, (a * e - b * d) / D]];
    const st = [0, 1, 2].map((q) => inv[q][0] * g[0] + inv[q][1] * g[1] + inv[q][2] * g[2]); c = c.map((t, q) => t - st[q]);
    if (Math.hypot(...st) < 1e-9) break;
  }
  return c;
}
(async () => {
  const { fbm2 } = await import("../app/src/steps.js");
  const srv = await serve(site()), base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" });
  const X = cols.length ? cols : Array.from({ length: 24 }, (_, i) => 40 + i * 50);
  for (const v of views) {
    await p.goto(base + "?shot=1&q=low&" + v.q, { waitUntil: "commit", timeout: 180000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
    await p.waitForTimeout(1500);
    let eye = v.eye || 3.5;
    if (eye === "auto") { const hits = await p.evaluate(() => { const o = []; for (const x of [420, 640, 860]) for (const y of [520, 580, 640, 700]) { const k = window.__pick(x, y, 3).find((q) => q.kind === "Mesh" && Math.abs(q.at[1]) < 0.02); if (k) o.push([k.at[0], k.at[1], k.at[2], k.distance]); } return o; }); eye = hits.length >= 4 ? cameraAt(hits)[1] : NaN; }
    const wet = 1, rise = smooth(1.9, 2.7, eye);   // summer: `wet` in mood.js; the paving is the ground: eye height above it
    const grid = await p.evaluate(([X, r0, r1]) => X.map((x) => { const col = []; for (let y = r0; y <= r1; y++) { const h = window.__pick(x, y, 3).find((q) => q.kind === "Mesh" && Math.abs(q.at[1]) < 0.02); col.push(h ? [h.at[0], h.at[2]] : null); } return col; }), [X, ...(v.rows || rows)]);
    const res = { old: [], now: [] }; for (const x of variants) res[x.name] = [];
    for (const col of grid) {
      const mask = { old: [], now: [] }; for (const x of variants) mask[x.name] = [];
      col.forEach((q, i) => {
        if (!q) { for (const k in mask) mask[k].push(null); return; }
        const n = col[i + 1] || col[i - 1], reach = n ? Math.hypot(n[0] - q[0], n[1] - q[1]) : 0.05;   // ground one pixel covers along the column
        const low = fbm2(q[0] * 0.17 + 3, q[1] * 0.17 + 3) + (wet - 1) * 0.34, edgeW = 0.04 + (Math.min(0.22, Math.max(0.04, 1.2 * reach)) - 0.04) * rise;
        mask.old.push(smooth(0.57, 0.61, low)); mask.now.push(smooth(0.59 - 0.5 * edgeW, 0.59 + 0.5 * edgeW, low));
        for (const x of variants) { const w = 0.04 + (Math.min(x.w, Math.max(0.04, x.k * reach)) - 0.04) * smooth(x.r0, x.r1, eye); mask[x.name].push(smooth(0.59 - 0.5 * w, 0.59 + 0.5 * w, low)); }
      });
      for (const k of Object.keys(mask)) {
        const m = mask[k]; let i = 0;
        while (i < m.length) {   // find each run from under .1 to over .9, either way
          if (m[i] === null || m[i] >= 0.1 && m[i] <= 0.9) { i++; continue; }
          const from = m[i] < 0.1 ? 0 : 1; let j = i + 1;
          while (j < m.length && m[j] !== null && (from === 0 ? m[j] < 0.9 : m[j] > 0.1)) { if (from === 0 ? m[j] < m[j - 1] - 0.02 : m[j] > m[j - 1] + 0.02) break; j++; }
          if (j < m.length && m[j] !== null && (from === 0 ? m[j] >= 0.9 : m[j] <= 0.1)) {
            let a = i; while (a < j && (from === 0 ? m[a] < 0.1 : m[a] > 0.9)) a++;   // the first pixel in the ramp
            res[k].push(Math.max(1, j - a + 1));
          }
          i = Math.max(j, i + 1);
        }
      }
    }
    const stat = (a) => { if (!a.length) return "none"; a = [...a].sort((x, y) => x - y); return `n=${a.length} median ${a[a.length >> 1]} px, smallest ${a[0]}, largest ${a[a.length - 1]}`; };
    console.log(v.name + (v.eye === "auto" ? `: eye ${eye.toFixed(2)} m, rise ${rise.toFixed(2)}` : ""), "\n  main :", stat(res.old), "\n  now  :", stat(res.now)); for (const x of variants) console.log("  " + x.name + ":", stat(res[x.name]));
  }
  await b.close(); srv.close();
})();
