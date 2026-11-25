// Close views of the z-fighting candidates tools/zfight-scan.mjs found (#655), and whether they flicker.
//   node tools/zfight-scan.mjs                       (writes tools/out/zfight/coplanar.json first)
//   node tools/zfight-views.cjs [outdir] [--n=5] [--idx=0,3,7] [--touch] [--size=390x844] [--frames=16]
// For each chosen finding the free eye (`__look`) is stood where the scan's rays found it seen from the walk (its median eye) and
// again at a quarter and half of that distance, looking at the overlap; the picture is kept. Then the eye is moved a millimetre at
// a time (a static scene: only the depth test can change a pixel) and a grid of points round the overlap is read back
// (`__probe(points)`) each time; `flicker` is the share of those points whose colour moved by more than 0.06 (of 1) between the frames.
// `--touch` is a phone: touch screen, a phone's size, the low tier it would start on. Software rendering (SwiftShader) keeps a deep
// depth buffer, so a pair that flickers here would flicker on a phone's 16 bits too, and one that holds here may not there.
const path = require("path"), fs = require("fs");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "zfight-views"));
const TOUCH = process.argv.includes("--touch"), [W, H] = arg("size", TOUCH ? "390x844" : "800x500").split("x").map(Number), FRAMES = +arg("frames", 16);
const all = JSON.parse(fs.readFileSync(path.join(__dirname, "out", "zfight", "coplanar.json"), "utf8")).filter((c) => c.medianEye);
let chosen;
if (arg("idx", "")) chosen = arg("idx").split(",").map((i) => all[+i]);
else { const seen = new Set(); chosen = []; for (const c of [...all].sort((a, b) => b.score - a.score)) { const k = [c.a.part, c.a.material, c.b.material].join("|"); if (seen.has(k) || c.a.part === "interior") continue; seen.add(k); chosen.push(c); if (chosen.length >= +arg("n", 5)) break; } }
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch(), report = [];
  const t = await open(b, srv.base, "debug=1&q=low&view=third&season=summer&time=day&shot=1", TOUCH ? { viewport: { width: W, height: H }, hasTouch: true, isMobile: true } : { viewport: { width: W, height: H } });
  await t.page.keyboard.press("Backquote").catch(() => {});   // the debug panel (`?debug`): shut for the pictures
  await t.page.addStyleTag({ content: ".lil-gui,#debug{display:none!important}" });
  for (const [i, c] of chosen.entries()) {
    const P = c.pt, E = c.medianEye, d = Math.hypot(P[0] - E[0], P[1] - E[1], P[2] - E[2]), views = {};
    const name = `${String(i + 1).padStart(2, "0")}-${c.a.material}-${c.b.material}`.replace(/[^\w-]/g, "");
    for (const k of [1, 0.5, 0.25]) {
      const eye = [0, 1, 2].map((a) => P[a] + (E[a] - P[a]) * k);
      await t.page.evaluate(([e, p]) => window.__look(e, p), [eye, P]); await t.frames(4);
      await t.page.screenshot({ path: path.join(out, `${name}-${Math.round(d * k)}m.png`) });
      // the sweep: 1 mm steps sideways, a grid of points round the middle of the picture read each time
      const grid = []; for (let gx = 0; gx < 8; gx++) for (let gy = 0; gy < 6; gy++) grid.push([W * (0.3 + 0.4 * gx / 7), H * (0.3 + 0.4 * gy / 5)]);
      const cols = [];
      for (let f = 0; f < FRAMES; f++) {
        const s = f * 0.001, e2 = [eye[0] + s * (eye[2] - P[2] > 0 ? 1 : -1), eye[1], eye[2]];
        await t.page.evaluate(([e, p]) => window.__look(e, p), [e2, P]);
        cols.push(await t.page.evaluate((g) => window.__probe(g).at, grid));
      }
      let moved = 0; const n = grid.length;
      for (let g = 0; g < n; g++) { let m = 0; for (let f = 1; f < cols.length; f++) { const A = cols[f - 1][g], B = cols[f][g]; if (A && B) m = Math.max(m, Math.max(...[0, 1, 2].map((q) => Math.abs(A[q] - B[q]) / 255))); } if (m > 0.06) moved++; }
      views[`${Math.round(d * k)}m`] = { flicker: +(moved / n).toFixed(3), points: n };
    }
    report.push({ name, at: P, eye: E, gap_mm: c.gap_mm, area_m2: c.area_m2, a: `${c.a.part}/${c.a.material}`, b: `${c.b.part}/${c.b.material}`, views });
    console.log(name, JSON.stringify(views));
  }
  await t.page.evaluate(() => window.__look()); fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ touch: TOUCH, size: [W, H], frames: FRAMES, errors: t.errors, report }, null, 1));
  if (t.errors.length) console.error("page errors:", t.errors);
  await b.close(); srv.close();
})();
