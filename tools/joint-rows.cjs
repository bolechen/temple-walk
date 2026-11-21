// How wide the joints between the court's flags read on the screen, row by row (#467, ART-REVIEW A4).
//   node tools/joint-rows.cjs [--joint=0.9,5.4] [--out=<file.json>] ['<json: [{ "name", "q": "show=cam06&season=summer&time=day&view=first" }, …]>']
// For each view the page is opened (the lowest tier: the geometry is the same on every tier), and `__pick` is asked what lies at
// every twelfth row of the middle column of a 1280×720 picture; the hits on the paving give how far each row of the picture looks
// along the ground. The eye's height follows from two of them (the rays of one column lie in one upright plane: the camera is
// where the two distances cross), and with the lens (`fov`) each row's joint is worked out at 1920×1080: a joint of width w that
// runs toward the eye is w·f/d wide on the screen, one that runs across it w·f·h/(d²+h²), each at least a pixel (the drawing
// makes it that wide); the row's value is the mean of the two. Reported for the lowest third of the picture (rows 720–1080) and
// the middle third (360–720), with the rows and the distances they cover: in the views of the court the paving begins at about
// row 700, so the middle third holds almost none of it down the middle.
// `--joint` is a list of widths in centimetres: 0.9 is the joint now, 5.4 the one it replaced (smoothstep(.014,.04) on both sides).
const fs = require("fs");
const { chromium } = require("playwright");
const { site, serve } = require("./site.cjs");
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const widths = arg("joint", "0.9,5.4").split(",").map(Number), outFile = arg("out", ""), W = 1280, H = 720;
const views = JSON.parse(process.argv.find((x) => x.startsWith("[")) || JSON.stringify([
  { name: "cam06-first-summer-day", q: "show=cam06&season=summer&time=day&view=first" },
  { name: "art3-third-autumn-dusk", q: "show=art3&season=autumn&time=dusk&view=third" }]));
(async () => {
  const srv = await serve(site()), base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" }), out = {};
  for (const v of views) {
    await p.goto(base + "?shot=1&q=low&" + v.q, { waitUntil: "commit", timeout: 180000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(([W, H]) => {
      const rows = [];
      for (let y = 0; y < H; y += 12) { const h = window.__pick(W / 2, y, 3).find((q) => q.kind === "Mesh" && Math.abs(q.at[1]) < 0.02); if (h) rows.push({ y, d: h.distance, x: h.at[0], z: h.at[2] }); }
      return { fov: window.__yard().fov, rows };
    }, [W, H]);
    const R = r.rows, a = R[0], c = R[R.length - 1], sb = Math.hypot(c.x - a.x, c.z - a.z);
    const sc = (a.d * a.d - c.d * c.d + sb * sb) / (2 * sb), h = Math.sqrt(Math.max(0, a.d * a.d - sc * sc));
    const f = 1080 / 2 / Math.tan((r.fov * Math.PI) / 360), res = { fov: r.fov, eyeHeight: +h.toFixed(2) };
    for (const cm of widths) {
      const w = cm / 100, rows = R.map((q) => { const dep = Math.sqrt(Math.max(0.01, q.d * q.d - h * h)), along = Math.max(1, (w * f) / dep), across = Math.max(1, (w * f * h) / (dep * dep + h * h)); return { row: Math.round((q.y * 1080) / H), d: +q.d.toFixed(1), px: +((along + across) / 2).toFixed(2) }; });
      const band = (lo, hi) => { const s = rows.filter((x) => x.row >= lo && x.row < hi); return s.length ? { rows: [s[0].row, s[s.length - 1].row], rowsSampled: s.length, metres: [s[s.length - 1].d, s[0].d], meanPx: +(s.reduce((t, x) => t + x.px, 0) / s.length).toFixed(2), maxPx: Math.max(...s.map((x) => x.px)) } : null; };
      res[`joint_${cm}cm`] = { lowestThird: band(720, 1080), middleThird: band(360, 720) };
    }
    out[v.name] = res; console.log(v.name, JSON.stringify(res));
  }
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + "\n");
  await b.close(); srv.close();
})();
