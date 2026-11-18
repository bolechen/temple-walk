// The bells for the publicity films, rendered offline from the page's own instruments (app/src/instruments.js): the far
// bell up the mountain that opens the walk (audio.js `mountainBell`: low-passed, light, answered by the hillside) and the
// great bell struck with the log (`strike("bell")`). Music is not made here: tools/music.mjs writes that.
//   node tools/marketing-audio.mjs <out.wav> <seconds> '[["far",0.5],["bell",21.0],["bell",27.5]]'
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"), here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, "..", "app");
const [outFile, secs, events] = process.argv.slice(2), ev = JSON.parse(events);
const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { bell, hillEcho } from "/src/instruments.js";
window.render = async (secs, ev) => {
  const sr = 44100, ctx = new OfflineAudioContext(2, sr * secs, sr), bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(ctx.destination);
  const echo = hillEcho(ctx, bus);
  for (const [kind, at] of ev) {
    if (kind === "far") { const lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 900; g.gain.value = 0.42; lp.connect(g); g.connect(bus); bell(ctx, lp, at, 0.8, hillEcho(ctx, bus)); }
    else bell(ctx, bus, at, 1, echo);
  }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-32768, Math.min(32767, L[i] * 32767)); pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, R[i] * 32767)); }
  window.__pcm = new Uint8Array(pcm.buffer); return { sr, bytes: window.__pcm.length };
};
window.chunk = (i, n) => { const a = window.__pcm.subarray(i, i + n); let s = ""; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); };
</script>`;
const types = { ".js": "text/javascript", ".html": "text/html" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(page); }
  const p = path.resolve(app, "." + path.posix.normalize(u)); if (!p.startsWith(app + path.sep) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }), tab = await b.newPage();
await tab.goto(`http://127.0.0.1:${srv.address().port}/`); await tab.waitForFunction(() => window.render);
const r = await tab.evaluate(([s, e]) => window.render(s, e), [Number(secs), ev]), parts = [];
for (let i = 0; i < r.bytes; i += 4 << 20) parts.push(Buffer.from(await tab.evaluate(([a, n]) => window.chunk(a, n), [i, 4 << 20]), "base64"));
const pcm = Buffer.concat(parts), wav = Buffer.alloc(44);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + pcm.length, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(r.sr, 24); wav.writeUInt32LE(r.sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(pcm.length, 40);
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true }); fs.writeFileSync(outFile, Buffer.concat([wav, pcm])); console.log("wrote", outFile, secs + " s");
await b.close(); srv.close();
