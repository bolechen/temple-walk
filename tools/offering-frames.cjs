// The four moments of a coin put into the 功德箱, each from the box's own shot, in the great hall (issue #202):
// the palms and the first bow, the right hand offering the coin over the slot, the let go, and the second bow. The
// observances' clock is held (`__riteClock`) and stepped, so that the moments are the same however slowly the page draws.
//   node tools/offering-frames.cjs [outdir] [--aspect=16x9,4x3,phone] [--moments=1,2,3,4] [--small]    software rendering → <outdir>/offering-<aspect>-<moment>.png
//   node tools/offering-frames.cjs --spec                                                      the same for tools/gpu-render.sh (16:9 and the door), as its JSON spec
const FRAMES = [["1-palms", 450], ["2-offer", 2000], ["3-let-go", 3100], ["4-bow", 4800]];   // milliseconds on the clock after his hands begin
const SIZES = { "16x9": [1920, 1080], "4x3": [1440, 1080], phone: [540, 1170] };
const SMALL = { "16x9": [960, 540], "4x3": [800, 600], phone: [360, 780] };   // --small: software rendering draws a frame in seconds at these
const QUERY = "enter&in=main&q=high&season=summer&time=day";
const DOOR = "in=main&cam=120,5.6,0,0.04&view=third&shot=1&enter&q=high&season=summer&time=day";   // as he comes in at the door, seen from behind him

// The page script: stand before the box, press the button, hold the clock, let the eye reach its shot (two seconds on the clock),
// and step on to `T` milliseconds after his hands begin.
const moment = (T) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fr = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = window.__gallery["main-box"]; window.__pose(b.at[0], b.at[1] + 0.2, Math.PI - b.face, 0.05);
  for (let i = 0; i < 150 && document.getElementById("act").hidden; i++) await sleep(100);
  window.__riteClock(0); document.getElementById("act").click();
  for (let i = 0; i < 40; i++) { window.__riteClock(50); await fr(); }
  for (let i = 0; i < 200 && window.__coin().began === null; i++) await sleep(50);
  const t0 = window.__coin().began; let now = window.__riteClock(0);
  while (now - t0 < ${T}) { now = window.__riteClock(50); await fr(); }
  await fr(); await fr();
})()`;

if (process.argv.includes("--spec")) {
  const shots = FRAMES.map(([name, T]) => ({ file: `after-16x9-${name}`, query: QUERY, size: SIZES["16x9"], wait: 2500, js: moment(T) }));
  shots.push({ file: "door-day-third", query: DOOR, size: SIZES["16x9"], wait: 3000 });
  console.log(JSON.stringify({ seconds: 0, bench: [], size: SIZES["16x9"], shots }));
  process.exit(0);
}

const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || d;
const out = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "offering-frames");
const aspects = arg("aspect", "16x9,4x3,phone").split(","), moments = arg("moments", "1,2,3,4").split(",").map(Number);
const small = process.argv.includes("--small"), root = require("./site.cjs").site();
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg", ".wasm": "application/wasm" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const aspect of aspects) for (const m of moments) {
    const [name, T] = FRAMES[m - 1], [w, h] = (small ? SMALL : SIZES)[aspect], p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: "zh-CN" }), errs = [];
    p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (c) => c.type() === "error" && errs.push(c.text().slice(0, 200)));
    await p.goto(`${base}?${small ? QUERY.replace("q=high", "q=low") : QUERY}`); await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 }); await p.waitForTimeout(800);
    await p.evaluate(moment(T)); const file = path.join(out, `offering-${aspect}-${name}.png`); await p.screenshot({ path: file }); console.log(file, errs.length ? "errors: " + errs.join(" | ") : "");
    await p.close();
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
