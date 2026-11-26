// Runs inside a Hugging Face Job that has a real graphics card: opens the temple in Chromium with the GPU,
// measures how many frames a second each quality tier really draws, and takes the pictures asked for.
//   node job.cjs <app dir> <out dir> '<json spec>'
// spec: { opening: { runs: [{ q, size, scale }] }, director: { size, q, places }, rites: { size, q }, tour: { runs, size, q, film, filmSize }, shots: ["court@autumn-dusk@third", { name, size, q }, { file, query, size, js, wait }, ...], size: [w, h], scale: 1, bench: [{ view, q, size, season, time, off, in, cam, level, body, trial, before, after }], seconds: 6 }
// `level` names the level every page is opened on (?level=, docs/t05/LEVEL-SPLIT.md S6; the prologue when it is left out).
// A bench row may name its own `level`, so that two temples are measured turn about in one job (docs/t05/PLAN.md item 13).
// `off` switches parts of the scene off (see ?off= in app/yard.js), to learn what each costs.
const { chromium } = require("playwright");
const { serve } = require(require("fs").existsSync(require("path").join(__dirname, "site.cjs")) ? "./site.cjs" : "../site.cjs");   // staged beside it by gpu-render.sh, or in the checkout
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const [root, out, specArg = "{}"] = process.argv.slice(2);
const spec = JSON.parse(specArg.trim().startsWith("{") ? specArg : Buffer.from(specArg, "base64").toString("utf8"));   // the launcher sends it as base64: a job's variables are single lines
const sh = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "pipe"], timeout: 20000 }).toString().trim(); } catch (e) { return "(failed) " + String(e.stderr || e.message).slice(0, 200); } };

// Ways of asking Chromium for the graphics card, most direct first. The first that reports a real GPU is used.
const FLAGS = {
  "angle-vulkan": ["--use-angle=vulkan", "--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE", "--disable-vulkan-surface"],
  "angle-egl": ["--use-gl=angle", "--use-angle=gl-egl"],
  "egl": ["--use-gl=egl"],
  "swiftshader": ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
};
// #183: the workbench's addresses (?terrain=) are read only on a preview's hostname, so such a page is opened at this
// name, mapped to the local server, with the debug panel kept shut so that it costs nothing (src/debuggate.js).
const BENCH_HOST = "pr-0-temple-walk-preview.test";
const COMMON = [`--host-resolver-rules=MAP ${BENCH_HOST} 127.0.0.1`, "--no-sandbox", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--autoplay-policy=no-user-gesture-required", "--enable-webgl", "--disable-gpu-driver-bug-workarounds"];

// The site the job was handed, in a form a report can be checked against later: the commit it was built from (as the
// launcher says, with "+dirty" if app/ had changes not committed), the bundled entry the page loads (its name carries
// the build's hash), and one SHA-256 over every file's path and contents.
function fingerprint(dir) {
  const crypto = require("crypto"), files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } };
  walk(dir);
  const all = crypto.createHash("sha256");
  for (const f of files) all.update(path.relative(dir, f) + "\0" + crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex") + "\n");
  const html = fs.existsSync(path.join(dir, "index.html")) ? fs.readFileSync(path.join(dir, "index.html"), "utf8") : "";
  return { commit: process.env.COMMIT || null, entry: (html.match(/assets\/index-[\w-]+\.js/) || [null])[0], files: files.length, sha256: all.digest("hex") };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const report = { started: new Date().toISOString(), host: { gpu: sh("nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader"), cpu: sh("nproc"), egl: sh("ls /usr/share/glvnd/egl_vendor.d 2>&1"), vulkan: sh("ls /usr/share/vulkan/icd.d /etc/vulkan/icd.d 2>&1"), libs: sh("ldconfig -p | grep -i -E 'nvidia|libEGL|libvulkan' | cut -c1-90 | head -30"), dev: sh("ls /dev | grep -i -E 'nvidia|dri' ; ls /dev/dri 2>&1") }, tried: {}, bench: [], shots: [], errors: [] };
  let srv;
  srv = await serve(root); const base = `http://127.0.0.1:${srv.address().port}/`;

  let browser = null, how = null, launchWith = null;
  pick: for (const [name, flags] of Object.entries(FLAGS)) for (const channel of ["chromium", undefined]) {
    const key = name + (channel ? "+new-headless" : "+headless-shell"); let b = null;
    try {
      b = await chromium.launch({ channel, args: [...COMMON, ...flags] });
      const p = await b.newPage(); await p.goto(base + "favicon.svg");   // any same-origin page that is not the app will do. It must exist and be shown as a document (a script is, as text; a file this server sends as a download is not), or this flavour is passed over and the frame rates are no longer comparable
      const gl = await p.evaluate(() => { const c = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas")   /* the probe page is an SVG document, where createElement makes an SVG element */, g = c.getContext("webgl2"); if (!g) return "no webgl2"; const e = g.getExtension("WEBGL_debug_renderer_info"); return String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER)); });
      report.tried[key] = gl; await p.close();
      if ((/NVIDIA|Tesla|GeForce|RTX|Quadro|AMD|Radeon/i.test(gl) && !/SwiftShader|llvmpipe/i.test(gl)) || name === "swiftshader") { browser = b; how = key; launchWith = { channel, args: [...COMMON, ...flags] }; break pick; }
      await b.close();
    } catch (e) { report.tried[key] = "launch failed: " + String(e.message).split("\n")[0].slice(0, 160); if (b) await b.close().catch(() => {}); }
  }
  report.site = fingerprint(root);   // whose code drew these pictures: every file the job was handed, hashed, and the page's bundled entry
  report.using = how; report.renderer = report.tried[how]; console.log("renderer:", how, "→", report.renderer);
  const save = () => fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  save();
  if (!browser) { console.log("no browser could be started"); process.exit(1); }

  // `fresh`: a browser of its own, started for this page and closed with it, so that nothing (compiled shaders, the GPU
  // process's first uploads) is left warm by an earlier page: a visitor's first visit.
  const open = async (query, [w, h], scale = 1, { fresh = false, path: at = "", ...extra } = {}) => {   // `path`: a page beside the site's own (another build staged under it, BASE_SITE)
    const own = fresh ? await chromium.launch(launchWith) : null;
    const ctx = await (own || browser).newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, ...extra }), page = await ctx.newPage();
    if (own) { const close = ctx.close.bind(ctx); ctx.close = async () => { await close().catch(() => {}); await own.close(); }; }
    // The hall's statue is deliberately not sent to the job, so its absence is not an error here.
    const ours = (t) => !/hall\.js|plate\.webp|\/m\/|404|Failed to load resource|Failed to fetch dynamically/.test(t);
    // An error printed by a library says what went wrong but not for which thing: keep where it was called from as well.
    await page.addInitScript(() => { const say = console.error; console.error = (...a) => say(...a, "\n  at " + (new Error().stack || "").split("\n").slice(2, 8).map((l) => l.trim().replace(/^at /, "").replace(/https?:\/\/[^/]+\//, "")).join(" < ")); });
    page.on("pageerror", (e) => ours(String(e.message)) && report.errors.push(String(e.message).slice(0, 300)));
    page.on("console", (m) => m.type() === "error" && ours(m.text()) && report.errors.push(m.text().slice(0, 900)));
    const bench = /(^|&)(terrain=|hall=open)/.test(query), home = bench ? base.replace("127.0.0.1", BENCH_HOST) : base; if (bench && !/(^|&)debug=/.test(query)) query += "&debug=0";
    const t0 = Date.now(); await page.goto(home + at + "?" + query + (spec.level && spec.level !== "t00" && !/(^|&)level=/.test(query) ? "&level=" + encodeURIComponent(spec.level) : ""), { waitUntil: "commit", timeout: 120000 });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    return { ctx, page, loadMs: Date.now() - t0 };
  };
  const q = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${v}`).join("&");

  // How fast does it really draw? Time runs, nothing is frozen, and the governor is held off by fixing the tier.
  for (const b of spec.bench || []) {
    const size = b.size || [1920, 1080], secs = spec.seconds || 6;
    try {
      const { ctx, page, loadMs } = await open(q({ q: b.q, show: b.view, view: b.as || "third", season: b.season, time: b.time, off: b.off, in: b.in, cam: b.cam, walker: b.walker, enter: b.enter, doorsync: b.doorsync, terrain: b.terrain, body: b.body, trial: b.trial, level: b.level }), size, b.scale || 1, { path: b.path || "" });
      await page.waitForTimeout(b.warm || 1500);   // `warm`: longer, for what is taken in its first seconds (the doorways, #218)
      if (b.before) await page.evaluate(`(async () => { ${b.before} })()`);   // `before`: a script run before the frames are counted (the ground filled with what has fallen, #267)
      // (#161) `walk`: he walks these points while the frames are counted, so that the walker is asked what it is asked in play
      if (b.walk) await page.evaluate((pts) => { window.__walkerReset?.(); window.__walk(pts); }, b.walk);
      const a = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now() })); await page.waitForTimeout(secs * 1000);
      const z = await page.evaluate(() => ({ f: window.__yard().frames, t: performance.now(), y: window.__yard(), buf: [document.getElementById("yardGl").width, document.getElementById("yardGl").height], walker: window.__walker ? window.__walker() : null, doors: window.__doorways ? window.__doorways() : null }));
      if (z.walker) z.walker.msPerFrame = +(z.walker.ms / Math.max(1, z.f - a.f)).toFixed(4);
      const cost = await page.evaluate(() => (window.__cost ? window.__cost(40) : null));   // drawing alone, without the browser's presenting
      const fps = +(((z.f - a.f) * 1000) / (z.t - a.t)).toFixed(1), row = { ...b, size, fps, ms: +(1000 / Math.max(fps, 0.01)).toFixed(2), cost, loadMs, tris: z.y.tris, calls: z.y.calls, buffer: z.buf, tier: z.y.tier, body: z.y.body, walker: z.walker, doors: z.doors, at: [z.y.x, z.y.z] };   // doors: the rooms seen through the doors (#218)
      if (b.after) row.after = await page.evaluate(`(async () => { ${b.after} })()`).catch((e) => ({ error: String(e.message).slice(0, 200) }));   // `after`: a script run once the frames are counted, its answer kept (the doorways' retake on a change of hour, #218)
      report.bench.push(row); console.log("bench", JSON.stringify(row)); await ctx.close();
    } catch (e) { report.bench.push({ ...b, error: String(e.message).slice(0, 200) }); console.log("bench failed", b, String(e.message).slice(0, 200)); }
    save();
  }
  // The opening after 入山 (app/src/opening.js, issue #110): a first visitor's page (nothing named in the address), 入山
  // clicked, and every frame's time from the click to the hand-over, apart for the wait on the first picture (`hold`) and
  // the way down (`fly`), with how long the eye waited before it moved. spec.opening = { runs: [{ q, size, scale }], film }.
  // Compare with `bench` rows of the first court measured in the same job (frame times differ 2–3 ms between jobs).
  if (spec.opening) {
    const log = (report.opening = { runs: [] });
    for (const R of spec.opening.runs || [{ q: "high", size: [1920, 1080] }]) {
      const size = R.size || [1920, 1080], row = { q: R.q, size, scale: R.scale || 1 };
      try {
        row.off = R.off || "";
        const { ctx, page, loadMs } = await open(q({ q: R.q, season: R.season || "summer", time: R.time || "day", off: R.off }), size, R.scale || 1);
        row.loadMs = loadMs; const ev = (f, a) => page.evaluate(f, a);
        await page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 });
        await ev(() => { window.__ft = []; window.__ph = []; const f = (t) => { window.__ft.push(t); window.__ph.push(window.__opening ? window.__opening().phase : "?"); requestAnimationFrame(f); }; requestAnimationFrame(f); });
        const t0 = Date.now(); await page.click("#enterBtn");
        while (Date.now() - t0 < 120000) { if (await ev(() => window.__opening().phase === "done")) break; await page.waitForTimeout(100); }
        row.took_ms = Date.now() - t0; row.state = await ev(() => window.__opening());
        row.frames = await ev(() => {
          const t = window.__ft, ph = window.__ph, start = ph.findIndex((p) => p === "hold");
          const part = (which) => { const d = []; for (let k = Math.max(1, start + 1); k < t.length; k++) if (which.includes(ph[k])) d.push(t[k] - t[k - 1]); if (!d.length) return null; const s = d.slice().sort((a, b) => a - b), mean = d.reduce((a, b) => a + b, 0) / d.length; return { frames: d.length, fps: +(1000 / mean).toFixed(1), mean_ms: +mean.toFixed(2), p95_ms: +s[Math.floor(s.length * 0.95)].toFixed(2), max_ms: +s[s.length - 1].toFixed(2), over40: d.filter((x) => x > 40).length }; };
          return { hold: part(["hold"]), fly: part(["fly", "skip"]), all: part(["hold", "fly", "skip"]) };
        });
        console.log("opening", JSON.stringify(row)); await ctx.close();
      } catch (e) { row.error = String(e.message).slice(0, 300); console.log("opening failed", row.error); }
      log.runs.push(row); save();
    }
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
  // A script the launcher staged beside this file (spec.script, spec.args): it gets `open` and the output folder, and draws
  // its own frames (tools/marketing-film.cjs, run by tools/marketing-gpu.sh).
  if (spec.script) {
    const a = spec.args || {};
    try { report.script = { name: spec.script, timeline: await require(path.resolve(__dirname, spec.script)).run({ ...a, open, out: path.join(out, a.out || "film"), log: (...m) => console.log(...m) }) }; }
    catch (e) { report.script = { name: spec.script, error: String(e.stack || e.message).slice(0, 600) }; console.log("script failed", report.script.error); }
    save();
  }
  // The pictures: a named view, optionally a season and hour and a point of view, drawn large.
  // A picture is a named view ("court@autumn-dusk@third"); or { name, size, q }, a named view drawn at its own size or tier
  // (the 2.39:1 art views beside 16:9 ones; a tier other than the spec's is added to the file's name); or an object for
  // anything else: { file, query, size, js, wait }, where `query` is the page's address after "?" (e.g. a ?cam= that no
  // named view has) and `js`, if given, is run in the page (it may return a promise) before the picture is taken.
  for (const shot of spec.shots || []) {
    const free = typeof shot === "object" && !!shot.file, named = typeof shot === "object" && !free, name = free ? shot.file : named ? shot.name : shot;
    const [view, when = "", as = ""] = free ? [] : name.split("@"), [season, time] = when.split("-"), size = (typeof shot === "object" && shot.size) || spec.size || [1920, 1080], tier = (named && shot.q) || spec.q || "high";
    try {
      const { ctx, page } = await open(free ? shot.query : q({ shot: 1, q: tier, show: view, season, time, view: as }), size, spec.scale || 1, { path: (typeof shot === "object" && shot.path) || "" });   // `path` (a free shot's or a named one's): the same page of the build staged beside the site's own (BASE_SITE), to draw a picture before and after in one job; a named shot's file then carries `_base`
      await page.waitForTimeout(free && shot.wait ? shot.wait : 800);
      const jsResult = free && shot.js ? await page.evaluate(shot.js) : undefined;   // what `js` returns is kept in the report beside the picture
      const file = (free ? name : name.replace(/@/g, "_") + (named && shot.q ? "_" + shot.q : "") + (named && shot.path ? "_base" : "")) + ".png"; await page.screenshot({ path: path.join(out, file), timeout: 120000 });
      const y = await page.evaluate(() => window.__yard()); report.shots.push({ name, file, tris: y.tris, calls: y.calls, ...(jsResult !== undefined ? { js: jsResult } : {}) }); console.log("shot", file); await ctx.close();
    } catch (e) { report.shots.push({ name, error: String(e.message).slice(0, 200) }); console.log("shot failed", name, String(e.message).slice(0, 200)); }
    save();
  }
  // What filming costs (#342, app/src/clip.js): the raised camera's frame interval with no film and with one being made,
  // turn about in this one job (`runs` times each), so that the card and the browser are the same for both.
  // spec.clip = { size, q, runs, secs, ms, aspect }: `ms` is how long each interval is measured, `secs` how long the film runs.
  if (spec.clip) {
    const C = spec.clip, size = C.size || [1920, 1080], runs = C.runs || 3, ms = C.ms || 6000, log = (report.clip = { size, q: C.q || "high", aspect: C.aspect || "tall", ms, off: [], same: [], on: [], files: [] });
    try {
      const { ctx, page } = await open(q({ q: C.q || "high", enter: 1, view: "third", season: "summer", time: "day" }), size, 1);
      await page.waitForTimeout(4000);
      await page.evaluate((a) => { window.__photo(true); document.querySelector(`[data-aspect="${a}"]`)?.click(); }, C.aspect || "tall"); await page.waitForTimeout(1500);
      const info = await page.evaluate(() => window.__clip()); log.supported = info.supported; log.mime = info.mime;
      const probe = (n) => page.evaluate((n) => new Promise((res) => { const d = []; let p = performance.now(); const end = p + n; const f = (t) => { d.push(t - p); p = t; if (t < end) requestAnimationFrame(f); else { d.shift(); d.sort((a, b) => a - b); const m = d.reduce((a, b) => a + b, 0) / d.length; res({ frames: d.length, mean: +m.toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), max: +d[d.length - 1].toFixed(2) }); } }; requestAnimationFrame(f); }), n);
      for (let i = 0; i < runs; i++) {
        log.off.push(await probe(ms));
        await page.evaluate((sh) => window.__clip({ layout: true, short: sh }), C.short || 0); await page.waitForTimeout(800); log.same.push(await probe(ms)); await page.evaluate(() => window.__clip({ layout: false })); await page.waitForTimeout(800);   // the same size and place, nothing recorded
        await page.evaluate(([s, sh, d]) => window.__clip({ start: true, secs: s, short: sh, dry: d }), [C.secs || Math.ceil(ms / 1000) + 4, C.short || 0, !!C.dry]);
        await page.waitForFunction(() => window.__clip().drawn > 5, null, { timeout: 60000 });
        log.on.push(await probe(ms));
        await page.waitForFunction(() => window.__clip().last != null, null, { timeout: 120000, polling: 500 });
        log.files.push(await page.evaluate(() => window.__clip().last)); await page.evaluate(() => document.getElementById("clipBack").click()); await page.waitForTimeout(500);
        console.log("clip run", i + 1, JSON.stringify({ off: log.off[i], same: log.same[i], on: log.on[i], file: log.files[i] })); save();
      }
      await ctx.close();
    } catch (e) { log.error = String(e.message).slice(0, 300); console.log("clip failed", log.error); }
    save();
  }
  report.finished = new Date().toISOString(); report.errors = [...new Set(report.errors)].slice(0, 20); save();
  await browser.close(); srv.close(); console.log("done:", report.bench.length, "measurements,", report.shots.length, "pictures,", report.errors.length, "page errors");
})().catch((e) => { console.error(e); process.exit(1); });
