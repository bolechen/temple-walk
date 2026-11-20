// The mountain's sound against the music, and against the walls of a hall (#331). In headless Chromium, with the page's own
// audio.js: (1) offline, the wind through the air stage (`createAir`, `setAir`) out of doors and in a hall: how many dB
// the whole falls, how many above 2 kHz, how long the change takes; (2) live, the real ambience and music buses in the
// court, on the stair and in a hall with the gust held at its mean: how far the mountain sits under the music; (3) with
// --render, one listening file: court, into the hall, out again (wind, the hall's reverb on the music).
//
//   node tools/mountain-sound.mjs [outdir]          numbers → <outdir>/report.json   (default tools/out/mountain)
//   node tools/mountain-sound.mjs [outdir] --render  and <outdir>/court-hall-court.mp3 (and -before.mp3: the wind as it was)
//   MOUNTAIN_LIVE=0 skips the live half (about 3 minutes)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url), { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, "..", "app");
const args = process.argv.slice(2), out = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(here, "out", "mountain")), render = args.includes("--render");
const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { AIR, windGains, createAir, setAir } from "/src/audio.js";
import { gust } from "/src/wind.js";
import { createZoneKeeper, moodMusic } from "/src/score.js";
import { createPlayer, reverb } from "/src/instruments.js";
const SR = 44100, db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
// The page's wind: brown noise in a loop, a band at 420 Hz and a high pass at 2.6 kHz, their gains set every quarter second.
const brown = (ctx) => { const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let last = 0, s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * rnd()) / 1.02; d[i] = last * 3.5; } for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] = d[i] * k + d[len - 2000 + i] * (1 - k); } return b; };
const wind = (ctx, to) => { const buf = brown(ctx), layer = (type, freq, q, rate) => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0; s.connect(f); f.connect(g); g.connect(to); s.start(); return g; };
  return { low: layer("bandpass", 420, 0.5, 0.95), leaves: layer("highpass", 2600, 0.3, 1.1) }; };
// What the page's tick does every 0.25 s: set the wind's two gains for the moment and the air stage for the room.
const drive = (ctx, w, air, seconds, place) => { let inside = null; for (let t = 0; t < seconds; t += 0.25) { const p = place(t), g = windGains(gust(p.t), p.grove, p.zone === "hall");
  w.low.gain.setTargetAtTime(g.low, t, 0.8); w.leaves.gain.setTargetAtTime(g.leaves, t, 0.6); if ((p.zone === "hall") !== inside) { inside = p.zone === "hall"; setAir(air, inside, t); } } };
// Magnitude spectrum of a stretch, Hann-windowed, averaged over 8192-sample blocks: [low dB total, dB above 2 kHz].
const fft = (re, im) => { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), x = i + k + len / 2, tr = re[x] * c - im[x] * s, ti = re[x] * s + im[x] * c; re[x] = re[i + k] - tr; im[x] = im[i + k] - ti; re[i + k] += tr; im[i + k] += ti; } } };
const bands = (d, from, to) => { const N = 8192; let all = 0, hi = 0, n = 0; for (let o = from; o + N <= to; o += N) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = d[o + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im);
  for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k], f = k * SR / N; all += p; if (f >= 2000) hi += p; } n++; } return { all, hi, n }; };
window.offline = async () => {
  const total = 60, ctx = new OfflineAudioContext(1, SR * total, SR), air = createAir(ctx, ctx.destination), w = wind(ctx, air.in);
  // out of doors 0-20 s, in a hall 20-40 s, out again 40-60 s; the gust held at 0.5 (a middling wind), the court's grove 0.12
  let mid = 1e6; while (Math.abs(gust(mid) - 0.5) > 0.001) mid += 0.01;   // a moment when the gust is 0.5, held
  const hold = (t) => ({ t: mid, grove: 0.12, zone: t >= 20 && t < 40 ? "hall" : "court" }), g0 = gust(mid);
  drive(ctx, w, air, total, hold);
  const d = (await ctx.startRendering()).getChannelData(0), seg = (a, b) => bands(d, Math.floor(a * SR), Math.floor(b * SR));
  const outA = seg(8, 18), inA = seg(30, 38), outB = seg(50, 58), rms = (x) => db(Math.sqrt(x.all)), hi = (x) => db(Math.sqrt(x.hi));
  // the air stage alone, fed a constant 1: its gain over time, for how long a change takes
  const c2 = new OfflineAudioContext(1, SR * 8, SR), a2 = createAir(c2, c2.destination), one = c2.createBufferSource(), ob = c2.createBuffer(1, SR * 8, SR); ob.getChannelData(0).fill(1); one.buffer = ob; one.connect(a2.in); one.start();
  setAir(a2, true, 1); setAir(a2, false, 4.5);
  const gain = (await c2.startRendering()).getChannelData(0), settle = (t0, final) => { for (let i = Math.floor(t0 * SR); i < gain.length; i++) if (Math.abs(db(gain[i]) - db(final)) < 1 && Math.abs(db(gain[Math.min(gain.length - 1, i + SR * 0.2 | 0)]) - db(final)) < 1) return +(i / SR - t0).toFixed(2); return null; };
  return { gust: g0, outdoors: { total_db: +rms(outA).toFixed(1), above_2k_db: +hi(outA).toFixed(1) }, hall: { total_db: +rms(inA).toFixed(1), above_2k_db: +hi(inA).toFixed(1) }, back_outdoors: { total_db: +rms(outB).toFixed(1), above_2k_db: +hi(outB).toFixed(1) },
    fall_db: +(rms(outA) - rms(inA)).toFixed(1), fall_above_2k_db: +(hi(outA) - hi(inA)).toFixed(1),
    seconds_to_settle_going_in: settle(1, AIR.in.gain), seconds_to_settle_coming_out: settle(4.5, AIR.out.gain), air: { in: AIR.in, out: AIR.out, tc: AIR.tc } };
};
// The live buses through the page's own audio.js: the music and the place, the gust held at its middle, in each place for a while.
window.live = async (zone, secs, t, season = "summer", time = "day", snow = 0, wet = 0) => {
  const A = await import("/src/audio.js");
  window.__zone = zone; window.__t = t; window.__mood = [season, time, snow, wet];
  if (!window.__started) { A.startAmbience(() => ({ grove: window.__zone === "grove" ? 1 : window.__zone === "upper" || window.__zone === "summit" ? 0.55 : 0.12, zone: window.__zone, season: window.__mood[0], time: window.__mood[1], wet: window.__mood[3], snow: window.__mood[2], t: window.__t })); window.__started = true; }
  await new Promise((k) => setTimeout(k, 4000));   // let the zone settle (2 s) and the air change
  const mus = [], amb = [], t0 = performance.now();
  while (performance.now() - t0 < secs * 1000) { const m = A.listen("music"), a = A.listen("ambience"); if (m.rms > 0) mus.push(m.rms); amb.push(a.rms); await new Promise((k) => setTimeout(k, 100)); }
  const mean = (v) => v.reduce((a, x) => a + x, 0) / (v.length || 1), pct = (v, q) => [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(q * v.length))] || 0, r1 = (x) => +x.toFixed(1);
  const m = mean(mus), a = mean(amb);
  return { zone, season, time, snow, music_mean_db: r1(db(m)), music_p90_db: r1(db(pct(mus, 0.9))), music_max_db: r1(db(Math.max(0, ...mus))), mountain_mean_db: r1(db(a)), mountain_max_db: r1(db(Math.max(0, ...amb))),
    mountain_minus_music_mean_db: r1(db(a) - db(m)), mountain_minus_music_p90_db: r1(db(a) - db(pct(mus, 0.9))), n: amb.length };
};
// One listening file: the court, into a hall and out again. The music is the page's score on the page's music chain (as
// tools/music.mjs has it), the wind the page's wind through the air stage, both on the buses' levels and one compressor.
window.walk = async (walkSpec, seed, heldGust, before = false) => {
  const total = walkSpec.reduce((a, [, s]) => a + s, 0) + 8, ctx = new OfflineAudioContext(2, SR * total, SR), comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
  const section = ctx.createGain(), lvl = ctx.createGain(), dry = ctx.createGain(), sOut = ctx.createGain(), sIn = ctx.createGain(), outV = reverb(ctx, 3.2, 2.6), inV = reverb(ctx, 2.0, 3.2, 0.9);
  lvl.gain.value = 0.7 * 0.8; dry.gain.value = 0.7; sOut.gain.value = 0.55; sIn.gain.value = 0; section.connect(lvl); lvl.connect(dry); lvl.connect(sOut); lvl.connect(sIn); dry.connect(comp); sOut.connect(outV); sIn.connect(inV); outV.connect(comp); inV.connect(comp);
  const alvl = ctx.createGain(), adry = ctx.createGain(), aOut = ctx.createGain(), aIn = ctx.createGain(); alvl.gain.value = 0.8 * 0.8; adry.gain.value = 0.8; aOut.gain.value = 0.45; aIn.gain.value = 0;
  alvl.connect(adry); alvl.connect(aOut); alvl.connect(aIn); adry.connect(comp); aOut.connect(outV); aIn.connect(inV);
  const air = createAir(ctx, alvl), w = wind(ctx, air.in), player = createPlayer(ctx, section, seed), keeper = createZoneKeeper(2), mood = moodMusic("summer", "day");
  let t = 0, inside = null;
  for (const [zone, secs] of walkSpec) for (const t0 = t; t < t0 + secs; t += 0.25) {
    const z = keeper.update(zone, t), isHall = z === "hall", g = before ? { low: 0.5 * gust(30 + t) * 0.428, leaves: 0.16 * gust(30 + t) ** 2 * 0.2524 } : windGains(heldGust ?? gust(30 + t), 0.12, isHall);   // before: the wind as it was until #331, the same in a hall
    w.low.gain.setTargetAtTime(g.low, t, 0.8); w.leaves.gain.setTargetAtTime(g.leaves, t, 0.6);
    if (isHall !== inside) { inside = isHall; if (!before) setAir(air, inside, t); sOut.gain.setTargetAtTime(inside ? 0 : 0.55, t, 0.7); sIn.gain.setTargetAtTime(inside ? 0.6 : 0, t, 0.7); aOut.gain.setTargetAtTime(inside ? 0 : 0.45, t, 0.7); aIn.gain.setTargetAtTime(inside ? 0.5 : 0, t, 0.7); }
    player.tick(t, z, 0, mood);
  }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-32768, Math.min(32767, L[i] * 32767)); pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, R[i] * 32767)); }
  window.__pcm = new Uint8Array(pcm.buffer); return { sr: SR, bytes: window.__pcm.length, seconds: total };
};
window.chunk = (i, n) => { const a = window.__pcm.subarray(i, i + n); let s = ""; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); };
</script>`;
const types = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/" || u === "/m.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(page); }
  const p = path.resolve(app, "." + path.posix.normalize(u)); if (!p.startsWith(app + path.sep) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${srv.address().port}/`, browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
fs.mkdirSync(out, { recursive: true }); const report = {};
const open = async () => { const tab = await browser.newPage(); tab.on("pageerror", (e) => console.error("page error:", e.message)); await tab.goto(base + "m.html"); await tab.waitForFunction(() => window.offline); return tab; };
{ const tab = await open(); report.offline = await tab.evaluate(() => window.offline()); console.log("offline:", JSON.stringify(report.offline)); await tab.close(); }
if (process.env.MOUNTAIN_LIVE !== "0") {
  const tab = await open(); report.live = [];
  // a moment when the gust is 0.5, held (the page asks for the wind at `t`)
  const mid = await tab.evaluate(async () => { const { gust } = await import("/src/wind.js"); for (let x = 1e6; ; x += 0.01) if (Math.abs(gust(x) - 0.5) < 0.001) return x; });
  const plan = process.env.MOUNTAIN_PLAN ? JSON.parse(process.env.MOUNTAIN_PLAN) : [["court", 90], ["stair", 90], ["hall", 40], ["court", 20]];
  for (const [zone, secs, season, time, snow, wet] of plan) { const r = await tab.evaluate(([z, s, g, se, ti, sn, we]) => window.live(z, s, g, se, ti, sn, we), [zone, secs, mid, season, time, snow, wet]); report.live.push(r); console.log("live:", JSON.stringify(r)); }
  await tab.close();
}
if (render) {
  // The same walk twice, the wind as it was and as it is, at one fixed gain (no loudness matching between the two: the
  // difference in level is the point), +14 dB to bring the quiet buses up to a comfortable level.
  const spec = JSON.parse(process.env.MOUNTAIN_WALK || '[["court",40],["hall",40],["court",40]]'); report.render = { walk: spec, gain_db: 14 };
  for (const [name, before] of [["court-hall-court", false], ["court-hall-court-before", true]]) {
    const tab = await open(), r = await tab.evaluate(([w, bf]) => window.walk(w, 7, null, bf), [spec, before]), parts = []; for (let i = 0; i < r.bytes; i += 4 << 20) parts.push(Buffer.from(await tab.evaluate(([a, b]) => window.chunk(a, b), [i, 4 << 20]), "base64"));
    const pcm = Buffer.concat(parts), wav = Buffer.alloc(44); wav.write("RIFF", 0); wav.writeUInt32LE(36 + pcm.length, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(r.sr, 24); wav.writeUInt32LE(r.sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(pcm.length, 40);
    const wp = path.join(out, name + ".wav"); fs.writeFileSync(wp, Buffer.concat([wav, pcm]));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wp, "-af", "volume=14dB", "-codec:a", "libmp3lame", "-q:a", "2", path.join(out, name + ".mp3")]); fs.unlinkSync(wp);
    report.render.seconds = r.seconds; await tab.close();
  }
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1)); await browser.close(); srv.close(); console.log("→ " + out);
