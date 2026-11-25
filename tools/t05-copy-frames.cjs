// The copy of the stele in T05 taken apart, for the art director (docs/t05/SOURCES.md §17; PRD.md §1.3 (a)): the page opened with
// him before the stele, the copy begun, the observances' clock held (`__riteClock`) and stepped to each moment, and a picture
// taken from the eye as the page has it then: the leaf taken out, the board raised, reading, the brush down, writing, reading
// again, the brush stopped, put away. Also the observation's stroke at C02 (`--p1`).
//   node tools/t05-copy-frames.cjs [outdir] [--p1] [--size=1280x720] [--q=high] [--times=0.6,0.8,1.0]
// → <outdir>/copy-<n>-<moment>.png and copy-sheet.jpg (a contact sheet, 1 MB at most), and frames.json.
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const sharp = require("sharp");
const { site, serve } = require("./site.cjs");

const args = process.argv.slice(2), flag = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const out = path.resolve(args.find((a) => !a.startsWith("--")) || "tools/out/t05-copy");
const P1 = args.includes("--p1"), [W, H] = flag("size", "1280x720").split("x").map(Number), Q = flag("q", "high");
const COPY = [[0.5, "取纸", "take"], [1.0, "举板", "raise"], [1.9, "抬头读", "read"], [3.0, "落笔", "down"], [8.0, "写", "write"], [10.0, "再抬头", "read-again"], [12.6, "停笔", "stop"], [13.7, "收起", "away"]];
const STROKE = [[0.5, "取纸", "take"], [1.9, "抬头看檐", "look-eave"], [3.0, "落笔", "down"], [3.9, "横墨", "stroke"], [6.0, "写下那句", "line"], [8.6, "停笔", "stop"], [9.6, "收起", "away"]];   // (file names in ASCII: the evidence store's mirror keys are addresses)

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve(site()), browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "zh-CN" });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const at = P1 ? "0,27,0,0.1" : "-16,11.3,0,0.05";
  await page.goto(`${srv.base}?level=t05&q=${Q}&enter&debug=0&view=third&cam=${at}&season=winter&time=day`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 });
  const frames = async (n) => { const f0 = await page.evaluate(() => window.__yard().frames); await page.waitForFunction((f) => window.__yard().frames >= f, f0 + n, { timeout: 120000 }); };
  await frames(4);
  if (P1) await page.evaluate(() => window.__page({ meet: true }));
  const id = P1 ? "p1b" : "copy";
  // The clock is held in the same moment the observance is begun (not awaited: it runs while the clock is held), so that every moment below
  // counts from his first move; on a slow software page a hold taken after the leaf shows came seconds late.
  await page.evaluate((i) => { window.__riteClock(0); window.__rite(i); }, id);
  // Once his hands are on the leaf the clock is held and stepped: each moment is a frame of the page as it is drawn then.
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__rites().writing.leaf)); i++) await frames(1);   // (he takes the leaf on the first steps of the held clock)
  await page.waitForFunction(() => window.__rites().writing.held !== undefined, null, { timeout: 120000 }).catch(async (e) => { console.error(JSON.stringify(await page.evaluate(() => ({ page: window.__page(), yard: (({ x, z, staged, target, route, frames }) => ({ x, z, staged, target, route, frames }))(window.__yard()), ui: window.__ui() })))); throw e; });
  // --times=0.6,0.8,…: those moments instead of the named ones (a strip of the swing there, for the art review), named by their seconds.
  const TIMES = (flag("times", "") || "").split(",").filter(Boolean).map(Number);
  const list = TIMES.length ? TIMES.map((t) => [t, `${t.toFixed(1)}s`, `${t.toFixed(1)}s`]) : P1 ? STROKE : COPY, shots = [];
  let held = 0;
  for (const [secs, name, slug] of list) {
    while (held < secs * 1000) { const step = Math.min(250, secs * 1000 - held); await page.evaluate((ms) => window.__riteClock(ms), step); held += step; await frames(1); }
    await frames(2);
    const file = path.join(out, `${TIMES.length ? "strip" : P1 ? "stroke" : "copy"}-${shots.length + 1}-${slug}.png`);
    await page.screenshot({ path: file });
    shots.push({ file, secs, name, writing: await page.evaluate(() => window.__rites().writing), director: await page.evaluate(() => { const d = window.__director(); return { phase: d.phase, id: d.id, w: d.w, cuts: d.cuts }; }) });
  }
  await page.evaluate(() => window.__riteClock(null));
  fs.writeFileSync(path.join(out, `${TIMES.length ? "strip" : P1 ? "stroke" : "copy"}-frames.json`), JSON.stringify({ errors, shots: shots.map((s) => ({ ...s, file: path.basename(s.file) })) }, null, 1));
  // The contact sheet: four across, each frame at a quarter of its size with its name under it.
  const cw = Math.round(W / 2.5), ch = Math.round(H / 2.5), cols = 4, rows = Math.ceil(shots.length / cols), pad = 28;
  const tiles = await Promise.all(shots.map(async (s, i) => ({ input: await sharp(s.file).resize(cw, ch).jpeg({ quality: 80 }).toBuffer(), left: (i % cols) * cw, top: Math.floor(i / cols) * (ch + pad) })));
  const labels = shots.map((s, i) => `<text x="${(i % cols) * cw + 8}" y="${Math.floor(i / cols) * (ch + pad) + ch + 20}" font-size="18" fill="#222">${i + 1}. ${s.name} (${s.secs} s)</text>`).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * (ch + pad)}"><rect width="100%" height="100%" fill="#efe9dc"/>${labels}</svg>`);
  await sharp(svg).composite(tiles).jpeg({ quality: 72 }).toFile(path.join(out, `${TIMES.length ? "strip" : P1 ? "stroke" : "copy"}-sheet.jpg`));
  console.log(JSON.stringify({ out, errors: errors.length, frames: shots.length }));
  await browser.close(); srv.close();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
