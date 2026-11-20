// #320's trial on a real card, run beside tools/gpu/job.cjs as its `script`: the three ways of showing a room through its
// door (the baked cube as it is, the baked cube with a larger face into the room `hires`, the room drawn live `live`,
// and `live` without its warming ahead) side by side. Each run is a cold page in a browser of its own: 入山 (the opening
// passed over), the walk's own route from the bamboo to the first court and on to 6 m before the great hall's door,
// every frame's length written down (the worst is the first approach's hitch), then, standing there in third person,
// what a frame costs (`__cost`), the frame rate, triangles and draw calls, and a picture.
//   KEEP_MODELS=1 EXTRA_FILES=tools/gpu/doorway-live.cjs tools/gpu-render.sh t4-small '{"script":"doorway-live.cjs","args":{}}'
// `quick`: no walk, he is stood 6 m out at once (to measure what a frame costs, not the first approach). A run with
// `base: true` opens the other build staged beside the site (BASE_SITE, served at base/), so the two are set side by
// side turn about in one job.
const fs = require("fs"), path = require("path");
const ROUTE = [[21.3, 77.5], [11, 77.5], [0, 77.5], [0, 62.5], [8.5, 60], [8.5, 49], [0, 46.5], [0, 29], [4, 20], [4, 9]];
const RUNS = [];
for (let i = 0; i < 2; i++) {
  for (const mode of ["", "hires", "live", "live-cold"]) RUNS.push({ q: "high", mode, i });
  for (const mode of ["", "hires"]) RUNS.push({ q: "low", mode, i });
}

exports.run = async ({ open, log, out, runs = RUNS, dist = 6, quick = false }) => {
  fs.mkdirSync(out, { recursive: true });
  const rows = [];
  for (const r of runs) {
    const size = r.q === "low" ? [390, 844] : [1920, 1080], scale = r.q === "low" ? 3 : 1;
    const doorway = { "live-cold": "live&warm=0", "live-half": "live&live=half" }[r.mode] ?? r.mode;
    const query = `q=${r.q}&season=summer&time=day&view=third` + (doorway ? `&doorway=${doorway}` : "");
    const row = { ...r, size, query };
    try {
      const { ctx, page, loadMs } = await open(query, size, scale, { fresh: true, path: r.base ? "base/" : "" });
      row.loadMs = loadMs;
      await page.evaluate(() => { window.__ft = []; window.__slow = []; let last = performance.now(); const go = (t) => { const d = +(t - last).toFixed(1); window.__ft.push(d); if (d > 50 && window.__slow.length < 40) { const l = window.__doorways?.()?.live; window.__slow.push({ ms: d, at: window.__ft.length, live: l ? JSON.stringify(l.halls) : null }); } last = t; requestAnimationFrame(go); }; requestAnimationFrame(go); });
      if (await page.isVisible("#title")) { await page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 }); await page.click("#enterBtn"); }
      await page.waitForTimeout(800);
      if (await page.evaluate(() => !!window.__opening && window.__opening().active)) { await page.keyboard.press("Escape"); await page.waitForFunction(() => !window.__opening().active, null, { timeout: 60000 }); }
      // 6 m out from the great hall's door, square on.
      const at = await page.evaluate((d) => { const h = window.__halls.find((x) => x.id === "main"); const ox = h.out[0] + Math.sin(h.outYaw) * 0.66, oz = h.out[1] - Math.cos(h.outYaw) * 0.66; const dx = Math.sin(h.outYaw), dz = -Math.cos(h.outYaw); return [ox + dx * d, oz + dz * d, Math.atan2(-dx, dz)]; }, dist);   // as tools/doorway-views.cjs stands its views
      const k = await page.evaluate(() => window.__ft.length);
      if (!quick) {
        await page.evaluate((pts) => window.__walk(pts), [...ROUTE, [at[0], at[1]]]);
        const t0 = Date.now();
        await page.waitForFunction(() => !window.__yard().target, null, { timeout: 180000, polling: 500 }).catch(() => { row.stuck = true; });
        row.walkS = +((Date.now() - t0) / 1000).toFixed(1);
      }
      await page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.04), at);
      await page.waitForFunction((m) => { const d = window.__doorways(); if (!d || d.halls.main.fade !== 1) return false; if (/live/.test(m)) return d.live && d.live.halls.main === "ready"; if (m === "hires") return d.halls.main.hi; return true; }, r.mode, { timeout: 90000, polling: 250 }).catch(() => { row.notReady = true; });
      await page.waitForTimeout(2500);
      const m = await page.evaluate((k) => ({ ft: window.__ft.slice(k), slow: window.__slow.map((x) => ({ ...x, at: x.at - k })), y: window.__yard(), doors: window.__doorways() }), k);
      const ft = m.ft.slice(2);
      row.frames = ft.length; row.maxMs = Math.max(...ft); row.over50 = ft.filter((x) => x > 50).length; row.over100 = ft.filter((x) => x > 100).length;
      row.worst5 = [...ft].sort((a, b) => b - a).slice(0, 5); row.slow = m.slow.filter((x) => x.at > 0);
      row.doors = { worstFrameMs: m.doors.worstFrameMs, spikes: m.doors.spikes, mb: m.doors.mb, live: m.doors.live };
      // Standing there: a frame's cost on the card, the rate, the load.
      const a = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now() }));
      await page.waitForTimeout(5000);
      const z = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now(), y: window.__yard() }));
      row.fps = +(((z.f - a.f) * 1000) / (z.t - a.t)).toFixed(1);
      row.tris = z.y.tris; row.calls = z.y.calls; row.at = [z.y.x, z.y.z];
      row.cost = await page.evaluate(() => window.__cost(40));
      row.live = (await page.evaluate(() => window.__doorways().live)) || null;
      const name = `main-${dist}m-${r.q}-${r.mode || "baked"}${r.base ? "-base" : ""}-${r.i}.png`;
      await page.screenshot({ path: path.join(out, name) }); row.shot = name;
      // For the measure of what one room costs: the same frame drawn from inside the great hall, at its door looking in.
      if (r.inside) { await page.evaluate(() => window.__inside("main")); await page.waitForFunction(() => window.__yard().room === "main" && !document.getElementById("veil").className, null, { timeout: 60000 }); await page.waitForTimeout(1500); row.inside = { cost: await page.evaluate(() => window.__cost(40)), ...(await page.evaluate(() => { const y = window.__yard(); return { tris: y.tris, calls: y.calls }; })) }; }
      await ctx.close();
    } catch (e) { row.error = String(e.message || e).slice(0, 300); }
    log("doorway-live", JSON.stringify(row));
    rows.push(row);
  }
  return rows;
};
