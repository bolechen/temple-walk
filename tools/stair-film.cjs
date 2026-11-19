// The novice on the real flights, in the page, before and after (issue #270): for each of three places, up and down,
// the page is stepped a frame at a time (its clock and requestAnimationFrame are replaced, so a slow software renderer
// loses nothing), W held as a visitor holds it, and every fourth frame (30 steps a second → 7.5 pictures a second) the
// following camera and, from his right, a side view are saved. TEMPLE_SITE names the built site: main's for `before`.
//
//   TEMPLE_SITE=<main dist> node tools/stair-film.cjs --label=before --out=tools/out/stair-film
//   node tools/stair-film.cjs --label=after --out=tools/out/stair-film [--places=hill,hall,summit] [--secs=6]
const { serve, launch } = require("../tests/e2e/lib.cjs");
const fs = require("fs"), path = require("path");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const label = arg("label", "after"), out = path.resolve(arg("out", "tools/out/stair-film")), secs = +arg("secs", 6), only = arg("places", "hill,hall,summit").split(",");
// The three flights, from the plan's ramps (tools/…: low and high ends, north is -z): the first of the mountain path,
// the steps before the great hall, the long flight under the summit pavilion.
const PLACES = {
  hill: { low: [0, 75.22], high: [0, 64], secs: 5 },
  hall: { low: [0, -0.88], high: [0, -3.6], secs: 3.5 },
  summit: { low: [0, -90.52], high: [0, -118.4], secs: 5 },
};
const STEP = 1000 / 30, EVERY = 4;
(async () => {
  const { base, close } = await serve(), b = await launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 260 }, deviceScaleFactor: 1, locale: "zh-CN" }), p = await ctx.newPage(), errors = [];
  p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errors.push(m.text()));
  await p.addInitScript(() => {
    let now = 0, cbs = []; performance.now = () => now;
    window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
    window.__step = (ms) => { now += ms; const c = cbs; cbs = []; for (const f of c) f(now); };
    window.__auto = setInterval(() => window.__step(33.3), 40);   // until the place is up; then the script steps it
  });
  await p.goto(`${base}?enter&q=low&season=summer&time=day&view=third&debug=0`, { waitUntil: "commit", timeout: 120000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
  await p.evaluate(() => clearInterval(window.__auto));
  const step = (n = 1, ms = STEP) => p.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) window.__step(ms); }, [n, ms]);
  await step(30);
  fs.mkdirSync(out, { recursive: true });
  const report = {};
  for (const id of only) for (const dir of ["up", "down"]) {
    const { low, high } = PLACES[id], to = dir === "up" ? high : low, from = dir === "up" ? low : high;
    const dz = Math.sign(to[1] - from[1]);   // north is -z
    const start = [from[0], from[1] - dz * 1.4], yaw = dz < 0 ? 0 : Math.PI;   // yaw 0 looks north (-z)
    await p.evaluate(([x, z, yaw]) => { window.__look(); window.__pose(x, z, yaw, 0.1); }, [...start, yaw]);
    await step(45); await p.keyboard.down("KeyW");
    const dirName = `${label}-${id}-${dir}`, frames = Math.round((PLACES[id].secs || secs) * 1000 / STEP), shots = [];
    fs.mkdirSync(path.join(out, dirName), { recursive: true });
    const trace = [];
    for (let f = 0; f < frames; f += EVERY) {
      await step(EVERY);
      const y = await p.evaluate(() => window.__yard()); trace.push([f / 30, y.x, y.z, y.h, y.bodyY, y.footY]);
      await p.screenshot({ path: path.join(out, dirName, `follow-${String(f / EVERY).padStart(3, "0")}.png`) });
      await p.evaluate(([x, h, z]) => { window.__look([x + 1.5, h + 0.62, z], [x, h + 0.42, z]); window.__step(1); }, [y.x, y.h, y.z]);
      await p.screenshot({ path: path.join(out, dirName, `side-${String(f / EVERY).padStart(3, "0")}.png`) });
      await p.evaluate(() => { window.__look(); });
    }
    await p.keyboard.up("KeyW"); await step(20);
    report[dirName] = { start, yaw, trace, errors: errors.length };
    console.log(dirName, "from z", trace[0][2].toFixed(1), "to", trace[trace.length - 1][2].toFixed(1), "height", trace[0][3].toFixed(2), "→", trace[trace.length - 1][3].toFixed(2));
  }
  fs.writeFileSync(path.join(out, `${label}-trace.json`), JSON.stringify(report));
  await b.close(); close(); if (errors.length) { console.error(errors.slice(0, 5)); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exit(1); });
