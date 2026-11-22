// The trailer's sound (#610): the game's own score (app/src/score.js on app/src/instruments.js, as tools/music.mjs renders it)
// laid along the script's shots, with the bell up the mountain for the opening and the great bell where a shot strikes it,
// rendered offline in headless Chromium to exactly the film's length and faded out at its end. No recording is used.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url), { chromium } = require("playwright"), { serve } = require("./site.cjs");
const app = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app");

const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { createZoneKeeper, moodMusic } from "/src/score.js";
import { createPlayer, reverb, bell, hillEcho } from "/src/instruments.js";
window.render = async (script, seed) => {
  const sr = 44100, ctx = new OfflineAudioContext(2, Math.round(sr * script.length), sr);
  const comp = ctx.createDynamicsCompressor(), master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
  master.gain.setValueAtTime(1, 0); master.gain.setValueAtTime(1, script.length - 3); master.gain.linearRampToValueAtTime(0, script.length - 0.05);
  // The page's chain for the music: dry and the court's reverb (or the hall's).
  const section = ctx.createGain(), dry = ctx.createGain(), sOut = ctx.createGain(), sIn = ctx.createGain(), lvl = ctx.createGain();
  const outV = reverb(ctx, 3.2, 2.6), inV = reverb(ctx, 2.0, 3.2, 0.9);
  section.gain.value = 1; lvl.gain.value = 0.7 * 0.8; dry.gain.value = 0.7; sOut.gain.value = 0.55; sIn.gain.value = 0;
  section.connect(lvl); lvl.connect(dry); lvl.connect(sOut); lvl.connect(sIn); dry.connect(master); sOut.connect(outV); sIn.connect(inV); outV.connect(master); inV.connect(master);
  const player = createPlayer(ctx, section, seed), keeper = createZoneKeeper(2), log = [];
  let inside = false;
  for (let t = 0; t < script.length; t += 0.25) {
    const shot = script.shots.find((s) => t >= s.from && t < s.to) || script.shots[script.shots.length - 1];
    const z = keeper.update(shot.zone, t);
    if ((z === "hall") !== inside) { inside = z === "hall"; sOut.gain.setTargetAtTime(inside ? 0 : 0.55, t, 0.7); sIn.gain.setTargetAtTime(inside ? 0.6 : 0, t, 0.7); }
    const p = player.tick(t, z, 0, moodMusic(shot.season, shot.time));
    if (p && !p.cut) log.push({ at: +p.start.toFixed(2), place: z, section: p.section });
  }
  // The bells: up the mountain as the film opens (audio.js mountainBell: low-passed at 900 Hz, 0.42, answered by the hill), and the great bell where a shot strikes it.
  const fx = ctx.createGain(); fx.connect(master);
  const far = ctx.createBiquadFilter(), farG = ctx.createGain(); far.type = "lowpass"; far.frequency.value = 900; farG.gain.value = 0.42; far.connect(farG); farG.connect(fx);
  bell(ctx, far, 0.25, 0.8, hillEcho(ctx, fx));
  const echo = hillEcho(ctx, fx), strokes = [];
  for (const s of script.shots) for (const e of s.events || []) if (e.strike === "bell") { bell(ctx, fx, s.from + e.at, 1, echo); strokes.push(+(s.from + e.at).toFixed(2)); }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, clipped = 0; for (let i = 0; i < L.length; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a >= 0.999) clipped++; }
  const pcm = new Int16Array(L.length * 2); for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-32768, Math.min(32767, L[i] * 32767)); pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, R[i] * 32767)); }
  window.__pcm = new Uint8Array(pcm.buffer);
  return { sr, seconds: script.length, bytes: window.__pcm.length, peak_dbfs: +(20 * Math.log10(peak || 1e-9)).toFixed(2), clipped, phrases: log.length, bell_strokes: strokes };
};
window.chunk = (i, n) => { const a = window.__pcm.subarray(i, i + n); let s = ""; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); };
</script>`;

/** Renders the score of `script` to a 16-bit stereo WAV at `wavPath`; returns what was measured. */
export async function renderScore(script, wavPath) {
  const srv = await serve(app, { api: false, handler: (req, res, u) => (u === "/" || u === "/trailer-audio.html") && (res.writeHead(200, { "content-type": "text/html" }), res.end(page), true) });
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const tab = await browser.newPage(); await tab.goto(srv.base + "trailer-audio.html"); await tab.waitForFunction(() => window.render);
    const r = await tab.evaluate(([s, seed]) => window.render(s, seed), [script, 7]);
    const parts = []; for (let i = 0; i < r.bytes; i += 4 << 20) parts.push(Buffer.from(await tab.evaluate(([a, b]) => window.chunk(a, b), [i, 4 << 20]), "base64"));
    const pcm = Buffer.concat(parts), head = Buffer.alloc(44);
    head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
    head.writeUInt32LE(r.sr, 24); head.writeUInt32LE(r.sr * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(wavPath, Buffer.concat([head, pcm]));
    return r;
  } finally { await browser.close(); srv.close(); }
}
