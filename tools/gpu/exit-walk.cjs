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
      // Two passes, because __pick takes about half a second and asked in the walk it stretches the frames it is timing.
      // Pass 1: W held, every frame logged cheaply (the page's own clock, the eye, where he stands). Pass 2: for every fourth frame he is set
      // down where he stood (`__pose`), the eye put where it was (`__look`) and turned at his legs, waist and head in turn; a point counts as
      // seen when the first solid thing at the middle of the picture is him. Hidden is fewer than two of those three.
      await page.evaluate(() => {
        window.__exit = []; const t0 = performance.now(); let on = true;
        window.__exitStop = () => { on = false; };
        const go = (t) => {
          if (!on) return;
          const f = window.__frame(), y = window.__yard(), b = f.monkBox;
          window.__exit.push({ t: +(t - t0).toFixed(1), eye: f.eye.map((v) => +v.toFixed(3)), at: f.at.map((v) => +v.toFixed(3)), yaw: y.yaw, h: b ? +b[3].toFixed(3) : 0, dist: +f.dist.toFixed(2), op: +f.opacity.toFixed(2) });
          requestAnimationFrame(go);
        };
        requestAnimationFrame(go);
      });
      await page.keyboard.down("w"); await page.waitForTimeout(secs * 1000); await page.keyboard.up("w");
      const rows = await page.evaluate(() => { window.__exitStop(); return window.__exit; });
      const ft = rows.slice(1).map((r, i) => r.t - rows[i].t), asks = [];
      for (let i = 0; i < rows.length; i += 4) {
        const r = rows[i];
        const seen = await page.evaluate(async (r) => {
          const fr = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
          window.__pose(r.at[0], r.at[2], r.yaw, 0); let n = 0;
          for (const up of [0.25, 0.6, 1.05]) {
            window.__look(r.eye, [r.at[0], r.at[1] + up, r.at[2]]); await fr();
            if ((window.__pick(window.innerWidth / 2, window.innerHeight / 2).find((h) => !h.transparent) || {}).part === "monk") n++;
          }
          return n;
        }, r);
        asks.push({ t: r.t, seen });
      }
      await page.evaluate(() => window.__look());
      let hidden = 0, run = 0, longest = 0;
      for (let i = 1; i < asks.length; i++) { const d = asks[i].t - asks[i - 1].t; if (asks[i].seen < 2) { hidden += d; run += d; longest = Math.max(longest, run); } else run = 0; }
      Object.assign(row, { frames: rows.length, meanFrameMs: +(ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length)).toFixed(1), asks: asks.length, hiddenMs: Math.round(hidden), longestMs: Math.round(longest), seen: asks.map((r) => r.seen).join(""), firstHiddenAt: (asks.find((r) => r.seen < 2) || {}).t, eyeDist: rows.filter((_, i) => i % 20 === 0).map((r) => r.dist) });
      await ctx.close();
    } catch (e) { row.error = String(e.message || e).slice(0, 300); }
    log("exit-walk", JSON.stringify({ ...row, trace: undefined }));
    out.push(row);
  }
  return out;
};
