// A play-through of the paths this round changed, at the speed a visitor has them (no ?fast), driven by real input:
// the keyboard on a desktop page and touches on an emulated phone. Each run is filmed and photographed, and every
// press is logged with what the page said back, so that the film can be watched beside the log.
//
//   node tools/play-t00.cjs [outdir] [summit bell tea phone director]
//
// What is NOT real input, and is marked so in the log as `diagnostic`: putting him beside the place with __pose (the
// software renderer is too slow to walk the whole mountain at a visitor's pace) and reading the page's state through
// its test hooks. Everything he does once there is a key press or a tap.
const { serve, launch } = require("../tests/e2e/lib.cjs");
const fs = require("fs"), path = require("path");
const out = path.resolve(process.argv[2] || "tools/out/play"), only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const log = [], note = (run, kind, what, extra = {}) => { const e = { t: new Date().toISOString(), run, kind, what, ...extra }; log.push(e); console.log(run.padEnd(7), kind.padEnd(10), what, Object.keys(extra).length ? JSON.stringify(extra) : ""); };

async function page(b, base, run, query, ctxOpts = {}) {
  // PLAY_SIZE=480x300 draws a smaller picture, so that a software renderer manages more frames and the timing of
  // presses can be seen nearer to what a real card gives.
  const [W, H] = (process.env.PLAY_SIZE || "960x600").split("x").map(Number);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: W, height: H } }, ...ctxOpts });
  const p = await ctx.newPage(), errors = [];
  p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errors.push(m.text()));
  await p.goto(base + "?" + query, { waitUntil: "commit", timeout: 120000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
  await p.waitForFunction(() => !document.getElementById("enterBtn")?.disabled, null, { timeout: 60000 });
  if (ctxOpts.hasTouch) await p.tap("#enterBtn", { timeout: 240000 }); else await p.click("#enterBtn", { timeout: 240000 });
  note(run, "input", ctxOpts.hasTouch ? "tap 入山" : "click 入山");
  const S = { p, ctx, errors,
    j: () => p.evaluate(() => window.__journey()), r: () => p.evaluate(() => window.__rites()),
    word: async () => ((await p.isVisible("#act")) ? p.getAttribute("#act", "data-word") : null),
    say: () => p.evaluate(() => document.getElementById("say").classList.contains("on") ? document.getElementById("say").textContent : ""),
    at: async (id, dx = 0.3, dz = 0.3) => { await p.evaluate(([k, a, c]) => { const q = window.__places[k]; window.__pose(q.at[0] + a, q.at[1] + c, Math.PI, 0.05); }, [id, dx, dz]); note(run, "diagnostic", `__pose beside ${id}`); },
    shot: async (name) => { await p.screenshot({ path: path.join(out, `${run}-${name}.png`), timeout: 240000 }); note(run, "shot", `${run}-${name}.png`); },
    until: async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await p.waitForTimeout(250); } throw new Error(`${run}: ${what}`); },
    key: async (k, what) => { await p.keyboard.press(k); note(run, "input", `key ${k}${what ? " · " + what : ""}`); },
    tap: async (sel, what) => { await p.tap(sel, { timeout: 240000 }); note(run, "input", `tap ${sel}${what ? " · " + what : ""}`); },
    async end() { const v = p.video(); await ctx.close(); const f = await v.path(); const to = path.join(out, `${run}.webm`); fs.renameSync(f, to); note(run, "film", path.basename(to), { errors }); },
  };
  return S;
}

const runs = {
  // A new book, straight to the summit: E to sit, three breaths, the close, the book; E stands him up again.
  async summit(b, base) {
    const s = await page(b, base, "summit", "q=low&view=third&season=summer&time=day");
    await s.at("sit"); await s.until(async () => (await s.word()) === "静坐", 30000, "静坐 not offered");
    note("summit", "page", `button: ${await s.word()}`, { say: await s.say() }); await s.shot("1-offered");
    await s.key("e", "静坐");
    await s.until(() => s.p.isVisible("#breath"), 60000, "no breath"); await s.shot("2-breath");
    const t0 = Date.now(); await s.until(async () => (await s.r()).closing, 120000, "the close never began");
    note("summit", "page", `close began ${((Date.now() - t0) / 1000).toFixed(0)} s after the breath`, { seals: (await s.j()).count });
    const lines = []; let i = 0;
    await s.until(async () => { const r = await s.r(); if (r.line && lines.at(-1) !== r.line) { lines.push(r.line); note("summit", "page", `closing line: ${r.line}`); await s.shot(`3-line${++i}`); } return !r.closing; }, 120000, "the close never ended");
    note("summit", "page", "every line the close said", { words: (await s.r()).words });
    await s.until(() => s.p.isVisible("#book"), 30000, "no book"); note("summit", "page", "book", { hint: await s.p.textContent("#bookHint") }); await s.shot("4-book");
    await s.key("Escape", "close the book"); await s.until(async () => (await s.word()) === "起身", 20000, "起身 not offered"); await s.shot("5-seated");
    await s.key("e", "起身"); await s.until(async () => !(await s.p.evaluate(() => window.__yard().staged)), 20000, "did not stand");
    await s.p.waitForTimeout(1500); note("summit", "page", `after standing, button: ${await s.word()}`, { closed: (await s.j()).closed > 0 });
    await s.end();
  },
  // The bell: one press, one stroke; a press while the log swings back does nothing; then the visitor's own spacing.
  async bell(b, base) {
    const s = await page(b, base, "bell", "q=low&view=third&season=summer&time=day");
    await s.at("bell", 0.3, -0.3); await s.until(async () => (await s.word()) === "撞钟", 30000, "撞钟 not offered"); await s.shot("1-offered");
    const f0 = await s.p.evaluate(() => window.__yard().frames), c0 = Date.now(); await s.p.waitForTimeout(5000);
    note("bell", "page", `frame rate here: ${(((await s.p.evaluate(() => window.__yard().frames)) - f0) / ((Date.now() - c0) / 1000)).toFixed(1)} frames/s`);
    const t0 = Date.now(), strikes = async () => (await s.j()).strikes;
    await s.key("e", "first press"); await s.until(async () => (await strikes()) === 1, 30000, "no first stroke");
    const wait = await s.p.evaluate(() => document.getElementById("act").classList.contains("wait")), ready = (await s.r()).bell.ready;
    await s.key("e", `pressed again at once (button faint: ${wait}, ready: ${ready})`);
    note("bell", "page", `stroke 1 sounded ${((Date.now() - t0) / 1000).toFixed(1)} s after the press`, { say: await s.say() });
    await s.p.waitForTimeout(2500); note("bell", "page", `strokes after the early press: ${await strikes()}, pulls: ${(await s.r()).bell.pulls}`); await s.shot("2-stroke1");
    for (const [gap, n] of [[3000, 2], [6500, 3], [2500, 4]]) {
      await s.p.waitForTimeout(gap); const ready = (await s.r()).bell.ready; await s.key("e", `after ${gap / 1000} s more (ready: ${ready})`);
      const t1 = Date.now(); await s.until(async () => (await s.r()).bell.pulls >= (n === 4 ? 4 : n), 30000, `stroke ${n}`);
      note("bell", "page", `pull ${n} rang ${((Date.now() - t1) / 1000).toFixed(1)} s after the press`, { strikes: await strikes(), sealed: !!(await s.j()).seals.bell, say: await s.say() });
      if (n === 3) await s.shot("3-third");
    }
    await s.key("v", "first person while holding the rope"); await s.p.waitForTimeout(1500); await s.shot("4-first-person"); await s.key("v");
    await s.key("Escape", "let go"); await s.until(async () => (await s.r()).bell.grip === 0, 20000, "never let go"); await s.shot("5-let-go");
    note("bell", "page", "after letting go", { rite: (await s.j()).rite, button: await s.word() });
    await s.end();
  },
  // Tea: E, the three sips, then he sits on; the visitor watches a while and stands him up with E.
  async tea(b, base) {
    const s = await page(b, base, "tea", "q=low&view=third&season=summer&time=day");
    await s.at("tea"); await s.until(async () => (await s.word()) === "吃茶", 30000, "吃茶 not offered"); await s.key("e", "吃茶");
    await s.until(async () => (await s.r()).tea.tilt > 0.3, 60000, "never drank"); await s.shot("1-sip");
    await s.until(async () => (await s.j()).seals.tea > 0, 90000, "no seal"); note("tea", "page", "seal", { button: await s.word() });
    await s.until(async () => (await s.word()) === "起身", 30000, "起身 not offered");
    const looks = []; const t0 = Date.now();
    while (Date.now() - t0 < 40000) { const r = await s.r(); looks.push(r.look); await s.p.waitForTimeout(1000); }
    const m = await s.p.evaluate(() => window.__music?.() || null);
    note("tea", "page", "sat on for 40 s", { lookRange: [Math.min(...looks), Math.max(...looks)], hushed: m && m.hushed, duck: m && m.duck }); await s.shot("2-sitting-on");
    await s.key("v", "first person while sitting"); await s.p.waitForTimeout(1500); await s.shot("3-first-person"); await s.key("v");
    await s.key("e", "起身"); await s.until(async () => (await s.j()).rite === null, 20000, "did not rise"); await s.p.waitForTimeout(3000);
    const m2 = await s.p.evaluate(() => window.__music?.() || null); note("tea", "page", "stood up", { hushed: m2 && m2.hushed }); await s.shot("4-up");
    await s.end();
  },
  // The eye going to each place's own shot and back (src/director.js), at a visitor's pace by real keys and the mouse:
  // the lamp (in, rested on, home by itself before he is done), the well (a step with W brings it home at once), the bell
  // (three presses on its shot, the eye stays; Esc brings it home), the tea (a drag of the view brings it home).
  // How long each swing took, and whether it was swung or cut behind the ink, is read from __director (diagnostic).
  async director(b, base) {
    const s = await page(b, base, "director", "q=low&view=third&season=summer&time=day");
    const D = () => s.p.evaluate(() => window.__director());
    const watch = async (what, fn, ms = 60000) => { const t0 = Date.now(); await s.until(async () => fn(await D()), ms, what); return ((Date.now() - t0) / 1000).toFixed(1); };
    // The lamp.
    await s.at("lamp"); await s.until(async () => (await s.word()) === "燃灯", 30000, "燃灯 not offered"); await s.shot("1-lamp-offered");
    await s.key("e", "燃灯"); let secs = await watch("never went to the lamp's shot", (d) => d.id === "lamp" && d.phase !== "idle");
    await s.shot("2-lamp-swing"); note("director", "diagnostic", "going to the lamp's shot", await D());
    secs = await watch("never reached the lamp's shot", (d) => d.phase === "hold" || d.phase === "out"); note("director", "page", `on the lamp's shot ${secs} s later`); await s.shot("3-lamp-shot");
    secs = await watch("never came home from the lamp", (d) => d.phase === "idle"); note("director", "page", `home by itself ${secs} s later`, await D()); await s.shot("4-lamp-home");
    // The well: W.
    await s.at("well"); await s.until(async () => (await s.word()) === "观水", 30000, "观水 not offered"); await s.key("e", "观水");
    secs = await watch("never reached the well's shot", (d) => d.id === "well" && d.phase === "hold"); note("director", "page", `on the well's shot ${secs} s after the press`); await s.shot("5-well-shot");
    await s.p.keyboard.down("w"); note("director", "input", "key W held · walk away"); await s.p.waitForTimeout(400);
    note("director", "diagnostic", "0.4 s after W", await D()); await s.p.keyboard.up("w");
    secs = await watch("never came home from the well", (d) => d.phase === "idle", 30000); note("director", "page", `home ${secs} s after W was let go`); await s.shot("6-well-home");
    // The bell: presses on its shot.
    await s.at("bell", 0.3, -0.3); await s.until(async () => (await s.word()) === "撞钟", 30000, "撞钟 not offered"); await s.key("e", "撞钟");
    secs = await watch("never reached the bell's shot", (d) => d.id === "bell" && d.phase === "hold"); note("director", "page", `on the bell's shot ${secs} s after the press`); await s.shot("7-bell-shot");
    for (const n of [2, 3]) { await s.until(async () => (await s.r()).bell.ready, 30000, "rope not ready"); await s.key("e", `撞钟 ${n}`); await s.until(async () => (await s.r()).bell.pulls >= n, 30000, `stroke ${n}`); note("director", "diagnostic", `after stroke ${n}`, await D()); }
    await s.shot("8-bell-third"); await s.key("Escape", "let go of the rope");
    secs = await watch("never came home from the bell", (d) => d.phase === "idle", 30000); note("director", "page", `home ${secs} s after Esc`, { button: await s.word() });
    // The tea: a drag.
    await s.at("tea"); await s.until(async () => (await s.word()) === "吃茶", 30000, "吃茶 not offered"); await s.key("e", "吃茶");
    secs = await watch("never reached the tea's shot", (d) => d.id === "tea" && d.phase === "hold", 90000); note("director", "page", `on the tea's shot ${secs} s after the press`); await s.shot("9-tea-shot");
    await s.p.mouse.move(480, 300); await s.p.mouse.down(); for (let x = 490; x <= 640; x += 15) await s.p.mouse.move(x, 302); await s.p.mouse.up(); note("director", "input", "mouse drag 160 px · look round");
    secs = await watch("never came home from the tea", (d) => d.phase === "idle", 30000); note("director", "page", `home ${secs} s after the drag`, { rite: (await s.j()).rite }); await s.shot("10-tea-home");
    await s.key("e", "起身"); await s.until(async () => (await s.j()).rite === null, 20000, "did not rise");
    note("director", "diagnostic", "the whole run", await D());
    await s.end();
  },
  // A phone: the same bell and tea by touch only.
  async phone(b, base) {
    const { devices } = require("playwright");
    const s = await page(b, base, "phone", "q=low&view=third&season=summer&time=day", { ...devices["iPhone 13"], recordVideo: { dir: out, size: { width: 390, height: 664 } } });
    await s.at("bell", 0.3, -0.3); await s.until(async () => (await s.word()) === "撞钟", 30000, "撞钟 not offered"); await s.tap("#act", "撞钟");
    await s.until(async () => (await s.j()).strikes === 1, 30000, "no stroke"); await s.shot("1-bell");
    await s.until(async () => (await s.r()).bell.ready, 20000, "not ready"); await s.tap("#act", "撞钟 again"); await s.until(async () => (await s.j()).strikes === 2, 30000, "no second stroke");
    note("phone", "page", "two strokes by touch", { hint: await s.p.evaluate(() => document.getElementById("hint").textContent) });
    await s.at("tea"); note("phone", "page", "moving him lets go of the rope", { rite: (await s.j()).rite });
    await s.until(async () => (await s.word()) === "吃茶", 30000, "吃茶 not offered"); await s.tap("#act", "吃茶");
    await s.until(async () => (await s.word()) === "起身", 120000, "起身 not offered"); await s.shot("2-tea"); await s.tap("#act", "起身");
    await s.until(async () => (await s.j()).rite === null, 20000, "did not rise"); note("phone", "page", "risen by touch");
    await s.end();
  },
};

(async () => {
  const srv = await serve(), b = await launch();
  try { for (const k of Object.keys(runs)) if (!only.length || only.includes(k)) { try { await runs[k](b, srv.base); } catch (e) { note(k, "FAILED", String(e.message || e)); } } }
  finally { await b.close(); srv.close(); fs.writeFileSync(path.join(out, "log.json"), JSON.stringify(log, null, 1)); }
})();
