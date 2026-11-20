// The novice on a flight, before and after (issue #270; AGENTS.md「改形体的，从几个方向看」): for each of up and down, from
// the front, the side and behind, eight frames across one stride, the monk.js on main above and the present one below.
//   node tools/stair-strip.cjs [--base=origin/main] [--out=tools/out/stair-strip.png] [--sides=正,侧,背] [--dirs=up,down]
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const here = __dirname, root = path.join(here, ".."), out = path.join(here, "out");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const base = arg("base", "origin/main"), dest = path.resolve(arg("out", path.join(out, "stair-strip.png")));
const onlySides = arg("sides", null)?.split(","), onlyDirs = arg("dirs", null)?.split(",");
(async () => {
  const old = path.join(root, "app/src/.monk-before.js");
  fs.writeFileSync(old, execSync(`git show ${base}:app/src/monk.js`, { cwd: root, maxBuffer: 1 << 26 }));
  const { build } = await import("vite"); const stageOut = path.join(out, "stair-stage");
  try { await build({ configFile: false, logLevel: "error", root: path.join(here, "stair-stage"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } }); }
  finally { fs.rmSync(old, { force: true }); }
  const types = { ".html": "text/html", ".js": "text/javascript" };
  const srv = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split("?")[0]); const p = path.join(stageOut, path.posix.normalize("/" + (rel === "/" ? "index.html" : rel))); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(path.dirname(dest), { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 400, height: 500 } }); const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction(() => window.stage?.ready, null, { timeout: 120000 });
  const SIDES = [["正", 0], ["侧", Math.PI / 2], ["背", Math.PI]].filter(([n]) => !onlySides || onlySides.includes(n));
  const DIRS = [["上", 1, "up"], ["下", -1, "down"]].filter(([, , k]) => !onlyDirs || onlyDirs.includes(k));
  const SPEED = { before: { 1: 1.25, [-1]: 1.25 }, after: { 1: 0.34 * 2.1, [-1]: 0.34 * 2.1 } };
  const rows = [];
  for (const [dl, dir] of DIRS) for (const [sl, yaw] of SIDES) for (const [vl, v] of [["改前", "before"], ["改后", "after"]]) rows.push([`${dl}·${sl}·${vl}`, await p.evaluate(([v, dir, sp, yaw]) => window.stage.strip(v, dir, sp, yaw), [v, dir, SPEED[v][dir], yaw])]);
  const CW = 130, CH = 173;
  const html = `<body style="margin:0;background:#111;font:12px sans-serif;color:#ddd">${rows.map(([l, imgs]) => `<div style="display:flex;align-items:center"><div style="width:90px;text-align:center">${l}</div>${imgs.map((s) => `<img style="width:${CW}px;height:${CH}px" src="${s}">`).join("")}</div>`).join("")}</body>`;
  await p.setViewportSize({ width: 90 + 8 * CW, height: rows.length * CH }); await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: dest }); console.log("wrote", dest, errs.length ? "errors: " + errs.join(" | ") : "");
  await b.close(); srv.close(); if (errs.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
