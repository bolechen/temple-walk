// Review-only probe (not part of the repo): photo DOF state, normal-input walk from the title, photo frames.
const { serve, launch, open } = require("../../../tests/e2e/lib.cjs");
const fs = require("fs"), path = require("path"), OUT = __dirname, log = [];
const L = (k, v) => { const s = `${new Date().toISOString()} ${k} ${JSON.stringify(v)}`; console.log(s); log.push(s); };
(async () => {
  const srv = await serve(), b = await launch();
  try {
    if (!process.env.SKIP1) {
    // 1. DOF while the camera is raised, high tier, desktop 16:9, third person court
    let t = await open(b, srv.base, "q=high&season=summer&time=day&cam=0,30,0,0&view=third", { viewport: { width: 1280, height: 720 } });
    await t.frames(4);
    await t.page.evaluate(() => window.__photo(true)); await t.frames(4);
    const pr = await t.page.evaluate(() => { const p = window.__probe(); return { post: p.post, photo: p.photo, tier: window.__yard().tier }; });
    L("dof-photo-high", pr);
    
    await t.page.evaluate(() => window.__photo(false)); await t.frames(3);
    L("dof-walking-high", await t.page.evaluate(() => window.__probe().post));
    L("errors1", t.errors); await t.close(); }
    let t;

    // 2. Normal input from the title, desktop: real click on 入山, Esc skip of opening, real W held
    t = await open(b, srv.base, "q=low", { viewport: { width: 1280, height: 720 }, enter: false });
    await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    await t.page.screenshot({ timeout: 600000, path: path.join(OUT, "input-title.png") });
    const btn = (await t.page.waitForSelector("#enterBtn:not([disabled])", { timeout: 300000 }));
    L("enter-button", !!btn);
    if (btn) await btn.click();
    await t.frames(10);
    const op = await t.page.evaluate(() => window.__opening ? window.__opening() : null); L("opening-after-enter", op);
    if (op && op.active) { await t.page.mouse.click(640, 360); }
    await t.page.waitForFunction(() => !window.__opening || !window.__opening().active, null, { timeout: 300000 });
    await t.frames(10);
    const s0 = await t.state(); L("start", { x: s0.x, z: s0.z, h: s0.h, frames: s0.frames });
    await t.page.keyboard.down("w"); const f0 = (await t.state()).frames;
    await t.page.waitForFunction((f) => window.__yard().frames > f + 60, f0, { timeout: 600000 });
    await t.page.keyboard.up("w"); await t.frames(3);
    const s1 = await t.state(); L("after-W-60frames", { x: s1.x, z: s1.z, h: s1.h, moved: Math.hypot(s1.x - s0.x, s1.z - s0.z) });
    await t.page.screenshot({ timeout: 600000, path: path.join(OUT, "input-after-w.png") });
    // drag to look
    const y0 = (await t.state()).yaw; await t.page.mouse.move(640, 300); await t.page.mouse.down(); await t.page.mouse.move(800, 300, { steps: 8 }); await t.page.mouse.up(); await t.frames(3);
    L("drag-yaw", { before: y0, after: (await t.state()).yaw });
    L("errors2", t.errors); await t.close();

    // 3. Photo frames: desktop and upright phone, first raise, default frame (high on desktop; phone tier auto)
    for (const [name, vp, extra] of [["desktop", { width: 1280, height: 720 }, {}], ["phone", { width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 1 }]]) {
      t = await open(b, srv.base, "cam=0,30,0,0&view=third&season=summer&time=day", { viewport: vp, ...extra });
      await t.frames(3); await t.page.evaluate(() => window.__photo(true)); await t.frames(3);
      const thirds = await t.page.evaluate(() => window.__settings ? window.__settings().thirds : null);
      const cap = await t.page.evaluate(async () => { const r = await window.__capture(); return r && typeof r === "object" ? { w: r.width ?? r.w, h: r.height ?? r.h, keys: Object.keys(r) } : r; });
      L("photo-" + name, { cap, thirds, post: await t.page.evaluate(() => window.__probe().post) });
      await t.page.screenshot({ timeout: 600000, path: path.join(OUT, `photo-${name}.png`) });
      L("errors-" + name, t.errors); await t.close();
    }
  } catch (e) { L("EXCEPTION", String(e.stack || e).slice(0, 800)); }
  finally { fs.writeFileSync(path.join(OUT, "check.log"), log.join("\n") + "\n"); await b.close(); srv.close(); }
})();
