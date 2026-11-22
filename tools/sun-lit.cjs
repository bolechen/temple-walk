// How much of the lower third of the picture's paving is in direct sun, and do shadows alternate along three vertical
// lines (#488; the art director's measure, issue 488's comment 7061589377). Each named view is drawn twice, with the sun
// (`__sun(1)`) and without it (`__sun(0)`); a pixel is "in sun" where the sun adds at least half of what it adds at the
// 95th percentile of the strip (and not less than 3 of 255). It prints the share, the lit-to-shaded brightness ratio and,
// on the lines at 20, 50 and 80% of the width, how many times a 6 px-blurred column crosses between light and shade.
// `--region=left23` measures the left two thirds of the whole picture instead (art4's tea house and table, #488 asks 8% and a ratio of 1.4 there); every run also reports `blown`, the share of pixels with a channel at 250 or over (the sun's glow washing out the roof, #488 asks 2% at most on court).
// usage: node tools/sun-lit.cjs [--size=1280x720] [--out=dir] [--views=art3@third,court@third] [--when=autumn-dusk]
//        node tools/sun-lit.cjs --pair=sun.png,nosun.png [--monk=x,y,w,h] [--region=left23]   (two pictures a T4 drew, with and without the sun: `__sun(1)`, `__sun(0)`)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const arg = (k, d) => ((process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3)) || d;
const MEASURE = async ([a, b0, W, H, mb0, region]) => {
        const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height); };
        const A = await load(a), B = await load(b0), w = A.width, h = A.height, L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const mb = mb0, left = region === "left23", y0 = left ? 0 : Math.floor(h * 0.667), x0 = left ? 0 : Math.floor(w * 0.05), x1 = left ? Math.floor(w * 2 / 3) : Math.floor(w * 0.95);   // `left23`: the left two thirds of the whole picture (art4: the tea house and the table); the default is the lower third's paving
        const inMonk = (x, y) => mb && x >= mb.x - 4 && x <= mb.x + mb.w + 4 && y >= mb.y - 4 && y <= mb.y + mb.h + 4;
        const diffs = [], vals = [];
        for (let y = y0; y < h; y++) for (let x = x0; x < x1; x++) { if (inMonk(x, y)) continue; const i = (y * w + x) * 4; diffs.push(L(A.data, i) - L(B.data, i)); }
        const sorted = [...diffs].sort((p, q) => p - q), D = sorted[Math.floor(sorted.length * 0.95)] || 0, thr = Math.max(0.5 * D, 3);
        let lit = 0, litL = 0, dark = 0, darkL = 0, n = 0;
        for (let y = y0; y < h; y++) for (let x = x0; x < x1; x++) { if (inMonk(x, y)) continue; const i = (y * w + x) * 4, d = L(A.data, i) - L(B.data, i), l = L(A.data, i); n++; if (d > thr) { lit++; litL += l; } else { dark++; darkL += l; } }
        // alternation along three vertical lines: blur 6 px, then count crossings of the mid level with a band
        const alt = [0.2, 0.5, 0.8].map((fx) => { const cx = Math.floor(w * fx), col = []; for (let y = y0; y < h; y++) { let s = 0, c = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const yy = Math.min(h - 1, Math.max(0, y + dy)), xx = Math.min(w - 1, Math.max(0, cx + dx)); s += L(A.data, (yy * w + xx) * 4); c++; } col.push(s / c); }
          const s2 = [...col].sort((p, q) => p - q), lo = s2[Math.floor(col.length * 0.1)], hi = s2[Math.floor(col.length * 0.9)], mid = (lo + hi) / 2, band = (hi - lo) * 0.15; let st = 0, cnt = 0;
          for (const v of col) { if (st <= 0 && v > mid + band) { if (st === -1) cnt++; st = 1; } else if (st >= 0 && v < mid - band) { if (st === 1) cnt++; st = -1; } } return { range: +(hi - lo).toFixed(1), crossings: cnt }; });
        let blown = 0; for (let i = 0; i < A.data.length; i += 4) if (Math.max(A.data[i], A.data[i + 1], A.data[i + 2]) >= 250) blown++;
        return { blown: +(blown / (A.data.length / 4)).toFixed(4), share: +(lit / n).toFixed(3), D: +D.toFixed(1), ratio: +((litL / Math.max(1, lit)) / Math.max(1, darkL / Math.max(1, dark))).toFixed(2), alt };
      };
(async () => {
  if (arg("pair", "")) {   // two pictures already drawn (a T4's, with and without the sun): read them, no page of the temple
    const [onF, offF] = arg("pair", "").split(","), b = await chromium.launch(), p = await b.newPage(), im = (f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64");
    const monk = arg("monk", "") ? (([x, y, w, h]) => ({ x, y, w, h }))(arg("monk", "").split(",").map(Number)) : null;
    console.log(JSON.stringify(await p.evaluate(MEASURE, [im(onF), im(offF), 0, 0, monk, arg("region", "")]))); await b.close(); return;
  }
  const root = require("./site.cjs").site(), { serve } = require("./site.cjs");   // only when pages are to be drawn: the site is built first if app/ has changed
  const srv = await serve(root), base = `http://127.0.0.1:${srv.address().port}/`;
  const [W, H] = arg("size", "1280x720").split("x").map(Number), out = arg("out", "/tmp/claude-0/sunscan");
  const views = arg("views", "art3@third,court@third").split(","), [season, hour] = arg("when", "autumn-dusk").split("-"), cands = [{ name: `${season}-${hour}` }];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" }), res = [];
  p.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
  for (const v of views) {
    const [view, vw] = v.split("@");
    await p.goto(`${base}?shot=1&q=high&show=${view}&season=${season}&time=${hour}&view=${vw}`, { waitUntil: "load" });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    await p.waitForTimeout(1500);
    for (const c of cands) {
      const set = async (k) => { await p.evaluate((k) => { window.__sun(k); window.__probe(); window.__probe(); }, k); await p.waitForTimeout(600); return p.screenshot({ timeout: 240000 }); };
      const on = await set(1), off = await set(0); await p.evaluate(() => window.__sun(1));
      const name = `${view}_${c.name}`; fs.writeFileSync(path.join(out, name + ".png"), on);
      const r = await p.evaluate(MEASURE, ["data:image/png;base64," + on.toString("base64"), "data:image/png;base64," + off.toString("base64"), W, H, await p.evaluate(() => window.__probe().monkBox)]);
      const row = { view, cand: c.name, ...r }; res.push(row); console.log(JSON.stringify(row));
    }
  }
  fs.writeFileSync(path.join(out, "scan.json"), JSON.stringify(res, null, 1));
  await b.close(); srv.close();
})();
