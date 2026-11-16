// The novice from every side, for a change to his body (issue #80; AGENTS.md「改形体的，从几个方向看」): standing, palms
// together and walking, each from the front, the side, behind and from above at an angle, then sitting on a stool and
// cross-legged on a cushion from the front, the side and behind; one sheet, a row to a pose.
//
//   node tools/novice-views.cjs [--glb=<novice.glb>|--code] [--out=<png>] [--walk=<frame>] [--label=<title>]
//
// He stands alone on a bare stage (tools/novice-stage/): the temple behind him made each picture take minutes under
// software rendering, and here two bodies can be compared frame for frame, because he is moved exactly as the unit tests
// move him (monk.update, frame by frame from his rest pose). `--code` shows the body built in code; `--glb` the sculpted one
// from any file in novice.glb's format, so the shipped file and a rebuilt one can be set beside each other without
// touching app/. The walking row is frame 52 of a stride from standing (`--walk` for another). The page itself, the light
// and the paving are portrait.js's job; this is for the shape and the seams.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const here = __dirname, out = path.join(here, "out");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const code = process.argv.includes("--code"), glb = code ? null : path.resolve(arg("glb", path.join(here, "../app/shared/models/novice.glb")));
const dest = path.resolve(arg("out", path.join(out, `novice-views-${code ? "code" : path.basename(glb, ".glb")}.png`))), walkFrame = +arg("walk", 52);

(async () => {
  // Bundle the stage with the app's own monk.js and three, as the site is bundled.
  const { build } = await import("vite");
  const stageOut = path.join(out, "novice-stage");
  await build({ configFile: false, logLevel: "error", root: path.join(here, "novice-stage"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } });
  const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary" };
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]);
    const p = rel === "/body.glb" && glb ? glb : path.join(stageOut, path.posix.normalize("/" + (rel === "/" ? "index.html" : rel)));
    if (!p.startsWith(stageOut) && p !== glb || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(path.dirname(dest), { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 2 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction(() => window.stage?.ready, null, { timeout: 120000 });
  if (glb) await p.evaluate(() => window.stage.load("body.glb"));
  const F = 0, S = Math.PI / 2, B = Math.PI, A = Math.PI / 4;   // front, his left side, behind, front-left from above
  const rows = [
    ["站立", "stand", [["正", F], ["侧", S], ["背", B], ["斜俯", A, 0.6]]],
    ["合掌", "pray", [["正", F], ["侧", S], ["背", B], ["斜俯", A, 0.6]]],
    ["走路", "walk", [["正", F], ["侧", S], ["背", B], ["斜俯", A, 0.6]]],
    ["坐凳", "chair", [["正", F], ["侧", S], ["背", B], ["斜俯", A, 0.6]]],
    ["盘坐", "sit", [["正", F], ["侧", S], ["背", B], ["斜俯", A, 0.6]]],
  ];
  const sheet = [];
  for (const [label, pose, views] of rows) {
    const shots = [];
    for (const [side, yaw, pitch] of views) shots.push([side, await p.evaluate(([pose, yaw, pitch, f]) => window.stage.shot(pose, yaw, pitch, f), [pose, yaw, pitch ?? 0.08, walkFrame])]);
    sheet.push([label, shots]);
  }
  const title = arg("label", code ? "代码身体" : path.basename(glb));
  const cols = Math.max(...sheet.map(([, s]) => s.length)), CW = 150, CH = 320;
  const html = `<body style="margin:0;background:#111;font:13px sans-serif;color:#ddd"><div style="height:24px;line-height:24px;padding-left:8px">${title}　走路为起步后第 ${walkFrame} 帧</div>${sheet.map(([l, s]) => `<div style="display:flex"><div style="width:30px;writing-mode:vertical-rl;display:flex;align-items:center;justify-content:center">${l}</div>${s.map(([n, img]) => `<div style="position:relative"><img style="display:block;width:${CW}px;height:${CH}px" src="${img}"><span style="position:absolute;left:5px;top:3px;text-shadow:0 0 3px #000">${n}</span></div>`).join("")}</div>`).join("")}</body>`;
  await p.setViewportSize({ width: 30 + CW * cols, height: 24 + CH * sheet.length }); await p.setContent(html); await p.waitForTimeout(200);
  await p.screenshot({ path: dest }); console.log("wrote", dest, errs.length ? "errors: " + errs.join(" | ") : "");
  await b.close(); srv.close(); if (errs.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
