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
// with a gap between bodies. `--near=<k>` comes k times closer, looking at height `--focus=<m>` (and `--focusx=<m>` across); `--faces` paints back faces magenta on a green ground (a hole shows green); `--lid=<0..1>` holds the Tripo body's eyelids (#607); `--hide=legs,skin` leaves parts out; `--beads[=gap]` lays the beads on the body worn, gap metres off its cloth (#286, tools/novice-rig.mjs); `--brow=y,z` puts the incense hands elsewhere in the head's frame (rites.js has 0.15,0.15), to try an offset without touching app/. `--poses` (stand, pray, walk, chair, sit; and, only when named, tea and incense: the bowl at his lips and the sticks at his brow) and `--sides` (正, 侧, 背, 斜俯) pick a few, for a
// quick look while a body is being adjusted. The walking row is frame 52 of a stride from standing (`--walk` for another). `--poses=turn` is the turn about to set off (#284), the frame being those since the word to go (6, 0.2 s, by default with `--walk=6`).
// The page itself, the light and the paving are portrait.js's job; this is for the shape and the seams.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const here = __dirname, out = path.join(here, "out");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
// the bodies, in the order given: null for the one built in code
const bodies = [];
for (const a of process.argv.slice(2)) { if (a === "--code") bodies.push(null); else if (a.startsWith("--glb=")) bodies.push(path.resolve(a.slice(6))); }
if (!bodies.length) bodies.push(path.join(here, "../app/shared/models/novice.glb"));
const nameOf = (g) => (g ? path.basename(g, ".glb") : "code");
const dest = path.resolve(arg("out", path.join(out, `novice-views-${bodies.map(nameOf).join("+")}.png`))), walkFrame = +arg("walk", 52);
const near = +arg("near", 1), focus = arg("focus", null);
const onlyPoses = arg("poses", null)?.split(","), onlySides = arg("sides", null)?.split(",");

// The sleeves against the rest of the robe in one picture (#286): from the picture and its flat-coloured twin (stage
// idpass: sleeves red, robe green, the rest of him blue, nothing black), the robe's median luminance, and how many sleeve
// pixels are more than 25% brighter than it, against all the pixels of his outline.
async function sleeveCount(img, ids) {
  const sharp = require("sharp"), raw = async (u) => sharp(Buffer.from(u.split(",")[1], "base64")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = await raw(img), b = await raw(ids), lum = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
  let outline = 0, arms = 0, smudge = 0; const sl = [], robe = [];
  // on the forearms and hands (yellow): a smudge is a pixel neither skin nor shadow on skin, brown or pale-white
  const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx ? d / mx : 0, mx / 255]; };
  for (let o = 0; o < b.data.length; o += 3) { const [r, g, bl] = [b.data[o], b.data[o + 1], b.data[o + 2]]; if (Math.max(r, g, bl) < 40) continue; outline++;
    if (r > 150 && g > 150 && bl < 100) { arms++; const [h, s, v] = hsv(a.data[o], a.data[o + 1], a.data[o + 2]); if ((s > 0.45 && v < 0.6 && h < 35) || (s < 0.08 && v > 0.92)) smudge++; }
    else if (r > g + 40 && r > bl + 40) sl.push(lum(a.data, o)); else if (g > r + 40 && g > bl + 40) robe.push(lum(a.data, o)); }
  robe.sort((x, y) => x - y); const med = robe.length ? robe[robe.length >> 1] : 0, bright = sl.filter((l) => l > 1.25 * med).length;
  return { outline, sleeves: sl.length, robeMedian: +med.toFixed(1), bright, share: outline ? bright / outline : 0, arms, smudge };
}

(async () => {
  // Bundle the stage with the app's own monk.js and three, as the site is bundled.
  const { build } = await import("vite");
  const stageOut = path.join(out, "novice-stage");
  await build({ configFile: false, logLevel: "error", root: path.join(here, "novice-stage"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } });
  const files = bodies.filter(Boolean);
  const { serve } = require("./site.cjs"); let srv;
  srv = await serve(stageOut, { api: false, handler: (req, res, rel) => { const m = /^\/body(\d+)\.glb$/.exec(rel); if (!m) return false; const p = files[+m[1]]; if (!p || !fs.existsSync(p)) { res.writeHead(404); res.end(); return true; } res.writeHead(200, { "content-type": "model/gltf-binary" }); fs.createReadStream(p).pipe(res); return true; } }); fs.mkdirSync(path.dirname(dest), { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 2 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction(() => window.stage?.ready, null, { timeout: 120000 });
  const urls = bodies.map((g) => (g ? `body${files.indexOf(g)}.glb` : null));
  for (const u of urls) if (u) await p.evaluate((u) => window.stage.load(u), u);
  if (process.argv.includes("--faces")) await p.evaluate(() => { window.stage.faces = true; });
  if (arg("lid", null)) await p.evaluate((v) => { window.stage.lid = v; }, +arg("lid"));   // eyelids held at 0 (open) to 1 (shut), #607
  if (arg("hide", null)) await p.evaluate((h) => { window.stage.hide = h.split(","); }, arg("hide"));
  if (process.argv.some((a) => a.startsWith("--beads"))) await p.evaluate((g) => { window.stage.beads = g; }, +(arg("beads", "0.004")) || 0.004);   // #286: the beads laid on the body worn (tools/novice-rig.mjs relayBeads)
  // #286: `--cam=x,y,z:lx,ly,lz:fov` an observance's shot in the place's frame (site.js SHOTS), `--size=w,h` its picture,
  // `--tea=tilt,nod` the bowl at his lips for the seated tea (pose teaSeat), `--unlit` textures only, `--sleeve` also
  // counts, in each picture, the sleeves' pixels more than 25% brighter than the rest of the robe, against his outline
  const camArg = arg("cam", null), sizeArg = arg("size", null), sleeve = process.argv.includes("--sleeve");
  if (camArg) await p.evaluate((c) => { const [at, look, fov] = c.split(":"); window.stage.cam = { at: at.split(",").map(Number), look: look.split(",").map(Number), fov: +fov }; }, camArg);
  if (sizeArg) await p.evaluate((z) => { window.stage.size = z.split(",").map(Number); }, sizeArg);
  if (arg("hold", null)) await p.evaluate((t) => { window.stage.hold = t.split(",").map(Number); }, arg("hold"));   // a grip to try for the seated tea (rites.js: 0.068,0.034,0.012)
  if (arg("tea", null)) await p.evaluate((t) => { window.stage.tea = t.split(",").map(Number); }, arg("tea"));
  if (process.argv.includes("--facefix")) await p.evaluate(() => { window.stage.facefix = true; });
  if (process.argv.some((a) => a.startsWith("--noindirect"))) await p.evaluate((v) => { window.stage.noindirect = v; }, arg("noindirect", true));
  if (process.argv.includes("--flat")) await p.evaluate(() => { window.stage.flat = true; });
  if (process.argv.includes("--idpass")) await p.evaluate(() => { window.stage.idpass = true; });   // the flat-coloured pass itself, to look at
  if (process.argv.includes("--unlit")) await p.evaluate(() => { window.stage.unlit = true; });
  if (arg("brow", null)) await p.evaluate((b) => { window.stage.brow = b.split(",").map(Number); }, arg("brow"));
  if (focus) await p.evaluate(([f, x]) => { window.stage.focus = f; window.stage.focusX = x; }, [+focus, +arg("focusx", 0)]);
  const F = 0, S = Math.PI / 2, B = Math.PI, A = Math.PI / 4;   // front, his left side, behind, front-left from above
  const SIDES = [["正", F], ["侧", S], ["背", B], ["斜俯", A, 0.6]].filter(([n]) => !onlySides || onlySides.includes(n));
  const ROWS = [["站立", "stand"], ["合掌", "pray"], ["走路", "walk"], ["坐凳", "chair"], ["盘坐", "sit"], ["吃茶", "tea"], ["举香", "incense"], ["坐着吃茶", "teaSeat"], ["绑定", "bind"], ["掉头起步", "turn"]].filter(([, k]) => onlyPoses || (k !== "tea" && k !== "incense" && k !== "bind" && k !== "teaSeat" && k !== "turn")).filter(([, k]) => !onlyPoses || onlyPoses.includes(k));
  const sheet = [], report = [];
  for (const [label, pose] of ROWS) {
    const groups = [];
    for (const u of urls) {
      await p.evaluate((u) => window.stage.use(u), u);
      const shots = [];
      for (const [side, yaw, pitch] of SIDES) {
        const img = await p.evaluate(([pose, yaw, pitch, f, n]) => window.stage.shot(pose, yaw, pitch, f, n), [pose, yaw, pitch ?? 0.08, walkFrame, near]);
        shots.push([side, img]);
        if (sleeve) {
          const ids = await p.evaluate(([pose, yaw, pitch, f, n]) => { window.stage.idpass = true; try { return window.stage.shot(pose, yaw, pitch, f, n); } finally { window.stage.idpass = false; } }, [pose, yaw, pitch ?? 0.08, walkFrame, near]);
          const r = await sleeveCount(img, ids); report.push({ pose, side, body: u || "code", ...r });
          console.log(`${label} ${side} ${u ? nameOf(files[+/\d+/.exec(u)[0]]) : "code"}: outline ${r.outline} px, sleeves ${r.sleeves} px, robe median luminance ${r.robeMedian}; sleeve pixels > 1.25x: ${r.bright} = ${(100 * r.share).toFixed(2)}% of his outline; forearms and hands ${r.arms} px, of them brown or white smudges ${r.smudge}`);
        }
      }
      groups.push(shots);
    }
    sheet.push([label, groups]);
  }
  const title = arg("label", bodies.map((g) => (g ? path.basename(g) : "代码身体")).join("｜"));
  const [SW, SH] = sizeArg ? sizeArg.split(",").map(Number) : [300, 640], CW = SW / 2, CH = SH / 2, GAP = bodies.length > 1 ? 8 : 0, W = 30 + bodies.length * SIDES.length * CW + (bodies.length - 1) * GAP;
  const head = bodies.length > 1 ? `<div style="display:flex;padding-left:30px">${bodies.map((g, i) => `<div style="width:${SIDES.length * CW}px;margin-right:${i < bodies.length - 1 ? GAP : 0}px;text-align:center">${g ? path.basename(g) : "代码身体"}</div>`).join("")}</div>` : "";
  const html = `<body style="margin:0;background:#111;font:13px sans-serif;color:#ddd"><div style="height:24px;line-height:24px;padding-left:8px">${title}　走路为起步后第 ${walkFrame} 帧</div>${head}${sheet.map(([l, gs]) => `<div style="display:flex"><div style="width:30px;writing-mode:vertical-rl;display:flex;align-items:center;justify-content:center">${l}</div>${gs.map((s, gi) => `<div style="display:flex;margin-right:${gi < gs.length - 1 ? GAP : 0}px">${s.map(([n, img]) => `<div style="position:relative"><img style="display:block;width:${CW}px;height:${CH}px" src="${img}"><span style="position:absolute;left:5px;top:3px;text-shadow:0 0 3px #000">${n}</span></div>`).join("")}</div>`).join("")}</div>`).join("")}</body>`;
  await p.setViewportSize({ width: W, height: 24 + (head ? 18 : 0) + CH * sheet.length }); await p.setContent(html); await p.waitForTimeout(200);
  await p.screenshot({ path: dest }); console.log("wrote", dest, errs.length ? "errors: " + errs.join(" | ") : "");
  if (sleeve) fs.writeFileSync(dest.replace(/\.png$/, ".sleeve.json"), JSON.stringify(report, null, 1));
  await b.close(); srv.close(); if (errs.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
