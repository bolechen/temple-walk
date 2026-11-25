// What a phone sees: opens every surface of the interface at a phone's size, upright and on its side, as a touch
// device, takes a picture of each and lists every control a thumb would miss (smaller than 44 px either way), any
// text under 12 px, anything that runs off the screen, and whether the page scrolls or zooms when it should not.
// It also lists a label broken onto a second line inside itself (a button's word, or a phrase of the line at the foot of
// the view that would have fitted whole on one line).
//   node tools/mobile-audit.cjs [out dir] [--lang=ja|en] [--shapes=upright,small] [--drawn]   → tools/out/mobile/*.png and report.json; exits 1 if anything is listed
//   (#614: the page is opened built but not drawn, since what is measured is the interface's DOM, and every wait is for a condition, not for seconds;
//   a surface that lists anything is then opened again with the scene drawn and photographed as `<shape>-<surface>-drawn.png`, the evidence a person looks at.
//   --shapes names the screens to measure, so that several machines can share them (upright, side, small, large); with none, all four, on one machine.
//   --drawn opens every page with the scene drawn, as it was before.)
//   (--only=title,menu audits only those surfaces, the others being opened on the way but not measured;
//   --lang audits the page in Japanese or English, into tools/out/mobile-ja/ or mobile-en/ unless an out dir is named;
//   --level=<id> audits another temple's page (`?level=<id>`), into mobile-<id>[-<lang>]/: only the surfaces that temple has (LEVEL_SURFACES),
//   with its own page seeded so that what is shown of it can be measured; the prologue's surfaces when left out, as before)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const ARGS = process.argv.slice(2), LANG = ((ARGS.find((a) => a.startsWith("--lang=")) || "").slice(7) || "zh");
const ONLY = (ARGS.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean).length ? (ARGS.find((a) => a.startsWith("--only="))).slice(7).split(",") : null;
const SHAPE_ARG = (ARGS.find((a) => a.startsWith("--shapes=")) || "").slice(9).split(",").filter(Boolean), DRAWN = ARGS.includes("--drawn");
const LEVEL = (ARGS.find((a) => a.startsWith("--level=")) || "").slice(8) || null;
const root = require("./site.cjs").site(), out = ARGS.find((a) => !a.startsWith("--")) || path.join(__dirname, "out", (LANG === "zh" ? "mobile" : `mobile-${LANG}`).replace(/^mobile/, LEVEL ? `mobile-${LEVEL}` : "mobile"));   // (another temple's into mobile-<id>[-<lang>])
const { serve } = require("./site.cjs");
let srv;
// The place built but not drawn (tests/e2e/run.cjs, BARE): `?off=` hides parts and unbuilds none, so everything the interface asks of the walk is there.
const BARE = "&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway";
// What the opening scripts below wait with, in the page: frames drawn, or a condition (installed in every page before its own scripts run).
const HELPERS = () => {
  window.__auditFrames = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); f(); });
  window.__auditUntil = async (cond, ms = 90000) => { const t0 = performance.now(); while (!cond()) { if (performance.now() - t0 > ms) throw new Error(`audit: waited ${ms} ms for ${cond}`); await new Promise((r) => requestAnimationFrame(r)); } };
};
// A surface that is only reached from another one's state.
const NEEDS = { sitsay: "sit", clip: "clipping" };
// A surface whose putting away is the way into the next one: the film being made is stopped, and its sheet is what comes up (the sheet is the next surface, `clip`).
const LEADS_TO = { clipping: "clip" };
// Each surface: how to bring it up, and how to put it away again.
const SURFACES = [
  ["title", null, null],
  // (a first visit is shown the mountain first, src/opening.js: passed over with Esc as a visitor may, as the eye comes down to him)
  ["walk", "document.getElementById('enterBtn').click(); __auditFrames(10).then(() => window.__opening().active && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))", null],
  // The year-end bell's night (#341): its one line at the top of the picture, then its card's sheet (laid out by
  // __joyaPreview, since the night is open only on the visitor's clock or the workbench, and this server is neither).
  ["joya", "window.__joyaPreview(true)", "window.__joyaPreview(false)"],
  ["joyaCard", "(async () => { window.__joyaPreview(true); await __auditUntil(() => { const b = document.getElementById('joyaTake'); return b && !b.hidden; }); document.getElementById('joyaTake').click(); await __auditUntil(() => window.__ui().stack.includes('joyaCard')); })()", "document.getElementById('joyaClose')?.click(); window.__joyaPreview(false)"],
  ["prologue", "(() => { window.__pose(6.6, 53.4, Math.atan2(-6.6, 13.4), 0.05); window.__prologue(true); })()", null],
  // (with a temple closed, so that the map's row is there too, #449: the book's 更多 paper and the map's own sheet below keep it)
  ["menu", "document.body.classList.add('seasons'); window.__pilgrimage({ mark: 't00', season: 'autumn' }); window.__menu(true)", "window.__menu(false)"],   // with the seasons open: the hour row, 随时辰 first (#135)
  // The map of temples walked (#449, phase one): one temple closed and another still a fog, then both closed (a place to go, and the one he is in marked); and the ring of ink that a held Q fills.
  ["pilgrim", "(async () => { window.__pilgrimage({ open: true }); for (let i = 0; i < 100 && !document.querySelector('#pilgrimList li'); i++) await new Promise((r) => setTimeout(r, 100)); })()", "document.getElementById('pilgrimClose').click()"],
  ["pilgrimGo", "(async () => { window.__pilgrimage({ mark: 't05', season: 'winter' }); window.__pilgrimage({ open: true }); for (let i = 0; i < 100 && !document.querySelector('#pilgrimList .go'); i++) await new Promise((r) => setTimeout(r, 100)); })()", "document.getElementById('pilgrimClose').click()"],
  ["pilgrimHold", "(async () => { window.__pilgrimage({ clock: 0 }); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true })); await __auditFrames(8); window.__pilgrimage({ clock: 600 }); await __auditFrames(8); })()", "document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'q', bubbles: true })); window.__pilgrimage({ clock: null })"],
  ["credits", "document.getElementById('menuCredits').click()", "document.getElementById('creditsClose').click()"],
  ["book", "window.__book()", "document.getElementById('bookClose').click()"],
  // Where a picture cannot be handed to the system's share sheet (#344: an app's own browser, and this headless one): the page to press and hold.
  // The close of the chapter (#473): the ring at its foot and the word beside it, held at a moment where the words are on; then the full book's page with its 更多 paper laid out as if 山顶再坐一回 were offered.
  // (the one fixed wait left, 1800 ms in this surface's put-away: a first watch is passed over by holding a press for 1.5 s of the page's own real clock, the ring
  // filling meanwhile (holdring.js), and no frame count or state stands for that time; the page keeps no way to fake that clock as the map's hold has, so the audit holds as a visitor does)
  ["ending", "(() => { window.__riteClock(null); void window.__ending(); __auditFrames(10).then(() => window.__riteClock(8000)); })()", "(async () => { const e = document.getElementById('ending'); for (let i = 0; i < 3 && !e.hidden; i++) { e.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9 + i, bubbles: true })); await new Promise((r) => setTimeout(r, 1800)); } window.__riteClock(null); })()"],
  ["bookMore", "(async () => { window.__book(); await __auditFrames(8); document.getElementById('bookReplay').hidden = false; window.__pilgrimage({ mark: 't00' }); document.getElementById('bookMoreBtn').hidden = false; document.getElementById('bookMoreBtn').click(); })()", "document.getElementById('bookMoreClose').click(); document.getElementById('bookClose').click()"],
  ["saveSheet", "(async () => { window.__book(); for (let i = 0; i < 100 && !document.getElementById('bookImg').src; i++) await new Promise((r) => setTimeout(r, 100)); document.getElementById('bookShare').click(); })()", "document.getElementById('saveClose').click(); document.getElementById('bookClose').click()"],
  // 带走朱印帐 (#338): the link made in the book, and the sheet such a link brings (raised from this page's own save).
  ["carryOut", "(async () => { window.__book(); await __auditUntil(() => { const i = document.getElementById('bookImg'); return i.complete && i.naturalWidth > 0; }); document.getElementById('bookMoreBtn').click(); await __auditFrames(8); document.getElementById('bookCarry').click(); })()", "document.getElementById('carryClose').click(); document.getElementById('bookClose').click()"],
  ["carryIn", "void window.__carryAsk()", "document.getElementById('carryInNo').click()"],
  ["photo", "window.__photo(true)", "window.__photo(false)"],
  // The photograph's settings with the short film's row, then a film being made (only the way to stop and a hair of progress), then its sheet (#342).
  ["photoSettings", "window.__photo(true); __auditFrames(10).then(() => document.getElementById('photoSettingsToggle').click())", "window.__photo(false)"],
  ["clipping", "window.__photo(true); __auditFrames(12).then(() => window.__clip({ start: true, secs: 40 }))", "window.__clip({ stop: true })"],
  ["clip", null, "document.getElementById('clipBack')?.click(); window.__photo(false)"],
  ["piece", "window.__work(Object.keys(window.__gallery).map((k) => window.__gallery[k].item.work).find(Boolean))", "document.getElementById('pieceClose').click()"],
  // (the longest of the library's lines, fixed: which one a visitor is given depends on the day, and the audit must not depend on luck; tests/e2e `slipfit` lays every line, in every language, on both screens)
  ["slip", "window.__slip(8)", "window.__slip(null)"],
  // The 功德箱's sheet (#202, web build only): a coin dropped in the great hall, then the paper with its one link.
  ["offering", "(async () => { const w = (ms) => new Promise((r) => setTimeout(r, ms)); for (let i = 0; i < 100 && !window.__offeringSheet?.(); i++) await w(100); })()", "document.getElementById('offeringClose')?.click()"],
  // A lamp lit for someone (#343): the sheet with its list of lines, and with the longest line chosen, the card, the link and the buttons.
  ["bless", "(async () => { window.__bless(7); for (let i = 0; i < 200 && document.getElementById('blessActs').hidden; i++) await new Promise((r) => setTimeout(r, 120)); })()", "document.getElementById('blessClose').click()"],
  // Sitting on the summit (#156): the small word for the breath at the foot, then the line said after the three breaths; both whole on the screen.
  ["sit", "(() => { const q = window.__places.sit; window.__pose(q.at[0] + 0.3, q.at[1] + 0.3, 0, 0); window.__rite('sit'); })()", null],
  ["sitsay", "(async () => { window.__riteClock(0); for (let i = 0; i < 80 && !document.getElementById('say').classList.contains('on'); i++) { window.__riteClock(500); await new Promise((r) => setTimeout(r, 120)); } })()", null],
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
  for (const el of document.querySelectorAll("#say, #hint, #breathWord")) {
    if (!shown(el) || !el.textContent.trim()) continue;
    const r = document.createRange(); r.selectNodeContents(el); const q = r.getBoundingClientRect(); if (q.left < 15.5 || q.right > W - 15.5 || q.top < 0 || q.bottom > H) tight.push(`${el.id} "${el.textContent.trim().slice(0, 14)}" [${Math.round(q.left)},${Math.round(q.right)}] of ${W}`);
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
    const check = (a, b) => { const ph = gs.slice(a, b).filter((g) => !g.space); if (ph.length > 1 && ph[0].line !== ph[ph.length - 1].line && ph.reduce((w, g) => w + g.r.width, 0) + (parseFloat(cs.letterSpacing) || 0) * ph.length < room) wrapped.push(`${el.id || el.className} phrase "${text.slice(a, b).trim().slice(0, 14)}" broken though it fits on a line`); };
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
  // The paper of a sheet laid over the walk lies inside the screen and in the middle of it, with 16 px or more to either side (the lamp sheet,
  // #343: a screen that measures every control and none of the paper let it run edge to edge once).
  const placed = [], card = document.querySelector("#bless[open] article");
  if (card) { const r = card.getBoundingClientRect(); if (r.left < 15.5 || W - r.right < 15.5) placed.push(`paper has ${Math.round(r.left)} px to its left and ${Math.round(W - r.right)} to its right`); if (Math.abs((r.left + r.right) / 2 - W / 2) > 2) placed.push("paper is not in the middle"); if (r.top < -0.5 || r.bottom > H + 0.5) placed.push(`paper runs off the top or foot [${Math.round(r.top)}, ${Math.round(r.bottom)}] of ${H}`); }
  return { small, tiny, off, bare, broken, tight, wrapped, overlap, placed, scrolls: document.documentElement.scrollHeight > H + 1 || document.documentElement.scrollWidth > W + 1, vv: visualViewport ? +visualViewport.scale.toFixed(2) : 1, w: W };
};
// Waiting is for a condition, never for seconds (CLAUDE.md: wait on frames). A surface is settled when the page has drawn a few frames
// and nothing finite is still moving (a fade, a slide: the Web Animations list holds CSS transitions too); a ring that pulses for ever never ends
// and is left out. What a surface needs beyond that is named here: the page's own state that says it is whole.
const READY = {
  sit: () => { const b = document.getElementById("breathWord"); return b && !b.hidden && !!b.textContent.trim(); },
  slip: () => { const d = document.getElementById("slip"); return d && d.open && !!document.getElementById("slipText").textContent.trim(); },
  book: () => { const i = document.getElementById("bookImg"); return i && i.complete && i.naturalWidth > 0; },
};
// (`closing`: the surface has just been put away; the next one must not open under a sheet still on its way out, which would hear its keys, ui.js `key`)
// Another temple's surfaces (--level): T05 has no book, seals, lamp or close yet; what it shows of its own is its page (src/levelpage.js):
// the slip it is shown on and the pause menu's 这一页, with a page seeded in yunjing.levels.v1 (the stroke and the copied line).
const LEVEL_SURFACES = {
  t05: [
    ["title", null, null],
    ["walk", "document.getElementById('enterBtn').click(); __auditFrames(10)", null],
    ["menu", "window.__menu(true)", "window.__menu(false)"],
    ["pageSlip", "window.__page({ show: true })", "document.getElementById('slipTake').click()"],
  ],
};
const LEVEL_SEED = { t05: { "yunjing.levels.v1": JSON.stringify({ v: 1, last: null, place: {}, page: { t05: { p1: { at: 1795300000000 }, stele: { at: 1795300100000, line: "qifo" } } } }) } };
if (LEVEL && LEVEL !== "t00") { if (!LEVEL_SURFACES[LEVEL]) { console.error(`--level=${LEVEL}: no surfaces are listed for it (LEVEL_SURFACES)`); process.exit(2); } SURFACES.splice(0, SURFACES.length, ...LEVEL_SURFACES[LEVEL]); }
const CLOSED = () => !window.__ui().modal;
const settle = (p, name, closing) => p.evaluate(async ([name, ready, cap]) => {
  const frames = () => (window.__yard ? window.__yard().frames : 0), step = () => new Promise((r) => requestAnimationFrame(() => r()));
  const f0 = frames(), t0 = performance.now();
  const moving = () => document.getAnimations().some((a) => a.playState === "running" && a.effect && a.effect.getComputedTiming().iterations !== Infinity);
  const need = ready ? (0, eval)(`(${ready})`) : () => true;
  // (a hard stop, so that a surface that never settles is measured as it stands rather than hanging the audit: a minute of the page's own time, eight seconds for a sheet being put away)
  while (performance.now() - t0 < cap && (frames() - f0 < 4 || moving() || !need())) await step();
}, [name, closing ? CLOSED.toString() : READY[name] ? READY[name].toString() : null, closing ? 8000 : 60000]);
const LINES = (m) => [m.bare.length ? `\n   paper left behind when drawn: ${m.bare.join(" | ")}` : "", m.placed.length ? `\n   placed badly: ${m.placed.join(" | ")}` : "", m.broken.length ? `\n   words broken across lines: ${m.broken.join(" | ")}` : "", m.tight.length ? `\n   too near the edge or each other: ${m.tight.join(" | ")}` : "", m.overlap.length ? `\n   overlapping: ${m.overlap.join(" | ")}` : "", m.wrapped.length ? `\n   wrapped: ${m.wrapped.join(" | ")}` : "", m.small.length ? `\n   small: ${m.small.join(" | ")}` : "", m.tiny.length ? `\n   tiny: ${m.tiny.join(" | ")}` : "", m.off.length ? `\n   off screen: ${m.off.join(" | ")}` : ""];
const SHAPES = [["upright", 390, 844], ["side", 844, 390], ["small", 360, 640], ["large", 430, 932]].filter(([n]) => !SHAPE_ARG.length || SHAPE_ARG.includes(n));
const badOf = (m, vw) => m.small.length + m.tiny.length + m.off.length + m.bare.length + m.broken.length + m.tight.length + m.wrapped.length + m.overlap.length + m.placed.length + (m.scrolls ? 1 : 0) + (m.w !== vw ? 1 : 0);

// One screen size, each of the surfaces named, in one page: measured, photographed, and put away again.
async function pass(b, [shape, vw, vh], names, bare, tag, report) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const p = await ctx.newPage(), errs = []; await p.addInitScript(HELPERS); p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  if (LEVEL && LEVEL_SEED[LEVEL]) await p.addInitScript((seed) => { for (const k in seed) if (localStorage.getItem(k) === null) localStorage.setItem(k, seed[k]); }, LEVEL_SEED[LEVEL]);
  await p.goto(`http://127.0.0.1:${srv.address().port}/?q=low&season=summer&time=day&lang=${LANG}${LEVEL ? `&level=${LEVEL}` : ""}${bare ? BARE : ""}`, { waitUntil: "commit", timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === "1" && !document.getElementById("enterBtn").disabled, null, { timeout: 300000 });
  let bad = 0, seen = 0;
  for (const [name, open, close] of SURFACES.filter(([n]) => names.includes(n))) {
    if (process.env.AUDIT_DEBUG) console.log("   [debug] before", name, JSON.stringify(await p.evaluate(() => window.__ui())));
    if (open) await p.evaluate(async (c) => { await (0, eval)(c); }, open);   // (awaited: an opening script that waits for a state holds the audit with it)
    await settle(p, name);
    // On the way in, the first line about the controls is measured too: it comes once the eye is down with him.
    if (name === "walk") await p.waitForFunction(() => document.getElementById("hint").classList.contains("on"), null, { timeout: 30000 }).then(() => settle(p, name)).catch(() => {});
    if (errs.length > seen) { console.log(`   page error while "${name}" was up:`, errs.slice(seen)); seen = errs.length; }
    const m = await p.evaluate(measure); await p.screenshot({ path: path.join(out, `${shape}-${name}${tag}.png`) });
    const n = badOf(m, vw); bad += n;
    if (!tag) report[`${shape}/${name}`] = m;
    console.log(`${shape}/${name}${tag}`.padEnd(22), `width ${m.w}`, n ? "" : "ok", m.w !== vw ? `PAGE IS ${m.w} WIDE, NOT ${vw}` : "", m.scrolls ? "SCROLLS" : "", ...LINES(m));
    if (close) { await p.evaluate(async (c) => { await (0, eval)(c); }, close); if (name in LEADS_TO) { await settle(p, name); continue; } await settle(p, name, true); { const u = await p.evaluate(() => window.__ui()); if (u.modal) console.log(`   (a sheet is still open after "${name}" was put away: the surfaces after it are measured under it) ${JSON.stringify(u)}`); } }
  }
  if (errs.length) { console.log("page errors:", errs); bad += errs.length; }
  await ctx.close();
  return bad;
}
(async () => {
  srv = await serve(root); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), report = {}; let bad = 0;
  const wanted = SURFACES.map(([n]) => n).filter((n) => !ONLY || ONLY.includes(n));
  for (const shape of SHAPES) {
    const t0 = Date.now(), before = Object.keys(report).length;
    bad += await pass(b, shape, wanted, !DRAWN, "", report);
    console.log(`${shape[0]}: ${Math.round((Date.now() - t0) / 1000)} s`);
    // What a phone would mind is then looked at in the whole picture: each surface that listed anything, with what it needs, drawn.
    const failing = Object.keys(report).filter((k) => k.startsWith(shape[0] + "/")).filter((k) => badOf(report[k], shape[1]) > 0).map((k) => k.split("/")[1]);
    if (!DRAWN && failing.length) {
      // ('walk' goes first for all but the title: a page that has not been entered still has its title over it)
      const again = SURFACES.map(([n]) => n).filter((n) => failing.includes(n) || failing.some((f) => NEEDS[f] === n) || (n === "walk" && failing.some((f) => f !== "title")));
      console.log(`${shape[0]}: ${failing.join(", ")} listed something; opened again with the scene drawn`);
      await pass(b, shape, again, false, "-drawn", {});
    }
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1)); await b.close(); srv.close();
  console.log(bad ? `${bad} things a phone would mind` : "nothing a phone would mind"); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
