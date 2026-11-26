// One ruler for the seven Buddhas' colours in the great hall (#762, #763): the picture the visitor's page draws, read zone by zone.
// Each view is drawn as the page draws it and saved; then, in the same pose, the figures are drawn once more with every
// paint material writing its zone and figure (paint.js, uIdMode 1) and everything else black, untoned, and the saved picture
// is read through that mask: for each figure and zone the pixels whose four neighbours are the same zone (no edge blends in),
// their mean colour on screen, CIE Lab (D65) of that mean, and the 10th/50th/90th percentile of luma. The head is the skin
// zone inside the screen rectangle from the hairline to below the mouth and from ear to ear, from each figure's own anchors,
// as tools/t05-hall/stage.js zoneIds does on the stage page. The art director's lines (2026-11-26) are judged on these.
// Before this the colour pass measured on the stage page and the light pass by hand-drawn boxes on the T4's pictures, and
// their curls disagreed by 3 L* and 20% of chroma for the same pigment; both are retired for this.
//
// usage, software rendering:  node tools/t05-zones.cjs <outdir> [--views=cam03,cam06,mid10-0,mid10-3,mid10-6] [--query=k=v&…] [--size=1920x1080] [--picks=12, 0 for none]
// on a T4: tools/t05-gpu.sh stages this file and runs it through tools/gpu/job.cjs as spec.script (exports.run).
const fs = require("fs"), path = require("path");

// The views: a named one as the page has it, or a figure seen from 10 m before it at the height of its head (mid10-<i>,
// i in the order FIGURE_FILES lists them: 0 Kasyapa at the east end, 3 Vipasyin in the middle, 6 Sakyamuni at the west).
const VIEWS = {
  cam03: "show=cam03&view=first",          // the light pass's T4s were all from his eyes
  "cam03-third": "show=cam03&view=third",  // the acceptance still (checks.js): from behind him, outside the threshold, the hall's fill not yet risen
  cam04: "show=cam04",
  cam05: "show=cam05",
  cam06: "show=cam06",
};
const BENCH_HOST = "pr-0-temple-walk-preview.test";   // ?hall=open is read only on a preview's host name (bench.js)

function lab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const L = 116 * f(Y) - 16, a = 500 * (f(X) - f(Y)), bb = 200 * (f(Y) - f(Z));
  return { L: +L.toFixed(1), a: +a.toFixed(1), b: +bb.toFixed(1), C: +Math.hypot(a, bb).toFixed(1), h: Math.round(((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360) };
}

// In the page: wait for the seven, pose a mid10 view, and return the mask of zones and figures at the drawing buffer's size.
async function prepare(page, view) {
  await page.waitForFunction(() => { const f = window.__t05Figures?.(); return f && f.figures.length && f.figures.every((x) => x.status === "ready" || x.status === "failed"); }, null, { timeout: 600000, polling: 1000 });
  // mid10-<i>: 10 m before the figure at the height of its brow; head-<i>: 3.5 m before it, its head filling the picture (the hairline)
  const mid = /^(mid10|head)-(\d)$/.exec(view);
  // wrist-w / wrist-f: Sakyamuni's right wrist (#578, #763) from the two nearest places a visitor can stand, the west aisle and before the altar,
  // in the figure's own frame as the mend's evidence has them (docs/t05/evidence/763-wrist-mend/README.md: metres, the seat's foot 0, facing +z)
  const wr = /^wrist-(w|f)$/.exec(view);
  if (wr) await page.evaluate((w) => new Promise((done) => {
    const d = window.__t05FiguresDebug(), f = Object.values(d.figures).find((x) => x.paints[0].userData.paint.U.uFig.value === 6), V = d.camera.position.constructor;
    const eye = f.pivot.localToWorld(new V(...(w === "w" ? [-4.05, 0.2, 2.6] : [-1.95, 0.2, 3.1]))), at = f.pivot.localToWorld(new V(-1.85, 3.58, 1.38));
    window.__look(eye.toArray(), at.toArray()); requestAnimationFrame(() => requestAnimationFrame(() => done(null)));
  }), wr[1]);
  // A column or a beam may stand on the line from the eye to the brow, or the eye itself inside a column (the fifth figure's, from 10 m, stood in
  // one: a ray from the eye does not see a column's faces from inside). So the line is tried the other way, from a metre before the figure back
  // toward the eye, and the eye steps aside a little at a time, never more than 1.5 m, until nothing stands on it.
  if (mid) for (const side of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
    const clear = await page.evaluate(([i, d0, dx]) => new Promise((done) => {
      const d = window.__t05FiguresDebug(), f = Object.values(d.figures).find((x) => x.paints[0].userData.paint.U.uFig.value === i), A = f.anchors;
      const head = f.pivot.localToWorld(new d.camera.position.constructor(...A.hairFront)), at = f.pivot.position, y = head.y - (d0 > 5 ? 0.6 : 0.35);
      const eye = [at.x + dx, y, at.z + d0], from = [at.x, y, at.z + 1], far = Math.hypot(dx, d0 - 1);
      window.__look(from, eye);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const h = window.__pick(innerWidth / 2, innerHeight / 2, 1)[0], ok = !h || h.distance > far - 0.3;
        window.__look(eye, [at.x, y, at.z]);
        requestAnimationFrame(() => requestAnimationFrame(() => done(ok)));
      }));
    }), [+mid[2], mid[1] === "mid10" ? 10 : 3.5, side]);
    if (clear) { if (side) console.log(`${view}: the eye stepped ${side} m aside to see past what stood in the way`); break; }
  }
}
function idPass() {
  const d = window.__t05FiguresDebug(), { renderer, scene, camera } = d, gl = renderer.getContext();
  const own = new Set(), kept = new Map(), hidden = [];
  // a plain black material from the same three as the page's own (the page's bundle is not importable from here)
  let BM = null; scene.traverse((o) => { if (!BM && o.isMesh && o.material?.isMeshBasicMaterial) BM = o.material.constructor; });
  const mat = BM ? new BM({ color: 0x000000, fog: false }) : null;
  const figs = Object.entries(d.figures);
  for (const [, f] of figs) { f.pivot.traverse((o) => { if (o.isMesh) own.add(o); }); for (const p of f.paints) p.userData.paint.U.uIdMode.value = 1; }
  scene.traverse((o) => {
    if (own.has(o)) return;
    if (o.isMesh && mat) { kept.set(o, o.material); o.material = mat; }
    else if ((o.isPoints || o.isLine || o.isSprite || (o.isMesh && !mat)) && o.visible) { hidden.push(o); o.visible = false; }
  });
  const tm = renderer.toneMapping, bg = scene.background, fog = scene.fog, rt = renderer.getRenderTarget(), ac = renderer.autoClear;
  renderer.toneMapping = 0; scene.background = null; scene.fog = null; renderer.autoClear = true;
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.render(scene, camera);
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, id = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, id);
  renderer.toneMapping = tm; scene.background = bg; scene.fog = fog; renderer.setRenderTarget(rt); renderer.autoClear = ac;
  for (const [o, m] of kept) o.material = m; for (const o of hidden) o.visible = true;
  for (const [, f] of figs) for (const p of f.paints) p.userData.paint.U.uIdMode.value = 0;
  mat?.dispose();
  // each figure's head rectangle on screen (y down), from its anchors
  const V = camera.position.constructor, heads = figs.map(([, f]) => {
    const A = f.anchors, eyeY = (A.eyeL[1] + A.eyeR[1]) / 2;
    const ps = [A.hairFront, [A.mouth[0], A.mouth[1] - 0.6 * (eyeY - A.mouth[1]), A.mouth[2]], A.earL, A.earR].map((p) => f.pivot.localToWorld(new V(...p)).project(camera));
    const x = ps.map((q) => (q.x + 1) / 2 * W), y = ps.map((q) => (1 - q.y) / 2 * H);
    return { fig: f.paints[0].userData.paint.U.uFig.value, box: [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)] };
  });
  // the id picture, rows bottom-up as readPixels gives them, packed two bytes a pixel (zone, figure)
  const z = new Uint8Array(W * H * 2); for (let k = 0, j = 0; k < id.length; k += 4, j += 2) { z[j] = Math.round(id[k] * 16 / 255); z[j + 1] = Math.round(id[k + 1] * 16 / 255); }
  let s = ""; for (let i = 0; i < z.length; i += 32768) s += String.fromCharCode.apply(null, z.subarray(i, i + 32768));
  return { W, H, ids: btoa(s), heads, order: figs.map(([k, f]) => [k, f.paints[0].userData.paint.U.uFig.value]) };
}

// Read the saved picture (PNG) through the mask.
async function measure(pngFile, m, zoneNames) {
  const sharp = require("sharp");
  const { data, info } = await sharp(pngFile).removeAlpha().resize(m.W, m.H, { kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
  const ids = Buffer.from(m.ids, "base64"), W = m.W, H = m.H;
  const at = (x, yUp) => { const j = (yUp * W + x) * 2; return ids[j + 1] ? ids[j] * 100 + ids[j + 1] : 0; };
  const names = [...zoneNames]; names[13] = "唇";
  const acc = {}, headAcc = {}, figName = Object.fromEntries(m.order.map(([k, i]) => [i + 1, k]));
  const faceZi = zoneNames.findIndex((n) => /肤色/.test(n)) + 1;
  const add = (o, r, g, b) => { o[0]++; o[1] += r; o[2] += g; o[3] += b; o[4][Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)]++; };
  for (let yUp = 1; yUp < H - 1; yUp++) for (let x = 1; x < W - 1; x++) {
    const c = at(x, yUp); if (!c) continue;
    if (at(x + 1, yUp) !== c || at(x - 1, yUp) !== c || at(x, yUp + 1) !== c || at(x, yUp - 1) !== c) continue;
    const y = H - 1 - yUp, k = (y * W + x) * info.channels, r = data[k], g = data[k + 1], b = data[k + 2];
    add((acc[c] ??= [0, 0, 0, 0, new Uint32Array(256)]), r, g, b);
    const zi = Math.floor(c / 100), fi = c % 100;
    if (zi === faceZi) { const h = m.heads.find((q) => q.fig + 1 === fi); if (h && x >= h.box[0] && x <= h.box[2] && y >= h.box[1] && y <= h.box[3]) add((headAcc[fi] ??= [0, 0, 0, 0, new Uint32Array(256)]), r, g, b); }
  }
  const pct = (h, n, q) => { let t = 0; for (let i = 0; i < 256; i++) { t += h[i]; if (t >= n * q) return i; } return 255; };
  const row = ([n, r, g, b, h]) => { const rgb = [r / n, g / n, b / n]; return { px: n, rgb: rgb.map((v) => +v.toFixed(1)), luma: +(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]).toFixed(1), lab: lab(rgb), q: [0.1, 0.5, 0.9].map((q) => pct(h, n, q)) }; };
  const out = {};
  for (const [c, a] of Object.entries(acc)) { if (a[0] < 30) continue; const zi = Math.floor(c / 100), fi = c % 100, f = figName[fi] ?? `fig${fi}`; (out[f] ??= {})[names[zi - 1] ?? `zone${zi}`] = row(a); }
  for (const [fi, a] of Object.entries(headAcc)) if (a[0] >= 30) (out[figName[fi] ?? `fig${fi}`] ??= {})["头"] = row(a);
  // the rest of the picture by material, as __pick named it: median L*, C*, h and luma of the pixels under the picks (not on a figure)
  if (m.picks) {
    const by = {}, sx = W / m.picks.W, sy = H / m.picks.H;
    for (const [px, py, mat, part, , wy] of m.picks.r) {
      const x = Math.round(px * sx), y = Math.round(py * sy); if (x < 0 || y < 0 || x >= W || y >= H || at(x, H - 1 - y)) continue;
      const k = (y * W + x) * info.channels, rgb = [data[k], data[k + 1], data[k + 2]], key = mat + (part ? " · " + part : "");
      (by[key] ??= []).push([lab(rgb), 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2], wy]);
    }
    const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
    out["(scene)"] = Object.fromEntries(Object.entries(by).filter(([, a]) => a.length >= 8).sort((a, b) => b[1].length - a[1].length).map(([k, a]) => [k, { n: a.length, L: +med(a.map((q) => q[0].L)).toFixed(1), C: +med(a.map((q) => q[0].C)).toFixed(1), h: med(a.map((q) => q[0].h)), b: +med(a.map((q) => q[0].b)).toFixed(1), L90: +[...a.map((q) => q[0].L)].sort((p, q) => p - q)[Math.floor(a.length * 0.9)].toFixed(1), luma: +med(a.map((q) => q[1])).toFixed(1), y: +med(a.map((q) => q[2])).toFixed(1) }]));
  }
  return out;
}

// The art director's lines that can be read off these numbers (#762's handover): faces, the ratio, b*, face over robe, curls.
function verdict(all) {
  const res = {};
  for (const [view, figs] of Object.entries(all)) {
    const faces = Object.entries(figs).filter(([, z]) => z["头"]).map(([k, z]) => [k, z["头"].luma, z["头"].lab.b]);
    const curls = Object.entries(figs).filter(([, z]) => z["螺发"]).map(([k, z]) => [k, z["螺发"].lab]);
    const robe = Object.entries(figs).filter(([, z]) => z["头"] && z["袈裟"]).map(([k, z]) => [k, z["头"].luma - z["袈裟"].luma]);
    const ls = faces.map((f) => f[1]);
    res[view] = {
      faceMin: ls.length ? Math.min(...ls) : null, ratio: ls.length > 1 ? +(Math.max(...ls) / Math.min(...ls)).toFixed(2) : null,
      faceBpos: faces.every((f) => f[2] > 0), faceOverRobe: robe.map(([k, d]) => [k, +d.toFixed(1)]),
      curls: curls.map(([k, l]) => ({ fig: k, L: l.L, C: l.C, h: l.h, ok: l.L >= 18 && l.L <= 26 && l.C >= 8 && l.C <= 14 && l.h >= 255 && l.h <= 275 })),
    };
  }
  return res;
}

const recipeZones = (root) => {
  for (const p of [path.join(root, "app/levels/t05/figures/recipe.json"), path.join(__dirname, "recipe.json"), path.join(__dirname, "../app/levels/t05/figures/recipe.json")]) if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")).zones.map((z) => z.name);
  throw new Error("recipe.json not found");
};

// On a T4, from tools/gpu/job.cjs: `open(query, size)` gives a page of the staged site. Each view leaves its picture and its
// mask (<view>.png, <view>.mask.json); the job's machine has no image library, so the reading is done after, by
// `node tools/t05-zones.cjs --measure=<dir>`, which software runs do at once.
exports.run = async ({ open, out, log = console.log, size = [1920, 1080], views = ["cam03", "cam06", "mid10-0", "mid10-3", "mid10-6"], query = "", picks = 12 }) => {   // picks: the step in pixels of the scene's material probe, 0 for none (each __pick is a ray through the whole hall: at 12 px a 1080p view takes about 15 minutes on a T4)
  fs.mkdirSync(out, { recursive: true });
  const files = [];
  for (const v of views) {
    const { ctx, page } = await open(`level=t05&hall=open&shot=1&q=high&season=winter&time=day&${VIEWS[v] ?? (/^(mid10|head)-\d$|^wrist-[wf]$/.test(v) ? "show=cam03&view=first" : v)}${query ? "&" + query : ""}`, size, 1);
    try {
      await prepare(page, v); await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(out, `${v}.png`) });
      const mask = await page.evaluate(idPass);
      // what lies under every 12th pixel that is not a figure (the back wall, the timber, the floor): the page's own __pick
      if (picks > 0) mask.picks = await page.evaluate((step) => { const r = [], W = innerWidth, H = innerHeight; for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) { const h = window.__pick(x, y, 1)[0]; r.push([x, y, h ? h.material : "sky", h ? String(h.part ?? "") : "", h ? +h.distance.toFixed(1) : -1, h ? h.at[1] : 0]); } return { W, H, r }; }, picks).catch(() => null);
      fs.writeFileSync(path.join(out, `${v}.mask.json`), JSON.stringify(mask));
      const cost = await page.evaluate(() => (window.__cost ? window.__cost(60) : null)).catch(() => null);
      files.push({ view: v, cost }); log("zones", v, cost);
    } catch (e) { files.push({ view: v, error: String(e.message).slice(0, 300) }); log("zones failed", v, e.message); }
    await ctx.close();
  }
  return files;
};

// Read every <view>.png in a folder through its <view>.mask.json; write zones.json and return the verdict.
exports.measureDir = async (dir, zones) => {
  const all = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".mask.json")).sort()) {
    const v = f.replace(/\.mask\.json$/, ""), png = path.join(dir, `${v}.png`); if (!fs.existsSync(png)) continue;
    all[v] = await measure(png, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), zones);
  }
  const report = { views: all, verdict: verdict(all) };
  fs.writeFileSync(path.join(dir, "zones.json"), JSON.stringify(report, null, 2));
  return report.verdict;
};

if (require.main === module) (async () => {
  const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || d;
  const zones = recipeZones(path.join(__dirname, ".."));
  if (arg("measure")) { console.log(JSON.stringify(await exports.measureDir(arg("measure"), zones), null, 1)); return; }
  const { chromium } = require("playwright"), { site, serve } = require("./site.cjs");
  const out = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "tools/out/t05-zones";
  const [w, h] = arg("size", "1920x1080").split("x").map(Number);
  const srv = await serve(site()), port = srv.address().port;
  const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", `--host-resolver-rules=MAP ${BENCH_HOST} 127.0.0.1`] });
  const open = async (q, [W, H]) => { const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" }), page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("pageerror", e.message));
    page.on("console", (m) => { if (m.type() === "error") console.log("console", m.text().slice(0, 400)); });   // (a shader that does not compile says so only here)
    await page.goto(`http://${BENCH_HOST}:${port}/?${q}&debug=0`, { waitUntil: "commit", timeout: 120000 }); await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 600000 }); return { ctx, page }; };
  await exports.run({ open, out, size: [w, h], views: arg("views", "cam03,cam06,mid10-0,mid10-3,mid10-6").split(","), query: arg("query", ""), picks: +arg("picks", "12") });
  await br.close(); srv.close();
  console.log(JSON.stringify(await exports.measureDir(out, zones), null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
