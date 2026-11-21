// Renders every named view of the site (see `views` in app/src/site.js) to tools/out/<name>.png.
// usage: node tools/shots.js [--level=<id>] [--size=WxH] [--off=part,…] [--tag=-x] [name ...]     e.g. node tools/shots.js gate library; --size=1280x536 for the 2.39:1 art views
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { doorwaysReady } = require("./doorway-ready.cjs");
const root = require("./site.cjs").site(), out = path.join(__dirname, "out");
const { serve } = require("./site.cjs");
let srv;
(async () => {
  srv = await serve(root);
  fs.mkdirSync(out, { recursive: true });
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const sized = process.argv.find((a) => a.startsWith("--size=")), [vw0, vh0] = sized ? sized.slice(7).split("x").map(Number) : [1280, 720];
  const p = await b.newPage({ viewport: { width: vw0, height: vh0 }, deviceScaleFactor: 1, locale: "zh-CN" });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.stack ? e.stack.slice(0, 500) : e.message));
  p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 400)));
  let names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const level = (process.argv.find((a) => a.startsWith("--level=")) || "").slice(8), off = (process.argv.find((a) => a.startsWith("--off=")) || "").slice(6), tag = (process.argv.find((a) => a.startsWith("--tag=")) || "").slice(6);   // --off=doorway: a part left out; --tag: added to the file's name
  for (let i = 0; i < Math.max(1, names.length); i++) {
    // A name may carry a season and hour and a view: "court@autumn-dusk@third".
    const [vname, when = "", vw = ""] = (names[i] || "arrive").split("@"), [season, time] = when.split("-");
    await p.goto(`${base}?shot=1&q=high&show=${vname}` + (season ? `&season=${season}` : "") + (time ? `&time=${time}` : "") + (vw ? `&view=${vw}` : "") + (off ? `&off=${off}` : "") + (level ? `&level=${encodeURIComponent(level)}` : ""), { waitUntil: "commit", timeout: 180000 });   // the page builds the whole temple before it reports itself loaded
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 }).catch((e) => errs.push(String(e).slice(0, 160)));
    if (!names.length) names = await p.evaluate(() => window.__views);
    // The rooms seen through the doors are taken a face a frame once the page is up (doorway.js): wait until they are in.
    await p.waitForFunction(`(${doorwaysReady})(window.__doorways?.())`, null, { timeout: 600000, polling: 500 }).catch((e) => errs.push(String(e).slice(0, 160)));   // every hall seen through its door shows its room, faded in, or has given up (#373); under software rendering three halls take minutes: their pictures come one cube a frame and fade by the frame
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(out, names[i].replace(/@/g, "_") + tag + ".png"), timeout: 240000 });
    console.log(names[i], JSON.stringify(await p.evaluate(() => { const y = window.__yard(); return { tris: y.tris, calls: y.calls }; })));
  }
  console.log("errors:", [...new Set(errs)].slice(0, 6));
  await b.close(); srv.close();
})();
