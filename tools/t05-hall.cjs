// Pictures and a film of the white-box hall of seven Buddhas (issue #280), with any statues stood on its altar.
//
//   node tools/t05-hall.cjs <spec.json>
//
// The spec says which statues stand where and what to draw:
//   { "out": "tools/out/t05", "size": [1600, 900], "ao": true,
//     "statues": [ { "url": "<path to .glb>", "x": 0, "h": 9.0, "turn": 0, "halo": { "rings": 3, "tips": 0 } }, … ],
//     "shots": [ { "name": "door-summer", "view": "door", "mood": "summer", "paint": true }, { "name": "a", "ortho": { "i": 0, "side": "front" } }, … ],
//     "film": { "name": "walk-winter", "mood": "winter", "fps": 24, "size": [1280, 720] },
//     "cost": 60 }
// Statue paths are files on this machine; the page fetches them as /s/<n>.glb. Views and moods are those in
// tools/t05-hall/stage.js (VIEWS, MOODS). Each picture's triangles and draw calls go to <out>/report.json, with the
// browser's renderer string, so a software picture is never mistaken for a GPU measurement. The film is drawn frame by
// frame (deterministic, any frame rate) and encoded with ffmpeg. The page is bundled with the site's own three.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const here = __dirname, root = path.join(here, "..");

(async () => {
  const specPath = process.argv[2]; if (!specPath) { console.error("usage: node tools/t05-hall.cjs <spec.json>"); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const out = path.resolve(root, spec.out || "tools/out/t05"); fs.mkdirSync(out, { recursive: true });
  const { build } = await import("vite");
  const stageOut = path.join(here, "out", "t05-hall-page");
  await build({ configFile: false, logLevel: "error", root: path.join(here, "t05-hall"), base: "./", publicDir: false, build: { outDir: stageOut, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 } });
  const files = (spec.statues || []).map((s) => path.resolve(root, s.url));
  const { serve } = require("./site.cjs"); let srv;
  srv = await serve(stageOut, { api: false, handler: (req, res, rel) => { const m = /^\/s\/(\d+)\.glb$/.exec(rel); if (!m) return false; const p = files[+m[1]]; if (!p || !fs.existsSync(p)) { res.writeHead(404); res.end(); return true; } res.writeHead(200, { "content-type": "model/gltf-binary" }); fs.createReadStream(p).pipe(res); return true; } });
  const gpu = process.env.T05_GPU === "1";
  const args = gpu ? ["--enable-gpu", "--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"] : ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  const browser = await chromium.launch({ args });
  const report = { spec: path.relative(root, specPath), shots: [], film: null, cost: null, statues: [] };
  const errs = [];
  async function page(w, h) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
    await p.goto(`http://127.0.0.1:${srv.address().port}/?w=${w}&h=${h}&ao=${spec.ao === false ? 0 : 1}&aoi=${spec.aoi ?? 0.85}`);
    await p.waitForFunction(() => window.hall?.ready, null, { timeout: 120000 });
    const list = (spec.statues || []).map((s, i) => ({ ...s, url: `/s/${i}.glb` }));
    const st = await p.evaluate((l) => window.hall.setStatues(l), list);
    report.statues = st.map((s, i) => ({ file: path.relative(root, files[i]), tris: s.tris }));
    report.renderer = await p.evaluate(() => window.hall.info());
    return p;
  }
  const [W, H] = spec.size || [1600, 900];
  // A shot may name its own size (issue #370's faces at the door: 16:9, 4:3 and a phone held upright); shots of one size
  // share a page. With `faces`, each picture also reports, for every listed figure, how tall its face stands on the
  // screen in pixels (hairline to chin, both read from the figure's paint anchors) and whether its eyes and mouth are
  // in the picture and not hidden (window.hall.occlusion).
  const faceList = (spec.faces || []).map((f) => {
    const A = JSON.parse(fs.readFileSync(path.join(here, "t05-hall", "paint", `${f.colour}.json`), "utf8")).anchors;
    const eyeY = (A.eyeL[1] + A.eyeR[1]) / 2, chin = [A.mouth[0], A.mouth[1] - 0.6 * (eyeY - A.mouth[1]), A.mouth[2]];
    return { i: f.i, name: f.name, pts: { hairline: A.hairFront, chin, eyeL: A.eyeL, eyeR: A.eyeR, mouth: A.mouth } };
  });
  const sizes = [...new Set((spec.shots || []).map((s) => (s.size || [W, H]).join("x")))];
  for (const sz of sizes) {
    const [sw, sh] = sz.split("x").map(Number), p = await page(sw, sh);
    for (const s of spec.shots.filter((s) => (s.size || [W, H]).join("x") === sz)) {
      const t0 = Date.now();
      const r = s.shoot ? await p.evaluate((sh) => window.hall.shoot(sh), s.shoot) : s.ortho ? await p.evaluate(([o, paint]) => { if (paint !== undefined) window.hall.paint(paint); window.hall.ortho(o.i ?? 0, o.side || "front", o); return {}; }, [s.ortho, s.paint])
        : await p.evaluate(({ v, m, over, paint }) => { window.hall.setMood(m); if (paint !== undefined) window.hall.paint(paint); window.hall.view(v, over || {}); const r = window.hall.stats(); window.hall.render(); return r; }, { v: s.view, m: s.mood || "summer", over: s.over, paint: s.paint });
      const file = path.join(out, `${s.name}.png`); await p.locator("canvas").screenshot({ path: file });
      if (faceList.length) r.faces = await p.evaluate(([fl, w, h]) => fl.map((f) => {
        const px = (v) => { const q = window.hall.figurePoint(f.i, v).project(window.hall.camera); return [(q.x + 1) / 2 * w, (1 - q.y) / 2 * h]; };
        const a = px(f.pts.hairline), b = px(f.pts.chin), e = px(f.pts.eyeL), m = px(f.pts.mouth);
        const occ = window.hall.occlusion(f.i, { eyeL: f.pts.eyeL, eyeR: f.pts.eyeR, mouth: f.pts.mouth }, 0.3);
        return { name: f.name, facePx: +Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(1), eyeToMouthPx: +Math.hypot(e[0] - m[0], e[1] - m[1]).toFixed(1),
          at: b.map((v) => Math.round(v)), seen: Object.fromEntries(Object.entries(occ).map(([k, o]) => [k, o.seen ? "yes" : o.onScreen ? "hidden by " + o.by : "off screen"])) };
      }), [faceList, sw, sh]);
      // with `probe: { pts: { name: [x, y, z] }, i }` (a point in figure i's own frame), where each point falls in the picture, in pixels
      // (tools/t05-hall/paint-measure.py reads a patch of the PNG there: the cheek's colour against the lips', issue #463)
      if (s.probe) r.probe = await p.evaluate(([pr, w, h]) => Object.fromEntries(Object.entries(pr.pts).map(([k, v]) => { const q = window.hall.figurePoint(pr.i, v).project(window.hall.camera); return [k, [(q.x + 1) / 2 * w, (1 - q.y) / 2 * h]]; })), [s.probe, sw, sh]);
      // with `pixels: { i, pts: [[x, y], …] }`, where each pixel falls on figure i's surface, in its own frame (stage.js pixelPoint)
      if (s.pixels) r.pixels = await p.evaluate(([px]) => px.pts.map(([x, y]) => window.hall.pixelPoint(px.i, x, y)), [s.pixels]);
      // with `zones: true`, the mean colour on screen of each zone of each figure, its halo and its lips (stage.js zoneIds,
      // issue #463), and each one's brightness against its face's (Rec. 709 luma of the mean colour)
      if (s.zones) r.zones = await p.evaluate(() => window.hall.zoneIds().map((z) => {
        const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b, face = z["面与手（肤色）"] && luma(z["面与手（肤色）"].rgb);
        return Object.fromEntries(Object.entries(z).map(([k, v]) => [k, { ...v, luma: +luma(v.rgb).toFixed(1), ofFace: face ? +(luma(v.rgb) / face).toFixed(2) : null }]));
      }));
      report.shots.push({ ...s, file: path.relative(root, file), ...r, ms: Date.now() - t0 }); console.log(`${s.name}: ${r.tris} tris, ${r.calls} calls, ${Date.now() - t0} ms`);
    }
    if (spec.cost && sz === sizes[0]) { report.cost = { view: spec.costView || "door3", ms: await p.evaluate(([n, v]) => { window.hall.view(v); return window.hall.cost(n); }, [spec.cost, spec.costView || "door3"]) }; console.log("cost", report.cost); }
    await p.close();
  }
  if (spec.film) {
    const [fw, fh] = spec.film.size || [1280, 720], fps = spec.film.fps || 24, dir = path.join(out, `${spec.film.name}-frames`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const p = await page(fw, fh); await p.evaluate((m) => window.hall.setMood(m), spec.film.mood || "winter");
    // a film may walk its own path (issue #370: the worship band, the side aisle) and log, frame by frame, which of a
    // figure's named points the eye sees and what hides the others (window.hall.occlusion)
    const path_ = spec.film.path, occ = spec.film.occlude, occLog = [];
    if (spec.film.paint !== undefined) await p.evaluate((v) => window.hall.paint(v), spec.film.paint);
    const dur = await p.evaluate((ps) => ps ? window.hall.walkPath(ps, 0) : window.hall.walk(0), path_ || null); const n = Math.round(Math.min(dur, spec.film.secs || 20) * fps);
    for (let i = 0; i < n; i++) {
      const o = await p.evaluate(([t, ps, oc]) => { if (ps) window.hall.walkPath(ps, t); else window.hall.walk(t); window.hall.render();
        return oc ? { t, at: window.hall.camera.position.toArray().map((v) => +v.toFixed(2)), occ: window.hall.occlusion(oc.i, oc.pts, oc.near) } : null; }, [i / fps, path_ || null, occ || null]);
      if (o) occLog.push(o);
      await p.locator("canvas").screenshot({ path: path.join(dir, `${String(i).padStart(4, "0")}.png`) });
      if (i % 48 === 0) console.log(`film ${i}/${n}`);
    }
    const mp4 = path.join(out, `${spec.film.name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", mp4]);
    report.film = { file: path.relative(root, mp4), frames: n, fps, secs: n / fps, size: [fw, fh] }; await p.close();
    if (occLog.length) {   // per point: the share of frames it was seen, and the stretches (metres walked) where it was not
      const sum = {}; for (const k of Object.keys(occLog[0].occ)) { const seen = occLog.filter((f) => f.occ[k].seen).length, hidden = [];
        for (const f of occLog) if (!f.occ[k].seen) { const last = hidden[hidden.length - 1]; if (last && f.t - last.t1 <= 1.5 / fps) { last.t1 = f.t; last.to = f.at; last.by[f.occ[k].by || "off-screen"] = 1; } else hidden.push({ t0: f.t, t1: f.t, from: f.at, to: f.at, by: { [f.occ[k].by || "off-screen"]: 1 } }); }
        sum[k] = { seen: +(seen / occLog.length).toFixed(3), hidden: hidden.map((h) => ({ ...h, by: Object.keys(h.by) })) }; }
      report.film.occlusion = sum; fs.writeFileSync(path.join(out, `${spec.film.name}-occlusion.json`), JSON.stringify(occLog));
    }
    if (!spec.film.keepFrames) fs.rmSync(dir, { recursive: true, force: true });
  }
  report.errors = errs; fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close(); srv.close();
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
