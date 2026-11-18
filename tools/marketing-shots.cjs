// Draws the pictures listed in docs/marketing/shots.json, one address each, from the built site.
//   node tools/marketing-shots.cjs [--ids a,b] [--batch 1] [--orient land|port] [--scale 0.25] [--out dir] [--spec]
// Locally (SwiftShader) it draws at `scale` of each entry's size, to settle cameras and framing. `--spec` prints the JSON
// spec for `tools/gpu-render.sh t4-small '<spec>'` instead, so the same addresses are drawn at full size on a T4 in one go.
// Every address carries ?body=code (the built novice, not the sculpted one) and ?shot=1 (time frozen, controls hidden).
const fs = require("fs"), path = require("path");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "docs", "marketing", "shots.json"), "utf8")).shots;
const ids = arg("ids", "") ? String(arg("ids")).split(",") : null, batch = arg("batch", null), orient = arg("orient", null);
const pick = list.filter((s) => (!ids || ids.includes(s.id)) && (!batch || s.batch <= Number(batch)) && (!orient || s.orient === orient));
const address = (s) => `shot=1&q=high&body=code&${s.query}`;
if (arg("spec", false)) {
  console.log(JSON.stringify({ seconds: 0, bench: [], scale: 1, shots: pick.map((s) => ({ file: s.id, query: address(s), size: s.size, wait: 1500 })) }));
  process.exit(0);
}
(async () => {
  const { serve, launch } = require("../tests/e2e/lib.cjs"), scale = Number(arg("scale", 0.25)), out = path.resolve(arg("out", "tools/out/marketing"));
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch(), errs = [];
  for (const s of pick) {
    const size = s.size.map((n) => Math.round(n * scale));
    const ctx = await b.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1, locale: "zh-CN" }), p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(s.id + " " + String(e).slice(0, 200))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(s.id + " " + m.text().slice(0, 200)));
    await p.goto(srv.base + "?" + address(s), { waitUntil: "commit", timeout: 180000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(out, s.id + ".png"), timeout: 240000 });
    console.log(s.id, size.join("x")); await ctx.close();
  }
  console.log("errors:", [...new Set(errs)].slice(0, 8)); await b.close(); srv.close();
})();
