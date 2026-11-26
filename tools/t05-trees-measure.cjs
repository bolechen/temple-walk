// Measures T05's trees, air and ground on J01 against the art director's lines of 2026-11-25 (#573, comment 7164808177; docs/t05/DECISIONS.md, 真树与远景):
// in cam01, cam07 and the arrival looking south every 8 px of the picture is asked what lies there (`__pick`) and the colour under it is read as CIE Lab
// (D65). Software rendering (SwiftShader): the shapes and the order of lightness hold, the absolute values want a T4.
//   cam07: the trees' share of each side of the gateway's opening (25% or more each), the white wall seen in it (half of main's or less), the shadow bands
//          down the path (3 or more, 10 L* darker than the sunlit stone), the hall against the archway (12 L* apart or less), the sky (b* -20±3, L* 76-82),
//          the withered grass beside the path (hue 75-90°, chroma 9 or less, not lighter than the paving);
//   cam01: the sunlit platform (b* +1 or more) and the hall's front in shade (b* -4 or less), the trees at each side (8-15% of the width), the highest tree
//          against the eave;
//   south: the poplars' bark (L* 55-65), and any bough within 5 m of the eye in the picture's corners (none).
// usage: node tools/t05-trees-measure.cjs <outdir> [--query=k=v&…] [--views=cam01,cam07,south] [--colors=<dir of <view>.png at 1280×720>]
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { site, serve } = require("./site.cjs");

const VIEWS = { cam01: "show=cam01", cam07: "show=cam07", south: "cam=0,215,3.1416,0.03" };
const TREE = /^(dryNeedles|treeBark|paleBark)$/, SKY = "ShaderMaterial|sky", PAVING = "ShaderMaterial|ground";

function lab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const med = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return +s[s.length >> 1].toFixed(1); };
const stats = (cs) => (cs.length ? { n: cs.length, L: med(cs.map((c) => c[0])), a: med(cs.map((c) => c[1])), b: med(cs.map((c) => c[2])), C: med(cs.map((c) => Math.hypot(c[1], c[2]))), h: med(cs.filter((c) => Math.hypot(c[1], c[2]) >= 2).map((c) => ((Math.atan2(c[2], c[1]) * 180) / Math.PI + 360) % 360)) } : { n: 0 });

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
    // `--colors=<dir>`: the colours read from another renderer's picture of the same view at the same size (`<dir>/<view>.png`, e.g. a T4's), the mask still this page's `__pick`
    const colors = (process.argv.find((a) => a.startsWith("--colors=")) || "").slice(9);
    const shot = await page.screenshot({ path: path.join(out, `${name}.png`) }), png = colors ? fs.readFileSync(path.join(colors, `${name}.png`)) : shot;
    const S = 8, { w, h, res } = await page.evaluate(async ([b64, S]) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(img.width, img.height), x2 = c.getContext("2d"); x2.drawImage(img, 0, 0);
      const d = x2.getImageData(0, 0, img.width, img.height).data, res = [];
      for (let y = S / 2; y < img.height; y += S) for (let x = S / 2; x < img.width; x += S) {
        const p = window.__pick(x, y, 1)[0], i = (y * img.width + x) * 4;
        res.push({ x, y, m: p ? `${p.material}|${p.part}` : "none", mat: p ? p.material : "none", d: p ? p.distance : Infinity, rgb: [d[i], d[i + 1], d[i + 2]] });
      }
      return { w: img.width, h: img.height, res };
    }, [png.toString("base64"), S]);
    for (const s of res) s.c = lab(s.rgb);
    const of = (f) => res.filter(f).map((s) => s.c), r = { sky: stats(of((s) => s.m === SKY)), paving: stats(of((s) => s.m === PAVING && s.d < 60)) };
    const cols = [...new Set(res.map((s) => s.x))].sort((a, b) => a - b);
    if (name === "cam07") {
      // the opening: the columns where, at mid-height, the picture is not the gate's own pillars (wood within 5 m)
      const open = cols.filter((x) => { const s = res.find((q) => q.x === x && Math.abs(q.y - h * 0.45) < S); return s && !(s.mat === "woodV" && s.d < 5); });
      const mid = (open[0] + open[open.length - 1]) / 2, treeCol = (x) => res.some((q) => q.x === x && TREE.test(q.mat) && q.d > 2);
      r.opening = { width: open.length, treesLeft: +(open.filter((x) => x < mid && treeCol(x)).length / open.length).toFixed(3), treesRight: +(open.filter((x) => x >= mid && treeCol(x)).length / open.length).toFixed(3), wallSamples: res.filter((q) => q.mat === "plaster" && open.includes(q.x) && q.d > 5).length };
      // the path straight ahead, from the picture's foot up to the archway: runs of shade
      const path = res.filter((q) => q.m === PAVING && Math.abs(q.x - w / 2) < 40 && q.d < 18 && q.d > 2).sort((a, b) => b.y - a.y), rows = [...new Set(path.map((q) => q.y))].map((y) => med(path.filter((q) => q.y === y).map((q) => q.c[0])));
      const lit = Math.max(...rows), dark = rows.map((L) => L < lit - 10); let bands = 0; dark.forEach((v, i) => { if (v && !dark[i - 1]) bands++; });
      r.pathShade = { bands, litL: lit, darkestL: Math.min(...rows) };
      // the hall through the archway's middle bay against the archway's timber
      const bay = (q) => Math.abs(q.x - w / 2) < 50;
      r.hall = stats(of((q) => bay(q) && q.d > 60 && q.m !== SKY && q.mat !== "none")); r.archway = stats(of((q) => q.d > 12 && q.d < 40 && /^(woodV|woodX|beam|fascia|lattice)$/.test(q.mat) && Math.abs(q.x - w / 2) < 260));
      r.hallVsArchway = r.hall.n && r.archway.n ? +Math.abs(r.hall.L - r.archway.L).toFixed(1) : null;
      r.grass = stats(of((q) => q.mat === "dryGrass" || q.mat === "dryEarth"));
      // the near east crowns against the light (the art director's final review: their darkest L* 8 or more): the 5th percentile and the median of their needles
      { const Ls = res.filter((q) => q.mat === "dryNeedles" && q.x > w * 0.55 && q.d < 30).map((q) => q.c[0]).sort((p, q) => p - q); r.eastCrown = Ls.length ? { n: Ls.length, p5L: +Ls[Math.floor(Ls.length * 0.05)].toFixed(1), medL: med(Ls) } : null; }
      // the archway's middle bay (the art director's lines for A, 2026-11-25): its timber split into sun and shade at the lightness that best parts them
      // (Otsu), the share in the sun, each part's median L*, and how much of each of the two middle columns is in the sun
      const ARCH = /^(woodV|woodX|beam|fascia|lattice|plaque|bracket|paint)/, bayX = [w * 0.43, w * 0.57];
      const mb = res.filter((q) => ARCH.test(q.mat) && q.d > 15 && q.d < 40 && q.x > bayX[0] && q.x < bayX[1] && q.y > h * 0.3 && q.y < h * 0.72);
      if (mb.length > 10) {
        const Ls = mb.map((q) => q.c[0]); let best = 0, cut = 0;
        for (let tq = 5; tq < 80; tq += 0.5) { const a0 = Ls.filter((L) => L < tq), a1 = Ls.filter((L) => L >= tq); if (!a0.length || !a1.length) continue; const m0 = a0.reduce((p, v) => p + v, 0) / a0.length, m1 = a1.reduce((p, v) => p + v, 0) / a1.length, v = a0.length * a1.length * (m1 - m0) ** 2; if (v > best) { best = v; cut = tq; } }
        const lit = mb.filter((q) => q.c[0] >= cut), shade = mb.filter((q) => q.c[0] < cut);
        const cols = [...new Set(mb.filter((q) => q.mat === "woodV").map((q) => q.x))].sort((p, q) => p - q), side = (f) => { const xs = cols.filter(f); const px = mb.filter((q) => q.mat === "woodV" && xs.includes(q.x)); return px.length ? +(px.filter((q) => q.c[0] >= cut).length / px.length).toFixed(2) : null; };
        r.bay = { n: mb.length, cut, litShare: +(lit.length / mb.length).toFixed(3), litL: med(lit.map((q) => q.c[0])), shadeL: med(shade.map((q) => q.c[0])), colLeftLit: side((x) => x < w / 2), colRightLit: side((x) => x >= w / 2) };
      }
    }
    if (name === "cam01") {
      const stone = res.filter((q) => q.mat === "stone" && q.d < 70).map((q) => q.c), Ls = stone.map((c) => c[0]).sort((a, b) => a - b), cut = Ls[Math.floor(Ls.length * 0.6)] ?? 0;
      r.platformSunlit = stats(stone.filter((c) => c[0] >= cut));
      r.frontShade = stats(of((q) => /^(woodV|lattice|plaster|woodX)$/.test(q.mat) && q.d > 35 && q.d < 75 && q.c[0] < 45));
      const treeCol = (x) => res.some((q) => q.x === x && TREE.test(q.mat) && q.d < 80);
      r.treesWidth = { left: +(cols.filter((x) => x < w / 2 && treeCol(x)).length / cols.length).toFixed(3), right: +(cols.filter((x) => x >= w / 2 && treeCol(x)).length / cols.length).toFixed(3) };
      const crownCol = (x) => res.some((q) => q.x === x && q.mat === "dryNeedles" && q.d < 80);   // the framing crowns alone (the bare saplings along the terrace's foot left out)
      r.crownsWidth = { left: +(cols.filter((x) => x < w / 2 && crownCol(x)).length / cols.length).toFixed(3), right: +(cols.filter((x) => x >= w / 2 && crownCol(x)).length / cols.length).toFixed(3) };
      const top = Math.min(...res.filter((q) => TREE.test(q.mat) && q.d < 80).map((q) => q.y)), eave = Math.max(...res.filter((q) => q.mat === "tile" && Math.abs(q.x - w / 2) < w * 0.15).map((q) => q.y));
      r.treeTopRow = Number.isFinite(top) ? top : null; r.eaveRow = Number.isFinite(eave) ? eave : null; r.treeOverEave = Number.isFinite(top) && Number.isFinite(eave) ? top < eave : null;
    }
    if (name === "south") {
      r.poplarBark = stats(of((q) => q.mat === "paleBark"));
      // the bark's lit face (the art director's final review: the line 55-65 is read on the face the sun is on): the 90th percentile of its lightness here
      { const Ls = res.filter((q) => q.mat === "paleBark").map((q) => q.c[0]).sort((p, q) => p - q); r.poplarBarkLit = Ls.length ? +Ls[Math.floor(Ls.length * 0.9)].toFixed(1) : null; }
      r.nearBoughsInCorners = res.filter((q) => TREE.test(q.mat) && q.d < 5 && (q.x < w * 0.2 || q.x > w * 0.8) && (q.y < h * 0.2 || q.y > h * 0.8)).length;
    }
    r.needles = stats(of((q) => q.mat === "dryNeedles")); r.bareWood = stats(of((q) => q.mat === "treeBark"));
    report[name] = r;
    console.log(name, JSON.stringify(r));
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));   // (after each view, so that a slow run keeps what it has)
  }
  await br.close(); srv.close();
})();
