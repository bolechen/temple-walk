// Every season and hour (sixteen moods) from one view, with the sky as the hour table has it and with the sky worked out from
// the sun's height (#592, trial B; app/src/atmosphere.js): two pictures to a mood, one page, tools/out/mood-sheet/.
//   node tools/mood-sheet.cjs [--view=cam06] [--size=960x540] [--only=summer-day,autumn-dusk] [--out=dir]
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { serve, site } = require("./site.cjs");
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const view = arg("view", "cam06"), [vw, vh] = arg("size", "960x540").split("x").map(Number), only = arg("only", "").split(",").filter(Boolean);
const out = path.resolve(arg("out", path.join(__dirname, "out", "mood-sheet")));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(site()), base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, locale: "zh-CN" });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 300)));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(`${base}?shot=1&q=high&show=${view}&view=first&season=spring&time=day`);
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
  const report = [];
  for (const s of ["spring", "summer", "autumn", "winter"]) for (const t of ["dawn", "day", "dusk", "night"]) {
    if (only.length && !only.includes(`${s}-${t}`)) continue;
    for (const on of [false, true]) {
      await p.evaluate(([s, t, on]) => { window.__skyTrial(on); window.__mood(s, t); }, [s, t, on]);
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await p.waitForTimeout(1500);
      const f = `${s}-${t}-${on ? "sky" : "table"}.png`;
      await p.screenshot({ path: path.join(out, f) });
      const pr = await p.evaluate(() => { const q = window.__probe(); return { mean: q.mean }; }).catch(() => ({}));
      report.push({ mood: `${s}-${t}`, sky: on, file: f, ...pr }); console.log(f, JSON.stringify(pr));
    }
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ view, size: [vw, vh], report, errors: [...new Set(errs)] }, null, 1));
  console.log("errors:", [...new Set(errs)].slice(0, 5));
  await b.close(); srv.close();
})();
