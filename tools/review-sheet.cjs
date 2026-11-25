// The review sheet: one frame of the novice read from three sides, as a picture and as numbers, for the cheap first review of
// an art change (the art director's pass is the dear one). From one moment it makes
//   tools/out/review-sheet/<name>.png   three views (as asked, from his side, from above at about 60°), each twice: the normal
//                                       picture with a ruler beside him (1.18 m, knee, shoulder, the hem's front edge), and the
//                                       same frame as flat colours by part over the scene's edge lines (skin, hands, robe,
//                                       trousers, shoes, the rest), so cloth, skin and light cannot be mistaken for one another
//   tools/out/review-sheet/<name>.json  per view the pixels of each colour, the hand's in the lap box, how much of the hand the
//                                       robe hides; and the ruler's readings in metres; and a verdict on the two things #664 turned on
// usage: node tools/review-sheet.cjs <what> [--out=<dir>] [--tag=<text>] [--size=WxH] [--season=<s>] [--time=<t>] [--q=low|medium|high]
//   <what> is a view name of the plan (`shot-sit`, as `?show=` takes), `sit:<hall>` (the first cushion or stool in that room, sat
//   on), or `rite:<id>` (an observance's pose, `__poseRite`, the clock held still). TEMPLE_SITE=<dir> names a site already built
//   (otherwise tools/site.cjs builds dist/ first). The workbench hook `__review` (app/src/review.js) is asked for with `?review=1`
//   on a preview's host name, so it is never in a visitor's page.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { serve } = require("./site.cjs");
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const what = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!what) { console.error("usage: node tools/review-sheet.cjs <view | sit:<hall> | rite:<id>> [--out=dir] [--tag=x]"); process.exit(2); }
const out = path.resolve(arg("out", path.join(__dirname, "out", "review-sheet"))), tag = arg("tag", ""), [W, H] = arg("size", "960x540").split("x").map(Number);
const season = arg("season", "summer"), time = arg("time", "day"), q = arg("q", "medium");
const name = what.replace(/[:@]/g, "_") + tag;
// ids and the scene's lines are read without the finish that would tint the flat colours
const OFF = "gtao,halation,lut,dof,layers,bloom,leafshadow";

(async () => {
  const lib = await import("./review-sheet-lib.mjs"), sharp = require("sharp");
  const root = require("./site.cjs").site(), srv = await serve(root);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--host-resolver-rules=MAP pr-0-temple-walk-preview.test 127.0.0.1"] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e).slice(0, 400)));
  p.on("console", (m) => m.type() === "error" && !/GPU stall/.test(m.text()) && errs.push(m.text().slice(0, 300) + (m.location().url ? " " + m.location().url.replace(/^https?:\/\/[^/]+/, "") : "")));
  const [kind, rest] = what.includes(":") ? what.split(":") : ["view", what];
  const base = `http://pr-0-temple-walk-preview.test:${srv.address().port}/`;
  const qs = `shot=1&review=1&q=${q}&view=third&debug=0&season=${season}&time=${time}&off=${OFF}` + (kind === "view" ? `&show=${rest}` : kind === "sit" ? `&enter&in=${rest}` : `&show=${rest}`);
  await p.goto(base + "?" + qs, { waitUntil: "commit", timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1" && window.__review, null, { timeout: 240000 });
  const frames = (n) => p.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const meta = { what, commit: await p.evaluate(() => window.__version?.().commit), body: await p.evaluate(() => window.__yard().body) };
  if (kind === "sit") {
    const i = await p.evaluate((room) => window.__seats.findIndex((s) => s.room === room), rest);
    if (i < 0) throw new Error(`no seat in ${rest}`);
    await p.evaluate((i) => window.__sit(i), i);
    // seated: the walk to it and the sitting down are done when he has stopped and the pose has settled
    await p.waitForFunction(() => { const y = window.__yard(); return window.__sitState ? window.__sitState() : true; }, null, { timeout: 120000 }).catch(() => {});
    await frames(40);
  } else if (kind === "rite") { await p.evaluate((id) => { window.__poseRite(id); window.__riteClock?.(0); }, rest); await frames(10); }
  else await frames(10);
  // settle: the pose eases in; draw until two measures agree
  let m0 = null;
  for (let i = 0; i < 40; i++) { await frames(6); const m = await p.evaluate(() => window.__review.measure()); const key = JSON.stringify(m.bones); if (m0 === key) { m0 = m; break; } m0 = key; }
  const settled = await p.evaluate(() => window.__review.measure());
  const o = settled.origin, c = [o[0], o[1] + 0.45, o[2]], eye = settled.camera.position;
  const hx = eye[0] - c[0], hz = eye[2] - c[2], hd = Math.hypot(hx, hz) || 1, dist = Math.min(2.2, Math.max(1.3, Math.hypot(hx, hz, eye[1] - c[1])));
  const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
  const el = Math.PI / 3;
  const shot = async () => { const png = await p.screenshot({ type: "png" }); const r = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return r.data; };
  const sidePos = (a) => { const [x, z] = rot(hx / hd, hz / hd, a); return { at: [c[0] + x * dist, c[1] + 0.1, c[2] + z * dist], to: c }; };
  // a pillar or a wall may stand on one side of him: take the side from which more of him is drawn
  const seen = async (s2) => { await p.evaluate((s3) => window.__look(s3.at, s3.to), s2); await frames(5); await p.evaluate(() => window.__review.ids({})); await frames(4); const d = await shot(); await p.evaluate(() => window.__review.ids(null)); const k = lib.countParts(d, W, H); return Object.values(k).reduce((a, v) => a + v, 0); };
  const sides = [sidePos(Math.PI / 2), sidePos(-Math.PI / 2)], seenN = [await seen(sides[0]), await seen(sides[1])], pick = seenN[1] > seenN[0] ? sides[1] : sides[0];
  const cams = [
    { id: "asked", set: kind === "sit" ? (() => { const [x, z] = rot(settled.facing[0], settled.facing[2], 0.6); return { at: [c[0] + x * 1.7, c[1] + 0.2, c[2] + z * 1.7], to: c }; })() : null },
    { id: "side", set: pick },
    { id: "top", set: { at: [c[0] + (hx / hd) * dist * Math.cos(el), c[1] + dist * Math.sin(el), c[2] + (hz / hd) * dist * Math.cos(el)], to: c } },
  ];
  const panels = [], views = [], report = {};
  for (const cam of cams) {
    await p.evaluate((s) => { window.__look?.(...(s ? [s.at, s.to] : [])); }, cam.set);
    if (cam.set) await p.evaluate((s) => window.__look(s.at, s.to), cam.set);
    await frames(8);
    const m = await p.evaluate(() => window.__review.measure()), normal = await shot();
    await p.evaluate(() => window.__review.ids({})); await frames(6); const all = await shot();
    await p.evaluate(() => window.__review.ids({ solo: "hand" })); await frames(6); const alone = await shot();
    await p.evaluate(() => window.__review.ids(null)); await frames(3);
    if (process.argv.includes("--dump")) for (const [k, d] of [["all", all], ["alone", alone]]) await sharp(d, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(out, `${name}.${cam.id}.${k}.png`));
    const box = lib.lapBox(m, W, H), counts = lib.cameraCounts({ all, handAlone: alone, box, w: W, h: H });
    const lines = lib.rulerLines(m, W, H), sil = lib.silhouette(normal, all, W, H);
    views.push({ id: cam.id, ...counts, camera: { position: m.camera.position, fov: m.camera.fov } });
    if (cam.id === "asked") Object.assign(report, { readings: lib.readings(m), measure: { origin: m.origin, facing: m.facing, bones: m.bones, hemFront: m.hemFront, hatWidth: m.hatWidth } });
    const svg = (rows) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="13">${rows}</svg>`);
    const draw = lines.map(([x0, y0, x1, y1, label, kind2]) => `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${kind2 === "hem" ? "#ff2d2d" : kind2 === "knee" ? "#1e90ff" : kind2 === "post" ? "#111" : "#000"}" stroke-width="${kind2 === "tick" ? 2 : kind2 === "post" ? 2 : 1.5}" ${kind2 === "hem" || kind2 === "knee" ? 'stroke-dasharray="6 4"' : ""}/>` + (label ? `<text x="${x1 + 6}" y="${y1 + 4}" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${label}</text>` : "")).join("");
    const boxSvg = box ? `<rect x="${box[0]}" y="${box[1]}" width="${box[2] - box[0]}" height="${box[3] - box[1]}" fill="none" stroke="#0a0" stroke-width="1.5" stroke-dasharray="3 3"/>` : "";
    const tagText = (t) => `<text x="8" y="18" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${t}</text>`;
    const a = await sharp(normal, { raw: { width: W, height: H, channels: 4 } }).composite([{ input: svg(draw + boxSvg + tagText(cam.id)), top: 0, left: 0 }]).png().toBuffer();
    const sRaw = Buffer.from(sil), s2 = await sharp(sRaw, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: svg(draw + boxSvg + tagText(cam.id + ": parts + edges")), top: 0, left: 0 }]).png().toBuffer();
    panels.push([a, s2]);
  }
  report.views = views; report.verdict = lib.verdict(report.readings, views); report.meta = { ...meta, errors: [...new Set(errs)].slice(0, 5), size: [W, H], season, time };
  const sheet = sharp({ create: { width: W * 3, height: H * 2, channels: 3, background: "#111" } });
  await sheet.composite(panels.flatMap(([a, s2], i) => [{ input: a, left: W * i, top: 0 }, { input: s2, left: W * i, top: H }])).png().toFile(path.join(out, name + ".png"));
  fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(report, null, 1) + "\n");
  console.log(JSON.stringify({ name, readings: report.readings, verdict: report.verdict, hands: views.map((v) => [v.id, v.handVisible, v.handAlone, v.lapHand]) }));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
