// The novice from every side, for a change to his body (issue #80; AGENTS.md「改形体的，从几个方向看」): standing, palms
// together and walking, each from the front, the side and behind, then sitting on a stool and cross-legged on a cushion
// from the front and from behind, in one sheet with a row to a pose.
//   node tools/novice-views.cjs [season-time] [sculpt] [out.png]   → tools/out/novice-views-<code|sculpt>.png
// Like portrait.js he is found in the photograph's picture wherever the eye has him, and the panel is cut round him. He
// walks on the spot (`__act`), so the walking row catches each view at another moment of the stride; the seats are real
// ones from the plan (`__seats`, `__sit`), and the eye is turned round him there with a drag, as a visitor would.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = require("./site.cjs").site(), out = path.join(__dirname, "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".glb": "model/gltf-binary", ".css": "text/css", ".woff2": "font/woff2", ".ktx2": "image/ktx2", ".wasm": "application/wasm" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const [season = "summer", time = "day"] = (process.argv[2] || "").split("-");
  const sculpt = process.argv.includes("sculpt"), dest = process.argv.find((a) => a.endsWith(".png")) || path.join(out, `novice-views-${sculpt ? "sculpt" : "code"}.png`);
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 760 }, deviceScaleFactor: 2, locale: "zh-CN" });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&q=high&view=third&season=${season}&time=${time}&cam=0,24,0,-0.05${sculpt ? "&body=sculpt" : ""}`, { waitUntil: "commit", timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 180000 });
  if (sculpt) await p.waitForFunction(() => window.__yard().dressed === true, null, { timeout: 600000 }).catch(() => { throw new Error("the sculpted body did not arrive"); });   // fetched after the first frames, which software rendering draws slowly at this size
  const W = 150, H = 320;
  const bare = () => p.evaluate(() => { document.body.classList.add("bare"); for (const id of ["frame", "photoBar", "photoClose", "photoSettings"]) { const e = document.getElementById(id); if (e) e.style.display = "none"; } });
  const box = () => p.evaluate(() => window.__probe().monkBox);
  const inView = (q) => q && q[0] > 4 && q[1] > 4 && q[0] + q[2] < 1496 && q[1] + q[3] < 756;
  /** Zoom the photograph until he fills the panel, and cut the panel round him. */
  async function frame(open, settle) {
    await open(1); await p.waitForTimeout(settle);
    let q = await box(); if (!q) throw new Error("the novice is not in the picture");
    let zoom = Math.min(6, (H * 0.86) / q[3]);
    for (;;) { await open(zoom); await p.waitForTimeout(900); const z = await box(); if (inView(z) || zoom <= 1) { q = z || q; break; } zoom = Math.max(1, zoom * 0.85); }
    const x = Math.min(Math.max(0, q[0] + q[2] / 2 - W / 2), 1500 - W), y = Math.min(Math.max(0, q[1] + q[3] / 2 - H / 2), 760 - H);
    return p.screenshot({ clip: { x, y, width: W, height: H }, timeout: 240000 });
  }
  const rows = [];
  // standing, palms together, walking: front (the eye before him), side (his left), behind
  const sides = [["正", Math.PI], ["侧", Math.PI * 1.5], ["背", 0]];
  for (const [label, act] of [["站立", { speed: 0 }], ["合掌", { speed: 0, pose: "pray" }], ["走路", { speed: 2.1 }]]) {
    const row = { label, shots: [] };
    for (const [side, yaw] of sides) {
      const open = (zoom) => p.evaluate(([y, a, z]) => { window.__pose(0, 24, y, -0.1); window.__act(a); window.__photo(true, { aspect: "screen", monk: true, zoom: z }); }, [yaw, act, zoom]);
      const s = await frame(async (z) => { await open(z); await bare(); }, rows.length || row.shots.length ? 3000 : 5000);
      row.shots.push([side, s]); console.log(`${label} ${side}`);
    }
    rows.push(row);
  }
  await p.evaluate(() => { window.__act(null); window.__photo(false); });
  // the seats: a stool at the tea table, the cushion on the summit
  for (const [label, kind] of [["坐凳", "stool"], ["盘坐", "cushion"]]) {
    const row = { label, shots: [] };
    const k = await p.evaluate((kind) => window.__seats.findIndex((s) => !s.room && s.kind === kind), kind);
    if (k < 0) throw new Error(`no ${kind} out of doors`);
    await p.evaluate((k) => { const s = window.__seats[k]; for (let a = 0; a < 24; a++) for (const r of [0.6, 0.9, 1.3]) { const x = s.at[0] + Math.sin(a * 0.2618) * r, z = s.at[1] + Math.cos(a * 0.2618) * r; if (!window.__blocked(x, z)) { window.__pose(x, z, 0, 0); window.__sit(k); return; } } }, k);
    await p.waitForFunction((want) => { const y = window.__yard(); return y.pose === want && !y.climbing; }, kind === "stool" ? "chair" : "sit", { timeout: 120000 });
    await p.waitForTimeout(4000);
    const face = await p.evaluate((k) => window.__seats[k].face, k);   // the way he faces, sitting there
    for (const [side, off] of [["正", Math.PI], ["背", 0]]) {
      // turn the eye round him with a drag until it looks the way wanted (the drag turns the view, not him)
      for (let tries = 0; tries < 12; tries++) {
        const yaw = await p.evaluate(() => window.__yard().yaw), want = face + off, d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
        if (Math.abs(d) < 0.08) break;
        await p.mouse.move(750, 380); await p.mouse.down(); await p.mouse.move(750 - d * 120, 380, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
      }
      const s = await frame(async (z) => { await p.evaluate((z) => window.__photo(true, { aspect: "screen", monk: true, zoom: z }), z); await bare(); }, 3000);
      await p.evaluate(() => window.__photo(false));
      row.shots.push([side, s]); console.log(`${label} ${side}`);
    }
    rows.push(row);
  }
  const cols = Math.max(...rows.map((r) => r.shots.length));
  const html = `<body style="margin:0;background:#111;font:14px sans-serif;color:#ddd">${rows.map((r) => `<div style="display:flex;align-items:stretch"><div style="width:44px;writing-mode:vertical-rl;display:flex;align-items:center;justify-content:center">${r.label}</div>${r.shots.map(([s, img]) => `<div style="position:relative"><img style="display:block;width:${W}px;height:${H}px" src="data:image/png;base64,${img.toString("base64")}"><span style="position:absolute;left:6px;top:4px;text-shadow:0 0 3px #000">${s}</span></div>`).join("")}</div>`).join("")}</body>`;
  await p.setViewportSize({ width: 44 + W * cols, height: H * rows.length }); await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: dest });
  console.log("wrote", dest, "errors:", errs.slice(0, 5)); await b.close(); srv.close();
  if (errs.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
