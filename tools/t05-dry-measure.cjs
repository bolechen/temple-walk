// Measures T05's ground outside the walls and its evergreen crowns on J01 (#573 step 7, follow-up 1): in each named framing, every 12 px
// of the picture is asked what lies there (`__pick`), and the colour under it is read as CIE Lab (D65). Reported per material by median:
// the dry earth near (within 15 m) and far, the sunlit crowns (L* ≥ 30) and the sky-lit ones (L* < 30), and the brightest other thing
// in frame for the "far ground is not the brightest block" line. Writes the pictures and a report to the folder given.
// usage: node tools/t05-dry-measure.cjs <outdir> [--query=k=v&…] [--views=cam01,cam07,south,se,sw]
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { site, serve } = require("./site.cjs");

const VIEWS = {
  cam01: "show=cam01",
  cam07: "show=cam07",
  south: "cam=0,215,3.1416,0.03",   // the arrival point looking south, the art director's own framing
  se: "cam=0,215,2.3562,0.03",
  sw: "cam=0,215,3.927,0.03",
};

function lab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const L = 116 * f(Y) - 16, a = 500 * (f(X) - f(Y)), bb = 200 * (f(Y) - f(Z));
  return [L, a, bb];
}
const med = (xs) => { if (!xs.length) return null; const s = [...xs].sort((p, q) => p - q); return s[s.length >> 1]; };
function stats(list) {
  if (!list.length) return { n: 0 };
  const L = med(list.map((p) => p[0])), a = med(list.map((p) => p[1])), b = med(list.map((p) => p[2]));
  const C = Math.hypot(a, b), h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { n: list.length, L: +L.toFixed(1), C: +C.toFixed(1), h: Math.round(h) };
}

(async () => {
  const out = process.argv[2] || "tools/out/t05-dry"; fs.mkdirSync(out, { recursive: true });
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
    const samples = await page.evaluate(async (b64) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(img.width, img.height), x2 = c.getContext("2d"); x2.drawImage(img, 0, 0);
      const d = x2.getImageData(0, 0, img.width, img.height).data, res = [];
      for (let y = 6; y < img.height; y += 12) for (let x = 6; x < img.width; x += 12) {
        const h = window.__pick(x, y, 1)[0], i = (y * img.width + x) * 4;
        res.push({ m: h ? h.material : "sky", part: h ? h.part : null, d: h ? h.distance : Infinity, rgb: [d[i], d[i + 1], d[i + 2]] });
      }
      return res;
    }, png.toString("base64"));
    const by = { near: [], far: [], sun: [], sky: [] }, other = {};
    for (const s of samples) {
      const c = lab(s.rgb);
      if (s.m === "dryEarth") (s.d <= 15 ? by.near : by.far).push(c);
      else if (s.m === "dryCedar") (c[0] >= 30 ? by.sun : by.sky).push(c);
      else (other[s.m === "ShaderMaterial" && s.d < 300 ? "paving" : s.m] ||= []).push(c);
    }
    const others = Object.fromEntries(Object.entries(other).filter(([, v]) => v.length >= 20).map(([k, v]) => [k, stats(v)]));
    report[name] = { earthNear: stats(by.near), earthFar: stats(by.far), crownSun: stats(by.sun), crownSky: stats(by.sky), others };
    console.log(name, JSON.stringify(report[name]));
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
  await br.close(); srv.close();
})();
