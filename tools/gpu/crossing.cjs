// How long a crossing from one temple to another takes on a real card (行脚图, #449), run beside tools/gpu/job.cjs as its `script`:
// the prologue opened in a browser started for it alone (`fresh`: a first visit's cold card), a temple closed so that the map has
// a place to go, then the press on 去 (`__pilgrimage({ go })`, the same call the map's button makes) — the ink curtain closes, the
// page opens again as the other temple's, and the curtain draws back once that temple can be drawn. Each round goes there and back
// in the same browser, as a visitor who has been there already goes. Each crossing is written down twice, by the page's own clock
// from the press (`ms`: the temple drawn, `walkMs`: the curtain gone and the walk his, src/ink.js) and by this script's, and the page's
// error list is kept. The long scroll of phase two (#450) is timed from `walkMs`. Needs a build that lists T05 (the canary, a preview).
//   EXTRA_FILES=tools/gpu/crossing.cjs tools/gpu-render.sh t4-small '{"script":"crossing.cjs","args":{"rounds":3}}'
exports.run = async ({ open, log, runs = [{ q: "high" }, { q: "low" }], rounds = 3 }) => {
  const out = [];
  for (const r of runs) {
    const size = r.q === "low" ? [390, 844] : [1920, 1080], scale = r.q === "low" ? 3 : 1, query = `q=${r.q}&enter=1&season=summer&time=day`;
    for (let round = 1; round <= rounds; round++) {
      let ctx = null;
      try {
        const o = await open(query, size, scale, { fresh: true }); ctx = o.ctx; const page = o.page;
        const here = async (to) => {
          const t0 = Date.now(), nav = page.waitForNavigation({ waitUntil: "commit", timeout: 120000 });
          await page.evaluate((id) => window.__pilgrimage({ go: id }), to); await nav;
          await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000, polling: 100 });
          const tReady = Date.now() - t0;
          await page.waitForFunction(() => window.__pilgrimage().ink.arrival?.walkMs != null, null, { timeout: 120000, polling: 100 });
          const tWalk = Date.now() - t0, a = await page.evaluate(() => window.__pilgrimage().ink.arrival), lv = await page.evaluate(() => window.__level().id);
          return { to, level: lv, ms: a.ms, walkMs: a.walkMs, scriptReadyMs: tReady, scriptWalkMs: tWalk };
        };
        await page.evaluate(() => { window.__pilgrimage({ mark: "t00", season: "summer" }); window.__pilgrimage({ mark: "t05", season: "summer" }); });
        const there = await here("t05"), back = await here("t00");
        const row = { ...r, round, size, loadMs: o.loadMs, there, back };
        out.push(row); log("crossing", JSON.stringify(row));
      } catch (e) { const row = { ...r, round, error: String(e.message || e).slice(0, 300) }; out.push(row); log("crossing", JSON.stringify(row)); }
      finally { if (ctx) await ctx.close().catch(() => {}); }
    }
  }
  return out;
};
