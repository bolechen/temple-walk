// How long he is hidden walking out of a hall's door without stopping (#411's art review, item 5), run beside tools/gpu/job.cjs as its `script`:
// the page opens third person, he is set inside a hall, comes out behind the veil, and W is held for a few seconds at a walking pace.
// Every frame, by the page's own clock, five points down the middle of his box are asked of the picture (`__pick`: is the first solid
// thing there him?); the report gives the milliseconds in which fewer than half of them were him, the longest run of such frames, and the
// least share seen. A run is the frames from the moment the veil is gone.
//   EXTRA_FILES=tools/gpu/exit-walk.cjs tools/gpu-render.sh t4-small '{"script":"exit-walk.cjs","args":{"halls":["main","chan","guanyin"]}}'
exports.run = async ({ open, log, halls = ["main"], q = "high", secs = 5 }) => {
  const out = [];
  for (const id of halls) {
    const row = { hall: id, q };
    try {
      const { ctx, page } = await open(`q=${q}&cam=0,30,0,0&view=third&enter&season=summer&time=day`, [1280, 720], 1);
      await page.waitForFunction(() => window.__eyeSpace().state === "ready", null, { timeout: 240000, polling: 250 });
      await page.evaluate((h) => window.__inside(h), id);
      await page.waitForFunction((h) => window.__yard().room === h, id, { timeout: 120000, polling: 50 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.__inside(null));
      await page.waitForFunction(() => !window.__yard().inside, null, { timeout: 120000, polling: 10 });
      await page.evaluate(() => {
        window.__exit = []; const t0 = performance.now(); let on = true;
        window.__exitStop = () => { on = false; };
        const go = (t) => {
          if (!on) return;
          const f = window.__frame(), b = f.monkBox; let seen = 0;
          if (b) seen = [0.1, 0.3, 0.5, 0.7, 0.9].filter((k) => (window.__pick(b[0] + b[2] / 2, b[1] + b[3] * k).find((h) => !h.transparent) || {}).part === "monk").length;
          window.__exit.push({ t: +(t - t0).toFixed(1), seen, h: b ? +b[3].toFixed(3) : 0, dist: +f.dist.toFixed(2), op: +f.opacity.toFixed(2) });
          requestAnimationFrame(go);
        };
        requestAnimationFrame(go);
      });
      await page.keyboard.down("w"); await page.waitForTimeout(secs * 1000); await page.keyboard.up("w");
      const rows = await page.evaluate(() => { window.__exitStop(); return window.__exit; });
      let hidden = 0, run = 0, longest = 0, worst = 5;
      for (let i = 1; i < rows.length; i++) {
        const d = rows[i].t - rows[i - 1].t, low = rows[i].seen < 3;
        worst = Math.min(worst, rows[i].seen);
        if (low) { hidden += d; run += d; longest = Math.max(longest, run); } else run = 0;
      }
      Object.assign(row, { frames: rows.length, hiddenMs: Math.round(hidden), longestMs: Math.round(longest), leastSeenOf5: worst, trace: rows.filter((_, i) => i % 6 === 0).slice(0, 60) });
      await ctx.close();
    } catch (e) { row.error = String(e.message || e).slice(0, 300); }
    log("exit-walk", JSON.stringify({ ...row, trace: undefined }));
    out.push(row);
  }
  return out;
};
