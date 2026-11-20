// The rooms seen through the halls' doors from outside (#218), drawn once when the site is built rather than in a
// visitor's page: each hall's room from just inside its door, in a day's light and a night's (colour, WebP) and how far
// each thing stands (sixteen bits over red and green, PNG), each cube's six faces in one picture. The page fetches them
// as he comes near a hall (app/src/doorway.js); drawing them in his page would compile every shader of the room while
// he walks (a T4 took 100–300 ms a shader).
//
// They are a build product, not kept in git: each hall's pictures are named by a fingerprint of what they are drawn
// from (the code that builds and lights the rooms, the scanned surfaces and figures, that hall's own room as built, the
// bake's settings), kept under that name in node_modules/.cache/doorways/ (CI keeps the folder in its cache), and drawn
// only for a fingerprint not seen before: a change to one hall's room redraws only that hall. Drawing needs the built
// site in a browser (software rendering is enough); the result is written to app/shared/doorways/ and, if the site is
// built, to dist/shared/doorways/, with t00.json naming each hall's files.
//
//   node tools/bake-doorways.mjs            take from the cache or draw what is missing, then write the files
//   node tools/bake-doorways.mjs --key      print one fingerprint over every hall (the CI cache's key)
//   node tools/bake-doorways.mjs --verify   also draw the great hall again in a whole page and compare it with its files
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, extname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { buildSite } = await import("../app/src/site.js");
const { buildInteriors, STAND } = await import("../app/src/interior.js");

const top = join(dirname(fileURLToPath(import.meta.url)), ".."), app = join(top, "app"), dist = join(top, "dist");
const CACHE = join(top, "node_modules", ".cache", "doorways"), OUT = join(app, "shared", "doorways"), LEVEL = "t00";
// `inward` (#320's trial, shown only with `?doorway=hires`): the face looking into the room again on its own, `col` pixels a
// side for colour (drawn `ss` times larger and averaged down), `dist` for distances (a quarter of `col`). DOORWAY_INWARD=512 for a smaller one.
const IN = Number(process.env.DOORWAY_INWARD || 1024);
export const BAKE = { version: 1, size: 256, quality: 0.9, moods: [["summer", "day"], ["summer", "night"]], inward: { col: IN, dist: IN / 4, ss: 2 } };   // distances at a quarter: 512 px held 160 KB a hall of PNG, over the 3 MB budget for eight
const sha = (...parts) => { const h = createHash("sha256"); for (const p of parts) h.update(p); return h.digest("hex"); };
const filesUnder = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map((f) => join(dir, String(f))).filter((f) => statSync(f).isFile()).sort() : []);

/** Each hall's fingerprint: what its pictures are drawn from. */
export function fingerprints() {
  const code = ["interior.js", "framing.js", "materials.js", "glsl.js", "textures.js", "geo.js", "fog.js", "sky.js", "doorway-shape.js", "doorway-capture.js", "lut.js", "post.js"]
    .map((f) => join(app, "src", f)).filter(existsSync).map((f) => readFileSync(f));
  const shared = [...filesUnder(join(app, "shared", "textures")), ...filesUnder(join(app, "shared", "models")).filter((f) => !/novice/.test(f))].map((f) => readFileSync(f));
  const three = readFileSync(join(top, "node_modules", "three", "package.json"));
  const global = sha(JSON.stringify(BAKE), three, ...code, ...shared, readFileSync(fileURLToPath(import.meta.url)));
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + String(k)] ||= Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) })) : (t[k] ||= Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) }))) });
  const site = buildSite(M), rooms = buildInteriors(M, site.halls), out = {};
  for (const h of site.halls) {
    const r = rooms.rooms[h.id]; if (!r) continue;
    const parts = []; r.group.traverse((o) => { if (o.geometry?.attributes?.position) parts.push(Buffer.from(o.geometry.attributes.position.array.buffer), Buffer.from([].concat(o.material).map((m) => m.name || m.type).join("|"))); });
    parts.push(Buffer.from(JSON.stringify(r.room.frame ? { cols: r.room.frame.cols.length } : {}) + JSON.stringify(r.lights.map((l) => [l.position.toArray(), l.intensity, l.distance, l.color.getHex()])) + JSON.stringify(STAND[h.id] || {})));
    out[h.id] = sha(global, ...parts).slice(0, 16);
  }
  return out;
}

const names = (id, fp) => ({ day: `${id}.${fp}.day.webp`, night: `${id}.${fp}.night.webp`, dist: `${id}.${fp}.dist.png` });
const inNames = (id, fp) => ({ inDay: `${id}.${fp}.in.day.webp`, inNight: `${id}.${fp}.in.night.webp`, inDist: `${id}.${fp}.in.dist.png` });
const allNames = (id, fp) => ({ ...names(id, fp), ...inNames(id, fp) });

// Serve a built site and open it in Chromium with software rendering, as the tests do.
async function withPage(root, query, fn) {
  const http = require("http"), { chromium } = require("playwright");
  const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".css": "text/css", ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".ktx2": "image/ktx2", ".jpg": "image/jpeg" };
  const srv = http.createServer((req, res) => {
    let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), full = join(root, "." + rel); if (full.startsWith(root)) p = full; } catch {}
    if (!p || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(readFileSync(p));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  try {
    const page = await (await b.newContext({ viewport: { width: 320, height: 200 }, locale: "zh-CN" })).newPage(), errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("response", (r) => r.status() >= 400 && !/\/shared\/doorways\//.test(r.url()) && errs.push(`HTTP ${r.status()} ${r.url()}`));   // the doorways' own pictures are what is being made
    await page.goto(`http://127.0.0.1:${srv.address().port}/?${query}`, { waitUntil: "commit", timeout: 180000 });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
    return await fn(page, errs);
  } finally { await b.close(); srv.close(); }
}

const dataOf = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");

/** Draw the halls named (their figures fetched first) and keep their pictures in the cache. */
async function draw(ids, fps) {
  if (!existsSync(join(dist, "index.html"))) execFileSync(process.execPath, [join(top, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn"], { cwd: top, stdio: "inherit" });
  mkdirSync(CACHE, { recursive: true });
  // Only the rooms are drawn into the cubes. Nothing of the place is left out (`?off=` would hide the batches the rooms
  // were merged into with the courts); only the passes the cubes do not use.
  await withPage(dist, "shot=1&q=high&enter&off=reflect,bloom,gtao", async (page, errs) => {
    for (const id of ids) {
      const t0 = Date.now(), p = await page.evaluate(([i, q, w]) => window.__doorBake(i, q, false, w), [id, BAKE.quality, BAKE.inward]);
      const n = allNames(id, fps[id]); for (const k of Object.keys(n)) writeFileSync(join(CACHE, n[k]), dataOf(p[k]));
      console.log(`bake-doorways: drew ${id} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    if (errs.length) throw new Error("bake-doorways: the page reported errors: " + errs.slice(0, 3).join(" | "));
  });
}

/** Take every hall's pictures from the cache (drawing what is missing) and write them where the site is served from. */
export async function bakeDoorways({ verify = false } = {}) {
  const t0 = Date.now(), fps = fingerprints(), ids = Object.keys(fps);
  const missing = ids.filter((id) => !Object.values(allNames(id, fps[id])).every((f) => existsSync(join(CACHE, f))));
  if (missing.length) await draw(missing, fps);
  const manifest = { level: LEVEL, bake: BAKE, halls: {} }, sizes = {}, inSizes = {};
  for (const dir of [OUT, existsSync(join(dist, "index.html")) ? join(dist, "shared", "doorways") : null].filter(Boolean)) {
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    for (const id of ids) {
      const n = names(id, fps[id]), m = inNames(id, fps[id]); for (const f of [...Object.values(n), ...Object.values(m)]) copyFileSync(join(CACHE, f), join(dir, f));
      manifest.halls[id] = { fp: fps[id], ...n, in: { day: m.inDay, night: m.inNight, dist: m.inDist } };
      sizes[id] = Object.values(n).reduce((s, f) => s + statSync(join(CACHE, f)).size, 0); inSizes[id] = Object.values(m).reduce((s, f) => s + statSync(join(CACHE, f)).size, 0);
    }
    writeFileSync(join(dir, `${LEVEL}.json`), JSON.stringify(manifest, null, 1));
  }
  const total = Object.values(sizes).reduce((a, b) => a + b, 0), kb = (b) => +(b / 1024).toFixed(1);
  const inTotal = Object.values(inSizes).reduce((a, b) => a + b, 0);
  const report = { drawn: missing, fromCache: ids.filter((i) => !missing.includes(i)), kb: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, kb(v)])), totalKb: kb(total),
    inward: { size: BAKE.inward, kb: Object.fromEntries(Object.entries(inSizes).map(([k, v]) => [k, kb(v)])), totalKb: kb(inTotal), withBaseKb: kb(total + inTotal) }, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  const over = Object.entries(sizes).filter(([, v]) => v > 300 * 1024).map(([k]) => k);
  if (over.length || total > 2.5 * 1024 * 1024) console.warn(`bake-doorways: over budget (300 KB a hall, 2.5 MB in all): ${over.join(", ") || "total " + kb(total) + " KB"}`);
  if (verify) report.verify = await compare("main", manifest.halls.main);
  return report;
}

/** The great hall drawn again, in a whole page (nothing left out), kept losslessly and compared pixel by pixel with its baked files. */
async function compare(id, entry) {
  return withPage(dist, "shot=1&q=high&enter", async (page) => page.evaluate(async ([i, e, q]) => {
    const fresh = await window.__doorBake(i, q, true), out = {};   // drawn again and kept losslessly: the files' WebP is measured against it
    const pixels = async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    for (const k of ["day", "night", "dist"]) {
      const a = await pixels(fresh[k]), b = await pixels("shared/doorways/" + e[k]); let max = 0, sum = 0, n = 0;
      for (let j = 0; j < a.length; j += 4) for (let c = 0; c < 3; c++) { const d = Math.abs(a[j + c] - b[j + c]); max = Math.max(max, d); sum += d; n++; }
      out[k] = { max, mean: +(sum / n).toFixed(3) };
    }
    return out;
  }, [id, entry, BAKE.quality]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--key")) { const f = fingerprints(); console.log(sha(JSON.stringify(f)).slice(0, 16)); }
  else console.log("bake-doorways:", JSON.stringify(await bakeDoorways({ verify: process.argv.includes("--verify") })));
}
