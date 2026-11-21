// Renders views inside the halls, which the named views of tools/shots.js cannot reach: each job names a hall, a pose
// and optionally a view and extra address parameters, and the picture's mean colour and the frame's load are printed.
// usage: node tools/inside.cjs <out dir> '[{"hall":"main","name":"caisson","abs":[120,-2,0,1.05]}, ...]'
//   or   node tools/inside.cjs <out dir> --views [level]   (every registered view of a level, app/levels/<level>/hall-views.js;
//        the level defaults to t00, and a level without a table is refused with the list of those that have one)
//   abs = [x, z, yaw, pitch] in the room's absolute place (rooms stand sixty metres apart in the order of site.halls).
//   A registered view gives [dx, z, yaw, pitch] from the room's centre line; --views adds the room's own offset.
//   view = "first" | "third"; qs = more address parameters, e.g. "time=night".
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const out = process.argv[2];
// The jobs are read before the site is built, so a wrong level or a bad list fails at once.
const jobs = (() => {
  if (process.argv[3] !== "--views") return JSON.parse(process.argv[3]);   // [{hall, name, abs:[x,z,yaw,pitch], view, qs}]
  try { return require("./hall-views.cjs").views(process.argv[4]); } catch (e) { console.error(String(e.message || e).split("\n")[0]); process.exit(2); }
})();
const root = require("./site.cjs").site();
const { serve } = require("./site.cjs");
let srv;
(async () => {
  srv = await serve(root);
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, locale: "zh-CN" });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  let cur = null;
  for (const j of jobs) {
    if (cur !== j.hall + j.view + (j.qs || "")) {
      await p.goto(`${base}?shot=1&q=high&in=${j.hall}&view=${j.view || "first"}${j.qs ? "&" + j.qs : ""}`, { waitUntil: "commit", timeout: 180000 });
      await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
      await p.waitForTimeout(4000); cur = j.hall + j.view + (j.qs || "");
    }
    const y0 = await p.evaluate(() => window.__yard());
    if (j.abs) await p.evaluate((a) => window.__pose(...a), j.abs);
    await p.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 6 ? r() : requestAnimationFrame(f)); f(); }));
    await p.screenshot({ path: path.join(out, j.name + ".png") });
    console.log(j.name, JSON.stringify(await p.evaluate(() => { const q = window.__probe(); return q.mean || q.color || q; })), JSON.stringify(await p.evaluate(() => { const y = window.__yard(); return [y.x, y.z, y.yaw, y.pitch, y.tris, y.calls]; })));
  }
  console.log("errors", errs.slice(0, 5)); await b.close(); srv.close();
})();
