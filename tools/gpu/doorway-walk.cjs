// What the rooms seen through the doors cost on a real card (#218), run beside tools/gpu/job.cjs as its `script`:
// a cold page as a first visitor has it (`fresh`: in a browser started for it alone), 入山 pressed (the opening passed over with Esc, as a visitor may), then the
// measured walk's own route (src/tour.js) at a walking pace from the bamboo through the gate into the first court,
// round the censer and up to the great hall's door, every frame's length written down. Each run is a fresh page, and
// the runs alternate the doorways on and off (`?off=doorway`), so the columns can be set side by side.
//   EXTRA_FILES=tools/gpu/doorway-walk.cjs tools/gpu-render.sh t4-small '{"script":"doorway-walk.cjs","args":{"runs":[{"q":"high"},{"q":"high","off":1}]}}'
const { ROUTE_TO_DOOR } = { ROUTE_TO_DOOR: [[21.3, 77.5], [11, 77.5], [0, 77.5], [0, 62.5], [8.5, 60], [8.5, 49], [0, 46.5], [0, 29], [4, 20], [4, 9], [0, 4], [0, -4.6]] };

exports.run = async ({ open, log, runs = [{ q: "high" }, { q: "high", off: 1 }, { q: "high" }, { q: "low" }, { q: "low", off: 1 }, { q: "low" }] }) => {
  const out = [];
  for (const r of runs) {
    const size = r.q === "low" ? [390, 844] : [1920, 1080], scale = r.q === "low" ? 3 : 1;
    const query = `q=${r.q}&season=summer&time=day` + (r.off ? "&off=doorway" : "");
    const row = { ...r, size, query };
    try {
      const { ctx, page, loadMs } = await open(query, size, scale, { fresh: !!r.fresh });
      row.loadMs = loadMs;
      // Every frame from here on, by the page's own clock.
      await page.evaluate(() => { window.__ft = []; let last = performance.now(); window.__slow = []; const go = (t) => { const d = +(t - last).toFixed(1); window.__ft.push(d); if (d > 50 && window.__slow.length < 40) { const h = window.__doorways?.()?.halls || {}; window.__slow.push({ ms: d, at: window.__ft.length, doors: Object.entries(h).filter(([, x]) => x.source && x.source !== "baked" || (x.fade > 0 && x.fade < 1)).map(([k, x]) => k + ":" + x.source + ":" + x.fade) }); } last = t; requestAnimationFrame(go); }; requestAnimationFrame(go); });
      if (await page.isVisible("#title")) { await page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 }); await page.click("#enterBtn"); }
      await page.waitForTimeout(800);
      if (await page.evaluate(() => !!window.__opening && window.__opening().active)) { await page.keyboard.press("Escape"); await page.waitForFunction(() => !window.__opening().active, null, { timeout: 60000 }); }
      const startAt = await page.evaluate(() => window.__ft.length);
      await page.evaluate((pts) => window.__walk(pts), ROUTE_TO_DOOR);
      const t0 = Date.now();
      await page.waitForFunction(() => !window.__yard().target, null, { timeout: 180000, polling: 500 }).catch(() => { row.stuck = true; });
      row.walkS = +((Date.now() - t0) / 1000).toFixed(1);
      // At the door: wait for its room to come in (doorways on), or as long (off), then a few seconds more.
      if (!r.off) await page.waitForFunction(() => { const d = window.__doorways(); return d && d.halls.main.fade === 1; }, null, { timeout: 60000, polling: 250 }).catch(() => { row.mainNotIn = true; });
      else await page.waitForTimeout(4000);
      await page.waitForTimeout(2000);
      const m = await page.evaluate((k) => ({ slow: window.__slow.map((x) => ({ ...x, at: x.at - k })), ft: window.__ft.slice(k), y: window.__yard(), doors: window.__doorways?.() || null }), startAt);
      const ft = m.ft.slice(2);   // the first two after the walk was given may straddle the Esc
      row.frames = ft.length; row.maxMs = Math.max(...ft); row.over100 = ft.filter((x) => x > 100).length; row.over50 = ft.filter((x) => x > 50).length;
      row.worst5 = [...ft].sort((a, b) => b - a).slice(0, 5);
      row.slow = m.slow; row.at = [+m.y.x.toFixed(1), +m.y.z.toFixed(1)]; row.tier = m.y.tier;
      if (m.doors) row.doors = { warm: m.doors.warm, worstFrameMs: m.doors.worstFrameMs, worstFaceMs: m.doors.worstFaceMs, lastFacesMs: m.doors.lastFacesMs, spikes: m.doors.spikes, mb: m.doors.mb, taken: Object.entries(m.doors.halls).filter(([, x]) => x.taken).map(([k]) => k) };
      await ctx.close();
    } catch (e) { row.error = String(e.message || e).slice(0, 300); }
    log("doorway-walk", JSON.stringify(row));
    out.push(row);
  }
  return out;
};
