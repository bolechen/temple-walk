const path = require("path"), fs = require("fs"), top = "/home/user/temple-walk";
const { site, serve } = require(path.join(top, "tools/site.cjs")); const { chromium } = require(path.join(top, "node_modules/playwright"));
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const Z0 = 15.4, RUN = 5.78, H = 3.0, zAt = (f) => Z0 + f * RUN, yAt = (f) => H * (1 - f);
// three stretches of the flight, seen going up (eye low, looking up) and going down (eye high, looking down); fractions of the way from the head
const PLACES = { lower: [[0.95, 0.55], [0.55, 0.95]], mid: [[0.7, 0.3], [0.3, 0.7]], upper: [[0.45, 0.05], [0.05, 0.45]] };
(async () => {
  const srv = await serve(site()); const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const crest of JSON.parse(process.env.CRESTS || "[1,0]")) {
    const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, locale: "zh-CN" })).newPage();
    await page.goto(`${srv.base}?level=t05&shot=1&q=high&season=winter&time=day&view=first&crest=${crest}&cam=0,30,0,0.1`, { waitUntil: "commit" });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 900000 });
    for (const sy of JSON.parse(process.env.SUNS || "[0.25,0.29,0.35]")) {
      await page.evaluate((sy) => { window.__sunY = sy; window.__mood("winter", "day"); }, sy);
      for (const [place, [up, down]] of Object.entries(PLACES)) for (const [dir, [a, bb]] of [["up", up], ["down", down]]) {
        const eye = [0, yAt(a) + 1.6, zAt(a)], to = [0, yAt(bb) + 0.2, zAt(bb)];   // eye at 1.6 m over the tread, looking at the tread ahead
        await page.evaluate(([e, t]) => window.__look(e, t), [eye, to]);
        await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
        await page.screenshot({ path: path.join(out, `s${sy}-${place}-${dir}-c${crest}.png`), timeout: 600000 });
      }
      console.log("done", crest, sy);
    }
    await page.close();
  }
  await b.close(); srv.close();
})();
