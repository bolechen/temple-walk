// What a phone sees: opens every surface of the interface at a phone's size, upright and on its side, as a touch
// device, takes a picture of each and lists every control a thumb would miss (smaller than 44 px either way), any
// text under 12 px, anything that runs off the screen, and whether the page scrolls or zooms when it should not.
// It also lists a label broken onto a second line inside itself (a button's word, or a phrase of the line at the foot of
// the view that would have fitted whole on one line).
//   node tools/mobile-audit.cjs [out dir] [--lang=ja|en]   → tools/out/mobile/*.png and report.json; exits 1 if anything is listed
//   (--only=title,menu audits only those surfaces, the others being opened on the way but not measured;
//   --lang audits the page in Japanese or English, into tools/out/mobile-ja/ or mobile-en/ unless an out dir is named)
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ARGS = process.argv.slice(2), LANG = ((ARGS.find((a) => a.startsWith("--lang=")) || "").slice(7) || "zh");
const ONLY = (ARGS.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean).length ? (ARGS.find((a) => a.startsWith("--only="))).slice(7).split(",") : null;
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
  const W = innerWidth, H = innerHeight, small = [], tiny = [], off = [], broken = [], tight = [], seen = new Set();
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
  // A label written across two lines (「日本」「語」) is not read as one word: a chip, or anything in the title bar, must set its text on one line,
  // and what the title says must keep 16 px from either edge.
  const rowsOf = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top / 4))).size; };
  for (const el of document.querySelectorAll(".chip, .title-links *, #title .sub, #title .how, #enterBtn, #againBtn")) {
    if (!shown(el) || (top && !top.contains(el)) || el.children.length || !el.textContent.trim()) continue;
    if (el.closest("#title") ? rowsOf(el) > 1 && !el.matches("#title .sub, #title .how") : rowsOf(el) > 1) broken.push(`${el.id || el.className || el.tagName} "${el.textContent.trim().slice(0, 14)}" in ${rowsOf(el)} lines`);
  }
  if (document.getElementById("title") && shown(document.getElementById("title"))) for (const el of document.querySelectorAll("#title h1, #title .sub, #title .how, #titleSeals, #enterBtn, #againBtn, .title-links .chip")) {
    if (!shown(el) || !el.textContent.trim()) continue;
    const r = document.createRange(); r.selectNodeContents(el); const q = r.getBoundingClientRect(); if (q.left < 15.5 || q.right > W - 15.5) tight.push(`${el.id || el.className || el.tagName} "${el.textContent.trim().slice(0, 14)}" [${Math.round(q.left)},${Math.round(q.right)}] of ${W}`);
  }
  const chips = [...document.querySelectorAll(".title-links .chip")].filter(shown).map((e) => [e.id || e.dataset.lang, e.getBoundingClientRect()]);
  for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) { const a = chips[i][1], b = chips[j][1]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) tight.push(`${chips[i][0]} overlaps ${chips[j][0]}`); }
  // A label read as one thing must not be broken inside itself. The lines it is set on are found from its characters:
  // a character that goes back along the line and down from the one before it begins a new line (in a slip written
  // down the page, back up and across to the next column). A button's word broken anywhere is listed, and so is a short
  // label wrapped at all; a longer one may wrap between its words. In the line at the foot of the view, a phrase between
  // its separators is listed when it is broken although it is narrower than the line.
  const glyphs = (el) => { const out = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.parentElement.getBoundingClientRect().width > 1 && n.parentElement.getBoundingClientRect().height > 1) for (let i = 0; i < n.textContent.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getClientRects()[0]; out.push({ c: n.textContent[i], r }); }
    return out; };
  const lines = (gs, vert) => { let line = 0, prev = null; for (const g of gs) { if (!g.r || !g.r.width || /\s|\u3000/.test(g.c)) { g.line = prev ? line : 0; g.space = true; continue; }
      if (prev && (vert ? g.r.top < prev.r.bottom - 1 && g.r.left < prev.r.left - 2 : g.r.left < prev.r.right - 1 && g.r.top > prev.r.top + 2)) line++; g.line = line; prev = g; } return line + 1; };
  const wrapped = [];
  for (const el of document.querySelectorAll("button, a[href], [role=button], .chip, .stamp")) {
    if (!shown(el) || (top && !top.contains(el)) || el.closest("[data-wraps]")) continue;
    const vert = getComputedStyle(el).writingMode.startsWith("vertical"), gs = glyphs(el), label = el.textContent.trim().replace(/\s+/g, " ");
    // (words read only by a screen reader are not on the screen; a long address can only break inside itself)
    if (!label || /^[\x21-\x7e]{25,}$/.test(label) || lines(gs, vert) < 2) continue;
    const solid = gs.filter((g) => !g.space), inWord = solid.some((g, i) => i && g.line !== solid[i - 1].line && !gs.slice(gs.indexOf(solid[i - 1]) + 1, gs.indexOf(g)).some((x) => x.space));
    if (inWord || [...label].length <= 16) wrapped.push(`${el.id || el.className || el.tagName} "${label.slice(0, 16)}"${inWord ? " broken inside a word" : ""}`);
  }
  for (const el of document.querySelectorAll(".caption")) {
    if (!shown(el) || (top && !top.contains(el)) || !el.textContent.trim()) continue;
    const gs = glyphs(el), cs = getComputedStyle(el), room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); lines(gs, false);
    const text = gs.map((g) => g.c).join(""), sep = /[\s\u3000]+·[\s\u3000]+/g; let from = 0, m;
    const check = (a, b) => { const ph = gs.slice(a, b).filter((g) => !g.space); if (ph.length > 1 && ph[0].line !== ph[ph.length - 1].line && ph.reduce((w, g) => w + g.r.width, 0) < room) wrapped.push(`${el.id || el.className} phrase "${text.slice(a, b).trim().slice(0, 14)}" broken though it fits on a line`); };
    while ((m = sep.exec(text))) { check(from, m.index); from = m.index + m[0].length; } check(from, text.length);
  }
  // Two controls on the picture lying on each other: a thumb cannot tell which it presses.
  const overlap = [], over = [...document.querySelectorAll("#yardView button, #yardView [role=button], body > #jumpBtn")].filter((el) => !top && shown(el) && getComputedStyle(el).pointerEvents !== "none");
  for (let i = 0; i < over.length; i++) for (let j = i + 1; j < over.length; j++) {
    const a = over[i], c = over[j]; if (a.contains(c) || c.contains(a)) continue;
    const r = a.getBoundingClientRect(), q = c.getBoundingClientRect(), w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (w > 1 && h > 1) overlap.push(`${a.id || a.className} "${a.textContent.trim().slice(0, 6)}" on ${c.id || c.className} "${c.textContent.trim().slice(0, 6)}" ${Math.round(w)}x${Math.round(h)}`);
  }
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) { const el = n.parentElement; if (!n.textContent.trim() || !el || !shown(el) || (top && !top.contains(el)) || seen.has(el)) continue; seen.add(el); const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11.9) tiny.push(`${el.id || el.className || el.tagName} "${n.textContent.trim().slice(0, 10)}" ${fs}px`); }
  // A sheet that scrolls must carry its paper itself (class `scrolls`): paper drawn behind the words is only as tall as
  // the part in sight and is drawn away with them, leaving the rest of the sheet bare.
  const bare = [...document.querySelectorAll(".paper:not(.scrolls)")].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY)).map((el) => el.id || el.parentElement.id + " ." + el.className);
  return { small, tiny, off, bare, broken, tight, wrapped, overlap, scrolls: document.documentElement.scrollHeight > H + 1 || document.documentElement.scrollWidth > W + 1, vv: visualViewport ? +visualViewport.scale.toFixed(2) : 1, w: W };
};
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), report = {}; let bad = 0;
  for (const [shape, vw, vh] of [["upright", 390, 844], ["side", 844, 390], ["small", 360, 640], ["large", 430, 932]]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
    await p.goto(`http://127.0.0.1:${srv.address().port}/?q=low&season=summer&time=day&lang=${LANG}`, { waitUntil: "commit", timeout: 180000 });
    await p.waitForFunction(() => document.body.dataset.ready === "1" && !document.getElementById("enterBtn").disabled, null, { timeout: 300000 });
    for (const [name, open, close] of SURFACES.filter(([n]) => !ONLY || ONLY.includes(n))) {
      if (open) await p.evaluate((c) => { (0, eval)(c); }, open);
      await p.waitForTimeout(name === "slip" ? 9000 : name === "book" ? 7000 : name === "walk" ? 4000 : 2500);
      // On the way in, the first line about the controls is measured too: it comes once the eye is down with him.
      if (name === "walk") await p.waitForFunction(() => document.getElementById("hint").classList.contains("on"), null, { timeout: 30000 }).then(() => p.waitForTimeout(1200)).catch(() => {});
      const m = await p.evaluate(measure); await p.screenshot({ path: path.join(out, `${shape}-${name}.png`) });
      report[`${shape}/${name}`] = m; const n = m.small.length + m.tiny.length + m.off.length + m.bare.length + m.broken.length + m.tight.length + m.wrapped.length + m.overlap.length + (m.scrolls ? 1 : 0) + (m.w !== vw ? 1 : 0); bad += n;
      console.log(`${shape}/${name}`.padEnd(16), `width ${m.w}`, n ? "" : "ok", m.w !== vw ? `PAGE IS ${m.w} WIDE, NOT ${vw}` : "", m.scrolls ? "SCROLLS" : "", m.bare.length ? `\n   paper left behind when drawn: ${m.bare.join(" | ")}` : "", m.broken.length ? `\n   words broken across lines: ${m.broken.join(" | ")}` : "", m.tight.length ? `\n   too near the edge or each other: ${m.tight.join(" | ")}` : "", m.overlap.length ? `\n   overlapping: ${m.overlap.join(" | ")}` : "", m.wrapped.length ? `\n   wrapped: ${m.wrapped.join(" | ")}` : "", m.small.length ? `\n   small: ${m.small.join(" | ")}` : "", m.tiny.length ? `\n   tiny: ${m.tiny.join(" | ")}` : "", m.off.length ? `\n   off screen: ${m.off.join(" | ")}` : "");
      if (close) { await p.evaluate((c) => { (0, eval)(c); }, close); await p.waitForTimeout(800); }
    }
    if (errs.length) { console.log("page errors:", errs); bad += errs.length; }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1)); await b.close(); srv.close();
  console.log(bad ? `${bad} things a phone would mind` : "nothing a phone would mind"); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
