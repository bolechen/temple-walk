// The imperial stele in the stele pavilion, from the places the art review asked for (issue #520): the shape alone in black and in
// colour, from the front, side and back and the four quarters, with the eye 2 m out at a visitor's height, and from the old path
// (`?show=stele`).
//
//   pnpm dev   (in another shell)
//   node tools/stele-views.cjs [--base=http://127.0.0.1:8000/] [--out=tools/out/stele] [--modes=color,black] [--views=front,side,...]
//
// The pavilion is turned a quarter, so the stele's face looks along +x in the world and its right-hand side along -z.
const { serve, launch } = require("../tests/e2e/lib.cjs");
const fs = require("fs"), path = require("path");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const out = path.resolve(arg("out", "tools/out/stele")), heights = ["notch"], modes = arg("modes", "color,black").split(",");
const SIZE = [1280, 720], C = [-12.5, 50.5];   // the stele's place
// Each view: where the eye is, in metres along the face (fx, +x in the world) and along the stele's side (fz, +z in the world), and
// how high above the platform; and the point it looks at (above the platform).
const VIEWS = {
  // The whole stone, from outside the columns (the pavilion is open on every side), at a visitor's height.
  front: { eye: [5.2, 0, 1.5], at: [0, 0, 1.5] }, side: { eye: [0, 5.2, 1.5], at: [0, 0, 1.5] }, back: { eye: [-5.2, 0, 1.5], at: [0, 0, 1.5] },
  q1: { eye: [4.0, 4.0, 1.5], at: [0, 0, 1.5] }, q2: { eye: [4.0, -4.0, 1.5], at: [0, 0, 1.5] },
  q3: { eye: [-4.0, 4.0, 1.5], at: [0, 0, 1.5] }, q4: { eye: [-4.0, -4.0, 1.5], at: [0, 0, 1.5] },
  // 2 m out, a visitor's own eye (the main distance for the stone and its writing).
  top: { eye: [0.05, 0.0, 6.5], at: [0, 0, 0.45] },       // straight down, for the base's tiers
  front2m: { eye: [2.0, 0, 1.3], at: [0, 0, 1.3], ctx: true },   // his own eye (1.3 m), level, 2.0 m from the stone's middle
  title: { eye: [3.75, 0, 1.3], at: [0, 0, 1.3], ctx: true },   // from the pavilion's mouth, level: the title's frame in the picture
  head: { eye: [1.6, 0.7, 2.6], at: [0, 0, 2.7] },     // the notched head and the title's frame from near
  arris: { eye: [0.9, -1.2, 1.1], at: [0.185, -0.495, 1.1] },    // a front arris of the body, face on, for the worn band at 0.8 to 1.4 m
  foot: { eye: [1.3, -1.7, 0.95], at: [0.1, -0.3, 0.75] },       // the stone's foot and the base's top, from the shaded side: damp, moss, the base's lighter top
  path: { show: "stele", ctx: true },                                // from the old path, the named view
};
const only = arg("views", Object.keys(VIEWS).join(",")).split(",");
(async () => {
  const given = arg("base", ""), srv = given ? { base: given, close() {} } : await serve(), b = await launch();
  fs.mkdirSync(out, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: SIZE[0], height: SIZE[1] }, deviceScaleFactor: 1, locale: "zh-CN" }), errors = [];
  for (const h of heights) {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errors.push(m.text()));
    await p.goto(`${srv.base}?shot=1&q=high&season=summer&time=day&view=first&off=doorway&debug=0&cam=${C[0] + 1.6},${C[1]},-1.5708,0`, { waitUntil: "commit", timeout: 300000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 600000 });
    const info = await p.evaluate(() => ({ y: window.__yard(), st: window.__stele ? window.__stele() : null }));
    const floor = info.y.h != null ? info.y.h : info.y.y;
    await p.evaluate(() => { window.__steleAlone(); window.__pose(0, 75, 0, 0); });   // the stone out of its pavilion, the novice out of the way
    for (const mode of modes) {
      await p.evaluate((m) => window.__stele(m === "black" ? "black" : "paint"), mode);
      for (const id of only) {
        const v = VIEWS[id];
        await p.evaluate((ctx) => { window.__part("site", !!ctx); window.__part("bamboo", !!ctx); window.__part("props", !!ctx); window.__part("trees", !!ctx); }, !!v.ctx);   // (the pavilion is shown only where it is the setting: the 2 m eye and the old path)
        if (v.show) await p.evaluate((s) => { window.__look(); window.__show(s); }, v.show);
        else await p.evaluate(([e, a]) => window.__look(e, a), [[C[0] + e0(v.eye[0]), floor + v.eye[2], C[1] + v.eye[1]], [C[0] + v.at[0], floor + v.at[2], C[1] + v.at[1]]]);
        await p.waitForTimeout(900); await p.evaluate(() => window.__probe()); await p.waitForTimeout(500);
        const f = path.join(out, `${id}_${mode}_h${h}.png`); await p.screenshot({ path: f, timeout: 240000 }); console.log(f);
      }
    }
    await p.close();
  }
  console.log("errors:", [...new Set(errors)].slice(0, 6)); await b.close(); srv.close();
})();
function e0(v) { return v; }
