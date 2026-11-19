// The four walks of tools/frame-measure.cjs as pictures (issue #271): six places along each, drawn with the eye as it is
// now and with each way put to the owner (`?frame=a|b`), on a wide screen (16:9), a laptop's (4:3) and a phone held
// upright. He is stood at each place facing on along the walk and the eye given a few frames to settle there.
//   node tools/frame-views.cjs [outdir] [--frame=now,a,b] [--size=16x9,4x3,phone]
// then `python3 tools/frame-sheet.py <outdir>` lays them out, one sheet a walk and a screen: a row for each eye.
const path = require("path"), fs = require("fs");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "frame-views"));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1].split(",");
const FRAMES = arg("frame", "now,a,b"), SIZES = { "16x9": [640, 360], "4x3": [480, 360], phone: [300, 650] }, sizes = arg("size", "16x9,4x3,phone");
const six = (f) => [0, 1, 2, 3, 4, 5].map((i) => f(i / 5));
const WALKS = {
  open: six((k) => [5, 32 - 14 * k, 0]),
  censer: six((k) => { const a = k * Math.PI * 2 * (5 / 6); return [2.6 * Math.sin(a), 13 + 2.6 * Math.cos(a), Math.atan2(-Math.cos(a), -Math.sin(a))]; }),
  columns: six((k) => [12.25, 24 - 17 * k, 0]),
  wall: six((k) => [21.3, 33 - 24 * k, 0]),
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch(), log = [];
  for (const size of sizes) for (const fr of FRAMES) {
    const [w, h] = SIZES[size];
    const t = await open(b, srv.base, `q=low&view=third&season=summer&time=day${fr === "now" ? "" : "&frame=" + fr}`, { viewport: { width: w, height: h } });
    for (const [name, pts] of Object.entries(WALKS)) for (const [i, [x, z, yaw]] of pts.entries()) {
      await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.06), [x, z, yaw]);
      await t.frames(5);
      const s = await t.page.evaluate(() => window.__frame()), file = `${size}-${name}-${i}-${fr}.png`;
      await t.page.screenshot({ path: path.join(out, file), timeout: 240000 });
      const box = s.monkBox, at = box ? [+(((box[0] + box[2] / 2) / s.w) * 100).toFixed(1), +(((box[1] + box[3] / 2) / s.h) * 100).toFixed(1)] : null;
      log.push({ file, size, frame: fr, walk: name, i, x, z, yaw: +yaw.toFixed(3), dist: s.dist, side: s.side, at });
      console.log(file, JSON.stringify(at), s.dist);
    }
    if (t.errors.length) console.error("page errors:", t.errors);
    await t.close();
  }
  fs.writeFileSync(path.join(out, "views.json"), JSON.stringify(log, null, 1));
  await b.close(); srv.close();
})();
