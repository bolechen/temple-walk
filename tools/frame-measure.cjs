// Where he stands in the picture in the third person, frame by frame, along four walks of the first court (issue #271):
// straight up the open court, once round the censer, north along the meditation hall's columns (they on his right),
// and north along the east wall (it on his right, then the alley behind the hall). For each walk: the middle of
// __probe().monkBox across the picture (read each frame through __frame(), the same box without drawing a frame), as
// a percentage of its width, and down it, as a percentage of its height; mean, range and the fastest change in a second;
// and on the stair, how much of him is in the picture (the box's top and foot; the share of frames with his feet in it).
// `old` is the eye as it was before #271 (`?frame=old`), `a` and `b` the two put to the owner (b the default).
//   node tools/frame-measure.cjs [outdir] [--frame=old,a,b] [--size=16x9,4x3,phone] [--walk=open,stair-up,…]
// `--walk=open,wall` measures only those; report.json keeps what earlier runs measured. The place is built but not drawn (BARE): what is measured is the camera, not the picture.
const path = require("path"), fs = require("fs");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "frame"));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1].split(",");
const FRAMES = arg("frame", "old,a,b"), only = arg("walk", "open,censer,columns,wall,stair-up,stair-down"), SIZES = { "16x9": [800, 450], "4x3": [600, 450], phone: [390, 844] }, sizes = arg("size", "16x9");
const BARE = "&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway";
// Each walk: where he is put, facing which way, and how he goes on (`to`: walk straight on until z is past it;
// `round`: round a point at a radius, the view turned with him by dragging, as a visitor turns it, for a whole turn).
const WALKS = {
  open: { at: [5, 32], yaw: 0, to: 18 },
  censer: { at: [0, 15.6], yaw: -Math.PI / 2, round: [0, 13, 2.6] },
  columns: { at: [12.25, 24], yaw: 0, to: 7 },
  wall: { at: [21.3, 33], yaw: 0, to: 9 },
  // up the flight by the half-way pavilion (west along the landing's line) and back down it (#271: a visitor's picture
  // there had him cut off at the waist)
  "stair-up": { at: [19.5, 77.5], yaw: -Math.PI / 2, until: (y) => y.x < 10.5 },
  "stair-down": { at: [9.5, 77.5], yaw: Math.PI / 2, until: (y) => y.x > 19.5 },
};
const stats = (xs, ts) => {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n; let rate = 0;
  // the fastest change over any second (from frame times, so a slow page does not read as a calm one)
  for (let i = 0, j = 0; i < n; i++) { while (ts[i] - ts[j] > 1) j++; for (let k = j; k < i; k++) rate = Math.max(rate, Math.abs(xs[i] - xs[k]) / Math.max(ts[i] - ts[k], 0.25)); }
  return { mean: +mean.toFixed(1), min: +Math.min(...xs).toFixed(1), max: +Math.max(...xs).toFixed(1), range: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), perSec: +rate.toFixed(1), n };
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch(), report = {};
  for (const size of sizes) for (const fr of FRAMES) {
    const [w, h] = SIZES[size];
    const t = await open(b, srv.base, `q=low&view=third&season=summer&time=day&frame=${fr}${BARE}`, { viewport: { width: w, height: h } });
    const p = t.page;
    for (const [name, W] of Object.entries(WALKS)) {
      if (!only.includes(name)) continue;
      await p.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.06), [...W.at, W.yaw]);
      await t.frames(20);
      await p.evaluate(() => { window.__rec = []; const t0 = performance.now(); const f = () => { if (!window.__rec) return; const s = window.__frame(), y = window.__yard(); if (s.monkBox) window.__rec.push({ t: (performance.now() - t0) / 1000, box: s.monkBox, w: s.w, h: s.h, x: y.x, z: y.z, dist: s.dist, side: s.side }); requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await p.mouse.move(w / 2, h * 0.3); await p.mouse.down(); let mx = w / 2, turned = 0, k = null;
      await p.keyboard.down("w");
      const t0 = Date.now();
      while (Date.now() - t0 < 240000) {
        const y = await p.evaluate(() => window.__yard());
        if ((W.to !== undefined && y.z < W.to) || (W.until && W.until(y))) break;
        if (W.round) {
          // the way on round the point, leaning in or out toward the radius
          const [cx, cz, r] = W.round, a = Math.atan2(y.x - cx, y.z - cz), d = Math.hypot(y.x - cx, y.z - cz);
          const tx = -Math.cos(a), tz = Math.sin(a), want = Math.atan2(tx, -tz) - (d - r) * 0.6;
          const err = Math.atan2(Math.sin(want - y.yaw), Math.cos(want - y.yaw)), dx = Math.max(-40, Math.min(40, err / (k || 0.004)));
          const was = y.yaw; mx += dx; await p.mouse.move(mx, h * 0.3); if (mx < 50 || mx > w - 50) { await p.mouse.up(); mx = w / 2; await p.mouse.move(mx, h * 0.3); await p.mouse.down(); }
          await p.waitForTimeout(80);
          const now = (await p.evaluate(() => window.__yard())).yaw, dy = Math.atan2(Math.sin(now - was), Math.cos(now - was));
          if (Math.abs(dx) > 5 && Math.abs(dy) > 1e-3) k = Math.abs(dy / dx); turned += dy;
          if (Math.abs(turned) > Math.PI * 2) break;
        } else await p.waitForTimeout(100);
      }
      await p.keyboard.up("w"); await p.mouse.up();
      const rec = await p.evaluate(() => { const r = window.__rec; window.__rec = null; return r; });
      const xs = rec.map((r) => ((r.box[0] + r.box[2] / 2) / r.w) * 100), ys = rec.map((r) => ((r.box[1] + r.box[3] / 2) / r.h) * 100), ts = rec.map((r) => r.t);
      const top = rec.map((r) => (r.box[1] / r.h) * 100), bottom = rec.map((r) => ((r.box[1] + r.box[3]) / r.h) * 100);
      const res = { across: stats(xs, ts), down: stats(ys, ts), head: +Math.min(...top).toFixed(1), feet: +Math.max(...bottom).toFixed(1), feetIn: +((bottom.filter((b) => b <= 100).length / bottom.length) * 100).toFixed(1), dist: stats(rec.map((r) => r.dist), ts), secs: +ts.at(-1).toFixed(1) };
      (report[size] ??= {})[fr] ??= {}; report[size][fr][name] = res;
      fs.writeFileSync(path.join(out, `trace-${size}-${fr}-${name}.json`), JSON.stringify(rec));
      console.log(size, fr, name, JSON.stringify(res));
    }
    if (t.errors.length) console.error("page errors:", t.errors);
    await t.close();
  }
  const file = path.join(out, "report.json"), old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  for (const [s, fr] of Object.entries(report)) for (const [f, ws] of Object.entries(fr)) Object.assign(((old[s] ??= {})[f] ??= {}), ws);
  fs.writeFileSync(file, JSON.stringify(old, null, 1));
  await b.close(); srv.close();
})();
