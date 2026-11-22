// trial: node trial.cjs <outdir> <cfg.json> ; cfg = { name: { set:[{i,full,angle,penumbra,pos,aim}], add:[[x,y,z,full,dist,color,aim,angle,penumbra]] } }
const path = require("path"), fs = require("fs"), top = "/home/user/temple-walk";
const { site, serve } = require(path.join(top, "tools/site.cjs")); const { chromium } = require(path.join(top, "node_modules/playwright"));
const [out, cfgFile] = process.argv.slice(2), cfgs = JSON.parse(fs.readFileSync(cfgFile, "utf8")); fs.mkdirSync(out, { recursive: true });
const PICKV = (process.env.PICK || '').split(','); const VIEWS = JSON.parse(process.env.VIEWS || "null") || { c: [0, 0.6, 0, 0.14], e: [0, -9, 0, 1.15], eW: [-9, -9, 0, 1.15], f: [0, -2, 0, 0.17], front: [0, -8, 3.1416, 0.12], ne: [10, -12, 2.4, 0.45], chest: [0, -3, 0, 0.05], fig: [0, -6, 0, 0.35], near: [0, 6, 0, 0.08] };
(async () => {
  const srv = await serve(site()); const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, locale: "zh-CN" })).newPage();
  await page.goto(`${srv.base}?level=t05&shot=1&q=high&season=summer&time=day&view=first&cam=0,-9,0,1.15`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body.dataset.ready === "1" && window.__fills, null, { timeout: 900000 });
  const frames = {};
  for (const [name, c] of Object.entries(cfgs)) {
    await page.evaluate((c) => { const F = window.__fills, Spot = F[0].constructor, root = F[0].parent;
      if (!window.__base) window.__base = F.map((l) => ({ full: l.userData.full, angle: l.angle, pen: l.penumbra, pos: l.position.toArray(), tgt: l.target.position.toArray() }));
      F.length = window.__base.length; // drop earlier additions
      (window.__added || []).forEach((l) => { root.remove(l); root.remove(l.target); }); window.__added = [];
      F.forEach((l, i) => { const b = window.__base[i]; l.userData.full = b.full; l.angle = b.angle; l.penumbra = b.pen; l.position.set(...b.pos); l.target.position.set(...b.tgt); });
      (c.set || []).forEach((s) => { const l = F[s.i]; if (s.dist != null) l.distance = s.dist; if (s.full != null) l.userData.full = s.full; if (s.angle != null) l.angle = s.angle; if (s.penumbra != null) l.penumbra = s.penumbra; if (s.pos) l.position.set(...s.pos); if (s.aim) l.target.position.set(...s.aim); });
      (c.add || []).forEach((a) => { const l = new Spot(a[5], 0, a[4], a[7] ?? 1, a[8] ?? 1, 1.6); l.position.set(a[0], a[1], a[2]); l.userData.full = a[3]; l.target.position.set(...a[6]); root.add(l); root.add(l.target); F.push(l); window.__added.push(l); });
      F.forEach((l) => l.target.updateMatrixWorld()); }, c);
    for (const [v, p] of Object.entries(VIEWS)) {
      await page.evaluate((p) => window.__pose(...p), p);
      await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
      frames[v] ||= await page.evaluate(() => ({ ...window.__frame(), fov: window.__probe().fov }));
      await page.screenshot({ path: path.join(out, `${name}-${v}.png`), timeout: 600000 });
      if (process.env.PICK && PICKV.includes(v) && !fs.existsSync(path.join(out, `pick-${v}.json`))) fs.writeFileSync(path.join(out, `pick-${v}.json`), JSON.stringify(await page.evaluate(() => { const o = []; for (let y = 4; y < 720; y += 8) for (let x = 4; x < 1280; x += 8) { const r = window.__pick(x, y, 1)[0]; if (!r) continue; o.push([x, y, r.part, r.material, r.at]); } return o; })));
    }
    console.log("done", name);
  }
  fs.writeFileSync(path.join(out, "frames.json"), JSON.stringify(frames)); await b.close(); srv.close();
})();
