// Measures T05's grown trees on J01 against the art director's lines of 2026-11-25 (docs/t05/DECISIONS.md, 真树与远景): in each judged framing
// (cam01, cam07, the arrival looking south) every 8 px of the picture is asked what lies there (`__pick`) and the colour under it is read as CIE
// Lab (D65). Reported: the needles in the sun (L* ≥ 30) and in the shade, with the darkest tenth (the crowns' undersides, L* ≥ 12 asked); the bare
// wood (L* 20–30 asked against the sky); the poplars' pale bark (L* 55–65 asked); in each half of the picture, the share of its width where a tree
// stands against the sky (cam01: a quarter or less each side); and the highest tree pixel against the great hall's eave (cam01: no tree top above
// it). Software rendering: the shapes and the order of lightness hold, the absolute values want a T4.
// usage: node tools/t05-trees-measure.cjs <outdir> [--query=k=v&…] [--views=cam01,cam07,south]
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { site, serve } = require("./site.cjs");

const VIEWS = { cam01: "show=cam01", cam07: "show=cam07", south: "cam=0,215,3.1416,0.03" };
const TREE = /^(dryNeedles|treeBark|paleBark)$/;

function lab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
const stats = (list) => (list.length ? { n: list.length, L: q(list.map((c) => c[0]), 0.5), L10: q(list.map((c) => c[0]), 0.1), L90: q(list.map((c) => c[0]), 0.9), C: q(list.map((c) => Math.hypot(c[1], c[2])), 0.5) } : { n: 0 });

(async () => {
  const out = process.argv[2] || "tools/out/t05-trees"; fs.mkdirSync(out, { recursive: true });
  const extra = (process.argv.find((a) => a.startsWith("--query=")) || "").slice(8);
  const names = ((process.argv.find((a) => a.startsWith("--views=")) || "").slice(8) || Object.keys(VIEWS).join(",")).split(",");
  const srv = await serve(site()), base = `http://127.0.0.1:${srv.address().port}/`;
  const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await br.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "zh-CN" });
  const report = {};
  for (const name of names) {
    await page.goto(`${base}?level=t05&shot=1&q=high&season=winter&time=day&view=first&${VIEWS[name]}${extra ? "&" + extra : ""}`, { waitUntil: "commit", timeout: 180000 });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    await page.waitForTimeout(1500);
    const png = await page.screenshot({ path: path.join(out, `${name}.png`) });
    const S = 8, samples = await page.evaluate(async ([b64, S]) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(img.width, img.height), x2 = c.getContext("2d"); x2.drawImage(img, 0, 0);
      const d = x2.getImageData(0, 0, img.width, img.height).data, res = [];
      for (let y = S / 2; y < img.height; y += S) for (let x = S / 2; x < img.width; x += S) {
        const h = window.__pick(x, y, 1)[0], i = (y * img.width + x) * 4;
        res.push({ x, y, m: h ? h.material : "sky", part: h ? h.part : null, d: h ? h.distance : Infinity, rgb: [d[i], d[i + 1], d[i + 2]] });
      }
      return { w: img.width, h: img.height, res };
    }, [png.toString("base64"), S]);
    const { w, res } = samples, sun = [], shade = [], bark = [], pale = [], mats = {};
    for (const s of res) {
      mats[s.m] = (mats[s.m] || 0) + 1;
      const c = lab(s.rgb);
      if (s.m === "dryNeedles") (c[0] >= 30 ? sun : shade).push(c); else if (s.m === "treeBark") bark.push(c); else if (s.m === "paleBark") pale.push(c);
    }
    // where a tree stands against the sky: a column whose highest tree sample is above every sample of anything else but the sky in it
    const cols = new Map(); for (const s of res) { const col = cols.get(s.x) || cols.set(s.x, { tree: Infinity, other: Infinity }).get(s.x); if (TREE.test(s.m)) col.tree = Math.min(col.tree, s.y); else if (s.m !== "sky") col.other = Math.min(col.other, s.y); }
    const half = (side) => { const xs = [...cols.entries()].filter(([x]) => (side < 0 ? x < w / 2 : x >= w / 2)); return +(xs.filter(([, c]) => c.tree < c.other).length / xs.length).toFixed(3); };
    const treeTop = Math.min(...res.filter((s) => TREE.test(s.m)).map((s) => s.y));
    // the great hall's eave: the lowest sample of its roof tile in the middle fifth of the picture
    const roofMat = Object.keys(mats).find((m) => /^tile$/i.test(m)) || "tile";
    const eave = Math.max(...res.filter((s) => s.m === roofMat && s.x > w * 0.4 && s.x < w * 0.6 && s.d < 120).map((s) => s.y));
    report[name] = { needlesSun: stats(sun), needlesShade: stats(shade), bareWood: stats(bark), poplarBark: stats(pale), treeAgainstSky: { left: half(-1), right: half(1) }, treeTopRow: treeTop, eaveRow: Number.isFinite(eave) ? eave : null, treeOverEave: Number.isFinite(eave) ? treeTop < eave : null };
    console.log(name, JSON.stringify(report[name]));
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));   // (after each view, so that a slow run keeps what it has)
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
  await br.close(); srv.close();
})();
