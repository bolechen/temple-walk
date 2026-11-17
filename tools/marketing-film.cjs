// The frames of the publicity films, drawn one at a time so that a slow machine and a fast one make the same film.
// Time is held still and moved on by hand: the opening with __openingAt(secs) (app/src/opening.js), the bell with
// __riteClock(ms) (src/rites.js), the prologue's title by setting its CSS animation's clock, the last view by moving the
// eye. Each frame waits until the page has drawn after the change, then is photographed. Subtitles are a line of the
// page's own typeface laid over the picture (nothing else is added to it). Every segment becomes a silent mp4;
// tools/marketing-edit.sh joins them with the bells and the music.
//
//   node tools/marketing-film.cjs --size 1080x1920 --fps 30 --out tools/out/film-v        # locally (SwiftShader: slow)
//   node tools/marketing-film.cjs --size 270x480 --fps 6 --out tools/out/film-test         # a quick trial
//   or as a T4 job: tools/marketing-gpu.sh film '{"film":{"size":[1080,1920],"fps":30,"name":"v"}}'  (job.cjs calls run())
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const MOOD = "season=autumn&time=dusk", BASE = "q=high&body=code";
// What each segment is. `url` is the page's address (the same on any machine); `sub` is [line, from, to] in seconds of the segment.
const SEGMENTS = [
  { id: "1-opening", kind: "opening", url: `${BASE}&view=third&${MOOD}`, sub: [["一段值得慢下来的路", 1.0, 7.0]] },
  { id: "2-title", kind: "title", secs: 7, url: `shot=1&${BASE}&show=cam04&view=third&${MOOD}`, titleAt: 1.0 },
  { id: "3-bell", kind: "bell", secs: 15, url: `shot=1&${BASE}&show=shot-bell&view=third&${MOOD}`, sub: [["撞钟，一响", 1.5, 6.5]] },
  { id: "4-lookback", kind: "lookback", secs: 10, url: `shot=1&${BASE}&show=lookback&view=first&${MOOD}`, sub: [["网页即玩，约十几分钟", 1.0, 5.0], ["山门之外 · 序章", 5.6, 9.4]], push: 0.12 },
];

async function run({ open, out, fps = 30, size, only, log = console.log }) {
  fs.mkdirSync(out, { recursive: true });
  const timeline = [], draw = async (page, n = 2) => { const f0 = await page.evaluate(() => window.__yard().frames); await page.waitForFunction((f) => window.__yard().frames >= f, f0 + n, { timeout: 300000 }); };
  const fade = (t, a, b, k = 0.7) => Math.max(0, Math.min(1, (t - a) / k, (b - t) / k));
  for (const seg of SEGMENTS) {
    if (only && !only.includes(seg.id)) continue;
    const dir = path.join(out, seg.id); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const { ctx, page } = await open(seg.url, size, 1, { locale: "zh-CN" });
    const vertical = size[1] > size[0];
    await page.evaluate(([v]) => {
      const el = document.createElement("div"); el.id = "mkSub";
      el.style.cssText = `position:fixed;left:0;right:0;bottom:${v ? 11 : 9}%;text-align:center;z-index:99;pointer-events:none;opacity:0;font:${v ? "4.4vw" : "2.4vw"}/1.5 "Yunjing Kai",serif;letter-spacing:.22em;color:#f3ecdc;text-shadow:0 1px 8px rgba(20,16,10,.7),0 0 2px rgba(20,16,10,.6)`;
      document.body.appendChild(el);
    }, [vertical]);
    let secs = seg.secs, info = {};
    if (seg.kind === "opening") {   // a first visitor: 入山, then the eye held by the page's own way down
      await page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 300000 });
      await page.evaluate(() => document.getElementById("enterBtn").click()); await page.waitForFunction(() => window.__opening().active, null, { timeout: 120000 });
      await page.evaluate(() => window.__openingAt(0)); await draw(page, 3);
      secs = await page.evaluate(() => window.__opening().secs); info.opening = secs;
    }
    if (seg.kind === "bell") { await page.evaluate(() => window.__riteClock(0)); await draw(page, 3); }
    let start = null;
    if (seg.kind === "lookback") start = await page.evaluate(() => { const y = window.__yard(); return { x: y.x, z: y.z, yaw: y.yaw, pitch: y.pitch }; });
    const n = Math.round(secs * fps);
    for (let i = 0; i < n; i++) {
      const t = i / fps;
      const sub = (seg.sub || []).find(([, a, b]) => t >= a - 0.01 && t <= b), alpha = sub ? fade(t, sub[1], sub[2]) : 0;
      await page.evaluate(([kind, t, fps, seg, start, text, alpha, i]) => {
        if (kind === "opening") window.__openingAt(Math.min(t, window.__opening().secs));
        if (kind === "bell" && i > 0) window.__riteClock(1000 / fps);
        if (kind === "title") {
          if (t >= seg.titleAt && !document.getElementById("prologue").classList.contains("on")) window.__prologue("hold");
          for (const a of document.getElementById("prologue").getAnimations({ subtree: true })) { a.pause(); a.currentTime = Math.max(0, (t - seg.titleAt) * 1000); }
        }
        const el = document.getElementById("mkSub"); el.textContent = text || el.textContent; el.style.opacity = alpha;
      }, [seg.kind, t, fps, seg, start, sub ? sub[0] : "", alpha, i]);
      if (seg.kind === "lookback") await page.evaluate(([s, t, push]) => window.__pose(s.x, s.z + push * t * Math.cos(s.yaw), s.yaw, s.pitch), [start, t, seg.push]);
      await draw(page, 2);
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 93, timeout: 120000 });
      if (i % (fps * 2) === 0) log(seg.id, `${i}/${n}`);
    }
    const meta = await page.evaluate(() => ({ yard: window.__yard(), rites: window.__rites && window.__rites().bell }));
    await ctx.close();
    const mp4 = path.join(out, seg.id + ".mp4");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "f%05d.jpg"), "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(fps), mp4]);
    fs.rmSync(dir, { recursive: true, force: true });
    timeline.push({ id: seg.id, kind: seg.kind, url: "?" + seg.url, secs, frames: n, fps, size, file: path.basename(mp4), ...info, end: { x: meta.yard.x, z: meta.yard.z } });
    fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(timeline, null, 1));
  }
  return timeline;
}
module.exports = { run, SEGMENTS };

if (require.main === module) (async () => {
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
  const { serve, launch } = require("../tests/e2e/lib.cjs"), srv = await serve(), browser = await launch(), errors = [];
  const open = async (query, [w, h], scale, extra = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, ...extra }), page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200))); page.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errors.push(m.text().slice(0, 200)));
    await page.goto(srv.base + "?" + query, { waitUntil: "commit", timeout: 180000 });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    return { ctx, page };
  };
  const size = arg("size", "270x480").split("x").map(Number), only = arg("only", null);
  const tl = await run({ open, out: path.resolve(arg("out", "tools/out/film")), fps: Number(arg("fps", 6)), size, only: only && only.split(",") });
  console.log(JSON.stringify(tl.map((s) => [s.id, s.secs, s.frames])), "errors:", [...new Set(errors)].slice(0, 6));
  await browser.close(); srv.close();
})();
