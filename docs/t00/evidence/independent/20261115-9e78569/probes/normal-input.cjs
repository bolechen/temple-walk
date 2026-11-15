// Independent reviewer script: real keyboard/mouse only for movement and UI (no __walk, __pose, ?cam, ?fast).
// Hooks are only read (__yard, __ui) to log state. Usage: node normal-input.cjs <worktree> <outdir>
const path = require("path"), fs = require("fs");
const wt = process.argv[2], outDir = process.argv[3]; fs.mkdirSync(outDir, { recursive: true });
const { serve, launch } = require(path.join(wt, "tests/e2e/lib.cjs"));
const log = []; const L = (o) => { o.t = new Date().toISOString(); log.push(o); console.log(JSON.stringify(o)); };
(async () => {
  const srv = await serve(), b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push("pageerror " + e));
  page.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errors.push("console " + m.text().slice(0, 200)));
  page.on("response", (r) => r.status() >= 400 && errors.push("HTTP " + r.status() + " " + r.url()));
  const t0 = Date.now();
  await page.goto(srv.base + "?q=low&season=summer&time=day", { waitUntil: "commit", timeout: 120000 });
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 400000 });
  L({ step: "ready", ms: Date.now() - t0 });
  await page.screenshot({ path: path.join(outDir, "00-title.png") });
  await page.waitForFunction(() => !document.getElementById("enterBtn")?.disabled, null, { timeout: 60000 });
  await page.click("#enterBtn"); await page.waitForFunction(() => document.body.classList.contains("entered"), null, { timeout: 60000 });
  const st = () => page.evaluate(() => { const y = window.__yard(); return { x: +y.x.toFixed(2), z: +y.z.toFixed(2), h: +(y.height ?? y.h ?? 0).toFixed(2), frames: y.frames, inside: y.inside ?? null }; });
  const frames = async (n) => { const f0 = (await st()).frames; const tt = Date.now(); while ((await st()).frames < f0 + n) { if (Date.now() - tt > 300000) throw new Error("stalled"); await page.waitForTimeout(300); } };
  let s = await st(); L({ step: "entered", ...s });
  await frames(5); await page.screenshot({ path: path.join(outDir, "01-start.png") });
  // Walk forward with W held at normal speed (no Shift) in segments; screenshot each.
  for (let i = 0; i < 6; i++) {
    const a = await st(), w0 = Date.now(); await page.keyboard.down("w"); await frames(60); await page.keyboard.up("w"); await frames(3);
    const c = await st(); L({ step: "walk-W", seg: i, from: [a.x, a.z, a.h], to: [c.x, c.z, c.h], dz: +(c.z - a.z).toFixed(2), frames: c.frames - a.frames, wallMs: Date.now() - w0 });
    await page.screenshot({ path: path.join(outDir, `02-walk-${i}.png`) });
  }
  // Pause menu: everything behind it must not answer.
  await page.keyboard.press("Escape"); await frames(2);
  let u = await page.evaluate(() => window.__ui()); L({ step: "menu-open", stack: u.stack, modal: u.modal });
  const before = await st(), pb = await page.evaluate(() => window.__probe());
  for (const k of ["e", "b", "p", "t", "h", "v", "Enter", " "]) { await page.keyboard.press(k); }
  await page.keyboard.down("w"); await frames(4); await page.keyboard.up("w");
  await page.mouse.wheel(0, 400); await frames(3);
  u = await page.evaluate(() => window.__ui()); const after = await st(), pa = await page.evaluate(() => window.__probe());
  L({ step: "menu-inputs", stackAfter: u.stack, moved: +Math.hypot(after.x - before.x, after.z - before.z).toFixed(3), viewBefore: pb.view, viewAfter: pa.view, photo: pa.photo, camDist: [pb.camDist, pa.camDist] });
  await page.screenshot({ path: path.join(outDir, "03-menu.png") });
  await page.keyboard.press("Escape"); await frames(2); u = await page.evaluate(() => window.__ui()); L({ step: "menu-closed", stack: u.stack });
  // Photograph: raise camera with P, inspect UI, open settings, shutter.
  await page.keyboard.press("p"); await frames(3); await page.screenshot({ path: path.join(outDir, "04-photo-raised.png") });
  const vis = await page.evaluate(() => [...document.querySelectorAll("button,a")].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0).map((e) => e.id || e.textContent.trim()).slice(0, 30));
  L({ step: "photo-visible-controls", vis });
  await page.click("#shutter"); await page.waitForFunction(() => !document.getElementById("print").hidden, null, { timeout: 300000 });
  const img = await page.evaluate(() => { const i = document.getElementById("printImg"); return { w: i.naturalWidth, h: i.naturalHeight }; });
  L({ step: "photo-taken", img }); await page.screenshot({ path: path.join(outDir, "05-print.png") });
  const src = await page.evaluate(() => document.getElementById("printImg").src);
  if (src.startsWith("data:image")) fs.writeFileSync(path.join(outDir, "05-photo.jpg"), Buffer.from(src.split(",")[1], "base64"));
  L({ step: "end", errors });
  fs.writeFileSync(path.join(outDir, "normal-input.json"), JSON.stringify({ log, errors }, null, 1));
  await b.close(); srv.close();
})().catch((e) => { L({ step: "FAILED", error: String(e.stack || e).slice(0, 600) }); fs.writeFileSync(path.join(outDir, "normal-input.json"), JSON.stringify({ log }, null, 1)); process.exit(1); });
