// Renders the trailer (#610): the level's script (app/levels/<level>/trailer.js) drawn frame by frame by the page in trailer
// mode (`?trailer`, app/src/trailer.js: a fixed clock, no interface, every frame the same whenever it is drawn), its score
// rendered offline to the same length, and both put together by ffmpeg into an H.264 mp4 (yuv420p, +faststart) that can be
// uploaded as it is. Frames are PNGs in <out>/frames/, kept: a run that stops can be run again with --resume.
//
//   node tools/trailer.mjs                              1920x1080 at 60 fps with the card's Vulkan (--gpu) or SwiftShader
//   node tools/trailer.mjs --size=640x360 --fps=12      a small preview, drawn in software
//   node tools/trailer.mjs --from=39 --to=46            only those seconds of the film (the frames are kept; no mp4 unless all are there)
//   node tools/trailer.mjs --stills=3                   three frames of each shot, set out as one sheet: <out>/stills.jpg (+ stills.json)
//   options: --level=<id> (t00) --q=high|medium|low (high) --out=<dir> (tools/out/trailer) --gpu --resume --no-audio --no-video
//
// Each run writes <out>/report.json: the script, the size, the renderer, frames and times, each shot's first and last frame,
// a SHA-256 of every frame (the same script at the same commit gives the same list), and what the page complained about.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import os from "node:os";
import { execFileSync } from "node:child_process"; import { fileURLToPath, pathToFileURL } from "node:url"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url), { chromium } = require("playwright"), { serve } = require("./site.cjs"), siteDir = require("./site.cjs").site;
const here = path.dirname(fileURLToPath(import.meta.url)), top = path.join(here, ".."), app = path.join(top, "app");
const arg = (n, d = null) => { const a = process.argv.find((x) => x === `--${n}` || x.startsWith(`--${n}=`)); return a === undefined ? d : a.includes("=") ? a.slice(n.length + 3) : true; };

const level = arg("level", "t00"), q = arg("q", "high"), gpu = !!arg("gpu"), resume = !!arg("resume");
const [W, H] = arg("size", "1920x1080").split("x").map(Number), fps = Number(arg("fps", 60)), stills = Number(arg("stills", 0));
const out = path.resolve(arg("out", path.join(top, "tools", "out", "trailer"))), framesDir = path.join(out, "frames");
const { TRAILER: script } = await import(pathToFileURL(path.join(app, "levels", level, "trailer.js")).href);
const total = Math.round(script.length * fps), shotOf = (i) => script.shots.findIndex((s, k) => i / fps >= s.from && (i / fps < s.to || k === script.shots.length - 1));
const from = Math.max(0, Math.round(Number(arg("from", 0)) * fps)), to = Math.min(total, Math.round(Number(arg("to", script.length)) * fps));
fs.mkdirSync(framesDir, { recursive: true });
const name = (i) => path.join(framesDir, String(i).padStart(6, "0") + ".png");
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

// ---- which frames: all of them, or `--stills=n` of each shot, spread through it ----
let want = [];
if (stills) for (const [k, s] of script.shots.entries()) for (let j = 1; j <= stills; j++) want.push({ shot: k, frame: Math.min(total - 1, Math.round((s.from + ((s.to - s.from) * j) / (stills + 1)) * fps)) });
else for (let i = from; i < to; i++) want.push({ shot: shotOf(i), frame: i });

// ---- the page ----
const SOFT = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"];
// The card: Metal on a Mac, Vulkan on a T4 (tools/gpu/job.cjs's way of asking for it).
const CARD = process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"]
  : ["--no-sandbox", "--use-angle=vulkan", "--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE", "--disable-vulkan-surface", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl"];
const report = { script: script.id, level, size: [W, H], fps, q, gpu, total, from, to, started: new Date().toISOString(), commit: process.env.COMMIT || null, shots: script.shots.map((s) => ({ id: s.id, first: Math.round(s.from * fps), last: Math.round(s.to * fps) - 1 })), errors: [], hashes: {} };
report.checks = {
  first_frame_is_the_opening: script.shots[0].kind === "opening" && script.shots[0].from === 0,
  length_s: script.length, length_in_60_75: script.length >= 60 && script.length <= 75,
  title_and_wishlist_last_5s: !!script.card && script.card.from >= script.length - 5 && !!script.card.wish && !!script.card.wishEn,
  no_version_text: !JSON.stringify(script).match(/\bv?\d+\.\d+\.\d+\b/),
};

let srv, browser;
async function open() {
  srv = await serve(siteDir());
  browser = await chromium.launch({ args: gpu ? CARD : SOFT });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN", reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  // Playwright's own screenshot waits on the page's animation frames, which only this tool moves; the browser is asked for the picture directly.
  const cdp = await ctx.newCDPSession(page); page.shoot = async (file) => { const r = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); };
  page.on("pageerror", (e) => report.errors.push(String(e.stack || e.message).slice(0, 400)));
  page.on("console", (m) => (m.type() === "error") && !/GPU stall/.test(m.text()) && report.errors.push(m.text().slice(0, 300)));
  const s0 = script.shots[0], query = `?trailer=1&fps=${fps}&show=arrive&enter=1&debug=0&q=${q}&season=${s0.season}&time=${s0.time}&level=${level}`;
  await page.goto(srv.base + query, { waitUntil: "commit", timeout: 240000 });
  await page.waitForFunction(() => document.body.dataset.ready === "1" && window.__trailer, null, { timeout: 900000, polling: 500 });
  report.renderer = await page.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"); const e = g && g.getExtension("WEBGL_debug_renderer_info"); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : "unknown"; });
  if (gpu && /swiftshader|llvmpipe|software/i.test(report.renderer)) throw new Error(`--gpu was asked for and the page draws with ${report.renderer}`);
  // The eye's hierarchy is built in a worker once the walk is the visitor's: it must be there before the first frame.
  await page.waitForFunction(() => ["ready", "failed", "off"].includes(window.__eyeSpace?.().state), null, { timeout: 900000, polling: 500 });
  report.eyeSpace = await page.evaluate(() => window.__eyeSpace().state);
  await page.evaluate((s) => window.__trailer.load(s, { fps: s.fps0 }), { ...script, fps0: fps });
  return page;
}

// ---- the picture ----
const t0 = Date.now(); let page = null, drawn = 0;
const todo = want.filter((w) => !(resume && fs.existsSync(name(w.frame))) && !(stills && fs.existsSync(name(w.frame))));
if (todo.length) {
  page = await open();
  for (const w of todo) {
    const r = await page.evaluate((i) => window.__trailer.frame(i), w.frame);
    await page.shoot(name(w.frame));
    drawn++;
    if (drawn % 20 === 0 || drawn === todo.length) console.log(`frame ${w.frame}/${total} (${r.shot}) ${((Date.now() - t0) / 1000 / drawn).toFixed(2)} s a frame`);
  }
  await browser.close(); srv.close();
}
report.rendered_frames = drawn; report.seconds_drawing = +((Date.now() - t0) / 1000).toFixed(1);
for (const w of want) if (fs.existsSync(name(w.frame))) report.hashes[w.frame] = sha(name(w.frame));

// ---- stills: a sheet, a row to a shot ----
if (stills) {
  const list = path.join(out, "stills.txt");
  fs.writeFileSync(list, want.map((w) => `file '${name(w.frame)}'\nduration 1`).join("\n") + `\nfile '${name(want[want.length - 1].frame)}'\n`);
  const cols = stills, rows = script.shots.length, tw = Math.min(480, Math.round(W / 2));
  const sheet = path.join(out, "stills.jpg");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=${tw}:-2,tile=${cols}x${rows}`, "-frames:v", "1", "-q:v", "6", sheet]);
  fs.writeFileSync(path.join(out, "stills.json"), JSON.stringify({ columns: cols, rows: want.map((w, k) => ({ row: Math.floor(k / cols), col: k % cols, shot: script.shots[w.shot].id, frame: w.frame, second: +(w.frame / fps).toFixed(2) })) }, null, 1));
  fs.unlinkSync(list); console.log("→ " + sheet);
}

// ---- the music, to the length of the film ----
const wav = path.join(out, "score.wav");
if (!stills && !arg("no-audio") && from === 0 && to === total) {
  const { renderScore } = await import("./trailer-audio.mjs");
  const r = await renderScore(script, wav); report.audio = r;
}

// ---- the film ----
const complete = !stills && fs.readdirSync(framesDir).filter((f) => f.endsWith(".png")).length >= total;
if (complete && !arg("no-video")) {
  const mp4 = path.join(out, `${script.id}-${W}x${H}-${fps}fps.mp4`);
  const audio = fs.existsSync(wav) && !arg("no-audio") ? ["-i", wav, "-c:a", "aac", "-b:a", "192k", "-shortest"] : ["-an"];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(framesDir, "%06d.png"), ...audio, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(fps), "-movflags", "+faststart", mp4]);
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size:stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames", "-of", "json", mp4]).toString());
  report.video = { file: path.basename(mp4), ...probe.format, streams: probe.streams };
  console.log("→ " + mp4, JSON.stringify(probe.format));
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
console.log("errors:", [...new Set(report.errors)].slice(0, 6), "checks:", JSON.stringify(report.checks));
if (report.errors.length) process.exitCode = 1;
