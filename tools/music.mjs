// Render the music of a visit to files, for listening: the same score (app/src/score.js) on the same instruments
// (app/src/instruments.js) the page uses, in an offline audio context in headless Chromium, along a scripted ten-minute
// walk. Writes tools/out/music/<mood>.mp3 (the whole walk), one excerpt per place, and report.json: peak, clipping,
// loudness over time, the longest silences and the phrase log. The bell, drum, wind and water are not in it: this is the
// music bus alone, as the "乐声" slider controls it.
//
//   node tools/music.mjs                       summer-day and winter-night
//   node tools/music.mjs autumn-dusk           one mood
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, "..", "app"), out = path.join(here, "out", "music");
const moods = process.argv.slice(2).length ? process.argv.slice(2) : ["summer-day", "winter-night"];
// The walk, as the unit test walks it: seconds in each place, and seals held along the way.
const WALK = [["grove", 70], ["stair", 60], ["gate", 45], ["court", 110], ["hall", 60], ["court", 25], ["upper", 120], ["summit", 110]];

const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { createConductor, createZoneKeeper, moodMusic, SECTION_LEVEL } from "/src/score.js";
import { createVoices, reverb } from "/src/instruments.js";
window.render = async (season, time, walk, seed) => {
  const sr = 44100, total = walk.reduce((a, [, s]) => a + s, 0) + 20, ctx = new OfflineAudioContext(2, sr * total, sr);
  // The page's chain for the music bus: a per-place level, dry and the court's reverb (or the hall's), a compressor.
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination);
  const section = ctx.createGain(), dry = ctx.createGain(), sOut = ctx.createGain(), sIn = ctx.createGain(), lvl = ctx.createGain();
  const outV = reverb(ctx, 3.2, 2.6), inV = reverb(ctx, 2.0, 3.2, 0.9);
  section.gain.value = 0; lvl.gain.value = 0.7 * 0.8; dry.gain.value = 0.7; sOut.gain.value = 0.55; sIn.gain.value = 0;
  section.connect(lvl); lvl.connect(dry); lvl.connect(sOut); lvl.connect(sIn); dry.connect(comp); sOut.connect(outV); sIn.connect(inV); outV.connect(comp); inV.connect(comp);
  const voices = createVoices(ctx, section), keeper = createZoneKeeper(2), c = createConductor(seed), mood = moodMusic(season, time), log = [];
  let t = 0, seals = 0, inside = false;
  for (const [zone, secs] of walk) {
    const t0 = t;
    for (; t < t0 + secs; t += 0.25) {
      if (zone === "upper" && t - t0 > 40) seals = Math.max(seals, 5);
      if (zone === "summit" && t - t0 > 30) seals = 7;
      const z = keeper.update(zone, t);
      if ((z === "hall") !== inside) { inside = z === "hall"; sOut.gain.setTargetAtTime(inside ? 0 : 0.55, t, 0.7); sIn.gain.setTargetAtTime(inside ? 0.6 : 0, t, 0.7); }
      const p = c.tick(t, z, seals, mood);
      if (p) { section.gain.setTargetAtTime(SECTION_LEVEL[p.section] ?? 0.8, t, 2); for (const e of p.events) voices.play(e, p.start + e.at); log.push({ at: +p.start.toFixed(2), place: z, section: p.section, length: +p.length.toFixed(1), rest: +(p.restEnd - p.notesEnd).toFixed(1), sig: p.sig }); }
    }
  }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
  // Numbers to go with the listening: peak, clipped samples, loudness in five-second windows, silences.
  let peak = 0, clipped = 0; const win = sr * 5, rms = [], silences = []; let quiet = 0;
  for (let i = 0; i < L.length; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a >= 0.999) clipped++; }
  for (let w = 0; w + win <= L.length; w += win) { let s = 0; for (let i = w; i < w + win; i++) s += L[i] * L[i] + R[i] * R[i]; rms.push(+(10 * Math.log10(s / (2 * win) + 1e-12)).toFixed(1)); }
  const blk = sr / 10; for (let w = 0; w + blk <= L.length; w += blk) { let m = 0; for (let i = w; i < w + blk; i++) m = Math.max(m, Math.abs(L[i])); if (m < 0.001) quiet++; else { if (quiet >= 30) silences.push([+((w / sr) - quiet / 10).toFixed(1), quiet / 10]); quiet = 0; } }
  // Sixteen-bit, interleaved, handed back in pieces.
  const pcm = new Int16Array(L.length * 2); for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-32768, Math.min(32767, L[i] * 32767)); pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, R[i] * 32767)); }
  window.__pcm = new Uint8Array(pcm.buffer);
  return { sr, seconds: total, bytes: window.__pcm.length, peak_dbfs: +(20 * Math.log10(peak)).toFixed(2), clipped, rms_db_5s: rms, silences_over_3s: silences, phrases: log };
};
// Each voice alone, a note at a time: the pitch it really sounds (autocorrelation over 0.3 s after the attack), in cents
// from what the score asked for.
window.tune = async (notes) => {
  const sr = 44100, res = [];
  for (const [voice, m] of notes) {
    const ctx = new OfflineAudioContext(1, sr * 3, sr), g = ctx.createGain(); g.connect(ctx.destination);
    createVoices(ctx, g).play({ voice, m, dur: 2, vel: 0.8 }, 0.01);
    const d = (await ctx.startRendering()).getChannelData(0), a = Math.floor(sr * 0.5), n = Math.floor(sr * 0.3), want = 440 * Math.pow(2, (m - 69) / 12);
    let best = 0, lag = 0; for (let L = Math.floor(sr / (want * 1.3)); L < Math.ceil(sr / (want / 1.3)); L++) { let s = 0; for (let i = a; i < a + n; i++) s += d[i] * d[i + L]; if (s > best) { best = s; lag = L; } }
    const y0 = (L) => { let s = 0; for (let i = a; i < a + n; i++) s += d[i] * d[i + L]; return s; }, l = y0(lag - 1), c = y0(lag), r = y0(lag + 1), frac = lag + 0.5 * (l - r) / (l - 2 * c + r || 1);
    let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
    res.push({ voice, m, want: +want.toFixed(2), got: +(sr / frac).toFixed(2), cents: +(1200 * Math.log2(sr / frac / want)).toFixed(1), peak: +peak.toFixed(3) });
  }
  return res;
};
window.chunk = (i, n) => { const a = window.__pcm.subarray(i, i + n); let s = ""; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); };
</script>`;

const types = { ".js": "text/javascript", ".html": "text/html" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/" || u === "/music.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(page); }
  const p = path.resolve(app, "." + path.posix.normalize(u)); if (!p.startsWith(app + path.sep) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${srv.address().port}/`, browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
fs.mkdirSync(out, { recursive: true });
const report = {};
{ const tab = await browser.newPage(); await tab.goto(base + "music.html"); await tab.waitForFunction(() => window.tune);
  const notes = []; for (const v of ["qin", "low", "harm", "xiao"]) for (const m of v === "low" ? [38, 43] : v === "harm" ? [67, 74, 79] : [55, 62, 67, 72]) notes.push([v, m]);
  report.tuning = await tab.evaluate((n) => window.tune(n), notes); await tab.close();
  for (const x of report.tuning) console.log(`  ${x.voice.padEnd(5)} ${x.m}: ${x.got} Hz for ${x.want} (${x.cents > 0 ? "+" : ""}${x.cents} cents), peak ${x.peak}`); }
for (const mood of moods) {
  const [season, time] = mood.split("-"), tab = await browser.newPage(); await tab.goto(base + "music.html"); await tab.waitForFunction(() => window.render);
  const t0 = Date.now(), r = await tab.evaluate(([s, t, w]) => window.render(s, t, w, 7), [season, time, WALK]);
  const parts = []; for (let i = 0; i < r.bytes; i += 4 << 20) parts.push(Buffer.from(await tab.evaluate(([a, b]) => window.chunk(a, b), [i, 4 << 20]), "base64"));
  const pcm = Buffer.concat(parts), wav = Buffer.alloc(44);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + pcm.length, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(r.sr, 24); wav.writeUInt32LE(r.sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(pcm.length, 40);
  const wavPath = path.join(out, mood + ".wav"); fs.writeFileSync(wavPath, Buffer.concat([wav, pcm]));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-q:a", "2", path.join(out, mood + ".mp3")]);
  // One excerpt per place, from where it settles to where the next begins.
  let at = 0; for (const [zone, secs] of WALK) { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(at), "-t", String(secs + 4), "-i", wavPath, "-af", `afade=t=out:st=${secs + 1}:d=3`, "-codec:a", "libmp3lame", "-q:a", "2", path.join(out, `${mood}-${String(at).padStart(3, "0")}-${zone}.mp3`)]); at += secs; }
  fs.unlinkSync(wavPath);
  report[mood] = { ...r, render_seconds: (Date.now() - t0) / 1000, walk: WALK };
  console.log(`${mood}: ${r.seconds}s, peak ${r.peak_dbfs} dBFS, ${r.clipped} clipped, ${r.phrases.length} phrases, rendered in ${report[mood].render_seconds}s`);
  await tab.close();
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
await browser.close(); srv.close();
console.log("→ " + out);
