// The sitting benches of the path's pavilions (#479) as pictures, for the art review: for each pavilion, he sits and the
// third-person view as the visitor has it (the eye behind him; in the half-way pavilion it is the eye turned to the valley,
// held where it rests), and from outside beside the steps, where the bench and its balustrade are seen from the path.
//   node tools/rest-views.cjs [outdir] [--season=summer] [--time=day]
const path = require("path"), fs = require("fs");
const { serve, launch } = require("../tests/e2e/lib.cjs");
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || d;
const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "rest"));
const season = arg("season", "summer"), time = arg("time", "day");
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(), b = await launch(), errors = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, locale: "zh-CN" }), p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errors.push(m.text()));
  await p.goto(`${srv.base}?q=high&enter&view=third&season=${season}&time=${time}`, { waitUntil: "commit", timeout: 120000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
  const frames = async (n) => { const f0 = await p.evaluate(() => window.__yard().frames); await p.waitForFunction((f) => window.__yard().frames >= f, f0 + n, { timeout: 300000 }); };
  const seats = await p.evaluate(() => window.__seats.map((s, i) => ({ i, at: s.at, face: s.face, top: s.top, pavilion: s.pavilion || null, place: s.place || null })).filter((s) => s.pavilion));
  const done = new Set();
  for (const s of seats) {
    if (done.has(s.pavilion)) continue; done.add(s.pavilion);
    const name = s.pavilion === "半山亭" ? "banshan" : s.pavilion === "望江亭" ? "wangjiang" : "yubei";
    // From the path, before he sits: outside the pavilion on the side the bench is seen from, a few metres off, looking at it.
    const from = [s.at[0] + Math.sin(s.face) * 5.5, s.at[1] + Math.cos(s.face) * 5.5];
    await p.evaluate(([x, z, f]) => window.__pose(x, z, -f, 0.12), [from[0], from[1], s.face]); await frames(8);
    await p.screenshot({ path: path.join(out, `${name}-1-from-outside.png`), timeout: 300000 });
    // Beside the bench on the pavilion's floor: the bench and its balustrade close.
    const near = [s.at[0] + Math.sin(s.face) * 2.4, s.at[1] + Math.cos(s.face) * 2.4];
    await p.evaluate(([x, z, f]) => { window.__pose(x, z, -f, 0.12); }, [near[0], near[1], s.face]); await frames(8);
    await p.screenshot({ path: path.join(out, `${name}-2-the-bench.png`), timeout: 300000 });
    // He sits: the eye as the visitor has it once he is down (and, in the half-way pavilion, once it has come round and rests).
    await p.evaluate(([x, z, f]) => window.__pose(x, z, -f, 0.05), [s.at[0] + Math.sin(s.face) * 1.2, s.at[1] + Math.cos(s.face) * 1.2, s.face]); await frames(4);
    await p.evaluate((i) => window.__sit(i), s.i);
    await p.waitForFunction((k) => { const r = window.__rites(), q = window.__seats[k]; return Math.hypot(r.him[0] - q.at[0], r.him[2] - q.at[1]) < 0.05; }, s.i, { timeout: 120000 });
    await frames(10);
    await p.screenshot({ path: path.join(out, `${name}-3-sitting-as-he-sits.png`), timeout: 300000 });
    if (s.place) {
      await p.waitForFunction(() => window.__director().phase === "hold", null, { timeout: 120000 }); await frames(30);
      await p.screenshot({ path: path.join(out, `${name}-4-the-eye-at-the-valley.png`), timeout: 300000 });
      console.log(name, "director", JSON.stringify(await p.evaluate(() => window.__director())));
    }
    await p.keyboard.down("s"); await frames(15); await p.keyboard.up("s");
    await p.waitForFunction(() => window.__director().phase === "idle", null, { timeout: 120000 });
  }
  console.log("errors:", errors.length ? errors : "none");
  await ctx.close(); await b.close(); srv.close && srv.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
