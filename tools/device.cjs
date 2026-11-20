// Real-device measurement for temple-walk (issue #188).
//
// One command, on a Mac with an Android phone on USB, measures the published
// site on that phone and writes tools/out/device/<run>/report.json plus
// screenshots. The numbers are a baseline for one phone on one day, not a
// merge gate: CI cannot run this, and one phone says nothing about slower
// Android phones or iPhones.
//
//   node tools/device.cjs [--site URL] [--out DIR] [--parts cold,hot,tour-low,tour-medium,mem,touch,heat]
//
// Defaults: --site https://temple.rushiwowen.co/ ; --out
// tools/out/device/device-<YYYY-MM-DD-HHMM>/ ; --parts all. A part list runs
// only those parts (e.g. --parts cold,hot,mem for the load + memory numbers).
//
// Method notes (learned the hard way, 2026-11-18/19 — keep them true):
// - Chrome must be in the phone's foreground. If the user switches to another
//   app (e.g. Facebook), connectOverCDP times out: the websocket connects but
//   the browser handshake stalls, and /json/list comes back empty. This script
//   brings Chrome forward at the start; if it still cannot connect, it says
//   so in plain words instead of a stack trace.
// - Playwright's page.touchscreen.tap() throws on a CDP-connected context
//   ("hasTouch must be enabled on the browser context"). All taps here go
//   through raw CDP Input.dispatchTouchEvent, which works on such a context.
//   A pinch is therefore also a CDP gesture, not a real finger channel.
// - A jump is over in well under a second: read window.__yard().h within
//   150-300 ms of the tap, not 800 ms later (by then he has landed).
// - Memory: `dumpsys meminfo <package>` changes shape between runs: sometimes
//   an aggregate with a "Total PSS by process" section (sum every
//   com.android.chrome* process), sometimes one process with a TOTAL line.
//   A TOTAL regex alone returns null half the time. Read whichever shape
//   arrives and record which one it was.
// - Screenshots go to tools/out/ (git-ignored), never into the repo. The
//   report itself is text and may be copied to docs/t00/evidence/device-<date>/.
//
// Safety: the script installs nothing, changes no system setting, reads no
// data off the phone except Chrome's own memory use, and closes the tab it
// opened. The phone model is written into the report; the serial number is
// never read or written.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEFAULT_SITE = "https://temple.rushiwowen.co/";
const CDP_URL = "http://localhost:9222";
const CHROME_PKG = "com.android.chrome";

// Reference lines the lead creator gave for the first report. They are his
// own invention, have no source, and are written beside the numbers for
// comparison only — never as a pass/fail verdict.
const REFERENCE = {
  lowAvgFpsMin: 30,
  lowP95MsMax: 50,
  coldToClickableMsMax: 15000,
};

const log = (...a) => {
  const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(new Date().toISOString(), s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function adb(cmd, timeoutMs = 20000) {
  try {
    return execSync(`adb ${cmd}`, { encoding: "utf8", timeout: timeoutMs }).trim();
  } catch (e) {
    return null;
  }
}

/** Human-actionable failure: say what to do, never dump a stack. */
function fail(msg) {
  console.error(`device: ${msg}`);
  process.exit(1);
}

/** PSS for Chrome. `dumpsys meminfo <package>` is unstable in shape: sometimes
 * it prints an aggregate with a "Total PSS by process" section (sum every
 * com.android.chrome* process), sometimes a single process with a TOTAL line
 * (that process's PSS). Handle both, and say which one was read. */
function memPSS() {
  const out = adb(`shell dumpsys meminfo ${CHROME_PKG}`);
  if (!out) return { total_KB: null, main_KB: null, note: "dumpsys returned nothing" };
  const section = out.split("Total PSS by process:")[1];
  if (section) {
    let total = 0;
    let main = null;
    let count = 0;
    for (const line of section.split("\n")) {
      if (/^Total /.test(line)) break;
      const m = line.match(/^\s*([\d,]+)K:\s*(com\.android\.chrome\S*)/);
      if (!m) continue;
      const kb = parseInt(m[1].replace(/,/g, ""), 10);
      total += kb;
      count += 1;
      if (/\/ activities\)/.test(line)) main = kb;
    }
    if (count) return { total_KB: total, main_KB: main, processes: count, format: "aggregate" };
  }
  const m = out.match(/^\s*TOTAL\s+([\d,]+)/m);
  if (m) {
    const kb = parseInt(m[1].replace(/,/g, ""), 10);
    return { total_KB: kb, main_KB: kb, processes: 1, format: "single-process" };
  }
  return { total_KB: null, main_KB: null, note: "no TOTAL line and no 'Total PSS by process' section" };
}

async function yardState(page) {
  return page
    .evaluate(() => {
      try {
        const y = window.__yard;
        if (typeof y !== "function") return { yard: y ? typeof y : "missing" };
        const o = y();
        return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "function" ? "[fn]" : v)));
      } catch (e) {
        return { error: String(e) };
      }
    })
    .catch((e) => ({ error: String(e) }));
}

async function waitReady(page, timeoutMs = 120000) {
  await page.waitForFunction(() => document.body && document.body.dataset.ready === "1", null, { timeout: timeoutMs });
}

async function enterGame(page) {
  await page.click("#enterBtn").catch(() => log("enter click failed (button may already be gone)"));
  await page
    .waitForFunction(() => document.body.classList.contains("entered"), null, { timeout: 30000 })
    .catch(() => log("entered class not seen"));
}

async function siteFingerprint(page) {
  return page
    .evaluate(() => {
      const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
      const entry = scripts.find((u) => /index-[A-Za-z0-9_-]+\.js$/i.test(u)) || null;
      return { entryFile: entry ? entry.split("/").pop() : null, entryUrl: entry, scripts: scripts.length };
    })
    .catch((e) => ({ error: String(e) }));
}

async function gpuInfo(page) {
  return page
    .evaluate(() => {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      let gpu = null;
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      }
      return { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio, gpu, ua: navigator.userAgent };
    })
    .catch((e) => ({ error: String(e) }));
}

async function runTour(page, site, q) {
  await page.goto(`${site}?tour=120x3&q=${q}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitReady(page);
  await enterGame(page);
  log(`tour q=${q} started, polling __tour() (up to ~8 min)...`);
  const start = Date.now();
  let tour = null;
  for (let i = 0; i < 40; i++) {
    await sleep(15000);
    tour = await page
      .evaluate(() => (typeof window.__tour === "function" ? window.__tour() : { error: "no __tour" }))
      .catch((e) => ({ error: e.message }));
    log(`tour q=${q} poll ${i} phase: ${tour.phase} runs: ${(tour.runs || []).length} done: ${tour.done}`);
    if (tour.done) break;
  }
  const runs = (tour.runs || []).map((r) => ({
    seconds: r.seconds,
    frames: r.frames,
    fps_mean: +r.fps_mean.toFixed(2),
    p95_ms: r.p95_ms,
    max_ms: r.max_ms,
  }));
  const out = { durationMs: Date.now() - start, phase: tour.phase, done: tour.done, runs };
  if (tour.result) out.ready_ms = tour.result.ready_ms;
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.findIndex((a) => a === name || a.startsWith(name + "="));
    if (i < 0) return def;
    const a = args[i];
    return a.includes("=") ? a.split("=").slice(1).join("=") : args[i + 1] || def;
  };
  const site = opt("--site", DEFAULT_SITE);
  const partsArg = opt("--parts", "all");
  const parts = new Set(partsArg === "all" ? ["cold", "hot", "tour-low", "tour-medium", "mem", "touch", "heat"] : partsArg.split(",").map((s) => s.trim()));
  const runName = `device-${new Date().toISOString().slice(0, 10)}-${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}`;
  const outDir = path.resolve(opt("--out", path.join("tools", "out", "device", runName)));
  fs.mkdirSync(outDir, { recursive: true });

  const report = {
    issue: 188,
    site,
    startedAt: new Date().toISOString(),
    device: {},
    load: {},
    tour: {},
    heat: null,
    mem: {},
    touch: {},
    reference: REFERENCE,
    notes: [],
    notVerified: [],
  };

  // --- device ---------------------------------------------------------------
  const devices = adb("devices");
  if (!devices || !/device$|device\s/m.test(devices) || /no devices|unauthorized/.test(devices)) {
    fail("no Android device found, or it is unauthorised. Plug the phone in by USB, turn on USB debugging, and tap Allow on the phone's authorisation prompt, then run this again.");
  }
  const model = adb("shell getprop ro.product.model");
  const android = adb("shell getprop ro.build.version.release");
  const battery = adb("shell dumpsys battery") || "";
  report.device.model = model || null;
  report.device.android = android || null;
  report.device.batteryLevel = (battery.match(/level:\s*(\d+)/) || [])[1] || null;
  report.device.acPowered = /AC powered: true/.test(battery);
  log("device", model, "android", android, "battery", report.device.batteryLevel, "ac", report.device.acPowered);

  // Chrome must be in the foreground, or CDP will not answer.
  adb("shell am start -a android.intent.action.VIEW -d about:blank com.android.chrome");
  await sleep(2000);
  adb("forward tcp:9222 localabstract:chrome_devtools_remote");
  let chromeVersion = null;
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    const v = await res.json();
    const m = /Chrome\/([\d.]+)/.exec(v.Browser || "");
    chromeVersion = m ? m[1] : v.Browser || null;
  } catch (e) {
    fail(`cannot reach Chrome on the phone at ${CDP_URL}. Make sure Chrome is in the foreground on the phone (not another app), the USB cable is in, and USB debugging is on.`);
  }
  report.device.chrome = chromeVersion;
  log("chrome", chromeVersion);

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (e) {
    fail(`connectOverCDP failed (${e.message}). Chrome is probably not in the foreground on the phone — bring it forward and run this again.`);
  }
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // Raw-CDP tap: Playwright's touchscreen.tap() needs hasTouch, which a
  // CDP-connected context does not have.
  const cdpTap = async (x, y) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(90);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  try {
    // --- device facts from the page -----------------------------------------
    await page.goto(site, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitReady(page);
    const info = await gpuInfo(page);
    report.device.screen = { w: info.w, h: info.h, dpr: info.dpr };
    report.device.gpu = info.gpu;
    const fp = await siteFingerprint(page);
    report.siteFingerprint = fp;
    log("screen", info.w, "x", info.h, "dpr", info.dpr, "gpu", info.gpu, "entry", fp.entryFile);

    // --- cold start: clear cache, 3 runs, median ---------------------------
    if (parts.has("cold")) {
      const runs = [];
      for (let i = 0; i < 3; i++) {
        await cdp.send("Network.clearBrowserCache");
        const t0 = Date.now();
        await page.goto(site, { waitUntil: "domcontentloaded", timeout: 120000 });
        await waitReady(page);
        const ms = Date.now() - t0;
        const enterEnabled = await page.evaluate(() => {
          const b = document.querySelector("#enterBtn");
          return b ? !b.disabled : null;
        });
        runs.push({ run: i + 1, toReadyMs: ms, enterBtnEnabled: enterEnabled });
        log(`cold run ${i + 1}: ready in ${ms} ms, enterBtn enabled: ${enterEnabled}`);
      }
      report.load.cold = { runs, medianToReadyMs: median(runs.map((r) => r.toReadyMs)) };
    }

    // --- hot start: no cache clear, 3 runs, median --------------------------
    if (parts.has("hot")) {
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        await page.goto(site, { waitUntil: "domcontentloaded", timeout: 120000 });
        await waitReady(page);
        const ms = Date.now() - t0;
        runs.push({ run: i + 1, toReadyMs: ms });
        log(`hot run ${i + 1}: ready in ${ms} ms`);
      }
      report.load.hot = { runs, medianToReadyMs: median(runs.map((r) => r.toReadyMs)) };
    }

    // --- frame cost: one tour round per tier ---------------------------------
    if (parts.has("tour-low")) {
      report.tour.low = await runTour(page, site, "low");
      report.tour.low.cost = await page.evaluate(() => (typeof window.__cost === "function" ? window.__cost() : "not present")).catch((e) => `ERR ${e.message}`);
      report.tour.low.census = await page.evaluate(() => (typeof window.__census === "function" ? window.__census() : "not present")).catch((e) => `ERR ${e.message}`);
      log("tour low done:", JSON.stringify(report.tour.low.runs));
    }
    if (parts.has("tour-medium")) {
      report.tour.medium = await runTour(page, site, "medium");
      report.tour.medium.cost = await page.evaluate(() => (typeof window.__cost === "function" ? window.__cost() : "not present")).catch((e) => `ERR ${e.message}`);
      report.tour.medium.census = await page.evaluate(() => (typeof window.__census === "function" ? window.__census() : "not present")).catch((e) => `ERR ${e.message}`);
      log("tour medium done:", JSON.stringify(report.tour.medium.runs));
    }

    // --- heat: low, two consecutive rounds, delta reported separately --------
    if (parts.has("heat")) {
      const r1 = await runTour(page, site, "low");
      const r2 = await runTour(page, site, "low");
      const mean = (runs) => runs.reduce((a, r) => a + r.fps_mean, 0) / Math.max(runs.length, 1);
      const p95 = (runs) => Math.max(...runs.map((r) => r.p95_ms));
      report.heat = {
        round1: r1,
        round2: r2,
        delta: {
          fpsMean: +(mean(r2.runs) - mean(r1.runs)).toFixed(2),
          p95Ms: +(p95(r2.runs) - p95(r1.runs)).toFixed(1),
        },
      };
      log("heat round1 fps:", mean(r1.runs).toFixed(2), "round2 fps:", mean(r2.runs).toFixed(2), "delta:", report.heat.delta.fpsMean);
    }

    // --- memory: first courtyard, a hall, the summit -------------------------
    if (parts.has("mem")) {
      await page.goto(site, { waitUntil: "domcontentloaded", timeout: 120000 });
      await waitReady(page);
      await enterGame(page);
      await sleep(2000);
      report.mem.afterFirstCourt = memPSS();
      log("PSS after first courtyard KB:", JSON.stringify(report.mem.afterFirstCourt));
      await page.goto(`${site}?in=main`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await waitReady(page);
      await enterGame(page);
      await sleep(3000);
      report.mem.afterHall = memPSS();
      log("PSS after entering a hall KB:", JSON.stringify(report.mem.afterHall));
      await page.goto(`${site}?up=lingxiao`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await waitReady(page);
      await enterGame(page);
      await sleep(3000);
      report.mem.afterSummit = memPSS();
      log("PSS after climbing Lingxiao KB:", JSON.stringify(report.mem.afterSummit));
    }

    // --- touch regression ----------------------------------------------------
    if (parts.has("touch")) {
      await page.goto(site, { waitUntil: "domcontentloaded", timeout: 120000 });
      await waitReady(page);
      await enterGame(page);
      await sleep(2000);
      const vp = page.viewportSize() || { width: 411, height: 812 };
      report.touch.viewport = { w: vp.width, h: vp.height, dpr: await page.evaluate(() => window.devicePixelRatio) };

      // opening (idle state is a real result: the opening never played)
      report.touch.opening = await page.evaluate(() => (typeof window.__opening === "function" ? window.__opening() : "not present")).catch((e) => `ERR ${e.message}`);

      // tap-to-walk x3 in the first courtyard
      report.touch.tapWalk = [];
      const taps = [
        { name: "center-ground", x: Math.round(vp.width * 0.5), y: Math.round(vp.height * 0.72) },
        { name: "left-ground", x: Math.round(vp.width * 0.3), y: Math.round(vp.height * 0.68) },
        { name: "right-ground", x: Math.round(vp.width * 0.7), y: Math.round(vp.height * 0.68) },
      ];
      for (const t of taps) {
        const before = await yardState(page);
        await cdpTap(t.x, t.y);
        await sleep(1200);
        const afterTap = await yardState(page);
        await sleep(4000);
        const afterWalk = await yardState(page);
        report.touch.tapWalk.push({ name: t.name, x: t.x, y: t.y, before, afterTap, afterWalk });
        log("tap", t.name, "->", JSON.stringify(afterTap).slice(0, 200));
      }

      // jump: read height 150-300 ms after the tap, not 800 ms (he lands fast)
      const jumpBtn = await page.evaluate(() => {
        const els = [...document.querySelectorAll("button, [role='button'], div")].filter((el) => el.textContent && el.textContent.trim() === "跳");
        if (!els.length) return null;
        const el = els[els.length - 1];
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
      });
      report.touch.jump = { button: jumpBtn };
      if (jumpBtn) {
        const before = await yardState(page);
        await cdpTap(jumpBtn.x, jumpBtn.y);
        await sleep(200);
        const at200 = await yardState(page);
        await sleep(600);
        const at800 = await yardState(page);
        report.touch.jump.before = before;
        report.touch.jump.at200ms = at200;
        report.touch.jump.at800ms = at800;
        log("jump at 200ms h:", at200 && at200.h, "at 800ms h:", at800 && at800.h);
      }

      // pinch: two-point spread; verify by __probe()'s camera distance
      try {
        const probeBefore = await page.evaluate(() => (typeof window.__probe === "function" ? window.__probe() : "not present")).catch((e) => `ERR ${e.message}`);
        const cx = Math.round(vp.width / 2);
        const cy = Math.round(vp.height / 2);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - 120, y: cy, id: 1 }, { x: cx + 120, y: cy, id: 2 }] });
        await sleep(400);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - 160, y: cy, id: 1 }, { x: cx + 160, y: cy, id: 2 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await sleep(800);
        const probeAfter = await page.evaluate(() => (typeof window.__probe === "function" ? window.__probe() : "not present")).catch((e) => `ERR ${e.message}`);
        report.touch.pinch = { dispatched: true, probeBefore, probeAfter, note: "CDP Input.dispatchTouchEvent, not a real finger channel" };
      } catch (e) {
        report.touch.pinch = { dispatched: false, error: String(e) };
      }

      // overlap: jump ring vs 留影/歇脚 tabs, portrait then landscape
      await page.screenshot({ path: path.join(outDir, "overlap-portrait.png") });
      report.touch.screenshots = { portrait: "overlap-portrait.png" };
      adb("shell settings put system accelerometer_rotation 0");
      adb("shell settings put system user_rotation 1");
      await sleep(2500);
      await page.screenshot({ path: path.join(outDir, "overlap-landscape.png") });
      report.touch.screenshots.landscape = "overlap-landscape.png";
      adb("shell settings put system user_rotation 0");
      adb("shell settings put system accelerometer_rotation 1");
      report.notes.push("screen rotation changed temporarily for the landscape screenshot and restored (accelerometer_rotation back to 1)");
      report.touch.memAfterPSS_KB = memPSS();
    }
  } finally {
    // Close the tab this script opened; leave the phone as it was found.
    try {
      await page.close();
    } catch (e) {
      /* already gone */
    }
    try {
      await browser.close();
    } catch (e) {
      /* already gone */
    }
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  log("wrote", path.join(outDir, "report.json"));
  console.log("DEVICE_DONE", outDir);
}

main().catch((e) => {
  console.error("device: unexpected failure:", e.message);
  process.exit(1);
});
