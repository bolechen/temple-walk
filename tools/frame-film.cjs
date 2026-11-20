// Two walks of issue #271 filmed frame by frame in the page: from behind the censer north past it, and in through the
// gate's middle bay from the forecourt (where the eye straight behind him used to be put out of the censer, or of the
// gate's eave, by 1.4–1.5 m in one frame). For each frame: a picture, where the eye stands and where he does (__frame()),
// and how far the eye moved beyond the step he took — the most of which is what the owner's rule bounds.
//   node tools/frame-film.cjs [outdir] [--frame=b] [--secs=5]
const path = require("path"), fs = require("fs");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "frame-film"));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1];
const fr = arg("frame", "b"), secs = +arg("secs", "5");
const WALKS = {
  censer: { at: [0, 18], yaw: 0, route: [[1.3, 13], [0, 9], [0, 3]] },
  gate: { at: [8.5, 52], yaw: -0.3, route: [[8.5, 49], [0, 46.5], [0, 34]] },
};
(async () => {
  const srv = await serve(), b = await launch(), report = {};
  const t = await open(b, srv.base, `q=low&view=third&season=summer&time=day&frame=${fr}`, { viewport: { width: 480, height: 270 } });
  for (const [name, W] of Object.entries(WALKS)) {
    const dir = path.join(out, `${name}-${fr}`); fs.mkdirSync(dir, { recursive: true });
    await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.04), [...W.at, W.yaw]);
    await t.frames(8);
    // every frame the page draws, recorded in the page itself (pictures are taken alongside, as fast as they can be)
    await t.page.evaluate(() => { window.__rec = []; const f = () => { if (!window.__rec) return; const s = window.__frame(); window.__rec.push({ t: performance.now() / 1000, eye: s.eye, at: s.at, dist: s.dist, side: s.side, box: s.monkBox, w: s.w }); requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await t.page.evaluate((r) => window.__walk(r), W.route);
    const rows = []; let shot = 0; const t0 = Date.now(); let first = null;
    while (true) {
      const s = await t.page.evaluate(() => window.__frame());
      if (!rows.length || s.frames !== rows.at(-1).frames) {
        rows.push(s); first ??= s.frames;
        await t.page.screenshot({ path: path.join(dir, `${String(shot++).padStart(3, "0")}.png`) });
      }
      // five seconds of the walk as the page lives it (its own clock, frame to frame, not the wall's)
      const walked = rows.length > 1 ? Math.hypot(rows.at(-1).at[0] - rows[0].at[0], rows.at(-1).at[2] - rows[0].at[2]) / 2.1 : 0;
      if (walked >= secs || Date.now() - t0 > 600000) break;
    }
    const all = await t.page.evaluate(() => { const r = window.__rec; window.__rec = null; return r; });
    // how far the eye moved in each frame beyond the step he took; and the same at sixty frames a second (the page under
    // software drawing takes several times as long over a frame, and every spring and speed limit is per second)
    let most = 0, most60 = 0, where = null;
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1], c = all[i], dt = Math.max(1e-3, Math.min(0.1, c.t - a.t));   // (yard.js caps a frame at a tenth of a second)
      const own = Math.hypot(c.eye[0] - a.eye[0] - (c.at[0] - a.at[0]), c.eye[2] - a.eye[2] - (c.at[2] - a.at[2]), c.eye[1] - a.eye[1] - (c.at[1] - a.at[1]));
      if (own > most) { most = own; where = { frame: i, at: c.at.map((v) => +v.toFixed(2)), dist: +c.dist.toFixed(2), side: +c.side.toFixed(2), dt: +dt.toFixed(3) }; }
      most60 = Math.max(most60, (own * (1 / 60)) / dt);
    }
    const across = all.filter((r) => r.box).map((r) => ((r.box[0] + r.box[2] / 2) / r.w) * 100);
    report[name] = { pictures: rows.length, frames: all.length, mostPerFrame: +most.toFixed(3), mostAt60: +most60.toFixed(3), where, across: [+Math.min(...across).toFixed(1), +Math.max(...across).toFixed(1)], slideMost: +Math.max(...all.map((r) => Math.abs(r.side || 0))).toFixed(2) };
    fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify(all));
    console.log(name, JSON.stringify(report[name]));
  }
  fs.writeFileSync(path.join(out, `report-${fr}.json`), JSON.stringify(report, null, 1));
  if (t.errors.length) console.error("page errors:", t.errors);
  await t.close(); await b.close(); srv.close();
})();
