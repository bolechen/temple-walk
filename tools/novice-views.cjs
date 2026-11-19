// The novice from every side, for a change to his body (issue #80; AGENTS.md「改形体的，从几个方向看」): standing, palms
// together and walking, each from the front, the side, behind and from above at an angle, then sitting on a stool and
// cross-legged on a cushion; one sheet, a row to a pose.
//
//   node tools/novice-views.cjs [--glb=<novice.glb>|--code] [--out=<png>] [--walk=<frame>] [--label=<title>]
//   node tools/novice-views.cjs --code --glb=app/shared/models/novice.glb --glb=<new.glb>    several bodies side by side
//   node tools/novice-views.cjs --glb=<new.glb> --poses=chair --sides=正                     one picture, while adjusting
//
// He stands alone on a bare stage (tools/novice-stage/): the temple behind him made each picture take minutes under
// software rendering, and here bodies can be compared frame for frame, because he is moved exactly as the unit tests
// move him (monk.update, frame by frame from his rest pose). `--code` shows the body built in code; `--glb` a sculpted one
// from any file in novice.glb's format, so the shipped file and a rebuilt one can be set beside each other without
// touching app/. Given more than one of them (issue #246), each pose's row holds every body's views in the order given,
// with a gap between bodies. `--poses` (stand, pray, walk, chair, sit; and, only when named, tea and incense: the bowl at his lips and the sticks at his brow) and `--sides` (正, 侧, 背, 斜俯) pick a few, for a
// quick look while a body is being adjusted. The walking row is frame 52 of a stride from standing (`--walk` for another).
// The page itself, the light and the paving are portrait.js's job; this is for the shape and the seams.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const here = __dirname, out = path.join(here, "out");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
// the bodies, in the order given: null for the one built in code
const bodies = [];
for (const a of process.argv.slice(2)) { if (a === "--code") bodies.push(null); else if (a.startsWith("--glb=")) bodies.push(path.resolve(a.slice(6))); }
if (!bodies.length) bodies.push(path.join(here, "../app/shared/models/novice.glb"));
const nameOf = (g) => (g ? path.basename(g, ".glb") : "code");
const dest = path.resolve(arg("out", path.join(out, `novice-views-${bodies.map(nameOf).join("+")}.png`))), walkFrame = +arg("walk", 52);
const onlyPoses = arg("poses", null)?.split(","), onlySides = arg("sides", null)?.split(",");

(async () => {
  // Bundle the stage with the app's own monk.js and three, as the site is bundled.
  const { build } = await import("vite");
  const stageOut = path.join(out, "novice-stage");
  await build({ configFile: false, logLevel: "error", root: path.join(here, "novice-stage"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } });
  const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary" };
  const files = bodies.filter(Boolean);
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]), m = /^\/body(\d+)\.glb$/.exec(rel);
    const p = m ? files[+m[1]] : path.join(stageOut, path.posix.normalize("/" + (rel === "/" ? "index.html" : rel)));
    if (!p || (!m && !p.startsWith(stageOut)) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(path.dirname(dest), { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 2 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction(() => window.stage?.ready, null, { timeout: 120000 });
  const urls = bodies.map((g) => (g ? `body${files.indexOf(g)}.glb` : null));
  for (const u of urls) if (u) await p.evaluate((u) => window.stage.load(u), u);
  const F = 0, S = Math.PI / 2, B = Math.PI, A = Math.PI / 4;   // front, his left side, behind, front-left from above
  const SIDES = [["正", F], ["侧", S], ["背", B], ["斜俯", A, 0.6]].filter(([n]) => !onlySides || onlySides.includes(n));
  const ROWS = [["站立", "stand"], ["合掌", "pray"], ["走路", "walk"], ["坐凳", "chair"], ["盘坐", "sit"], ["吃茶", "tea"], ["举香", "incense"]].filter(([, k]) => onlyPoses || (k !== "tea" && k !== "incense")).filter(([, k]) => !onlyPoses || onlyPoses.includes(k));
  const sheet = [];
  for (const [label, pose] of ROWS) {
    const groups = [];
    for (const u of urls) {
      await p.evaluate((u) => window.stage.use(u), u);
      const shots = [];
      for (const [side, yaw, pitch] of SIDES) shots.push([side, await p.evaluate(([pose, yaw, pitch, f]) => window.stage.shot(pose, yaw, pitch, f), [pose, yaw, pitch ?? 0.08, walkFrame])]);
      groups.push(shots);
    }
    sheet.push([label, groups]);
  }
  const title = arg("label", bodies.map((g) => (g ? path.basename(g) : "代码身体")).join("｜"));
  const CW = 150, CH = 320, GAP = bodies.length > 1 ? 8 : 0, W = 30 + bodies.length * SIDES.length * CW + (bodies.length - 1) * GAP;
  const head = bodies.length > 1 ? `<div style="display:flex;padding-left:30px">${bodies.map((g, i) => `<div style="width:${SIDES.length * CW}px;margin-right:${i < bodies.length - 1 ? GAP : 0}px;text-align:center">${g ? path.basename(g) : "代码身体"}</div>`).join("")}</div>` : "";
  const html = `<body style="margin:0;background:#111;font:13px sans-serif;color:#ddd"><div style="height:24px;line-height:24px;padding-left:8px">${title}　走路为起步后第 ${walkFrame} 帧</div>${head}${sheet.map(([l, gs]) => `<div style="display:flex"><div style="width:30px;writing-mode:vertical-rl;display:flex;align-items:center;justify-content:center">${l}</div>${gs.map((s, gi) => `<div style="display:flex;margin-right:${gi < gs.length - 1 ? GAP : 0}px">${s.map(([n, img]) => `<div style="position:relative"><img style="display:block;width:${CW}px;height:${CH}px" src="${img}"><span style="position:absolute;left:5px;top:3px;text-shadow:0 0 3px #000">${n}</span></div>`).join("")}</div>`).join("")}</div>`).join("")}</body>`;
  await p.setViewportSize({ width: W, height: 24 + (head ? 18 : 0) + CH * sheet.length }); await p.setContent(html); await p.waitForTimeout(200);
  await p.screenshot({ path: dest }); console.log("wrote", dest, errs.length ? "errors: " + errs.join(" | ") : "");
  await b.close(); srv.close(); if (errs.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
