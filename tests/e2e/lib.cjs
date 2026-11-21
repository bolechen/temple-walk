// What the end-to-end scenarios share: a server for app/, a browser that can draw without a GPU, and a page that records its own errors.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { site, serve: siteServe } = require("../../tools/site.cjs"), root = site(), out = path.join(__dirname, "..", "..", "tools", "out");

// The site served by tools/site.cjs's one server (#399): { base, close }.
async function serve() { const srv = await siteServe(root); return { base: srv.base, close: () => srv.close() }; }
// E2E_GPU=1 (the T4 run, tools/ci/t4-job.sh, #335) asks Chromium for the graphics card through Vulkan, as tools/gpu/job.cjs does;
// everywhere else the scenarios draw in software, which is what they were written against.
const GPU_ARGS = ["--no-sandbox", "--use-angle=vulkan", "--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE", "--disable-vulkan-surface", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-gpu-driver-bug-workarounds", "--autoplay-policy=no-user-gesture-required"];
const SOFT_ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"];
const launch = () => chromium.launch({ args: process.env.E2E_GPU ? GPU_ARGS : SOFT_ARGS });
// What this browser draws with. A run that was asked for the card and got software would be a free-machine run under a T4's name.
async function renderer(browser) {
  const p = await browser.newPage();
  try { return await p.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"); if (!g) return "no webgl2"; const e = g.getExtension("WEBGL_debug_renderer_info"); return String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER)); }); }
  finally { await p.close(); }
}

// A page on the temple. `errors` collects everything the page complains about; a scenario fails if it is not empty at the end.
async function open(browser, base, query, opts = {}) {
  const { enter, observeLoading, route, ...ctxOpts } = opts;
  // The page speaks the browser's language (src/i18n.js); the scenarios are written against the Chinese, so their
  // browser speaks Chinese unless one asks otherwise (`locale`, or ?lang=).
  const ctx = await browser.newContext({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 1, locale: "zh-CN", ...ctxOpts });
  const page = await ctx.newPage(), errors = [];
  // `window.__poseNear(x, z, yaw, pitch)`: __pose, but into a cell he may stand in. A place's ring has shut cells in it (the bell's railing, the tea table's stools), and a visitor is never put in one: he steps through
  // the floor's open cells a stride at a time, so put down in a shut one he cannot take the first step on a card that draws sixty frames a second (software rendering's longer strides jump out of it, which hid it).
  await page.addInitScript(() => { window.__poseNear = (x, z, yaw, pitch) => {
    const tries = [[0, 0]]; for (let r = 1; r <= 12; r++) for (let k = 0; k < 16; k++) tries.push([Math.cos((k * Math.PI) / 8) * r * 0.1, Math.sin((k * Math.PI) / 8) * r * 0.1]);
    for (const [dx, dz] of tries) { window.__pose(x + dx, z + dz, yaw, pitch); if (!window.__walker().blockedHere) return [dx, dz]; }
    window.__pose(x, z, yaw, pitch); return null;
  }; });
  if (opts.init) await page.addInitScript(opts.init);   // before the page's own scripts: a stub for an API, a way to hide it
  if (route) await page.route(route[0], route[1]);   // before the page asks: a file made to fail, as on a bad network
  page.on("pageerror", (e) => errors.push("page error: " + String(e.stack || e).slice(0, 400)));
  page.on("console", (m) => {
    if (m.type() !== "error" || /GPU stall/.test(m.text())) return;
    const at = m.location();
    errors.push("console: " + m.text().slice(0, 300) + (at.url ? ` (${at.url}:${at.lineNumber ?? at.line ?? 0})` : ""));
  });
  page.on("requestfailed", (r) => !/fonts\.g/.test(r.url()) && errors.push("request failed: " + r.url()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));
  if (observeLoading) await page.addInitScript(() => {
    window.__loadingHistory = [];
    new MutationObserver(() => {
      const bar = document.getElementById("loadProgress");
      if (!bar) return;
      const value = bar.hasAttribute("value") ? Number(bar.getAttribute("value")) : null;
      if (window.__loadingHistory.at(-1) !== value || !window.__loadingHistory.length) window.__loadingHistory.push(value);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });
  });
  await page.goto(base + "?" + query, { waitUntil: "commit", timeout: 120000 });   // the page builds the whole temple before it reports itself loaded
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
  // A visitor arriving meets the title first and steps in from it; a scenario may ask to be left at the title.
  if (opts.enter !== false && (await page.isVisible("#title"))) { await page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 }); await page.click("#enterBtn"); await page.waitForFunction(() => document.body.classList.contains("entered")); }
  // A first visitor is shown the mountain before the walk is theirs (src/opening.js); a scenario stepping in this way passes
  // over it as a visitor may, with Esc, and begins once the walk is handed back (the `opening` scenario watches it whole).
  if (opts.enter !== false && (await page.evaluate(() => !!window.__opening && window.__opening().active))) { await page.keyboard.press("Escape"); await page.waitForFunction(() => !window.__opening().active, null, { timeout: 120000 }); }
  // What else the page was doing when a wait gave up: the open layers, the observance, the eye's director, what the button offered.
  const why = () => page.evaluate(() => JSON.stringify({ ui: window.__ui?.()?.stack, rite: window.__journey?.()?.rite, director: window.__director?.()?.phase, act: document.getElementById("act")?.dataset.word || null, actShown: !!document.getElementById("act") && !document.getElementById("act").hidden, hint: window.__hud?.()?.said?.slice?.(-2) }));
  const t = {
    page, errors, close: () => ctx.close(),
    state: () => page.evaluate(() => window.__yard()),
    probe: () => page.evaluate(() => window.__probe()),
    journey: () => page.evaluate(() => window.__journey()),
    inHall: () => page.evaluate(() => window.__yard().inside),
    // Poll until `fn` is true; throw with the walker's state if it never is.
    async until(fn, ms, what) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await page.waitForTimeout(1200); } throw new Error(what + " | " + JSON.stringify(await t.state()) + " | " + (await why().catch(() => ""))); },
    // Poll until `fn` is true, giving up after `frames` more frames have been drawn, not after so many seconds: a page that takes a fixed number of frames to do something
    // (the great hall's doorway: about fifty, #386) takes a minute on an idle machine and several on a loaded one. `secs` is only the stop for a page that has stopped drawing.
    async untilFrames(fn, frames, what, secs = 1800) {
      const f0 = (await t.state()).frames, t0 = Date.now();
      for (;;) {
        if (await fn()) return;
        const s = await t.state();
        if (s.frames - f0 > frames) throw new Error(`${what} (after ${s.frames - f0} frames) | ${JSON.stringify(s)}`);
        if (Date.now() - t0 > secs * 1000) throw new Error(`${what} (the page drew ${s.frames - f0} frames in ${secs} s) | ${JSON.stringify(s)}`);
        await page.waitForTimeout(1200);
      }
    },
    // Poll the probe until `pred` holds of it; what a click or a key changes is applied by the next frame of the page, which a card that draws sixty a second has not yet begun when the click returns.
    async probeUntil(pred, what, ms = 60000) { let p; await t.until(async () => pred(p = await t.probe()), ms, what); return p; },
    // Let the page draw `n` more frames: under software rendering a second may hold one frame or ten.
    async frames(n) { const f0 = (await t.state()).frames; await t.until(async () => (await t.state()).frames >= f0 + n, 240000, `the page stopped drawing (wanted ${n} more frames)`); },
    // The first destination a tap sets, caught frame by frame inside the page. A poll from outside can come too late: with ?fast=1, or on a card that
    // draws sixty frames a second, a walk of a few metres is over before it has looked (#379: `taps` on the T4 read null where the free machines read the spot).
    async tapTarget(tap, what = "the tap") {
      await page.evaluate(() => { window.__tapTarget = null; const look = () => { const s = window.__yard(); if (s.target) window.__tapTarget = s.target.slice(); else requestAnimationFrame(look); }; requestAnimationFrame(look); });
      await tap();
      await t.until(() => page.evaluate(() => !!window.__tapTarget), 30000, `${what} set no destination`);
      return page.evaluate(() => window.__tapTarget);
    },
    shot: (name) => { fs.mkdirSync(out, { recursive: true }); return page.screenshot({ path: path.join(out, name + ".png"), timeout: 240000 }); },
  };
  return t;
}
function expect(cond, what) { if (!cond) throw new Error(what); }
module.exports = { serve, launch, renderer, open, expect, out };
