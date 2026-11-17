// What a phone sees: opens every surface of the interface at a phone's size, upright and on its side, as a touch
// device, takes a picture of each and lists every control a thumb would miss (smaller than 44 px either way), any
// text under 12 px, anything that runs off the screen, and whether the page scrolls or zooms when it should not.
//   node tools/mobile-audit.cjs [out dir] [--lang=ja|en]   → tools/out/mobile/*.png and report.json; exits 1 if anything is listed
//   (--lang audits the page in Japanese or English, into tools/out/mobile-ja/ or mobile-en/ unless an out dir is named)
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ARGS = process.argv.slice(2), LANG = ((ARGS.find((a) => a.startsWith("--lang=")) || "").slice(7) || "zh");
const root = require("./site.cjs").site(), out = ARGS.find((a) => !a.startsWith("--")) || path.join(__dirname, "out", LANG === "zh" ? "mobile" : `mobile-${LANG}`);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".css": "text/css", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const srv = http.createServer((req, res) => {
  let p = null; try { const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"), base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel)); if (full.startsWith(base + path.sep)) p = full; } catch {}
  if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);   // the file as it is published: nothing is added to it here
});
// Each surface: how to bring it up, and how to put it away again.
const SURFACES = [
  ["title", null, null],
  // (a first visit is shown the mountain first, src/opening.js: passed over with Esc as a visitor may, as the eye comes down to him)
  ["walk", "document.getElementById('enterBtn').click(); setTimeout(() => window.__opening().active && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 300)", null],
  ["prologue", "(() => { window.__pose(6.6, 53.4, Math.atan2(-6.6, 13.4), 0.05); window.__prologue(true); })()", null],
  ["menu", "document.body.classList.add('seasons'); window.__menu(true)", "window.__menu(false)"],   // with the seasons open: the hour row, 随时辰 first (#135)
  ["credits", "document.getElementById('menuCredits').click()", "document.getElementById('creditsClose').click()"],
  ["book", "window.__book()", "document.getElementById('bookClose').click()"],
  ["photo", "window.__photo(true)", "window.__photo(false)"],
  ["piece", "window.__work(Object.keys(window.__gallery).map((k) => window.__gallery[k].item.work).find(Boolean))", "document.getElementById('pieceClose').click()"],
  ["slip", "(() => { window.__pose(window.__places.sutra.at[0], window.__places.sutra.at[1], 0, 0); window.__rite('sutra'); })()", "window.__take && window.__take()"],
];
const measure = () => {
  const W = innerWidth, H = innerHeight, small = [], tiny = [], off = [], seen = new Set();
  const shown = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05 && !el.closest("[hidden]") && (!el.closest("dialog") || el.closest("dialog").open); };
  const top = [...document.querySelectorAll("dialog[open]")].pop();
  for (const el of document.querySelectorAll("button, a[href], input, select, [role=button], summary")) {
    if (!shown(el) || el.disabled || (top && !top.contains(el))) continue;
    const r = el.getBoundingClientRect(), name = el.id || el.className || el.tagName, label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 12);
    if (r.width < 43.5 || r.height < 43.5) small.push(`${name} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    // A control further down a sheet that scrolls is on the sheet, not off the screen: it is reached by scrolling the sheet,
    // which is itself whole on the screen. Only sideways, or a sheet that cannot scroll, still counts.
    let sheet = el.parentElement; while (sheet && !(/auto|scroll/.test(getComputedStyle(sheet).overflowY) && sheet.scrollHeight > sheet.clientHeight + 1)) sheet = sheet.parentElement;
    const sr = sheet && sheet.getBoundingClientRect(), onSheet = sheet && sr.top >= -1 && sr.bottom <= H + 1;
    if (r.left < -1 || r.right > W + 1 || (!onSheet && (r.top < -1 || r.bottom > H + 1))) off.push(`${name} "${label}" [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) { const el = n.parentElement; if (!n.textContent.trim() || !el || !shown(el) || (top && !top.contains(el)) || seen.has(el)) continue; seen.add(el); const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11.9) tiny.push(`${el.id || el.className || el.tagName} "${n.textContent.trim().slice(0, 10)}" ${fs}px`); }
  // A sheet that scrolls must carry its paper itself (class `scrolls`): paper drawn behind the words is only as tall as
  // the part in sight and is drawn away with them, leaving the rest of the sheet bare.
  const bare = [...document.querySelectorAll(".paper:not(.scrolls)")].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY)).map((el) => el.id || el.parentElement.id + " ." + el.className);
  return { small, tiny, off, bare, scrolls: document.documentElement.scrollHeight > H + 1 || document.documentElement.scrollWidth > W + 1, vv: visualViewport ? +visualViewport.scale.toFixed(2) : 1, w: W };
};
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), report = {}; let bad = 0;
  for (const [shape, vw, vh] of [["upright", 390, 844], ["side", 844, 390], ["small", 360, 640]]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
    await p.goto(`http://127.0.0.1:${srv.address().port}/?q=low&season=summer&time=day&lang=${LANG}`, { waitUntil: "commit", timeout: 180000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1" && !document.getElementById("enterBtn").disabled, null, { timeout: 300000 });
    for (const [name, open, close] of SURFACES) {
      if (open) await p.evaluate((c) => { (0, eval)(c); }, open);
      await p.waitForTimeout(name === "slip" ? 9000 : name === "book" ? 7000 : name === "walk" ? 4000 : 2500);
      const m = await p.evaluate(measure); await p.screenshot({ path: path.join(out, `${shape}-${name}.png`) });
      report[`${shape}/${name}`] = m; const n = m.small.length + m.tiny.length + m.off.length + m.bare.length + (m.scrolls ? 1 : 0) + (m.w !== vw ? 1 : 0); bad += n;
      console.log(`${shape}/${name}`.padEnd(16), `width ${m.w}`, n ? "" : "ok", m.w !== vw ? `PAGE IS ${m.w} WIDE, NOT ${vw}` : "", m.scrolls ? "SCROLLS" : "", m.bare.length ? `\n   paper left behind when drawn: ${m.bare.join(" | ")}` : "", m.small.length ? `\n   small: ${m.small.join(" | ")}` : "", m.tiny.length ? `\n   tiny: ${m.tiny.join(" | ")}` : "", m.off.length ? `\n   off screen: ${m.off.join(" | ")}` : "");
      if (close) { await p.evaluate((c) => { (0, eval)(c); }, close); await p.waitForTimeout(800); }
    }
    if (errs.length) { console.log("page errors:", errs); bad += errs.length; }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1)); await b.close(); srv.close();
  console.log(bad ? `${bad} things a phone would mind` : "nothing a phone would mind"); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
