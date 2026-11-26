// T05's first sound field, rendered for listening and measured (docs/t05/SOUND.md §1; score.js `layerOf`): the page's own air stage,
// wind, Z1 floor (`BED`), dry-stone steps and the three reverbs, offline in headless Chromium, along a short walk: the court, in under
// the great hall's roof (walking, then standing), and out again. Writes <outdir>/t05-court-hall-court.mp3 (+14 dB, as mountain-sound's
// files are) and <outdir>/report.json: the measured RT60 of each reverb's impulse (T20 from the backward-integrated energy, times three),
// the peak (dBFS, before the +14 dB), the loudness of each stretch and every silence of 1.5 s or more under -70 dBFS (a window of 0.25 s).
//
//   node tools/t05-sound.mjs [outdir]       (default tools/out/t05-sound)
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url), { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, "..", "app");
const out = path.resolve(process.argv[2] || path.join(here, "out", "t05-sound"));
const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { AIR, windGains, createAir, setAir, COURT_VERB, TIMBER_VERB, HALL_VERB, BED, bedGain } from "/src/audio.js";
import { gust } from "/src/wind.js"; import { reverb } from "/src/instruments.js"; import { stepSound, LEVEL } from "/src/steps.js";
const SR = 44100, mk = (V) => (c) => reverb(c, V.seconds, V.power, V.dark);
const brown = (ctx) => { const len = SR * 4, b = ctx.createBuffer(1, len, SR), d = b.getChannelData(0); let last = 0, s = 7; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * r()) / 1.02; d[i] = last * 3.5; } for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] = d[i] * k + d[len - 2000 + i] * (1 - k); } return b; };
// The time a reverb's own impulse takes to fall: to -60 dB of its backward-integrated energy (Schroeder), and T20 (-5 to -25 dB) times three.
window.measure = async (name) => { const V = { court: COURT_VERB, timber: TIMBER_VERB, hall: HALL_VERB }[name], ctx = new OfflineAudioContext(1, SR * 9, SR), c = mk(V)(ctx), s = ctx.createBufferSource(), b = ctx.createBuffer(1, 1, SR); b.getChannelData(0)[0] = 1; s.buffer = b; s.connect(c); c.connect(ctx.destination); s.start(0);
  const d = (await ctx.startRendering()).getChannelData(0); let tot = 0; for (const x of d) tot += x * x; let acc = tot, t5 = null, t25 = null, t60 = null; for (let i = 0; i < d.length; i++) { acc -= d[i] * d[i]; const db = 10 * Math.log10(Math.max(acc, 1e-30) / tot); if (t5 === null && db <= -5) t5 = i / SR; if (t25 === null && db <= -25) t25 = i / SR; if (t60 === null && db <= -60) t60 = i / SR; }
  return { name, seconds: V.seconds, power: V.power, dark: V.dark, rt60_to_minus60_s: +t60.toFixed(2), rt60_t20_s: +(3 * (t25 - t5)).toFixed(2) }; };
window.walk = async (spec) => {
  const total = spec.reduce((a, [, s]) => a + s, 0) + 8, ctx = new OfflineAudioContext(2, SR * total, SR), comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
  const outV = mk(COURT_VERB)(ctx), longV = mk(HALL_VERB)(ctx); outV.connect(comp); longV.connect(comp);
  const G = () => ctx.createGain(), bus = (lvl, dry, wet) => { const b = { in: G(), duck: G(), dry: G(), out: G(), long: G() }; b.dry.gain.value = dry; b.out.gain.value = wet; b.long.gain.value = 0; b.wet = wet;
    b.in.connect(b.duck); b.duck.connect(b.dry); b.duck.connect(b.out); b.duck.connect(b.long); b.dry.connect(comp); b.out.connect(outV); b.long.connect(longV); b.in.gain.value = lvl; return b; };
  const amb = bus(0.8, 0.8, 0.45), fx = bus(1, 0.8, 0.07); fx.wet = 0.07; const air = createAir(ctx, amb.in);
  const noise = brown(ctx), layer = (type, f, q, rate) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = G(); s.buffer = noise; s.loop = true; s.playbackRate.value = rate; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(air.in); s.start(); return g; };
  const low = layer("bandpass", 420, 0.5, 0.95), leaves = layer("highpass", 2600, 0.3, 1.1), bed = layer("lowpass", BED.cutoff, 0.5, 0.6);
  // the effects bus's steps: dry stone, as a paved court and a hall's floor sound
  const step = (t, seed, hall) => { const d = stepSound("stone", SR, { seed, speed: 2.1 }), b = ctx.createBuffer(1, d.length, SR); b.getChannelData(0).set(d); const s = ctx.createBufferSource(); s.buffer = b; const g = G(); g.gain.value = LEVEL.stone; s.connect(g); g.connect(fx.in); s.start(t); };
  let t = 0, inside = null, seed = 1; const walking = [];
  for (const [zone, secs, steps] of spec) { const t0 = t; for (; t < t0 + secs; t += 0.25) {
    const hall = zone === "hall", g = windGains(gust(30 + t), 0.12, hall);
    low.gain.setTargetAtTime(g.low, t, 0.8); leaves.gain.setTargetAtTime(g.leaves, t, 0.6); bed.gain.setTargetAtTime(bedGain(t), t, 1.2);
    if (hall !== inside) { inside = hall; setAir(air, hall, t); for (const b of [amb, fx]) { b.out.gain.setTargetAtTime(hall ? 0 : b.wet, t, 0.7); b.long.gain.setTargetAtTime(hall ? (b === amb ? b.wet * 1.1 : 0.4) : 0, t, 0.7); } }
  } if (steps) for (let k = t0 + 0.5; k < t0 + steps; k += 0.58) step(k, seed++, zone === "hall"); }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), pcm = new Int16Array(L.length * 2); let peak = 0;
  for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); pcm[2 * i] = Math.max(-32768, Math.min(32767, L[i] * 32767)); pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, R[i] * 32767)); }
  const win = SR / 4, rms = []; for (let o = 0; o + win <= L.length; o += win) { let s = 0; for (let i = 0; i < win; i++) s += L[o + i] * L[o + i] + R[o + i] * R[o + i]; rms.push(10 * Math.log10(Math.max(s / (2 * win), 1e-14))); }
  window.__pcm = new Uint8Array(pcm.buffer); return { sr: SR, bytes: window.__pcm.length, seconds: total, peak_db: +(20 * Math.log10(peak)).toFixed(1), rms };
};
window.chunk = (i, n) => { const a = window.__pcm.subarray(i, i + n); let s = ""; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); };
</script>`;
const { serve } = require("./site.cjs");
const srv = await serve(app, { api: false, handler: (req, res, u) => (u === "/" || u === "/m.html") && (res.writeHead(200, { "content-type": "text/html" }), res.end(page), true) });
const base = `http://127.0.0.1:${srv.address().port}/`, browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
fs.mkdirSync(out, { recursive: true });
const tab = await browser.newPage(); tab.on("pageerror", (e) => console.error("page error:", e.message)); await tab.goto(base + "m.html"); await tab.waitForFunction(() => window.measure);
const spec = [["court", 25, 20], ["hall", 50, 14], ["court", 25, 20]], report = { walk: spec.map(([z, s, w]) => ({ layer: z, seconds: s, walking_seconds: w })), note: "peak before the +14 dB of the mp3; the walk is one court, the hall (walking, then standing), the court" };
report.reverbs = []; for (const n of ["court", "timber", "hall"]) report.reverbs.push(await tab.evaluate((x) => window.measure(x), n));
const r = await tab.evaluate((s) => window.walk(s), spec), parts = []; for (let i = 0; i < r.bytes; i += 4 << 20) parts.push(Buffer.from(await tab.evaluate(([a, b]) => window.chunk(a, b), [i, 4 << 20]), "base64"));
const pcm = Buffer.concat(parts), wav = Buffer.alloc(44); wav.write("RIFF", 0); wav.writeUInt32LE(36 + pcm.length, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(r.sr, 24); wav.writeUInt32LE(r.sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(pcm.length, 40);
const wp = path.join(out, "t05-court-hall-court.wav"); fs.writeFileSync(wp, Buffer.concat([wav, pcm]));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wp, "-af", "volume=14dB", "-codec:a", "libmp3lame", "-q:a", "2", path.join(out, "t05-court-hall-court.mp3")]); fs.unlinkSync(wp);
// loudness by stretch, and the silences (0.25 s windows under -70 dBFS, runs of 1.5 s or more)
const rms = r.rms, at = (a, b) => rms.slice(Math.floor(a * 4), Math.floor(b * 4)); report.peak_db = r.peak_db; report.seconds = r.seconds;
let t0 = 0; report.stretches = spec.map(([z, s]) => { const w = at(t0, t0 + s), mean = 10 * Math.log10(w.reduce((a, d) => a + 10 ** (d / 10), 0) / w.length); const o = { layer: z, from: t0, to: t0 + s, mean_db: +mean.toFixed(1) }; t0 += s; return o; });
report.silences = []; { let run = 0; rms.forEach((d, i) => { if (d < -70) run++; else { if (run >= 6) report.silences.push({ from: (i - run) / 4, seconds: run / 4 }); run = 0; } }); if (run >= 6) report.silences.push({ from: (rms.length - run) / 4, seconds: run / 4 }); }
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1)); await browser.close(); srv.close(); console.log(JSON.stringify(report, null, 1)); console.log("→ " + out);
