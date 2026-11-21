// Measures the lit windows in a picture of the page (issue #459, ART-REVIEW A2).
// usage: node tools/window-lit.cjs [--size=WxH] [--out=dir] [--tag=-x] [--plan=<repo root whose app/ gives the windows>] <view@season-hour@first|third> ...
// For each named view it takes the picture, projects every lattice bay of the plan (site.litWindows, worked out in Node
// from the same code the page runs) through the camera the page used, and reads the pixels inside each bay's rectangle:
// mean luminance in the picture as drawn (`luma`), and in the same picture with the lamps put out (`__lamp(0)`): the
// difference (`lamp`) is the light the lamp gives that bay, free of the sun on the wood round it. A bay is "lit" when
// `lamp` passes LUMA.
// It prints, per view, the lit area as a share of all the windows' area in the picture, and for each pair of lit
// neighbours (same building, same side, next bay) how far their mean luminances part. A window hidden behind a tree or
// another building is measured as it appears, so a hidden lit one reads as dark: the share is a floor, not a ceiling.
// Writes <out>/<view>[tag].png, .json (every window's rectangle, area, luminance) and window-lit.json (the summary).
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const arg = (k, d) => ((process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3)) || d;
const LUMA = +arg("luma", 6);   // mean luminance (0..255) the lamp must add over a bay for it to count as lit
(async () => {
  const repo = path.resolve(arg("plan", path.join(__dirname, ".."))), tool = require("./site.cjs");
  await import(path.join(__dirname, "../tests/unit/dom-stub.mjs"));
  const THREE = await import("three"), { buildSite } = await import(path.join(repo, "app/src/site.js"));
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const wins = buildSite(M).litWindows;
  if (!wins) throw new Error("the plan at " + repo + " has no litWindows");
  const root = tool.site(), srv = await tool.serve(root), base = `http://127.0.0.1:${srv.address().port}/`;
  const [W, H] = arg("size", "1280x536").split("x").map(Number), out = arg("out", path.join(__dirname, "out")), tag = arg("tag", "");
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" }), summary = {};
  for (const name of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
    const [view, when = "", vw = ""] = name.split("@"), [season, time] = when.split("-");
    await p.goto(`${base}?shot=1&q=high&show=${view}` + (season ? `&season=${season}` : "") + (time ? `&time=${time}` : "") + (vw ? `&view=${vw}` : ""), { waitUntil: "load" });
    await p.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    await p.waitForFunction(`(${require("./doorway-ready.cjs").doorwaysReady})(window.__doorways?.())`, null, { timeout: 600000, polling: 500 }).catch(() => {});
    await p.waitForTimeout(1200);
    const file = path.join(out, name.replace(/@/g, "_") + tag), shot = await p.screenshot({ path: file + ".png", timeout: 240000 });
    const was = await p.evaluate(() => { const v = window.__lamp(); window.__lamp(0); window.__probe(); return v; });
    const dark = await p.screenshot({ path: file + "-nolamp.png", timeout: 240000 }); await p.evaluate((v) => { window.__lamp(v); window.__probe(); }, was);
    const res = await p.evaluate(async ({ url, url0, wins, LUMA, night }) => {
      const f = window.__frame(), fov = window.__probe().fov, eye = f.eye, [yaw, pitch] = f.look, w = innerWidth, h = innerHeight;
      const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0); return [g, im]; };
      const [cx, img] = await load(url), [cx0] = await load(url0);
      const k = img.width / w, tan = Math.tan((fov * Math.PI) / 360);
      // The camera's basis: three's YXZ euler, yaw about y then pitch about x, looking down its own -z.
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const fwd = [-sy * cp, sp, -cy * cp], right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const proj = (P) => { const d = [P[0] - eye[0], P[1] - eye[1], P[2] - eye[2]], z = dot(d, fwd); if (z < 0.3) return null; return [(0.5 + dot(d, right) / (z * tan * 2 * (w / h))) * w, (0.5 - dot(d, up) / (z * tan * 2)) * h]; };
      const rows = [], depthOf = (q) => dot([(q.a[0] + q.b[0]) / 2 - eye[0], (q.y0 + q.y1) / 2 - eye[1], (q.a[1] + q.b[1]) / 2 - eye[2]], fwd);
      for (const q of wins) {
        const toEye = [eye[0] - (q.a[0] + q.b[0]) / 2, 0, eye[2] - (q.a[1] + q.b[1]) / 2];
        if (q.n[0] * toEye[0] + q.n[1] * toEye[2] <= 0) continue;   // seen from behind
        const y0 = q.door ? q.y0 : q.y0 + 1.12, cs = [[q.a[0], y0, q.a[1]], [q.b[0], y0, q.b[1]], [q.b[0], q.y1, q.b[1]], [q.a[0], q.y1, q.a[1]]].map(proj);
        if (cs.some((c) => !c)) continue;
        const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]), x0 = Math.max(0, Math.min(...xs)), x1 = Math.min(w, Math.max(...xs)), yy0 = Math.max(0, Math.min(...ys)), yy1 = Math.min(h, Math.max(...ys));
        const full = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
        if (x1 - x0 < 4 || yy1 - yy0 < 4 || (x1 - x0) * (yy1 - yy0) < full * 0.6) continue;   // off the picture, or too small to read
        const d = cx.getImageData(Math.floor(x0 * k), Math.floor(yy0 * k), Math.max(1, Math.floor((x1 - x0) * k)), Math.max(1, Math.floor((yy1 - yy0) * k))).data;
        const d0 = cx0.getImageData(Math.floor(x0 * k), Math.floor(yy0 * k), Math.max(1, Math.floor((x1 - x0) * k)), Math.max(1, Math.floor((yy1 - yy0) * k))).data;
        let n = 0, l = 0, l0 = 0, wm = 0; for (let i = 0; i < d.length; i += 4) { l += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; l0 += 0.2126 * d0[i] + 0.7152 * d0[i + 1] + 0.0722 * d0[i + 2]; wm += d[i] - d[i + 2]; n++; }
        l /= n; l0 /= n; wm /= n; const lamp = Math.max(0, l - l0); rows.push({ depth: depthOf(q), building: q.building, face: q.face, bay: q.bay, door: q.door, rect: [x0, yy0, x1, yy1].map(Math.round), area: Math.round((x1 - x0) * (yy1 - yy0)), luma: +l.toFixed(1), lamp: +lamp.toFixed(1), warm: +wm.toFixed(1), lit: lamp > LUMA, plan: night ? q.night : q.dusk });
      }
      // A bay whose middle lies inside the rectangle of a nearer one of another building is behind it: not measured.
      const seen = rows.filter((r) => !rows.some((o) => o.depth < r.depth - 1 && o.building !== r.building && (r.rect[0] + r.rect[2]) / 2 > o.rect[0] && (r.rect[0] + r.rect[2]) / 2 < o.rect[2] && (r.rect[1] + r.rect[3]) / 2 > o.rect[1] && (r.rect[1] + r.rect[3]) / 2 < o.rect[3]));
      return { fov, eye, yaw, pitch, rows: seen };
    }, { url: "data:image/png;base64," + shot.toString("base64"), url0: "data:image/png;base64," + dark.toString("base64"), wins, LUMA, night: time === "night" });
    const area = res.rows.reduce((s, r) => s + r.area, 0), litArea = res.rows.filter((r) => r.lit).reduce((s, r) => s + r.area, 0), pairs = [];
    for (const r of res.rows) { const nx = res.rows.find((v) => v.building === r.building && v.face === r.face && v.bay === r.bay + 1); if (nx && r.lit && nx.lit) pairs.push({ at: `${r.building} ${r.face} ${r.bay}/${nx.bay}`, differ: +(Math.abs(r.lamp - nx.lamp) / Math.max(r.lamp, nx.lamp)).toFixed(3) }); }
    const lit = res.rows.filter((r) => r.lit);
    summary[name] = { windows: res.rows.length, lit: lit.length, areaShare: +(litArea / Math.max(1, area)).toFixed(3), litLampMean: +(lit.reduce((s, r) => s + r.lamp, 0) / Math.max(1, lit.length)).toFixed(1), litLampMax: Math.max(0, ...lit.map((r) => r.lamp)), pairs, darkMax: Math.max(0, ...res.rows.filter((r) => !r.plan).map((r) => r.lamp)), litMin: Math.min(255, ...res.rows.filter((r) => r.plan).map((r) => r.lamp)), minPairDiffer: pairs.length ? Math.min(...pairs.map((v) => v.differ)) : null };
    fs.writeFileSync(file + ".json", JSON.stringify({ camera: { fov: res.fov, eye: res.eye, yaw: res.yaw, pitch: res.pitch }, rows: res.rows }, null, 1));
    console.log(name, JSON.stringify(summary[name]));
  }
  fs.writeFileSync(path.join(out, "window-lit" + tag + ".json"), JSON.stringify(summary, null, 1));
  await b.close(); srv.close();
})();
