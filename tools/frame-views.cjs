// The walks of tools/frame-measure.cjs as pictures (issue #271): six places along each, drawn with the eye as it was
// (`?frame=old`) and with each way put to the owner (`?frame=a|b`, b the default), on a wide screen (16:9), a laptop's (4:3) and a phone held
// upright. He is stood at each place facing on along the walk and the eye given a few frames to settle there.
//   node tools/frame-views.cjs [outdir] [--frame=old,a,b] [--size=16x9,4x3,phone] [--walk=…] [--at=2: only those of the six places] [--keep: skip pictures already there]
// then `python3 tools/frame-sheet.py <outdir>` lays them out, one sheet a walk and a screen: a row for each eye.
const path = require("path"), fs = require("fs");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "frame-views"));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1].split(",");
const FRAMES = arg("frame", "old,a,b"), only = arg("walk", "open,censer,columns,wall,stair-up,stair-down"), at = arg("at", "0,1,2,3,4,5").map(Number), SIZES = { "16x9": [640, 360], "4x3": [480, 360], phone: [300, 650] }, sizes = arg("size", "16x9,4x3,phone");
const six = (f) => [0, 1, 2, 3, 4, 5].map((i) => f(i / 5));
const WALKS = {
  open: six((k) => [5, 32 - 14 * k, 0]),
  censer: six((k) => { const a = k * Math.PI * 2 * (5 / 6); return [2.6 * Math.sin(a), 13 + 2.6 * Math.cos(a), Math.atan2(-Math.cos(a), -Math.sin(a))]; }),
  columns: six((k) => [12.25, 24 - 17 * k, 0]),
  wall: six((k) => [21.3, 33 - 24 * k, 0]),
  "stair-up": six((k) => [18.5 - 8 * k, 77.5, -Math.PI / 2]),
  "stair-down": six((k) => [10.5 + 8 * k, 77.5, Math.PI / 2]),
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch(), log = [];
  for (const size of sizes) for (const fr of FRAMES) {
    const [w, h] = SIZES[size];
    const t = await open(b, srv.base, `q=low&view=third&season=summer&time=day&frame=${fr}`, { viewport: { width: w, height: h } });
    for (const [name, pts] of Object.entries(WALKS)) for (const [i, [x, z, yaw]] of pts.entries()) {
      if (!only.includes(name) || !at.includes(i) || fs.existsSync(path.join(out, `${size}-${name}-${i}-${fr}.png`)) && process.argv.includes("--keep")) continue;
      await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.06), [x, z, yaw]);
      await t.frames(5);
      const s = await t.page.evaluate(() => window.__frame ? window.__frame() : { monkBox: window.__probe().monkBox, w: innerWidth, h: innerHeight, dist: null, side: null }), file = `${size}-${name}-${i}-${fr}.png`;
      await t.page.screenshot({ path: path.join(out, file), timeout: 240000 });
      const box = s.monkBox, at = box ? [+(((box[0] + box[2] / 2) / s.w) * 100).toFixed(1), +(((box[1] + box[3] / 2) / s.h) * 100).toFixed(1)] : null;
      const span = box ? [+((box[1] / s.h) * 100).toFixed(1), +(((box[1] + box[3]) / s.h) * 100).toFixed(1)] : null;
      log.push({ file, size, frame: fr, walk: name, i, x, z, yaw: +yaw.toFixed(3), dist: s.dist, side: s.side, at, span });
      console.log(file, JSON.stringify(at), s.dist);
      // kept after every picture, with what earlier runs drew, so a run stopped half way still lays out
      const vf = path.join(out, "views.json"), had = fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, "utf8")).filter((v) => v.file !== file) : [];
      fs.writeFileSync(vf, JSON.stringify([...had, log.at(-1)], null, 1));
    }
    if (t.errors.length) console.error("page errors:", t.errors);
    await t.close();
  }

  await b.close(); srv.close();
})();
