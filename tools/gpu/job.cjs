// Runs inside a Hugging Face Job that has a real graphics card: opens the temple in Chromium with the GPU,
// measures how many frames a second each quality tier really draws, and takes the pictures asked for.
//   node job.cjs <app dir> <out dir> '<json spec>'
// spec: { director: { size, q, places }, rites: { size, q }, tour: { runs, size, q, film, filmSize }, shots: ["court@autumn-dusk@third", { file, query, size, js, wait }, ...], size: [w, h], scale: 1, bench: [{ view, q, size, season, time, off, in, cam }], seconds: 6 }
// `off` switches parts of the scene off (see ?off= in app/yard.js), to learn what each costs.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const [root, out, specArg = "{}"] = process.argv.slice(2);
const spec = JSON.parse(specArg.trim().startsWith("{") ? specArg : Buffer.from(specArg, "base64").toString("utf8"));   // the launcher sends it as base64: a job's variables are single lines
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".glb": "model/gltf-binary", ".ktx2": "image/ktx2", ".wasm": "application/wasm", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const sh = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "pipe"], timeout: 20000 }).toString().trim(); } catch (e) { return "(failed) " + String(e.stderr || e.message).slice(0, 200); } };

// Ways of asking Chromium for the graphics card, most direct first. The first that reports a real GPU is used.
const FLAGS = {
  "angle-vulkan": ["--use-angle=vulkan", "--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE", "--disable-vulkan-surface"],
  "angle-egl": ["--use-gl=angle", "--use-angle=gl-egl"],
  "egl": ["--use-gl=egl"],
  "swiftshader": ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
};
const COMMON = ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--autoplay-policy=no-user-gesture-required", "--enable-webgl", "--disable-gpu-driver-bug-workarounds"];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const report = { started: new Date().toISOString(), host: { gpu: sh("nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader"), cpu: sh("nproc"), egl: sh("ls /usr/share/glvnd/egl_vendor.d 2>&1"), vulkan: sh("ls /usr/share/vulkan/icd.d /etc/vulkan/icd.d 2>&1"), libs: sh("ldconfig -p | grep -i -E 'nvidia|libEGL|libvulkan' | cut -c1-90 | head -30"), dev: sh("ls /dev | grep -i -E 'nvidia|dri' ; ls /dev/dri 2>&1") }, tried: {}, bench: [], shots: [], errors: [] };
  const srv = http.createServer((req, res) => {
    let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}   // a bad escape, or a path that climbs out of the app, is not served
    if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${srv.address().port}/`;

  let browser = null, how = null;
  pick: for (const [name, flags] of Object.entries(FLAGS)) for (const channel of ["chromium", undefined]) {
    const key = name + (channel ? "+new-headless" : "+headless-shell"); let b = null;
    try {
      b = await chromium.launch({ channel, args: [...COMMON, ...flags] });
      const p = await b.newPage(); await p.goto(base + "favicon.svg");   // any same-origin page that is not the app will do. It must exist and be shown as a document (a script is, as text; a file this server sends as a download is not), or this flavour is passed over and the frame rates are no longer comparable
      const gl = await p.evaluate(() => { const c = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas")   /* the probe page is an SVG document, where createElement makes an SVG element */, g = c.getContext("webgl2"); if (!g) return "no webgl2"; const e = g.getExtension("WEBGL_debug_renderer_info"); return String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER)); });
      report.tried[key] = gl; await p.close();
      if ((/NVIDIA|Tesla|GeForce|RTX|Quadro|AMD|Radeon/i.test(gl) && !/SwiftShader|llvmpipe/i.test(gl)) || name === "swiftshader") { browser = b; how = key; break pick; }
      await b.close();
    } catch (e) { report.tried[key] = "launch failed: " + String(e.message).split("\n")[0].slice(0, 160); if (b) await b.close().catch(() => {}); }
  }
  report.using = how; report.renderer = report.tried[how]; console.log("renderer:", how, "→", report.renderer);
  const save = () => fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  save();
  if (!browser) { console.log("no browser could be started"); process.exit(1); }

  const open = async (query, [w, h], scale = 1, extra = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, ...extra }), page = await ctx.newPage();
    // The hall's statue is deliberately not sent to the job, so its absence is not an error here.
    const ours = (t) => !/hall\.js|plate\.webp|\/m\/|404|Failed to load resource|Failed to fetch dynamically/.test(t);
    // An error printed by a library says what went wrong but not for which thing: keep where it was called from as well.
    await page.addInitScript(() => { const say = console.error; console.error = (...a) => say(...a, "\n  at " + (new Error().stack || "").split("\n").slice(2, 8).map((l) => l.trim().replace(/^at /, "").replace(/https?:\/\/[^/]+\//, "")).join(" < ")); });
    page.on("pageerror", (e) => ours(String(e.message)) && report.errors.push(String(e.message).slice(0, 300)));
    page.on("console", (m) => m.type() === "error" && ours(m.text()) && report.errors.push(m.text().slice(0, 900)));
    const t0 = Date.now(); await page.goto(base + "?" + query, { waitUntil: "commit", timeout: 120000 });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    return { ctx, page, loadMs: Date.now() - t0 };
  };
  const q = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${v}`).join("&");

  // How fast does it really draw? Time runs, nothing is frozen, and the governor is held off by fixing the tier.
  for (const b of spec.bench || []) {
    const size = b.size || [1920, 1080], secs = spec.seconds || 6;
    try {
      const { ctx, page, loadMs } = await open(q({ q: b.q, show: b.view, view: b.as || "third", season: b.season, time: b.time, off: b.off, in: b.in, cam: b.cam }), size, b.scale || 1);
      await page.waitForTimeout(1500);
      const a = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now() })); await page.waitForTimeout(secs * 1000);
      const z = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now(), y: window.__yard(), buf: [document.getElementById("yardGl").width, document.getElementById("yardGl").height] }));
      const cost = await page.evaluate(() => (window.__cost ? window.__cost(40) : null));   // drawing alone, without the browser's presenting
      const fps = +(((z.f - a.f) * 1000) / (z.t - a.t)).toFixed(1), row = { ...b, size, fps, ms: +(1000 / Math.max(fps, 0.01)).toFixed(2), cost, loadMs, tris: z.y.tris, calls: z.y.calls, buffer: z.buf, tier: z.y.tier };
      report.bench.push(row); console.log("bench", JSON.stringify(row)); await ctx.close();
    } catch (e) { report.bench.push({ ...b, error: String(e.message).slice(0, 200) }); console.log("bench failed", b, String(e.message).slice(0, 200)); }
    save();
  }
  // The measured walk (app/src/tour.js) and a film of it: spec.tour = { runs: "120x3", size: [1920, 1080], q: "high", film: 95, filmSize: [960, 540] }.
  // The numbers and the film come from separate passes, so that recording does not slow what is being measured.
  if (spec.tour) {
    const T = spec.tour, size = T.size || [1920, 1080], query = (runs) => `tour=${runs}&enter&view=first&q=${T.q || "high"}&season=summer&time=day`;
    try {
      const { ctx, page, loadMs } = await open(query(T.runs || "120x3"), size, 1);
      await page.waitForFunction(() => window.__tour().done, null, { timeout: 900000, polling: 2000 });
      const r = await page.evaluate(() => window.__tour().result);
      r.environment = { host_gpu: report.host.gpu, browser: browser.version(), how: report.using, renderer: report.renderer, headless: true, vsync: "off (--disable-gpu-vsync --disable-frame-rate-limit)", page_load_ms: loadMs };
      fs.writeFileSync(path.join(out, "performance.json"), JSON.stringify(r, null, 1));
      fs.writeFileSync(path.join(out, "frame-times.csv"), "run,frame,ms\n" + r.runs.map((x, i) => x.frame_ms.map((ms, k) => `${i + 1},${k},${ms}`).join("\n")).join("\n") + "\n");
      report.tour = r.runs.map(({ frame_ms, ...x }) => x); console.log("tour", JSON.stringify(report.tour)); await ctx.close();
    } catch (e) { report.tour = { error: String(e.message).slice(0, 300) }; console.log("tour failed", report.tour.error); }
    save();
    if (T.film) try {
      const fs2 = T.filmSize || [960, 540], { ctx, page } = await open(query(`${T.film}x1`), fs2, 1, { recordVideo: { dir: out, size: { width: fs2[0], height: fs2[1] } } });
      await page.waitForFunction(() => window.__tour().done, null, { timeout: 600000, polling: 2000 });
      const v = page.video(); await ctx.close(); const from = await v.path(); fs.renameSync(from, path.join(out, "walkthrough.webm")); report.film = { file: "walkthrough.webm", seconds: T.film + 10, size: fs2 }; console.log("film", fs.statSync(path.join(out, "walkthrough.webm")).size);
    } catch (e) { report.film = { error: String(e.message).slice(0, 300) }; console.log("film failed", report.film.error); }
    fs.writeFileSync(path.join(out, "console.txt"), (report.errors.length ? report.errors.join("\n") : "no page errors, console errors or failed requests during the walk") + "\n");
    save();
  }
  // The eye going to each place's own shot and back (app/src/director.js): frame times while he stands at the place
  // with the eye following him, while it swings to the shot, while it rests there, and while it swings home after a
  // step. spec.director = { size, q, places: ["lamp", "bell", "tea", "sutra", "sit"], sound: true }. He is put beside each
  // with __pose (diagnostic); the observance is begun with E and left with W (Esc for the bell and the tea, E to take the library's slip).
  if (spec.director) {
    const R = spec.director, size = R.size || [1920, 1080], log = (report.director = { size, q: R.q || "high", places: [] });
    try {
      const { ctx, page } = await open(q({ q: R.q || "high", enter: 1, view: "third", season: "summer", time: "day" }), size, 1);
      const ev = (f, a) => page.evaluate(f, a);
      // A visitor's first tap lets the place be heard (the sound starts, its reverbs are made); keys alone never do. Here
      // that happens before anything is measured, as it has for anyone who has walked up to an observance.
      if (R.sound !== false) { await ev(() => window.__music?.(true)); await page.waitForTimeout(1500); }
      await ev(() => { window.__ft = []; const f = (t) => { window.__ft.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const until = async (f, ms, what) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return Date.now() - t; await page.waitForTimeout(10); } throw new Error(what); };
      const mark = () => ev(() => window.__ft.length);
      const stats = (a, b) => ev(([i, j]) => { const t = window.__ft.slice(i, j), raw = t.slice(1).map((v, k) => v - t[k]), d = raw.slice().sort((x, y) => x - y); if (!d.length) return null; const at = raw.indexOf(d[d.length - 1]); const mean = d.reduce((x, y) => x + y, 0) / d.length; return { frames: d.length, fps: +(1000 / mean).toFixed(1), mean_ms: +mean.toFixed(2), p95_ms: +d[Math.floor(d.length * 0.95)].toFixed(2), max_ms: +d[d.length - 1].toFixed(2), max_frame: at, max_at_ms: +(t[at + 1] - t[0]).toFixed(0) }; }, [a, b]);
      for (const id of R.places || ["lamp", "bell", "tea", "sutra", "sit"]) {   // (not the well: its shot waits for #99)
        const row = { id };
        try {
          await ev((k) => { const p = window.__places[k]; window.__pose(p.at[0] + (k === "bell" ? 0.3 : 0.1), p.at[1] + (k === "bell" ? -0.3 : 0.1), Math.PI - p.face, 0.05); }, id);
          await until(() => ev(() => { const b = document.getElementById("act"); return b && !b.hidden && !!b.dataset.word; }), 30000, "nothing offered");
          await page.waitForTimeout(1500); let m0 = await mark(); await page.waitForTimeout(2500); row.following = await stats(m0, await mark());
          await page.keyboard.press("e"); await until(() => ev(() => window.__director().phase !== "idle"), 20000, "the eye never left him");
          m0 = await mark(); await until(() => ev(() => window.__director().phase === "hold"), 20000, "never reached the shot"); row.swing_in = await stats(m0, await mark());
          row.how_in = await ev(() => { const d = window.__director(); return { cuts: d.cuts, blends: d.blends, why: d.why, in: d.in }; });
          m0 = await mark(); await page.waitForTimeout(2000); row.on_shot = await stats(m0, await mark());
          // The line is held out on a slip of paper, a sheet over the walk: nothing walks him away until it is taken (E).
          if (id === "sutra") await until(() => ev(() => window.__ui().stack.includes("slip")), 20000, "the slip was never held out");
          const key = id === "bell" || id === "tea" ? "Escape" : id === "sutra" ? "e" : "w";
          if (key === "w") await page.keyboard.down("w"); else await page.keyboard.press(key);
          m0 = await mark(); await until(() => ev(() => window.__director().phase === "idle"), 20000, "never came home"); row.swing_out = await stats(m0, await mark());
          if (key === "w") await page.keyboard.up("w");
          row.turn_max_deg = await ev(() => window.__director().turnMax);
          await until(() => ev(() => window.__journey().rite === null), 20000, "the observance did not end");
          await page.waitForTimeout(800);
        } catch (e) { row.error = String(e.message).slice(0, 200); row.state = await ev(() => ({ d: window.__director(), rite: window.__journey().rite, where: window.__yard() && [window.__yard().x, window.__yard().z] })).catch(() => null); }
        log.places.push(row); console.log("director", JSON.stringify(row)); save();
      }
      await ctx.close();
    } catch (e) { log.error = String(e.message).slice(0, 300); console.log("director failed", log.error); }
    save();
  }
  // The bell and the tea at a visitor's pace, by real key presses, on a card that draws as fast as a visitor's would:
  // when each press is heard, whether a press made while the log still swings back is one more stroke, and how he sits
  // on after his tea. He is put beside each with __pose (diagnostic); everything after that is the keyboard.
  if (spec.rites) {
    const R = spec.rites, size = R.size || [1280, 720], log = (report.rites = { size, steps: [] }), note = (what, o = {}) => { log.steps.push({ ms: Date.now() - t00, what, ...o }); console.log("rites", what, JSON.stringify(o)); };
    let t00 = Date.now();
    try {
      const { ctx, page } = await open(q({ q: R.q || "high", enter: 1, view: "third", season: "summer", time: "day" }), size, 1, { recordVideo: { dir: out, size: { width: size[0], height: size[1] } } });
      const ev = (f, a) => page.evaluate(f, a), word = () => ev(() => { const b = document.getElementById("act"); return b && !b.hidden ? b.dataset.word : null; });
      const until = async (f, ms, what) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return Date.now() - t; await page.waitForTimeout(20); } throw new Error(what); };
      const fps = async () => { const f0 = await ev(() => window.__yard().frames), c = Date.now(); await page.waitForTimeout(3000); return +(((await ev(() => window.__yard().frames)) - f0) / ((Date.now() - c) / 1000)).toFixed(1); };
      t00 = Date.now();
      await ev(() => { const p = window.__places.bell; window.__pose(p.at[0] + 0.3, p.at[1] - 0.3, Math.PI, 0.05); }); note("diagnostic: __pose beside the bell");
      await until(async () => (await word()) === "撞钟", 30000, "撞钟 not offered"); note("frame rate at the bell", { fps: await fps() });
      const st = () => ev(() => ({ strikes: window.__journey().strikes, pulls: window.__rites().bell.pulls, ready: window.__rites().bell.ready, faint: document.getElementById("act").classList.contains("wait") }));
      let t = Date.now(); await page.keyboard.press("e"); note("key E (first press)");
      await until(async () => (await st()).strikes === 1, 30000, "no first stroke"); note("stroke 1 heard", { afterPress: Date.now() - t });
      await page.waitForTimeout(300); const before = await st(); await page.keyboard.press("e"); note("key E 0.3 s after the stroke, while the log swings back", before);
      await page.waitForTimeout(2500); note("2.5 s after the early press", await st());
      for (const n of [2, 3]) {
        const w = await until(async () => (await st()).ready, 20000, "the rope never came back"); note("rope back in hand", { waited: w });
        await page.waitForTimeout(n === 2 ? 1500 : 4000); t = Date.now(); const p0 = (await st()).pulls; await page.keyboard.press("e"); note(`key E (stroke ${n})`);
        await until(async () => (await st()).pulls > p0, 20000, `stroke ${n}`); note(`stroke ${n} heard`, { afterPress: Date.now() - t, ...(await st()), sealed: await ev(() => !!window.__journey().seals.bell) });
      }
      await page.screenshot({ path: path.join(out, "rites-bell.png") });
      await page.waitForTimeout(6000); note("6 s with no press", await st());
      t = Date.now(); await page.keyboard.press("Escape"); await until(async () => (await ev(() => window.__rites().bell.grip)) === 0, 10000, "never let go"); note("Esc let go", { afterPress: Date.now() - t, button: await word() });
      await ev(() => { const p = window.__places.tea; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, Math.PI, 0.05); }); note("diagnostic: __pose beside the tea");
      await until(async () => (await word()) === "吃茶", 30000, "吃茶 not offered"); t = Date.now(); await page.keyboard.press("e"); note("key E (吃茶)");
      await until(async () => (await ev(() => window.__journey().seals.tea)) > 0, 90000, "no seal for tea"); note("tea drunk, seal", { afterPress: Date.now() - t, button: await word() });
      const looks = []; const c0 = Date.now(); while (Date.now() - c0 < 20000) { looks.push(await ev(() => window.__rites().look)); await page.waitForTimeout(250); }
      note("sat on 20 s", { look: [Math.min(...looks), Math.max(...looks)], music: await ev(() => { const m = window.__music && window.__music(); return m ? { hushed: m.hushed, duck: m.duck } : null; }), fps: await fps() });
      await page.screenshot({ path: path.join(out, "rites-tea.png") });
      t = Date.now(); await page.keyboard.press("e"); await until(async () => !(await ev(() => window.__yard().staged)), 10000, "did not stand"); note("key E (起身): standing", { afterPress: Date.now() - t });
      const v = page.video(); await ctx.close(); if (v) fs.renameSync(await v.path(), path.join(out, "rites.webm"));
    } catch (e) { log.error = String(e.message).slice(0, 300); console.log("rites failed", log.error); }
    save();
  }
  // The pictures: a named view, optionally a season and hour and a point of view, drawn large.
  // A picture is a named view ("court@autumn-dusk@third"), or an object for anything else: { file, query, size, js, wait },
  // where `query` is the page's address after "?" (e.g. a ?cam= that no named view has) and `js`, if given, is run in the
  // page (it may return a promise) before the picture is taken.
  for (const shot of spec.shots || []) {
    const free = typeof shot === "object", name = free ? shot.file : shot;
    const [view, when = "", as = ""] = free ? [] : name.split("@"), [season, time] = when.split("-"), size = (free && shot.size) || spec.size || [1920, 1080];
    try {
      const { ctx, page } = await open(free ? shot.query : q({ shot: 1, q: spec.q || "high", show: view, season, time, view: as }), size, spec.scale || 1);
      await page.waitForTimeout(free && shot.wait ? shot.wait : 800);
      if (free && shot.js) await page.evaluate(shot.js);
      const file = free ? name + ".png" : name.replace(/@/g, "_") + ".png"; await page.screenshot({ path: path.join(out, file), timeout: 120000 });
      const y = await page.evaluate(() => window.__yard()); report.shots.push({ name, file, tris: y.tris, calls: y.calls }); console.log("shot", file); await ctx.close();
    } catch (e) { report.shots.push({ name, error: String(e.message).slice(0, 200) }); console.log("shot failed", name, String(e.message).slice(0, 200)); }
    save();
  }
  report.finished = new Date().toISOString(); report.errors = [...new Set(report.errors)].slice(0, 20); save();
  await browser.close(); srv.close(); console.log("done:", report.bench.length, "measurements,", report.shots.length, "pictures,", report.errors.length, "page errors");
})().catch((e) => { console.error(e); process.exit(1); });
