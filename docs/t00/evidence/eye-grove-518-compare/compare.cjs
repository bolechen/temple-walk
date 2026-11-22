// #518 side by side: 0.6.0 / main / the new keep-out (D 0.5) / D 0.8, at the title, the opening's end, the first picture
// after 入山, the bamboo start, the ink-stone pool (16:9 and upright) and the half-way pavilion; each after the eye's space
// is ready (where the build has one) and 90 frames more. Records the eye, the arm, the view's pitch against the visitor's
// and monkBox.
const repo = process.argv[2], out = process.argv[3], tag = process.argv[4], only = (process.argv[5] || "").split(",").filter(Boolean), fs = require("fs");
const { serve, launch } = require(repo + "/tests/e2e/lib.cjs");
const SHOTS = [
  ["title", 1280, 720, "?debug=0", "title"],
  ["opening-end", 1280, 720, "?debug=0", "opening"],
  ["first", 1280, 720, "?enter&debug=0", "walk"],
  ["start", 1280, 720, "?cam=21.3,91.5,0,0.3&view=third&season=summer&time=day&debug=0", "walk"],
  ["pool-16x9", 1280, 720, "?cam=23.63642,75.60001,2.422,0.084&view=third&season=autumn&time=day&debug=0", "walk"],
  ["pool-9x19.5", 390, 845, "?cam=23.63642,75.60001,2.422,0.084&view=third&season=autumn&time=day&debug=0", "walk"],
  ["path-fp-east", 1280, 720, "?cam=19,76.5,1.10,-0.08&view=first&season=autumn&time=day&debug=0", "walk"],
  ["path-fp-west", 1280, 720, "?cam=22.5,78.5,-0.29,-0.15&view=first&season=autumn&time=day&debug=0", "walk"],
  ["halfway", 1280, 720, "?cam=9.4,76.32,-2.2,0.1&view=third&season=summer&time=day&debug=0", "walk"],
].filter((s) => !only.length || only.includes(s[0]));
(async () => {
  const srv = await serve(), b = await launch(), res = {};
  for (const [name, w, h, q, kind] of SHOTS) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, locale: "zh-CN" })).newPage();
    await p.goto(srv.base + q);
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 900000 });
    await p.waitForFunction(() => !window.__eyeSpace || window.__eyeSpace().state === "ready", null, { timeout: 1800000, polling: 1000 });
    if (kind === "opening") { await p.evaluate(() => window.__openingAt(999)); }
    const f0 = await p.evaluate(() => window.__yard().frames); await p.waitForFunction((f) => window.__yard().frames >= f + 90, f0, { timeout: 1800000, polling: 500 });
    res[name] = await p.evaluate(([W, H]) => {
      const f = window.__frame(), y = window.__yard(), b = f.monkBox, deg = 180 / Math.PI;
      return { eye: f.eye.map((v) => +v.toFixed(2)), at: f.at.map((v) => +v.toFixed(2)), arm: +Math.hypot(f.eye[0] - f.at[0], f.eye[2] - f.at[2]).toFixed(2), cameraPitch: +(f.look[1] * deg).toFixed(1), visitorPitch: +(y.pitch * deg).toFixed(1), box: b, boxY: b ? [+(b[1] / H).toFixed(3), +((b[1] + b[3]) / H).toFixed(3)] : null, boxX: b ? [+(b[0] / W).toFixed(3), +((b[0] + b[2]) / W).toFixed(3)] : null, eyeSpace: window.__eyeSpace ? window.__eyeSpace().state : "none (written plan)" };
    }, [w, h]);
    console.log(tag, name, JSON.stringify(res[name]));
    await p.screenshot({ path: `${out}/${name}-${tag}.png`, timeout: 900000 }); await p.close();
  }
  fs.writeFileSync(`${out}/compare-${tag}.json`, JSON.stringify(res, null, 1));
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
