// End-to-end scenarios: a real page in a real browser, driven the way a visitor drives it.
//   node tests/e2e/run.cjs --shard=1/4  the first of four parts of whatever was asked for (the weekly run shares it among four machines)
//   node tests/e2e/run.cjs              every scenario (about twenty minutes without a GPU)
//   node tests/e2e/run.cjs --smoke      tiers 1 and 2: everything but the long walks and the photograph
//   node tests/e2e/run.cjs --quick      tier 1 only (the page comes up clean): what must pass before anything is published
//   node tests/e2e/run.cjs walk photo   only those named
// Each scenario is independent and fails on any error the page reports. A report is written to tools/out/e2e-report.json.
const fs = require("fs"), path = require("path");
const { serve, launch, open, expect, out } = require("./lib.cjs");

// Software rendering draws the whole temple about once a second and takes twenty seconds to bring it up. A scenario
// that asks what the page does (where he may walk, what a key opens, what is kept) and never looks at the picture is
// opened with the place built but not drawn (`BARE`: ?off= hides parts, it does not unbuild them, so the walker, the
// plan and every hook are as they are for a visitor); it then runs several times faster. The scenarios that look at the
// picture (boot, doorway, halls, snow, moods, views, photo, photo-ui, menu, parts, finish, rites, stairs, drop), and the long walk that
// samples his height as he climbs, draw all of it.
// `doorway` too: the rooms seen through the doors are drawn into cubes as he comes near (doorway.js), a face a frame, and
// under software rendering one face of a room can hold a frame for a second, which no scenario that never looks needs.
const BARE = "&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway";
const scenarios = {
  // The page comes up, draws, and offers its controls.
  // A browser that cannot draw the temple at all (#190): no WebGL, or its graphics card switched off for the browser. The
  // title says why in words, offers no "try again", and its language buttons still work, in each language. The renderer
  // failing to start is what this scenario makes happen, so three's one line about it is expected here and nowhere else;
  // any other console error or page error still fails it.
  nogl: { tier: 1, async run(b, base) {
    const ctx = await b.newContext({ viewport: { width: 900, height: 600 }, locale: "zh-CN" }), page = await ctx.newPage(), errors = [];
    await page.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/i.test(kind) ? null : get.call(this, kind, ...rest); }; });
    page.on("pageerror", (e) => errors.push("page error: " + String(e).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error" && !/WebGLRenderer: (A WebGL context could not be created|Error creating WebGL context)/i.test(m.text())) errors.push("console: " + m.text().slice(0, 300)); });
    page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));
    const said = { zh: "浏览器不支持 WebGL", ja: "WebGL が利用できません", en: "WebGL is unavailable", ko: "WebGL을 사용할 수 없습니다" };
    const look = () => page.evaluate(() => ({ label: document.getElementById("loadLabel").textContent, retry: !document.getElementById("loadRetry").hidden, enter: !document.getElementById("enterBtn").disabled, lang: document.documentElement.lang }));
    await page.goto(base + "?q=low", { waitUntil: "commit", timeout: 120000 });
    await page.waitForFunction(() => /WebGL/.test(document.getElementById("loadLabel").textContent), null, { timeout: 120000 });
    let s = await look();
    expect(s.label.includes(said.zh) && !s.retry && !s.enter, "a browser without WebGL should be told why, with no retry and no way in: " + JSON.stringify(s));
    // The language buttons on the title, which the walk would have bound, still open the page in another language; and so on round.
    for (const l of ["ja", "en", "ko", "zh"]) {
      await Promise.all([page.waitForNavigation({ waitUntil: "commit", timeout: 120000 }), page.click(`#title [data-lang="${l}"]`)]);
      await page.waitForFunction((w) => document.getElementById("loadLabel").textContent.includes(w), said[l], { timeout: 120000 });
      s = await look(); expect(!s.retry && !s.enter, `in ${l} there should still be no retry and no way in: ` + JSON.stringify(s));
    }
    expect(errors.length === 0, errors.join("\n")); await ctx.close();
  } },
  // The cedars' wood is grown from a seed by three's TreeGenerator (#162): the page and Node must grow the same trees,
  // to the tenth of a millimetre, or a picture taken in one could not be measured in the other (#161).
  // The ground keeps what comes down on it (#267): in the real page, leaves that touch the paving under the first
  // court's maple are handed to the ground's record as the frames go, and on an autumn night (a breeze below every leaf's
  // grip) none of them goes in the next minute; run on three minutes, more lie there than before.
  litter: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=-7.5,33,-0.38,-0.42&season=autumn&time=night" + BARE);
    const got = () => t.page.evaluate(() => window.__litter(0, true));
    await t.until(async () => (await got()).kept >= 5, 240000, "no leaf was handed to the ground under the maple");
    const L = (await got()).leaves.filter((l) => Math.abs(l[0]) > 3).slice(0, 30);
    const amount = (l) => t.page.evaluate(([x, z]) => window.__litter(0, [x, z, 0.1]).at, l);
    const before = []; for (const l of L) before.push(await amount(l));
    expect(before.every((n) => n >= 1), "a leaf handed over is not on the ground: " + JSON.stringify(before));
    await t.page.evaluate(() => window.__litter(60)); await t.frames(2);
    for (let i = 0; i < L.length; i++) { const n = await amount(L[i]); expect(n >= before[i], `on a still night the leaves round ${L[i]} went from ${before[i]} to ${n}`); }
    const a = await got(); await t.page.evaluate(() => window.__litter(180)); const c = await got();
    expect(c.kept + c.heap > a.kept + a.heap + 20, "three more minutes and no more leaves lie on the ground: " + JSON.stringify([a.kept, a.heap, c.kept, c.heap]));
    await t.close();
  } },
  treeseed: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low" + BARE);
    const page = await t.page.evaluate(() => window.__trees());
    await import(require("url").pathToFileURL(require("path").join(__dirname, "../unit/dom-stub.mjs")).href);
    const THREE = await import("three"), { buildSite } = await import(require("url").pathToFileURL(require("path").join(__dirname, "../../app/src/site.js")).href), { createTrees, geometryHash } = await import(require("url").pathToFileURL(require("path").join(__dirname, "../../app/src/trees.js")).href);
    const M = new Proxy({}, { get: (o, k) => (k === "plaster" || k === "interior" ? () => (o["__" + k] ||= new THREE.MeshBasicMaterial()) : (o[k] ||= new THREE.MeshBasicMaterial())) });
    const node = createTrees(new THREE.Group(), M, buildSite(M).trees, {});
    expect(page.cedars > 10 && page.cedars === node.cedars.length, `the page grew ${page.cedars} cedars, Node ${node.cedars.length}`);
    expect(page.hash === geometryHash(node.cedars.map((c) => c.geometry)), `the page's cedars (${page.hash}) are not Node's (${geometryHash(node.cedars.map((c) => c.geometry))})`);
    await t.close();
  } },
  boot: { tier: 1, async run(b, base) {
    const t = await open(b, base, "q=low", { enter: false, observeLoading: true });
    // First the title: the temple's name, a way in, and nothing else in the way.
    expect(await t.page.isVisible("#title") && (await t.page.textContent("#title h1")) === "山门之外" && (await t.page.textContent("#title .sub")).includes("云径禅寺"), "the title is missing");
    expect(!(await t.page.isVisible("#photoBtn")) && !(await t.page.isVisible("#bookBtn")) && !(await t.page.isVisible("#act")), "the walking controls should wait behind the title");
    expect(await t.page.evaluate(() => document.fonts.check('40px "Yunjing Brush"', "云径禅寺") && document.fonts.check('20px "Yunjing Serif"', "朱印") && document.fonts.check('20px "Yunjing Kai"', "朱印")), "the temple's own typefaces did not load");
    await t.page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 });
    await t.page.keyboard.press("Space"); await t.until(() => t.page.evaluate(() => document.getElementById("title").hidden), 30000, "the title never left");
    // A first visitor is shown the mountain first (src/opening.js); what follows is the arriving view it hands back.
    expect(await t.page.evaluate(() => window.__opening().active), "a first visitor should be shown the opening");
    await t.until(() => t.page.evaluate(() => window.__opening().phase === "done"), 180000, "the opening never handed the walk back");
    expect((await t.journey()).entered && (await t.page.textContent("#goal")).includes("钟楼"), "a new visitor should be pointed at the bell");
    await t.frames(2); expect(await t.page.isVisible("#way") && /\d+ 步/.test(await t.page.textContent("#way")), "an arriving visitor should be shown the way to the first place, and how far");
    const loading = await t.page.evaluate(() => ({ values: window.__loadingHistory, hidden: document.getElementById("loading").hidden, value: document.getElementById("loadProgress").value }));
    expect(loading.values.includes(null), "loading indicator must exist before module initialization");
    expect(loading.values.some(v => v > 0 && v < 100), "loading must show intermediate real progress");
    expect(loading.value === 100 && loading.hidden, "loading must finish and leave the picture when ready");
    const numbers = loading.values.filter(v => v !== null);
    expect(numbers.every((v, i) => !i || v >= numbers[i - 1]), "loading progress moved backwards");
    const s = await t.state(); expect(s.running && s.frames >= 3, "the walk is not running"); expect(s.tris > 50000, "almost nothing is being drawn: " + s.tris);
    expect(s.h < -10, "the visit should begin at the foot of the path, not at height " + s.h);
    await t.frames(10);
    expect((await t.state()).dressed === false, "a visitor should meet the novice built in code: the sculpted body is worn only with ?body=sculpt until its cloth stops tearing");
    const p = await t.probe(); expect(p.view === "third" && p.monk, "a visitor arriving should see the novice from behind");
    { const vp = t.page.viewportSize(), [x, y, w, h] = p.monkBox || [];   // and he is in the picture, whole, at a size a person can see (tools/portrait.js finds him by this)
      expect(p.monkBox && x >= 0 && y >= 0 && x + w <= vp.width && y + h <= vp.height && h > vp.height * 0.08, "the novice should stand whole in the picture: " + JSON.stringify({ box: p.monkBox, vp })); }
    expect(p.camDist > 3.2, `the first sight of the place should not be the back of his head: the eye is ${p.camDist} m behind him`);
    expect(p.lum > 12 && p.lum < 245, "the picture is blank: mean " + p.lum.toFixed(1));
    for (const id of ["photoBtn", "menuBtn", "bookBtn"]) expect(await t.page.isVisible("#" + id), `#${id} is not on screen`);
    // Only those: the view changes with the wheel or two fingers, the season is not offered to a first visit, and there is no jump button.
    for (const id of ["viewBtn", "moodBtn", "jumpBtn"]) expect(!(await t.page.$("#" + id)), `#${id} should no longer sit on the picture`);
    expect(!(await t.page.evaluate(() => document.body.classList.contains("seasons"))) && !(await t.page.isVisible('[data-season="winter"]')), "a first visit should not be offered the seasons");
    // What is said about the controls is said once, on arriving, and then the picture is left alone.
    const hud = () => t.page.evaluate(() => window.__hud());
    expect((await hud()).said.includes("walk") && (await t.page.textContent("#hint")).includes("行走"), "an arriving visitor was not told how to walk");
    expect(!(await t.page.isVisible("#keys")), "the list of keys should wait until it is asked for");
    await t.until(async () => { const h = await hud(); return !h.tip && !h.goal && !h.moodTag && !(await t.page.isVisible("#hint")) && !(await t.page.isVisible("#goal")) && !(await t.page.isVisible("#way")); }, 60000, "the words on the picture never left it");
    for (const id of ["moodPanel", "print", "photoBar", "frame", "book", "slip", "toast", "act"]) expect(!(await t.page.isVisible("#" + id)), `#${id} should start hidden`);
    const m = await t.page.evaluate(() => window.__merged); expect(m.after < m.before / 3 && m.after < 120, "static geometry was not merged: " + JSON.stringify(m));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The events the operation reads (src/analytics.js): the page names what a visitor does, and the last of them are
  // kept for `__events()`. No picture is looked at, so the place is built but not drawn.
  events: { tier: 1, async run(b, base) {
    const t = await open(b, base, "q=low" + BARE, { enter: false });
    await t.page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 });
    await t.page.keyboard.press("Space");
    await t.until(() => t.page.evaluate(() => document.body.classList.contains("entered")), 30000, "the title never left");
    if (await t.page.evaluate(() => window.__opening().active)) { await t.page.keyboard.press("Escape"); await t.until(() => t.page.evaluate(() => !window.__opening().active), 60000, "Esc did not pass over the opening"); }
    const names = () => t.page.evaluate(() => window.__eventLog().map((e) => e.name));
    expect((await names()).includes("demo.ready") && (await names()).includes("demo.enter"), "the page should name its start: " + JSON.stringify(await names()));
    await t.page.keyboard.down("w"); await t.frames(8); await t.page.keyboard.up("w");
    expect((await names()).includes("demo.walk"), "walking should be named: " + JSON.stringify(await names()));
    await t.page.evaluate(() => window.__inside("main"));
    await t.until(async () => (await names()).includes("demo.hall"), 30000, "entering a hall should be named");
    await t.page.keyboard.press("v");
    expect((await names()).includes("demo.view"), "changing the view should be named");
    await t.page.keyboard.press("b"); await t.until(() => t.page.isVisible("#book"), 20000, "the book did not open");
    expect((await names()).includes("demo.book"), "opening the book should be named");
    await t.page.click("#bookClose");
    await t.page.keyboard.press("Escape"); await t.until(() => t.page.isVisible("#menu"), 10000, "no menu");
    expect((await names()).includes("demo.menu"), "opening the menu should be named");
    await t.page.keyboard.press("Escape");
    const e = await t.page.evaluate(() => window.__eventLog());
    expect(e.every((x) => "lang" in x.data), "every event should carry the language: " + JSON.stringify(e.filter((x) => !("lang" in x.data))));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The page in Japanese and in English (src/i18n.js): a browser that reads Japanese is met in Japanese, from the title to
  // the seal book, in faces of its own; the choice made in the menu is kept, and the address can always ask again.
  lang: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low" + BARE, { enter: false, locale: "ja-JP" });
    const words = (sel) => t.page.textContent(sel);
    await t.page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 });
    expect(await t.page.evaluate(() => document.documentElement.lang) === "ja" && (await words("#title h1")) === "山門之外" && (await words("#enterBtn")) === "山に入る" && (await t.page.title()).includes("雲径禅寺"), "a Japanese browser should be met by the title in Japanese: " + JSON.stringify([await words("#title h1"), await words("#enterBtn"), await t.page.title()]));
    expect(await t.page.evaluate(async () => { await document.fonts.load('20px "Yunjing Kai JA"', "山に入る"); return document.fonts.check('20px "Yunjing Kai JA"', "山に入る"); }), "the Japanese kai did not load");
    expect(!(await t.page.isVisible("#titleCommunity")), "the WeChat group is offered only in Chinese");
    expect(await t.page.isVisible('.langs [data-lang="en"]') && !(await t.page.isVisible('.langs [data-lang="ja"]')), "the title should offer the other two languages");
    await t.page.click("#enterBtn"); await t.until(() => t.page.evaluate(() => document.body.classList.contains("entered")), 30000, "the title never left");
    if (await t.page.evaluate(() => window.__opening().active)) { await t.page.keyboard.press("Escape"); await t.until(() => t.page.evaluate(() => !window.__opening().active), 60000, "Esc did not pass over the opening"); }   // a first visit: the mountain first (src/opening.js)
    expect((await words("#goal")).includes("鐘楼") && (await words("#goal")).includes("次は"), "the next place should be named in Japanese: " + (await words("#goal")));
    await t.page.evaluate(() => { const p = window.__places.bell; window.__pose(p.at[0] + 0.3, p.at[1] - 0.3, 0, 0); });
    await t.until(async () => (await t.page.isVisible("#act")) && (await words("#act")).includes("鐘を撞く"), 30000, "the bell should be offered in Japanese");
    await t.page.evaluate(() => window.__book()); await t.until(() => t.page.isVisible("#book"), 20000, "the book did not open");
    // (the walk so far is told only after twenty steps, #185: here he has been posed, not walked)
    expect((await words("#bookHint")).includes("鐘楼") && (await words("#bookHint")).includes("撞く"), "the book's hint should be in Japanese: " + (await words("#bookHint")));
    expect(await t.page.evaluate(() => document.getElementById("bookImg").complete && document.getElementById("bookImg").naturalWidth === 1200), "the seal book was not drawn");
    await t.page.click("#bookClose");
    // A work's card in the hall: its title and its note in Japanese, the museum's source line as published.
    await t.page.evaluate(() => window.__work("liangkai-chushan-shijia")); await t.until(() => t.page.isVisible("#piece"), 20000, "the work's card did not open");
    expect((await words("#pieceTitle")) === "出山釈迦図" && /[ぁ-ん]/.test(await words("#pieceNote")) && (await words("#pieceFacts")).includes("東京国立博物館") && (await words("#pieceCredit")).startsWith("Source: ColBase"), "the work's card should be in Japanese: " + (await words("#pieceTitle")));
    expect((await words("#pieceProcessed")).includes("を加工して作成") && (await words("#pieceProcessed")).includes("TA-617") && await t.page.isVisible("#pieceProcessed"), "a ColBase card should say, in Japanese, that the picture was edited: " + (await words("#pieceProcessed")));
    await t.page.click("#pieceClose");
    // Chosen in the menu: kept, and the page opens again in it.
    await t.page.keyboard.press("Escape"); await t.until(() => t.page.isVisible("#menu"), 10000, "no menu");
    expect(await t.page.getAttribute('#menu [data-lang="ja"]', "aria-pressed") === "true" && (await words("#menu")).includes("見回す速さ"), "the menu should be in Japanese, with Japanese circled");
    await Promise.all([t.page.waitForNavigation({ waitUntil: "commit", timeout: 120000 }), t.page.click('#menu [data-lang="en"]')]);
    await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    expect(await t.page.evaluate(() => sessionStorage.getItem("yunjing.lang.from")) === null, "the page that a language switch opened should have read, and forgotten, where it came from");
    expect(await t.page.evaluate(() => document.documentElement.lang) === "en" && (await words("#title .sub")).includes("Yunjing Temple") && new URL(t.page.url()).searchParams.get("lang") === null, "English should be chosen and kept, with nothing in the address: " + (await words("#title .sub")));
    expect(await t.page.evaluate(() => getComputedStyle(document.getElementById("photoBtn")).writingMode) === "horizontal-tb", "English is not written down the page");
    await t.page.evaluate(() => window.__work("muqi-hu-tu")); await t.until(() => t.page.isVisible("#piece"), 20000, "the work's card did not open in English");
    expect((await words("#pieceTitle")) === "Tiger" && (await words("#pieceNote")).startsWith("An ink painting on silk by the Southern Song") && !/[\u3400-\u9fff]/.test((await words("#pieceNote")) + (await words("#pieceFacts"))), "the work's card should be in English: " + (await words("#pieceNote")).slice(0, 80));
    await t.page.click("#pieceClose");
    // Nothing on the English title is left in Chinese but the calligraphy (the name and its seal).
    const left = await t.page.evaluate(() => [...document.querySelectorAll("#title button, #title p, #title .sub, #title .how")].filter((el) => el.offsetParent && !el.closest("[data-lang]") && /[\u3400-\u9fff]/.test(el.textContent)).map((el) => el.textContent));
    expect(!left.length, "Chinese left on the English title: " + JSON.stringify(left));
    // Korean, asked for in the address: the title and a work's card in Hangul, in a face of its own.
    await t.page.goto(base + "?q=low&lang=ko" + BARE, { waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1" && !document.getElementById("enterBtn").disabled, null, { timeout: 240000 });
    expect(await t.page.evaluate(() => document.documentElement.lang) === "ko" && (await words("#title .sub")).includes("운경선사") && ["산에 들기", "이어서 걷기"].includes(await words("#enterBtn")), "?lang=ko should bring the Korean title: " + (await words("#title .sub")) + " / " + (await words("#enterBtn")));
    expect(await t.page.evaluate(async () => { await document.fonts.load('20px "Yunjing Serif KO"', "산에 들기"); return document.fonts.check('20px "Yunjing Serif KO"', "산에 들기"); }), "the Korean face did not load");
    await t.page.evaluate(() => window.__work("liangkai-chushan-shijia")); await t.until(() => t.page.isVisible("#piece"), 20000, "the work's card did not open in Korean");
    expect((await words("#pieceTitle")) === "출산석가도" && /[가-힣]/.test(await words("#pieceNote")), "the work's card should be in Korean: " + (await words("#pieceTitle")));
    await t.page.click("#pieceClose");
    await t.page.goto(base + "?q=low&lang=zh" + BARE, { waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    expect((await t.page.evaluate(() => document.documentElement.lang)).startsWith("zh") && (await words("#title .sub")).includes("云径禅寺"), "?lang=zh should bring the Chinese back");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Up the old path, round the screen wall, through the gate, across the court, in at the door; incense; out again.
  walk: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1");   // drawn: it reads his height along the way a few times a second, and not drawn he is up the mountain between two readings
    await t.page.evaluate(() => window.__walk([[21.3, 81.5], [21.3, 77.5], [11, 77.5], [0, 77.5], [0, 62.5], [8.5, 60], [8.5, 49], [0, 46.5], [0, 2], [0, -6.0]]));
    let lo = 0, hi = -99;
    await t.until(async () => { const s = await t.state(); lo = Math.min(lo, s.h); hi = Math.max(hi, s.h); return t.inHall(); }, 700000, "the walk in never reached the hall");
    expect(lo < -14 && hi >= 1.4, `the climb should go from the foot of the path to the hall's platform; went ${lo} to ${hi}`);
    // Indoors: a real room. He stands on its floor, far below the court, with the figures before him.
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted");
    let s = await t.state(); expect(s.inside && s.h < -50 && s.z > 5, "should stand just inside the door: " + JSON.stringify(s));
    await t.until(() => t.page.evaluate(() => window.__figures() === "here"), 120000, "the figures never arrived"); await t.frames(3); await t.shot("e2e-hall");
    // He can walk about in it, the columns stop him, and a frame on the wall can be looked at.
    // (The way to the frame keeps clear of the row of columns at z = 4.35, whose reach, his own width added, ends at 5.02.)
    const cx = await t.page.evaluate(() => window.__places.incense.at[0]), go = (pts) => t.page.evaluate(([c, p]) => window.__walk(p.map(([x, z]) => [c + x, z])), [cx, pts]);   // every hall has its own room; this one's middle is at cx
    await go([[-6, 5.7], [-11.7, 5.5]]); await t.until(async () => (await t.journey()).look === "main-w1", 60000, "standing before a frame offered nothing");
    expect((await t.page.getAttribute("#act", "data-word")) === "观看", "the frame should offer a look"); await t.page.click("#act");
    await t.until(() => t.page.isVisible("#slip"), 20000, "the frame showed nothing");
    expect((await t.page.textContent("#slipText")) === "入山帖" && (await t.page.textContent("#slipFrom")).includes("竹林里的泥"), "the first frame in the great hall should hold its leaf of the story"); await t.page.click("#slipTake");
    // The westernmost column of the row before the dais: asked of the page, because the bays have moved it once already (9.56 m, then 10.13 after daa9d27, and this scenario kept the old number for a week).
    const col = await t.page.evaluate((c) => { const cs = window.__columns("main").filter((k) => Math.abs(k.z - 4.35) < 0.05); return cs.sort((a, b) => a.x - b.x)[0]; }, cx);
    expect(col && await t.page.evaluate(([x, z]) => window.__blocked(x, z), [col.x, col.z]), "the hall has no column before the dais, or it does not stop him: " + JSON.stringify(col));
    await t.page.evaluate(([x, z]) => window.__walk([[x, z]]), [col.x, col.z]); await t.frames(20); s = await t.state(); expect(Math.hypot(s.x - col.x, s.z - col.z) > 0.45, "he walked through a column: he stands " + Math.hypot(s.x - col.x, s.z - col.z).toFixed(2) + " m from the centre of the one at " + col.x + ", " + col.z);
    // Incense before the altar, then out by the door into the daylight.
    await go([[0, 4], [0, -1.2]]); await t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === "上香", 240000, "no way to offer incense");
    await t.page.click("#act"); await t.until(async () => (await t.journey()).seals.incense > 0, 60000, "no seal for the incense");
    await go([[0, 4], [0, 7.9]]); await t.until(async () => !(await t.inHall()), 60000, "never left the hall");
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the daylight never cleared");
    s = await t.state(); expect(s.running && Math.abs(s.h - 1.5) < 0.05 && s.z > -7, "should step out onto the porch: " + JSON.stringify(s));
    await t.frames(4); expect(!(await t.inHall()), "walked straight back in"); expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // At a real walking pace, a tap on the hall leads to its door and through it.
  tap: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&view=first&cam=0.3,2.2,0,0.05" + BARE, { hasTouch: true });
    await t.page.touchscreen.tap(210, 300); await t.until(t.inHall, 300000, "a tap on the hall never led inside");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A tap on the ground sends him to the spot tapped, on every level of the mountain and on the stairs between.
  taps: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&view=first&cam=0,30,0,0" + BARE, { hasTouch: true });
    // Each place: where he stands, which way he looks (0 is uphill, a quarter turn is east), and the least height that proves he is there.
    for (const [name, x, z, yaw, lo] of [["the court", 0, 30, 0, -0.1], ["the first terrace", 12, -40, 0, 2.3], ["the second terrace", 6, -70.5, Math.PI / 2, 5.1], ["the summit", -10, -120.4, Math.PI / 2, 19.9], ["the foot of the path, looking up its steps", 21.3, 91.5, 0, -15]]) {
      await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0), [x, z, yaw]); await t.frames(2);
      const s0 = await t.state(); expect(s0.h > lo, `${name}: posed at the wrong height ${s0.h}`);
      await t.page.touchscreen.tap(210, 520);   // below the horizon: a spot on the ground a few steps ahead
      await t.frames(1); const s1 = await t.state();
      expect(s1.target, `${name}: a tap on the ground set no destination`);
      const ahead = (s1.target[0] - x) * Math.sin(yaw) - (s1.target[1] - z) * Math.cos(yaw), aside = Math.abs((s1.target[0] - x) * Math.cos(yaw) + (s1.target[1] - z) * Math.sin(yaw));
      expect(ahead > 1.5 && ahead < 9 && aside < 0.5, `${name}: the tap should land a few steps straight ahead, not ${ahead.toFixed(1)} m ahead and ${aside.toFixed(1)} m aside at ${s1.target}`);
      await t.until(async () => (await t.state()).target === null, 60000, `${name}: never arrived`);
      const s2 = await t.state(); expect(Math.hypot(s2.x - s1.target[0], s2.z - s1.target[1]) < 0.3, `${name}: stopped short of the tapped spot at ${s2.x}, ${s2.z}`);
    }
    // #154: the spot the owner stood at (the tea house porch's south end, in the ring that blocks) and tapped the court from:
    // he comes out, and by the porch's hop or round it reaches the tapped ground.
    await t.page.evaluate(() => window.__pose(-12.85, 5.98, -0.765, -0.188)); await t.frames(2);
    await t.page.evaluate(() => window.__view("third")); await t.frames(2);
    for (const [px, py] of [[210, 520], [150, 560], [260, 500]]) {
      await t.page.evaluate(() => window.__pose(-12.85, 5.98, -0.765, -0.188)); await t.frames(2);
      await t.page.touchscreen.tap(px, py); await t.until(async () => (await t.state()).target !== null || (await t.state()).x < -12.2, 30000, "the tap set no way out of the blocked spot");
            await t.until(async () => { const s = await t.state(); return s.target === null && !s.dropping; }, 90000, "he never came out of the tea house porch's south end");
      const s2 = await t.state(); expect(!(await t.page.evaluate(() => window.__walker().blockedHere)) && Math.hypot(s2.x + 12.85, s2.z - 5.98) > 0.3, `he is still in the ring that blocks, or has not moved: ${s2.x}, ${s2.z}`);
    }
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Every hall with a door can be gone into, has a room of its own with frames on its walls, and lets him out again where he came in.
  // Seen from outside, a hall's door shows its own room (doorway.js, #218): nothing is taken when the page opens; the
  // great hall is taken when he comes near it, and fades in; the altar stands where it stood seen through the door when
  // he goes in; and every hall can be taken.
  doorway: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=high&view=third&season=summer&time=day&cam=0,60,3.14,0");
    await t.frames(4);
    // Nothing of the doorways is fetched with the page: no picture, and not the code that draws rooms into cubes.
    const early = await t.page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /shared\/doorways\/|doorway-capture/.test(n)));
    expect(early.length === 0, "the doorways were fetched with the page: " + early.join(", "));
    let r = await t.page.evaluate(() => window.__doorways());
    expect(r && Object.keys(r.halls).length === 8, "every hall that can be entered should have a doorway: " + JSON.stringify(r));
    expect(Object.values(r.halls).every((h) => !h.taken), "rooms were taken while the page opened, far from any door: " + JSON.stringify(r.halls));
    const h = (await t.page.evaluate(() => window.__halls)).find((x) => x.id === "main"), inYaw = h.outYaw + Math.PI, f = [Math.sin(inYaw), -Math.cos(inYaw)];
    await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.04), [h.out[0] - f[0] * 6, h.out[1] - f[1] * 6, inYaw]);
    await t.until(async () => { const d = await t.page.evaluate(() => window.__doorways()); return d.halls.main.taken >= 1 && d.halls.main.fade === 1; }, 240000, "the great hall's room never came into its doorway");
    r = await t.page.evaluate(() => window.__doorways()); expect(r.halls.main.taken === 1, "the great hall was taken more than once: " + JSON.stringify(r.halls.main));
    // Its room came from the baked pictures (tools/bake-doorways.mjs), and nothing was drawn into a cube in the page.
    expect(r.halls.main.source === "baked", "the great hall's doorway did not come from its baked pictures: " + JSON.stringify(r.halls.main));
    const drew = await t.page.evaluate(() => performance.getEntriesByType("resource").some((e) => /doorway-capture/.test(e.name)));
    expect(!drew, "the code that draws rooms into cubes was fetched by a visitor's page");
    console.log("     the doorways:", JSON.stringify({ main: r.halls.main, mb: r.mb, worstFrameMs: r.worstFrameMs }));
    await t.shot("e2e-doorway");
    // At the door, then the first frame inside: the altar keeps its place across the picture, seen with his own eyes. From
    // behind him the eye also comes 2.5 m nearer on going in (he is set down inside the room, interior.js's `door`), so
    // there the altar moves somewhat more; that is reported, not held (#218).
    const across = {};
    for (const view of ["first", "third"]) {
      await t.page.evaluate((v) => window.__view(v), view);
      await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.04), [h.out[0], h.out[1], inYaw]); await t.frames(3);
      const out = await t.page.evaluate(() => window.__doorAltar("main"));
      await t.page.evaluate(() => window.__inside("main")); await t.until(async () => (await t.state()).room === "main", 30000, "could not go into the great hall");
      await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted"); await t.frames(1);
      const inn = await t.page.evaluate(() => window.__doorAltar("main"));
      across[view] = { out: +out.x.toFixed(3), in: +inn.x.toFixed(3), moved: +(Math.abs(out.x - inn.x) / 2).toFixed(3) };
      await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.state()).inside, 30000, "could not come out of the great hall");
      await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the daylight never cleared");
    }
    console.log("     the altar across the door, as a fraction of the picture's width:", JSON.stringify(across));
    expect(across.first.moved <= 0.05, `the altar jumps across the door: ${JSON.stringify(across.first)} (more than 5% of the width)`);
    const hour = await t.page.evaluate(() => { const p = window.__probe(); return `${p.season}-${p.time}`; });
    r = await t.page.evaluate(() => window.__doorways(true));
    expect(Object.values(r.halls).every((x) => x.taken >= 1 && x.fade === 1), "not every hall's room could be taken: " + JSON.stringify(r.halls));
    // Drawing them in the page lights each room by a day and a night; the page's own hour must be the one it had.
    const after = await t.page.evaluate(() => { const p = window.__probe(); return `${p.season}-${p.time}`; });
    expect(after === hour, `drawing the rooms left the page at ${after}, not ${hour}`);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Without its baked pictures (none built, or the fetch failed) a doorway is the dark box it always was: nothing black,
  // no error, and the great hall still opens.
  "doorway-none": { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&view=third&season=summer&time=day&cam=0,60,3.14,0" + BARE.replace(",doorway", ""), { init: () => {
      const f = window.fetch; window.fetch = (u, ...a) => (/shared\/doorways\/t00\.json/.test(String(u)) ? Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } })) : f(u, ...a));
    } });
    const h = (await t.page.evaluate(() => window.__halls)).find((x) => x.id === "main"), inYaw = h.outYaw + Math.PI, f = [Math.sin(inYaw), -Math.cos(inYaw)];
    await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0.04), [h.out[0] - f[0] * 6, h.out[1] - f[1] * 6, inYaw]);
    await t.until(async () => (await t.page.evaluate(() => window.__doorways())).halls.main.source === "none", 60000, "the doorway never gave up on pictures it does not have");
    await t.frames(5);
    const r = await t.page.evaluate(() => window.__doorways());
    expect(r.halls.main.fade === 0 && !r.halls.main.taken, "a doorway without pictures should keep its dark box: " + JSON.stringify(r.halls.main));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  halls: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=0,30,0,0&view=first");
    const halls = await t.page.evaluate(() => window.__halls); expect(halls.length === 8, "eight halls should have doors: " + halls.map((h) => h.id));
    for (const h of halls) {
      await t.page.evaluate((id) => window.__inside(id), h.id); await t.until(async () => (await t.state()).room === h.id, 30000, `could not go into ${h.name}`);
      await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted");
      let s = await t.state(); expect(s.h < -50, `${h.name}: not standing on the room's floor`);
      // Turning to look back at the door, he sees the court he came from: a picture taken at the hall's own door,
      // not a sheet of white light that floods the room.
      expect(s.doorway === 1, `${h.name}: nothing was hung beyond the doorway`);
      // The figures beside the great Buddha are not copies of him: four different scans come when the main hall is first entered.
      if (h.id === "main") { await t.until(async () => { const st = await t.page.evaluate(() => window.__statues()); return ["arhat", "gilt-monk", "guanyin-seated", "guanyin-rock"].every((k) => st[k] === 1); }, 120000, "the figures beside the Buddha never arrived");
        await t.frames(3); const lit = await t.page.evaluate(() => window.__probe()); expect(lit.lum > 20, "with the figures in it the main hall goes dark: mean " + lit.lum.toFixed(1)); }
      if (h === halls[0]) {
        await t.page.evaluate((x) => window.__pose(x, 0, Math.PI, 0.05), s.x); await t.frames(3);
        const p = await t.page.evaluate(() => window.__probe()); expect(p.lum > 25 && p.lum < 170, `${h.name}: looking out through the door the picture is washed out or black: mean ${p.lum.toFixed(1)}`);
        // A real work hangs beside the leaf; read closely it shows its picture, its entry and where it comes from.
        const hung = await t.page.evaluate((id) => Object.entries(window.__gallery).filter(([k, v]) => v.room === id && v.item.work).map(([, v]) => v.item.work), h.id);
        expect(hung.length >= 1, `${h.name}: no real work on the walls`);
        await t.page.evaluate((slug) => window.__work(slug), hung[0]); await t.until(async () => { const w = await t.page.evaluate(() => window.__work()); return w.open && w.loaded && w.title; }, 60000, "the work's card never showed its picture");
        const card = await t.page.evaluate(() => ({ note: document.getElementById("pieceNote").textContent.length, credit: document.getElementById("pieceCredit").textContent }));
        expect(card.note > 100 && /ColBase|Metropolitan/.test(card.credit), "the card lacks its note or its source line: " + JSON.stringify(card));
        await t.page.waitForTimeout(400); await t.page.keyboard.press("Escape"); await t.until(async () => !(await t.page.evaluate(() => window.__work())).open, 20000, "Esc did not put the work's card away");
        expect((await t.page.evaluate(() => window.__menu ? document.getElementById("menu").hidden : true)), "Esc on the card also opened the pause menu");
      }
      const p = await t.probe(); expect(p.lum > 8 && p.lum < 235, `${h.name}: the room is blank (${p.lum.toFixed(0)})`);
      // The hall's registered camera pose must stand on open floor here too: check the real page, not just the plan.
      const view = require("../../tools/hall-views.cjs").views("t00").find((v) => v.hall === h.id);
      await t.page.evaluate(([x, z, yaw, pitch]) => window.__pose(x, z, yaw, pitch), view.abs);
      await t.frames(2); const cam = await t.probe();
      expect(cam.lum > 8 && cam.lum < 235 && (await t.state()).h < -50, `${h.name}: the registered camera sees nothing (${cam.lum.toFixed(0)})`);
      const spot = await t.page.evaluate((id) => Object.entries(window.__gallery).find(([k]) => k.startsWith(id + "-"))[1].at, h.id);
      await t.page.evaluate(([x, z]) => window.__pose(x, z, 0, 0), spot); await t.until(async () => ((await t.journey()).look || "").startsWith(h.id + "-"), 30000, `${h.name}: no frame to look at`);
      await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.state()).inside, 30000, `could not leave ${h.name}`);
      await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the daylight never cleared"); await t.frames(3);
      s = await t.state(); expect(Math.hypot(s.x - h.out[0], s.z - h.out[1]) < 0.3 && !s.inside, `${h.name}: came out in the wrong place or went straight back in: ${JSON.stringify(s)}`);
    }
    // From the summit pavilion, the door-view cube camera is so far from the middle of the mountain that a
    // sky dome left at the origin falls beyond its far plane. Every pixel above the hills must be night sky,
    // not a black hole: sample the doorway's upper band on the page's own drawing buffer.
    await t.page.evaluate(() => window.__inside("lingxiao")); await t.until(async () => (await t.state()).room === "lingxiao", 30000, "could not go into the summit pavilion");
    await t.page.evaluate(() => window.__pose(420, 5.9, -3.14, -0.226)); await t.frames(3);
    const skyBand = await t.page.evaluate(() => {
      const c = document.getElementById("yardGl"), a = document.createElement("canvas");
      a.width = c.width; a.height = c.height;
      window.__probe();   // the doorway has been drawn with its own post pass before pixels are read
      a.getContext("2d").drawImage(c, 0, 0);
      const x = Math.round(a.width * 0.4), y = Math.round(a.height * 0.14), d = a.getContext("2d").getImageData(x, y, Math.round(a.width * 0.2), Math.round(a.height * 0.12)).data;
      let dark = 0, n = 0; for (let i = 0; i < d.length; i += 4) { n++; if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 25) dark++; }
      return dark / n;
    });
    expect(skyBand < 0.02, `the sky seen through the summit door is a black hole: ${(skyBand * 100).toFixed(1)}% dark`);
    await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.state()).inside, 30000, "could not leave the summit pavilion");
    await t.shot("e2e-halls"); expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // In winter he leaves his prints in the snow of the court; indoors no snow lies on the floor and none falls,
  // even when the hour is changed while he is inside, and the prints by the door are still there when he comes out.
  // Each step in the snow is heard as a crunch; on the swept path up the middle of the court, none.
  snow: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&season=winter&time=day&cam=6.5,19.5,0,0&view=third");
    expect((await t.page.evaluate(() => window.__trail())).on, "in winter the snow should be ready to take his prints");
    // The place is heard (as after the visitor's first touch), so his steps in the snow are too.
    await t.page.evaluate(() => window.__music(true)); await t.until(async () => (await t.page.evaluate(() => window.__steps())).state === "running", 30000, "the sound never started");
    // Off the swept axis, through the snow of the court, toward the door of the meditation hall.
    await t.page.evaluate(() => window.__walk([[6.5, 17], [6.5, 14.5]])); await t.until(async () => (await t.state()).target === null && (await t.state()).route === 0, 240000, "he never walked across the snow");
    const walked = await t.page.evaluate(() => window.__trail()); expect(walked.stamps >= 6 && walked.last, "five metres of snow should hold more prints than " + walked.stamps);
    const heard = (await t.page.evaluate(() => window.__steps())).crunches; expect(heard >= 4, `five metres of snow crunched only ${heard} times`);
    // A step is heard on the effects bus, listened to while it sounds (a frame drawn in software takes longer than a
    // step, so it is played and heard within one call). That it crunches rather than thuds is steps.test.mjs's to say.
    const step = await t.page.evaluate(() => { window.__steps(true); const t0 = performance.now(); while (performance.now() - t0 < 90); return window.__listen("effects"); });
    expect(step.rms > 0.0002, "a step in the snow made no sound: " + JSON.stringify(step));   // silence is 0; how loud is steps.test.mjs's to say
    // Standing where he stopped and looking down the way he came, the prints darken the snow.
    await t.page.evaluate(() => window.__view("first"));
    const look = async () => { await t.page.evaluate(() => window.__pose(6.5, 14.3, Math.PI, -0.75)); await t.frames(2);
      return t.page.evaluate(() => { const seen = window.__probe().lum; window.__trail(false); return window.__probe().lum - seen; }); };   // in one go: the next frame shows them again
    const dark = await look(); await t.shot("e2e-snow-prints"); expect(dark > 0.6, `his prints should show in the snow: they darken the picture by ${dark.toFixed(2)} ` + JSON.stringify(walked));
    await t.page.evaluate(() => window.__inside("chan")); await t.until(async () => (await t.state()).room === "chan", 60000, "could not go into the meditation hall");
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted"); await t.frames(2);
    let p = await t.probe(); expect(p.snow === 0 && !p.drift, `indoors no snow should lie or fall: snow ${p.snow}, falling ${p.drift}`);
    await t.page.evaluate(() => window.__mood("winter", "night")); await t.frames(2);
    p = await t.probe(); expect(p.snow === 0 && !p.drift, `a change of hour indoors let the snow in: snow ${p.snow}, falling ${p.drift}`);
    await t.page.evaluate(() => window.__mood("winter", "day")); await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.state()).inside, 60000, "could not come out");
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the daylight never cleared"); await t.frames(2);
    p = await t.probe(); expect(p.snow === 1 && p.drift, `outdoors again the snow should lie and fall: snow ${p.snow}, falling ${p.drift}`);
    const still = await look(); expect(still > 0.6, `his prints were forgotten while he was in the hall: they darken the picture by ${still.toFixed(2)}`);
    // Along the swept path up the middle of the court his steps make no crunch.
    const before = (await t.page.evaluate(() => window.__steps())).crunches, stepped = (await t.page.evaluate(() => window.__trail())).stamps;
    await t.page.evaluate(() => { window.__pose(0, 24, 0, 0); window.__walk([[0, 20]]); }); await t.until(async () => (await t.state()).target === null && (await t.state()).route === 0, 240000, "he never walked the swept path");
    const after = (await t.page.evaluate(() => window.__steps())).crunches; expect(after === before, `the swept path crunched ${after - before} times`);
    expect((await t.page.evaluate(() => window.__steps())).heard.stone >= 2, "on the swept path his steps should sound on stone");
    expect((await t.page.evaluate(() => window.__trail())).stamps >= stepped + 4, "he took no steps along the swept path, so its silence says nothing");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // His steps sound as what they come down on: wet stone after summer rain and a splash in a puddle of the court (where
  // the paving draws one, and rings spread across it), dry stone in autumn, the floor of a hall.
  steps: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&season=summer&time=day&cam=4,15.5,3.14,0&view=third" + BARE);
    const heard = () => t.page.evaluate(() => window.__steps().heard);
    const walk = async (pts, what) => { await t.page.evaluate((p) => window.__walk(p), pts); await t.until(async () => (await t.state()).target === null && (await t.state()).route === 0, 240000, what); };
    await t.page.evaluate(() => window.__music(true)); await t.until(async () => (await t.page.evaluate(() => window.__steps())).state === "running", 30000, "the sound never started");
    // Up the court at x = 4: wet stone to z 21, then water standing from z 21.5 (steps.js's puddleAt, the paving's own pattern).
    await walk([[4, 23]], "he never crossed the wet court");
    let h = await heard(); expect(h.wet >= 3 && h.puddle >= 1 && h.snow === 0 && h.stone === 0, "after summer rain the court should sound wet, with a splash in its puddle: " + JSON.stringify(h));
    // and each step into the puddle sends rings across its water (ground.js), one pair for every splash heard
    const r = await t.page.evaluate(() => window.__ripples());
    expect(r && r.made === h.puddle, "every splash should set the puddle rippling: " + JSON.stringify({ r, h }));
    await t.page.evaluate(() => window.__mood("autumn", "day")); await t.frames(2);
    await walk([[4, 17]], "he never crossed the dry court");
    const h2 = await heard(); expect(h2.stone >= 3 && h2.wet === h.wet && h2.puddle === h.puddle, "in autumn the court should sound dry: " + JSON.stringify(h2));
    expect((await t.page.evaluate(() => window.__ripples())).made === r.made, "dry autumn stone has no water to ripple");
    // A step is heard on the effects bus as it sounds (played and listened to within one call).
    const one = await t.page.evaluate(() => { window.__steps("stone"); const t0 = performance.now(); while (performance.now() - t0 < 90); return window.__listen("effects"); });
    expect(one.rms > 0.0001, "a step on stone made no sound: " + JSON.stringify(one));   // silence is 0; how loud is steps.test.mjs's to say
    await t.page.evaluate(() => window.__inside("main")); await t.until(async () => (await t.state()).room === "main", 60000, "could not go into the main hall");
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted");
    const s = await t.state(); await walk([[s.x, s.z - 3]], "he never walked in the hall");
    const h3 = await heard(); expect(h3.stone >= h2.stone + 3 && h3.wet === h2.wet, "a hall's floor should sound as dry stone: " + JSON.stringify(h3));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The whole pilgrimage: seven observances, a seal for each, the book filling, and all of it remembered.
  pilgrimage: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&seed=4" + BARE);
    const at = (id) => t.page.evaluate((k) => window.__journey && (() => { const p = window.__places[k]; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); })(), id);
    const seal = async (id, what) => t.until(async () => (await t.journey()).seals[id] > 0, 90000, `no seal for ${what}`);
    const word = () => t.page.getAttribute("#act", "data-word"), offered = (w, what) => t.until(async () => (await t.page.isVisible("#act")) && (await word()) === w, 30000, `"${w}" was not offered ${what}`);
    let j = await t.journey(); expect(j.count === 0 && j.next === "bell", "a new book should be empty");
    // The summit first, with nothing else in the book: three breaths, its seal, and the prologue closes all the same,
    // with words about this walk only, then the book with what is still to be found.
    await t.page.evaluate(() => window.__music(true));   // the place heard, so that the close's music can be checked
    await at("sit"); await offered("静坐", "on the summit of an empty book"); await t.page.click("#act");
    await t.until(() => t.page.isVisible("#breathWord"), 60000, "no breath to follow"); await seal("sit", "sitting");
    await t.until(async () => (await t.page.evaluate(() => window.__rites().ended)) === 1, 120000, "the chapter never closed with only one seal");
    { const cu = await t.page.evaluate(() => window.__cues()), mu = await t.page.evaluate(() => window.__music());
      expect(cu.farBell === 1, "the close should end on the far bell answering");
      expect(cu.ending === 1 && mu.started, "the close should have its own music: " + JSON.stringify({ cu, section: mu.section })); }
    const said = (await t.page.evaluate(() => window.__rites().words)).join("|"); expect(said.includes("山门之外") && !/钟敲过|茶吃过|香也上过|还有没做完/.test(said), "the closing words should answer only what was done: " + said);
    await t.page.keyboard.press("b");   // nothing opens by itself after the close (#147): the book is the visitor's to open
    await t.until(() => t.page.isVisible("#book"), 60000, "the book never opened after the close");
    expect((await t.page.textContent("#bookHint")).includes("帐上还空着六处"), "the book should say what is still to be found: " + (await t.page.textContent("#bookHint")));
    await t.page.click("#bookClose"); j = await t.journey(); expect(j.closed > 0 && j.count === 1, "the close was not remembered: " + JSON.stringify(j));
    // He is still sitting; the button stands him up. Sitting there again is only a seat now: no second close.
    await offered("起身", "while he sits on the summit"); await t.page.keyboard.press("e");   // (the button is not drawn on the far view, #147: E stands him up all the same)
    await t.until(async () => !(await t.page.evaluate(() => window.__yard().staged)), 20000, "起身 did not stand him up");
    await at("sit"); await t.frames(6);   /* the button is looked at every 180 ms, and a frame here is longer than that */ expect((await word()) !== "静坐", "the summit offered the close a second time");
    // The bell: each press is one stroke, and a press while the log still swings back from the bronze is not one.
    await at("bell"); await offered("撞钟", "before the bell"); await t.page.click("#act");
    await t.until(async () => (await t.journey()).strikes === 1, 60000, "the first press did not ring the bell");
    for (const n of [2, 3]) { await t.until(async () => (await t.page.evaluate(() => window.__rites().bell.ready)), 30000, "the rope never came back to hand"); await t.page.click("#act"); await t.until(async () => (await t.journey()).strikes === n, 30000, `the stroke ${n} did not sound`); }
    await seal("bell", "the bell"); expect((await t.page.textContent("#toastName")).includes("闻钟") && (await t.page.getAttribute("#toastSeal", "src")).startsWith("data:image"), "no seal was shown");
    expect((await t.page.textContent("#bookBtn")).includes("二"), "the book's button should count the seals");
    await t.page.keyboard.press("Escape"); await t.until(async () => (await t.journey()).rite === null, 20000, "Esc did not let the rope go");
    // Tea, the well, the lamp: walk into the ring, press, wait. After the tea he stays until he is stood up.
    for (const [id, w] of [["tea", "吃茶"], ["well", "观水"], ["lamp", "燃灯"]]) {
      await at(id); await offered(w, `at ${id}`); await t.page.click("#act"); await seal(id, id);
      if (id === "tea") { await offered("起身", "after the tea"); await t.page.click("#act"); await t.until(async () => (await t.journey()).rite === null, 20000, "he did not get up from the tea"); }
    }
    expect((await t.journey()).lampLit, "the lamp should stay lit");
    // The library gives a line, which must be taken.
    await at("sutra"); await t.until(() => t.page.isVisible("#act"), 30000, "nothing offered at the library"); await t.page.click("#act");
    await t.until(() => t.page.isVisible("#slip"), 60000, "no slip was given"); const line = await t.page.textContent("#slipText"); expect(line.length > 3, "the slip is blank");
    await t.page.click("#slipTake"); await seal("sutra", "the library"); expect((await t.journey()).verse.text === line, "the line was not kept");
    // The book survives leaving and coming back.
    await t.page.reload(); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    expect((await t.page.textContent("#titleSeals")).includes("六"), "the title should say how many seals are held");
    await t.page.waitForFunction(() => !document.getElementById("enterBtn").disabled); await t.page.click("#enterBtn");
    j = await t.journey(); expect(j.count === 6 && j.lampLit && j.next === "incense" && j.closed > 0, "the book was not remembered: " + JSON.stringify(j));
    // Incense, in the great hall, is the seventh: the full book has its own seal and opens, and the close is not played again.
    await t.page.evaluate(() => window.__inside(true)); await t.until(() => t.inHall(), 30000, "could not go in");
    await at("incense"); await offered("上香", "before the altar"); await t.page.click("#act");
    await seal("incense", "the incense"); expect((await t.page.evaluate(() => window.__rites().incense)).planted, "the sticks are not standing in the ash");
    await t.until(async () => (await t.page.isVisible("#toast")) && (await t.page.textContent("#toastName")).includes("七印圆满"), 60000, "a full book was not marked");
    await t.until(() => t.page.isVisible("#book"), 60000, "the full book never opened");
    j = await t.journey(); expect(j.done && j.count === 7 && j.book && j.book[0] === 1200, "the book is not complete: " + JSON.stringify(j));
    expect((await t.page.evaluate(() => window.__rites().ended)) === 0, "the close played again for the seventh seal");
    await t.until(async () => ((await t.page.getAttribute("#bookSave", "href")) || "").startsWith("blob:"), 60000, "nothing to save"); await t.shot("e2e-book");   // (the page opens as bare paper and is written on when drawn)
    await t.page.click("#bookClose"); expect((await word()) !== "上香" || !(await t.page.isVisible("#act")), "the incense should not be offered again");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A book kept by an older version: a filled one has seen the close and is not shown it on the summit again; one
  // whose close the page had noted separately keeps that; one with neither, whatever seals it holds, closes there.
  // The close comes once in each season: sat again in the same season the summit is only a seat; after the season is
  // changed, sitting there plays it again, and a book already full is not given its seal a second time.
  // The far view at the close of the chapter (#147): nothing opens by itself, the eye stays on the pavilion with one line at
  // the foot, the book is the visitor's to open (B, or that line), shutting it leaves the far view, and a step brings the eye
  // home by a swing, never a cut.
  farview: { tier: 2, async run(b, base) {
    // How fast the picture may turn coming home, in degrees a second: the director's own limit (#71, DIRECT.rate.out). A bound
    // on the turn of one frame would measure the machine: the swing turns at a steady rate, so a frame that took 135 ms turns it 3.75°.
    const TURN_HOME = 190;
    const t = await open(b, base, "q=low&fast=1&seed=4&view=third&season=summer&time=day" + BARE, { viewport: { width: 960, height: 540 } });
    await t.page.evaluate(() => { const p = window.__places.sit; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); });
    await t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === "静坐", 60000, "静坐 was not offered");
    await t.page.click("#act");
    await t.until(async () => (await t.page.evaluate(() => window.__rites().ended)) === 1, 180000, "the close never ended");
    const D = () => t.page.evaluate(() => window.__director()), U = () => t.page.evaluate(() => window.__ui());
    let d = await D(), u = await U();
    expect(!u.stack.some((l) => /book/.test(JSON.stringify(l))) && !(await t.page.evaluate(() => document.getElementById("book").open)), "the book opened by itself at the end: " + JSON.stringify(u));
    expect(d.phase === "hold" && d.id === "ending", "the eye is not held on the far view: " + JSON.stringify(d));
    await t.until(() => t.page.evaluate(() => document.getElementById("hint").classList.contains("on")), 60000, "no line at the foot of the far view");
    const line = await t.page.textContent("#hint"); expect(/朱印帐/.test(line), "the line does not offer the book: " + line);
    // (a line said as he sat is gone after its few seconds, which a fast run has not waited out)
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("say").classList.contains("on"))), 30000, "the line said while he sat never went");
    // Nothing but that line lies over the picture, on three screens; the slips at the edge (留影, 歇脚, the book's seal) stay, at the edge.
    for (const [w, h] of [[960, 540], [800, 600], [390, 844]]) {
      await t.page.setViewportSize({ width: w, height: h }); await t.frames(3);
      const over = await t.page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => {
        if (el.closest("dialog") || ["CANVAS", "SCRIPT", "STYLE", "HEAD"].includes(el.tagName) || el.closest("#hint, #photoBtn, #menuBtn, #bookBtn")) return false;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (cs.display === "none" || cs.visibility === "hidden" || r.width < 2 || r.height < 2) return false;
        for (let a = el; a && a !== document.body; a = a.parentElement) if (+getComputedStyle(a).opacity < 0.05) return false;   // faded with its parent
        if (el.children.length && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
        return !!(el.textContent || "").trim() || el.matches("button,img,svg");
      }).map((el) => `${el.id || el.className || el.tagName}<${(el.textContent || '').trim().slice(0, 12)}>`));
      expect(over.length === 0, `${w}x${h}: over the far view lie ${over.join(", ")}`);
    }
    // B opens the book; shutting it leaves the far view as it was.
    await t.page.keyboard.press("b"); await t.until(async () => (await U()).modal, 30000, "B did not open the book");
    await t.page.click("#bookClose"); await t.until(async () => !(await U()).modal, 20000, "the book would not close");
    d = await D(); expect(d.phase === "hold" && d.id === "ending", "shutting the book left the far view: " + JSON.stringify(d));
    // The camera raised on the far view keeps it.
    await t.page.evaluate(() => window.__photo(true)); await t.frames(3); d = await D(); expect(d.phase === "hold" && d.id === "ending", "the photograph left the far view: " + JSON.stringify(d)); await t.page.evaluate(() => window.__photo(false)); await t.frames(2);
    // A step brings the eye home by a swing: no cut, and no frame turns the picture further than the swing's own limit.
    await t.page.keyboard.down("w"); await t.until(async () => (await D()).phase === "out" || (await D()).phase === "idle", 60000, "a step did not send the eye home"); await t.page.keyboard.up("w");
    await t.until(async () => (await D()).phase === "idle", 60000, "the eye never got home");
    d = await D(); expect(d.cuts === 0 && d.rateMax <= TURN_HOME, "coming home was not a smooth swing: " + JSON.stringify({ cuts: d.cuts, rateMax: d.rateMax, turnMax: d.turnMax, turnDt: d.turnDt }));
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("hint").classList.contains("on")) && /朱印帐/.test(await t.page.textContent("#hint"))), 30000, "the line about the book stayed after the eye went home");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();

    // On a phone there is no B: the line at the foot is the way to the book, pressed with a thumb; the stick brings the eye home.
    {
      const m = await open(b, base, "q=low&fast=1&seed=4&view=third&season=summer&time=day" + BARE, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      await m.page.evaluate(() => { const p = window.__places.sit; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); });
      await m.until(async () => (await m.page.isVisible("#act")) && (await m.page.getAttribute("#act", "data-word")) === "静坐", 60000, "静坐 was not offered on the phone");
      await m.page.tap("#act");
      await m.until(async () => (await m.page.evaluate(() => window.__rites().ended)) === 1, 180000, "the close never ended on the phone");
      // (the first seal's tip, said a few seconds after the toast, may still be on the line: this book holds one seal, so it is not full; the far view's own line takes its place)
      await m.until(async () => (await m.page.evaluate(() => { const h = document.getElementById("hint"); return h.classList.contains("on") && !/小印/.test(h.textContent); })), 60000, "no line at the foot of the far view on the phone");
      const said = await m.page.textContent("#hint"); expect(said.trim() === "点这一行，翻开朱印帐" && !/B/.test(said), "on a touch screen the line should say to press it, not name a key: " + said);
      await m.until(async () => !(await m.page.evaluate(() => document.getElementById("say").classList.contains("on"))), 30000, "the line said while he sat never went");
      await m.page.tap("#hint"); await m.until(async () => (await m.page.evaluate(() => window.__ui())).modal, 30000, "touching the line did not open the book");
      await m.page.tap("#bookClose"); await m.until(async () => !(await m.page.evaluate(() => window.__ui())).modal, 20000, "the book would not close");
      let d2 = await m.page.evaluate(() => window.__director()); expect(d2.phase === "hold" && d2.id === "ending", "shutting the book left the far view on the phone: " + JSON.stringify(d2));
      // The stick, pushed with a real touch, brings the eye home.
      const box = await m.page.evaluate(() => { const r = document.getElementById("stick").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const cdp = await m.page.context().newCDPSession(m.page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box[0], y: box[1] }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box[0], y: box[1] - 40 }] });
      await m.until(async () => ["out", "idle"].includes((await m.page.evaluate(() => window.__director())).phase), 60000, "the stick did not bring the eye home");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await m.until(async () => (await m.page.evaluate(() => window.__director())).phase === "idle", 60000, "the eye never got home on the phone");
      d2 = await m.page.evaluate(() => window.__director()); expect(d2.cuts === 0 && d2.rateMax <= TURN_HOME, "coming home by the stick was not a smooth swing: " + JSON.stringify({ cuts: d2.cuts, rateMax: d2.rateMax, turnMax: d2.turnMax, turnDt: d2.turnDt }));
      expect(m.errors.length === 0, m.errors.join("\n")); await m.close();
    }

    // The music is not cut: nothing in the far view passes the close over, so its phrase ends where it was written to, and the picture is still the far view then.
    {
      const k = await open(b, base, "q=low&fast=1&seed=4&view=third&season=summer&time=day" + BARE, { viewport: { width: 960, height: 540 } });
      await k.page.evaluate(() => window.__music(true));
      await k.page.evaluate(() => { const p = window.__places.sit; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); });
      await k.until(async () => (await k.page.isVisible("#act")) && (await k.page.getAttribute("#act", "data-word")) === "静坐", 60000, "静坐 was not offered for the music");
      await k.page.click("#act");
      await k.until(async () => (await k.page.evaluate(() => window.__rites().ended)) === 1, 180000, "the close never ended for the music");
      const m0 = await k.page.evaluate(() => window.__music()), c0 = await k.page.evaluate(() => window.__cues());
      expect(m0.started && c0.ending === 1 && c0.passed === 0, "the close's music did not begin, or was passed over: " + JSON.stringify({ cues: c0, section: m0.section }));
      // (the audio clock runs on real time, not the observances' clock: its phrase is some forty seconds long)
      await k.until(async () => { const m = await k.page.evaluate(() => window.__music()); return m.section === "ending" && !m.playing; }, 120000, "the close's music never played out");
      const m1 = await k.page.evaluate(() => window.__music()), c1 = await k.page.evaluate(() => window.__cues()), d3 = await k.page.evaluate(() => window.__director());
      expect(m1.cuts === m0.cuts && c1.passed === 0, "the music was cut before it played out: " + JSON.stringify({ cuts: [m0.cuts, m1.cuts], passed: c1.passed }));
      expect(d3.phase === "hold" && d3.id === "ending", "the picture left the far view while the music played out: " + JSON.stringify(d3));
      expect(k.errors.length === 0, k.errors.join("\n")); await k.close();
    }

    // The full book's own seal is shown when the book is opened after the close, once; a page left before that owes it the next time.
    {
      const q = "q=low&fast=1&cam=0,30,0,0&season=summer&time=day" + BARE;
      const z = await open(b, base, q);
      const all = ["bell", "incense", "tea", "sutra", "well", "lamp", "sit"], stamped = () => z.page.evaluate(() => JSON.parse(localStorage.getItem("yunjing.journey.v1") || "{}").stamped || null);
      await z.page.evaluate((ids) => { localStorage.setItem("yunjing.journey.v1", JSON.stringify({ v: 1, born: 1, seals: Object.fromEntries(ids.map((id, i) => [id, 10 + i])), strikes: 3, verse: null, done: 20, opened: 20, told: true, closed: 30, closedSeason: "summer", stamped: null })); }, all);
      await z.page.reload({ waitUntil: "commit" }); await z.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
      await z.page.evaluate(() => { void window.__ending(); });
      await z.until(async () => (await z.page.evaluate(() => window.__rites().ended)) === 1, 180000, "the close never ended with a full book");
      expect(!(await stamped()) && !(await z.page.isVisible("#toast")) && !(await z.page.evaluate(() => document.getElementById("book").open)), "the full book's seal was shown, or the book opened, by itself after the close");
      // The page is left before the book was opened: the seal is still owed when it is back.
      await z.page.reload({ waitUntil: "commit" }); await z.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
      expect(!(await stamped()), "the seal was lost by leaving the page");
      await z.page.keyboard.press("b");
      await z.until(async () => (await z.page.isVisible("#toast")) && (await z.page.textContent("#toastName")).includes("七印圆满"), 60000, "the full book's seal was not shown when the book was first opened");
      await z.until(() => z.page.isVisible("#book"), 60000, "the book did not open after its seal");
      expect(!!(await stamped()), "the seal was shown but not kept");
      await z.page.click("#bookClose"); await z.page.waitForTimeout(1500);
      await z.page.keyboard.press("b"); await z.until(() => z.page.isVisible("#book"), 30000, "the book did not open the second time");
      expect(!((await z.page.isVisible("#toast")) && (await z.page.textContent("#toastName")).includes("七印圆满")), "the full book's seal was shown a second time");
      expect(z.errors.length === 0, z.errors.join("\n")); await z.close();
    }
  } },
  // The breath of sitting on the summit (#156): a ring on the ground and a small word at the foot of the picture, and nothing
  // laid over his head or chest, from the sitting's own shot, from behind him and from his own eyes, on four screens.
  breathring: { tier: 2, async run(b, base) {
    const SIZES = [[960, 540], [800, 600], [390, 844], [844, 390]];
    const cases = [["third", true], ["third", false], ["first", true]];
    for (const [view, autocam] of cases) {
      const t = await open(b, base, `q=low&enter&view=${view}&season=summer&time=day&seed=4` + BARE, { viewport: { width: 960, height: 540 }, init: `try{localStorage.setItem("yunjing.settings.v1",JSON.stringify({autocam:${autocam}}))}catch{}` });
      await t.page.evaluate(() => { const p = window.__places.sit; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); });
      await t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === "静坐", 40000, "静坐 was not offered");
      await t.page.click("#act");
      await t.until(() => t.page.isVisible("#breathWord"), 90000, "no word for the breath");
      await t.page.evaluate(() => window.__riteClock(0));   // the observances' clock held: a moment to look at
      // The breath goes in; the word is at the foot of the picture, the ring is on the ground, and it grows.
      let prev = -1;
      for (const [w, h] of SIZES) {
        await t.page.setViewportSize({ width: w, height: h }); await t.frames(3);
        for (const step of [1500, 2500]) {
          await t.page.evaluate((ms) => window.__riteClock(ms), step); await t.frames(2);
          // A passage begun on this very step has drawn nothing yet: let it run a little (the clock is the page's, not frames).
          for (let i = 0; i < 6 && (await t.page.evaluate(() => window.__rites().sit.fill)) === 0; i++) { await t.page.evaluate(() => window.__riteClock(600)); await t.frames(2); }
          const r = await t.page.evaluate(() => {
            const P = window.__probe(), box = P.monkBox, out = [];
            for (const el of document.querySelectorAll("body *")) {
              if (el.closest("dialog") || el.tagName === "CANVAS" || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
              const cs = getComputedStyle(el), rc = el.getBoundingClientRect();
              if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05 || rc.width < 2 || rc.height < 2) continue;
              if (!(el.textContent || "").trim() && !el.matches("button,img,svg")) continue;
              if (el.children.length && !(el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))) continue;
              out.push({ id: el.id || el.className || el.tagName, x: rc.left, y: rc.top, w: rc.width, h: rc.height });
            }
            return { box, out, word: document.getElementById("breathWord").getBoundingClientRect().toJSON(), ring: window.__rites().sit, breathEl: !!document.getElementById("breath"), vh: innerHeight, vw: innerWidth };
          });
          expect(!r.breathEl, "a ring is still fixed to the screen");
          expect(r.ring.ring === true && r.ring.fill > 0, "the ring on the ground is not drawn while he breathes in: " + JSON.stringify(r.ring));
          expect(r.word.top > r.vh * 0.5 && r.word.left >= 0 && r.word.right <= r.vw, `the word is not at the foot of the picture: ${JSON.stringify(r.word)}`);
          if (r.box) { const [bx, by, bw, bh] = r.box, top = [bx, by, bw, bh / 2];
            for (const e of r.out) expect(!(e.x < top[0] + top[2] && e.x + e.w > top[0] && e.y < top[1] + top[3] && e.y + e.h > top[1]), `${view}${autocam ? "" : " (no autocam)"} ${w}x${h}: ${e.id} lies over his head and chest: ${JSON.stringify({ e, box: r.box })}`); }
          prev = r.ring.fill;
        }
      }
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    }
  } },
  // The slip of paper from the library (#203): each of its lines, in each language, on a phone upright and on its side, lies whole on the
  // screen: the paper and the button under it inside the picture, the page not wider than the screen, the words not under 12 px.
  slipfit: { tier: 2, async run(b, base) {
    const SIZES = [[390, 844], [844, 390]], bad = [];
    for (const lang of ["zh", "ja", "en", "ko"]) {
      const t = await open(b, base, `q=low&cam=0,30,0,0&season=summer&time=day&lang=${lang}` + BARE, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: { zh: "zh-CN", ja: "ja-JP", en: "en-US", ko: "ko-KR" }[lang] });
      const n = await t.page.evaluate(() => window.__verses);
      for (const [w, h] of SIZES) {
        await t.page.setViewportSize({ width: w, height: h });
        for (let i = 0; i < (n || 14); i++) {
          await t.page.evaluate((k) => window.__slip(k), i); await t.frames(2);
          const r = await t.page.evaluate(() => {
            const W = innerWidth, H = innerHeight, rc = (id) => document.querySelector(id).getBoundingClientRect(), p = rc("#slip .paper"), b = rc("#slipTake"), x = rc("#slipText"), f = rc("#slipFrom");
            const px = (id) => parseFloat(getComputedStyle(document.querySelector(id)).fontSize);
            const within = (q) => q.left >= -0.5 && q.right <= W + 0.5 && q.top >= -0.5 && q.bottom <= H + 0.5;
            return { W, H, scrollW: document.documentElement.scrollWidth, paper: within(p), button: within(b), text: within(x) && x.left >= p.left - 0.5 && x.right <= p.right + 0.5 && x.top >= p.top - 0.5 && x.bottom <= p.bottom + 0.5, from: within(f), fs: Math.min(px("#slipText"), px("#slipFrom")), box: [p.left, p.top, p.right, p.bottom].map(Math.round) };
          });
          if (!(r.paper && r.button && r.text && r.from && r.scrollW <= r.W && r.fs >= 12)) bad.push(`${lang} ${w}x${h} #${i}: ${JSON.stringify(r)}`);
          await t.page.evaluate(() => window.__slip(null)); await t.frames(1);
        }
      }
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    }
    expect(bad.length === 0, `${bad.length} slips do not lie whole on the screen:\n  ` + bad.join("\n  "));
    // A phone turned over while the paper is open: the longest line, in Korean, opened upright and then laid on its side, is fitted again.
    {
      const t = await open(b, base, "q=low&cam=0,30,0,0&season=summer&time=day&lang=ko" + BARE, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "ko-KR" });
      await t.page.evaluate(() => window.__slip(8)); await t.frames(2);
      await t.page.setViewportSize({ width: 844, height: 390 }); await t.frames(3);
      const r = await t.page.evaluate(() => { const W = innerWidth, H = innerHeight, p = document.querySelector("#slip .paper").getBoundingClientRect(), b = document.getElementById("slipTake").getBoundingClientRect(); return { W, H, scrollW: document.documentElement.scrollWidth, paper: [p.left, p.top, p.right, p.bottom].map(Math.round), button: [b.top, b.bottom].map(Math.round) }; });
      expect(r.scrollW <= r.W && r.paper[0] >= 0 && r.paper[2] <= r.W && r.paper[1] >= 0 && r.paper[3] <= r.H && r.button[1] <= r.H, "the paper opened upright did not lie whole once the phone was turned over: " + JSON.stringify(r));
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    }
  } },
  replay: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=0,30,0,0&season=summer&time=day" + BARE);
    const all = ["bell", "incense", "tea", "sutra", "well", "lamp", "sit"];
    await t.page.evaluate((ids) => { localStorage.setItem("yunjing.journey.v1", JSON.stringify({ v: 1, born: 1, seals: Object.fromEntries(ids.map((id, i) => [id, 10 + i])), strikes: 3, verse: null, done: 20, opened: 20, told: true, closed: 30, closedSeason: "summer" })); }, all);
    await t.page.reload({ waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    const summit = async () => { await t.page.evaluate(() => { const p = window.__places.sit; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); }); await t.frames(3); await t.page.waitForTimeout(800); return (await t.page.isVisible("#act")) ? t.page.getAttribute("#act", "data-word") : null; };
    expect((await summit()) !== "静坐", "the close was offered again in the season it was seen in");
    await t.page.evaluate(() => window.__mood("winter", "day"));
    await t.until(async () => (await summit()) === "静坐", 30000, "a change of season did not offer the close again");
    await t.page.click("#act"); await t.until(async () => (await t.page.evaluate(() => window.__rites().ended)) === 1, 120000, "the close did not play again in winter");
    await t.page.keyboard.press("b");   // (opened by the visitor, #147)
    await t.until(() => t.page.isVisible("#book"), 60000, "the book did not open after the close");
    const j = await t.journey(); expect(j.closedSeason === "winter", "the season of the close was not kept: " + j.closedSeason);
    expect(!(await t.page.textContent("#toastName")).includes("七印圆满") || !(await t.page.isVisible("#toast")), "the full book's seal was shown again on a replay");
    await t.page.click("#bookClose"); await t.page.keyboard.press("Escape");
    expect((await summit()) !== "静坐", "the close was offered twice in winter");
    await t.page.evaluate(() => localStorage.removeItem("yunjing.journey.v1"));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Incense set in the ash burns down (here in twelve seconds rather than five minutes): it shortens and smokes, then
  // stands cold, and 上香 is offered again; a reload while it burns finds it as far burnt as it was.
  incense: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&burn=12&in=main&cam=0,0,0,0" + BARE);
    const R = () => t.page.evaluate(() => window.__rites().incense), word = async () => ((await t.page.isVisible("#act")) ? t.page.getAttribute("#act", "data-word") : null);
    const at = () => t.page.evaluate(() => { const p = window.__places.incense; window.__pose(p.at[0] + 0.2, p.at[1] + 0.3, 0, 0); });
    await t.until(() => t.inHall(), 60000, "not in the great hall"); await at();
    await t.until(async () => (await word()) === "上香", 40000, "上香 was not offered"); await t.page.click("#act");
    await t.until(async () => (await R()).planted, 120000, "the sticks were never set in the ash");
    let r = await R(); expect(r.smoke && r.left > 0 && r.left <= 12, "planted sticks should smoke and have time left: " + JSON.stringify(r));
    // The seal comes after the bow that follows the planting, a few seconds on: wait for it, as for any passage.
    await t.until(async () => (await t.journey()).seals.incense > 0, 60000, "no seal for the incense");
    await t.until(async () => !(await t.journey()).rite, 30000, "he did not finish the offering");
    expect((await word()) !== "上香", "incense should not be offered while it burns");
    await t.page.reload({ waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    r = await R(); expect(r.planted || r.burnt, "a reload lost the incense: " + JSON.stringify(r));
    await t.until(async () => (await R()).burnt, 60000, "the incense never burnt out");
    r = await R(); expect(!r.planted && !r.smoke, "burnt-out incense should stand cold: " + JSON.stringify(r));
    await t.until(() => t.inHall(), 60000, "not back in the great hall"); await at();
    await t.until(async () => (await word()) === "上香", 40000, "上香 was not offered again once it burnt out");
    const seal = (await t.journey()).seals.incense; await t.page.click("#act");
    await t.until(async () => (await R()).planted, 120000, "the second offering was never set in the ash");
    expect((await t.journey()).seals.incense === seal, "a second offering should not earn the seal again");
    await t.page.evaluate(() => { localStorage.removeItem("yunjing.journey.v1"); localStorage.removeItem("yunjing.incense.v1"); });
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  oldbook: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=0,30,0,0");
    const at = (id) => t.page.evaluate((k) => { const p = window.__places[k]; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); }, id);
    const summit = async () => { await at("sit"); await t.frames(6);   /* the button is looked at every 180 ms, and a frame here is longer than that */ return (await t.page.isVisible("#act")) ? t.page.getAttribute("#act", "data-word") : null; };
    const load = async (book, ended) => { await t.page.evaluate(([bk, e]) => { localStorage.setItem("yunjing.journey.v1", JSON.stringify(bk)); if (e) localStorage.setItem("yunjing.ending.v1", "1"); else localStorage.removeItem("yunjing.ending.v1"); }, [book, ended]);
      await t.page.reload({ waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 }); };
    const all = ["bell", "incense", "tea", "sutra", "well", "lamp", "sit"];
    await load({ v: 1, born: 1, seals: Object.fromEntries(all.map((id, i) => [id, 10 + i])), strikes: 3, verse: null, done: 20 }, false);
    let j = await t.journey(); expect(j.count === 7 && j.closed === 20, "a filled old book should have seen the close: " + JSON.stringify(j));
    expect((await summit()) !== "静坐", "a filled old book was offered the close again");
    await load({ v: 1, born: 1, seals: { bell: 4, tea: 5 }, strikes: 3, verse: null, done: null }, true);
    j = await t.journey(); expect(j.count === 2 && j.closed > 0, "the old note that the close was seen was lost: " + JSON.stringify(j));
    expect(!(await t.page.evaluate(() => localStorage.getItem("yunjing.ending.v1"))), "the old note should be folded into the book");
    // Its summit seal is still to be earned: sitting there earns it, and the close is not played again.
    expect((await summit()) === "静坐", "an old book without the summit's seal should still be offered it");
    await t.page.click("#act"); await t.until(async () => (await t.journey()).seals.sit > 0, 90000, "the summit's seal was not earned");
    // (Seconds, not frames: the close would follow on game.js's timer, which runs on the clock.)
    await t.page.waitForTimeout(4000); expect((await t.page.evaluate(() => window.__rites().ended)) === 0 && !(await t.page.evaluate(() => window.__rites().closing)), "the close played again for an old book that had seen it");
    await load({ v: 1, born: 1, seals: { bell: 4, sit: 5 }, strikes: 3, verse: null, done: null }, false);
    j = await t.journey(); expect(j.count === 2 && !j.closed, "an old book that never closed should not be marked closed: " + JSON.stringify(j));
    expect((await summit()) === "静坐", "an old book whose summit seal came before the close should be offered it");
    await t.page.evaluate(() => localStorage.removeItem("yunjing.journey.v1"));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Issue #100: coming out of a hall, a tap on the court is a walk to the spot tapped, not back to the door. On the
  // main hall's porch and steps the tap rule "go to the hall's door" must not apply; from the court it still does.
  hallexit: { tier: 2, async run(b, base) {
    for (const [view, touch] of [["third", false], ["first", false], ["third", true]]) {
      const t = await open(b, base, `q=low&enter&view=${view}&season=summer&time=day` + BARE, { hasTouch: touch });
      const halls = await t.page.evaluate(() => window.__halls);
      const tap = (x, y) => touch ? t.page.touchscreen.tap(x, y) : t.page.mouse.click(x, y);
      const settle = async () => { await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted"); await t.frames(3); };
      // Every hall once with the mouse in the third person; the other two ways of looking and the touch screen take two.
      const all = view === "third" && !touch;
      for (const h of halls) {
        if (!all && !["main", "chan"].includes(h.id)) continue;
        if (h.id === "main" && view === "third") continue;   // the main hall's porch is checked below, with its own bounds
        await t.page.evaluate((id) => window.__inside(id), h.id); await t.until(async () => (await t.state()).room === h.id, 60000, `could not go into ${h.name}`); await settle();
        await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.inHall()), 60000, `never came out of ${h.name}`); await settle();
        const s0 = await t.state();
        // Facing the court, a tap anywhere on the ground must go where it was aimed, never to the hall's door.
        const vp = t.page.viewportSize();
        let set = 0;
        for (const [fx, fy] of [[0.5, 0.95], [0.5, 0.75], [0.5, 0.65], [0.3, 0.64], [0.7, 0.58], [0.5, 0.55]]) {
          await tap(vp.width * fx, vp.height * fy); await t.frames(1);
          let s1 = await t.state();
          for (let n = 0; n < 12 && !s1.target; n++) { await t.frames(1); s1 = await t.state(); }   // (from a porch the straight line is shut: the way round is worked out over a frame or two)
          if (!s1.target) continue;   // a tap above the horizon of this hall's court leads nowhere
          set++;
          expect(Math.hypot(s1.target[0] - h.door[0], s1.target[1] - h.door[1]) > 0.5, `${view}${touch ? " touch" : ""} ${h.name}: a tap on the court at (${fx},${fy}) went to the hall's door: ${s1.target} from ${s0.x},${s0.z}`);
          expect(!(await t.inHall()), `${h.name}: he went back in`);
          await t.page.evaluate(() => window.__walk([]));
        }
        expect(set >= 1, `${view}${touch ? " touch" : ""} ${h.name}: only ${set} taps on the court set a destination`);
      }
      if (view === "third") {
        // Main hall: out of the door, three taps toward the court; he walks down the steps and does not turn round.
        await t.page.evaluate(() => window.__inside("main")); await t.until(async () => (await t.state()).room === "main", 60000, "could not go into the main hall"); await settle();
        await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.inHall()), 60000, "never came out of the main hall"); await settle();
        const vp = t.page.viewportSize();
        for (const [fx, fy] of [[0.5, 0.75], [0.5, 0.65], [0.3, 0.64]]) {
          await tap(vp.width * fx, vp.height * fy); await t.frames(1);
          const s1 = await t.state();
          expect(s1.target && s1.target[1] > -0.48, `main hall: a tap on the court from the porch should set a target past the foot of the steps (z > -0.48), got ${s1.target}`);
        }
        await t.until(async () => { const s = await t.state(); return !s.target && s.z > -0.48; }, 120000, "he did not walk down the steps");
        expect(!(await t.inHall()), "main hall: walked back in");
      }
      if (view === "first") {
        // What the rule is for, kept: from the court a tap on the hall leads to its door and in; on the porch a tap on the door goes in, a tap on the porch floor does not.
        const vp = t.page.viewportSize(), at = async (x, z, yaw, pitch) => { await t.page.evaluate(([x, z, yaw, pitch]) => window.__pose(x, z, yaw, pitch), [x, z, yaw, pitch]); await t.frames(3); };
        await at(0.3, 2.2, 0, 0.05); await tap(vp.width / 2, vp.height * 0.375); await t.until(t.inHall, 300000, "from the court, a tap on the hall never led inside");
        await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.inHall()), 60000, "never came out"); await settle();
        await at(0, -3.5, 0, -0.45); await tap(vp.width / 2, vp.height * 0.85); await t.frames(1);
        const f = await t.state(); expect(f.target && f.target[1] > -5.0 && f.target[1] < -1, `on the porch, a tap on the porch floor should walk there, got ${f.target}`);
        await t.until(async () => !(await t.state()).target, 120000, "never reached the spot on the porch"); expect(!(await t.inHall()), "a tap on the porch floor took him into the hall");
        await at(0, -3.5, 0, -0.35); await tap(vp.width / 2, vp.height * 0.5); await t.until(t.inHall, 300000, "on the porch, a tap on the door never led inside");
      }
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    }
  } },
  // Every cushion and stool is a seat. This asks only where he ends up, so the place is not drawn and he hurries: it
  // was the slow half of the rites scenario, which still sits on one stool and one cushion at a visitor's pace.
  seats: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&enter&view=third&season=summer&time=day" + BARE);
    const R = () => t.page.evaluate(() => window.__rites());
    // Every seat there is, indoors and out: put beside it, he goes over and is on it, at its height, turned the way it faces.
    const seats = await t.page.evaluate(() => window.__seats.map((k) => ({ at: k.at, top: k.top, room: k.room, kind: k.kind })));
    let room = null;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      if ((s.room || null) !== room) { room = s.room || null; await t.page.evaluate((id) => window.__inside(id), room); await t.until(async () => (await t.page.evaluate(() => window.__yard().room)) === room, 40000, `could not go to ${room || "the open"}`); }
      const from = await t.page.evaluate((k) => { const s = window.__seats[k]; for (let a = 0; a < 24; a++) for (const r of [0.6, 0.9, 1.3]) { const x = s.at[0] + Math.sin(a * 0.2618) * r, z = s.at[1] + Math.cos(a * 0.2618) * r; if (!window.__blocked(x, z)) { window.__pose(x, z, 0, 0); window.__sit(k); return [x, z]; } } return null; }, i);
      expect(from, `no ground beside seat ${i} in ${room || "the open"}`);
      await t.until(async () => { const r = await R(); return Math.hypot(r.him[0] - s.at[0], r.him[2] - s.at[1]) < 0.03 && Math.abs(r.him[1] - s.top) < 0.03; }, 40000, `he is not sitting on seat ${i} in ${room || "the open"} (${s.at.map((v) => v.toFixed(1))})`);
      expect((await t.state()).pose === (s.kind === "stool" ? "chair" : "sit"), `on seat ${i} in ${room || "the open"}, a ${s.kind}, he sits ${(await t.state()).pose}`);
    }
    expect((await R()).sat >= seats.length, "not every seat was sat on");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Which floor he walks on (#265, #274): the grid baked from the drawn meshes everywhere by default (a spot on every level
  // out of doors, inside a hall, up on the balcony), the written plan with ?walker=old; and a ?cam address that falls
  // where the grid shuts him out is moved to the nearest open spot within half a metre, or back to the start of the path
  // (in a room: left at its door; on the balcony: at its door).
  walkgrid: { tier: 2, async run(b, base) {
    let t = await open(b, base, "q=low&view=first&cam=0,20,0,0" + BARE);
    const w = await t.page.evaluate(() => window.__walker());
    console.log("    walker " + JSON.stringify(w));
    expect(w.mode === "mesh" && w.grid === "outdoors" && w.answers && w.bytes > 10000 && w.memory > 1e6 && w.drops > 12 && !w.failed, "the page should walk on the baked floor: " + JSON.stringify(w));
    // One named view on every level of the place, from the page's own list: the path, the forecourt, the first court, each terrace, the summit.
    let last = -Infinity; const floors = [];
    for (const v of ["arrive", "halfway", "forecourt", "court", "terrace", "guanyin", "summit"]) {
      expect(await t.page.evaluate((n) => window.__show(n), v), `no view called ${v}`); await t.frames(2);
      const q = await t.page.evaluate(() => window.__walker()); floors.push(+q.floor.toFixed(2));
      expect(q.grid === "outdoors" && q.answers && !q.blockedHere, `at "${v}" he should stand on open floor of the grid: ${JSON.stringify(q)}`);
      expect(q.floor >= last - 0.01, `"${v}" stands at ${q.floor}, lower than the level before it (${last})`); last = q.floor;
    }
    expect(floors[floors.length - 1] - floors[0] > 25, `the walk climbs from ${floors[0]} to ${floors[floors.length - 1]} m`);
    // A spot just inside what the censer shuts, and its middle (nowhere open within half a metre), both from the page.
    await t.page.evaluate(() => window.__show("court")); await t.frames(2);
    const spots = await t.page.evaluate(() => { const [x, z] = [0, 13]; let r = 0; while (window.__blocked(x + r, z) && r < 3) r += 0.02; return { near: [x + r - 0.2, z], deep: [x, z], start: window.__walker().start }; });
    // Inside a hall: its own grid; and a walk across the room by the keys' own path ends on open floor.
    await t.page.evaluate(() => window.__inside("main")); await t.until(async () => (await t.state()).room === "main", 60000, "could not go into the great hall");
    const inHall = await t.page.evaluate(() => window.__walker());
    expect(inHall.grid === "room:main" && inHall.answers && !inHall.blockedHere, `in the great hall he should stand on its own grid: ${JSON.stringify(inHall)}`);
    // A point of the room that is shut (the nearest shut point north of where he stands: the cushions are floor, the stand and the table are not).
    const shut = await t.page.evaluate(() => { const y = window.__yard(); let d = 0; while (!window.__blocked(y.x, y.z - d) && d < 12) d += 0.05; return { at: [y.x, y.z - d - 0.1], door: [y.x, y.z] }; });
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    t = await open(b, base, `q=low&view=first&cam=${spots.near[0]},${spots.near[1]},0,0` + BARE);
    let y = await t.state();
    expect(Math.hypot(y.x - spots.near[0], y.z - spots.near[1]) <= 0.51 && !(await t.page.evaluate(([x, z]) => window.__blocked(x, z), [y.x, y.z])), `a ?cam in a shut cell should settle within half a metre: ${JSON.stringify([spots.near, y.x, y.z])}`);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    t = await open(b, base, `q=low&view=first&cam=${spots.deep[0]},${spots.deep[1]},0,0` + BARE);
    y = await t.state();
    expect(Math.hypot(y.x - spots.start[0], y.z - spots.start[1]) < 0.05, `a ?cam with nowhere open near should go back to the start: ${JSON.stringify([y.x, y.z, spots.start])}`);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    // In a room: an address in something is moved onto open floor of that room.
    t = await open(b, base, `q=low&view=first&in=main&cam=${shut.at[0]},${shut.at[1]},0,0` + BARE);
    y = await t.state(); const r = await t.page.evaluate(() => window.__walker());
    expect(y.room === "main" && r.grid === "room:main" && !r.blockedHere && Math.hypot(y.x - shut.at[0], y.z - shut.at[1]) <= 0.51, `?in=main&cam in a shut cell should settle in the room: ${JSON.stringify([shut.at, y.x, y.z, r.blockedHere])}`);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    // Up on the balcony: its own grid; nothing but the balcony can be stood on; an address off it stands him at its door.
    t = await open(b, base, "q=low&up=lingxiao" + BARE);
    const up = await t.page.evaluate(() => { const w = window.__walker(), y = window.__yard(), L = window.__lofts.lingxiao; return { w, at: [y.x, y.z], door: L.door, floor: L.floor, outer: L.outer, ground: window.__blocked(0, L.outer.z1 + 6) }; });
    expect(up.w.grid === "loft:lingxiao" && up.w.answers && !up.w.blockedHere && Math.abs(up.w.floor - up.floor) < 0.03, `up on the balcony he should stand on its own grid at its height: ${JSON.stringify(up.w)}`);
    expect(up.ground, "from the balcony the summit's ground should not be floor");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    t = await open(b, base, `q=low&up=lingxiao&cam=${up.outer.x1 + 3},${up.door[1]},0,0` + BARE);
    y = await t.state();
    expect(Math.hypot(y.x - up.door[0], y.z - up.door[1]) < 0.05, `?up=lingxiao&cam off the balcony should stand him at its door: ${JSON.stringify([y.x, y.z, up.door])}`);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    t = await open(b, base, "q=low&view=first&walker=old&cam=0,20,0,0" + BARE);
    const o = await t.page.evaluate(() => window.__walker());
    expect(o.mode === "old" && o.grid === null && !o.bytes, "?walker=old should walk the written plan, and fetch no grid: " + JSON.stringify(o));
    await t.page.evaluate(() => window.__inside("main")); await t.until(async () => (await t.state()).room === "main", 60000, "could not go into the great hall on the written plan");
    expect((await t.page.evaluate(() => window.__walker())).grid === null, "?walker=old is the written plan indoors too");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Round the platforms the baked floor opened (#265: the owner saw the floor's underside from his own eyes at the great
  // hall's east end): along every porch edge of the first court, a little in from it, first person and third, his feet
  // are on the floor under him and his own eye is well over it.
  platforms: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&view=first&cam=0,20,0,0" + BARE);
    const edges = await t.page.evaluate(() => window.__drops().filter((e) => e.top < 2 && Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) > 1));
    expect(edges.length >= 8, `only ${edges.length} porch edges in the court`);
    let n = 0;
    for (const view of ["first", "third"]) {
      await t.page.evaluate((v) => window.__view(v), view);
      for (const e of edges) for (const f of [0.2, 0.5, 0.8]) {
        const x = e.a[0] + (e.b[0] - e.a[0]) * f - e.normal[0] * 0.3, z = e.a[1] + (e.b[1] - e.a[1]) * f - e.normal[1] * 0.3;
        if (await t.page.evaluate(([x, z]) => window.__blocked(x, z), [x, z])) continue;
        await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0), [x, z, Math.atan2(e.normal[0], -e.normal[1])]); await t.frames(3);
        const w = await t.page.evaluate(() => window.__walker()), y = await t.state(); n++;
        expect(Math.abs(w.floor - e.top) < 0.03, `${view}: at (${x.toFixed(2)}, ${z.toFixed(2)}) on a ${e.top} m porch the floor reads ${w.floor}`);
        expect(y.footY >= w.floor - 0.05, `${view}: his feet are under the floor at (${x.toFixed(2)}, ${z.toFixed(2)}): ${y.footY} under ${w.floor}`);
        expect(w.eye >= w.floor + 0.6, `${view}: the eye is at ${w.eye.toFixed(2)}, the floor at ${w.floor} (${x.toFixed(2)}, ${z.toFixed(2)})`);
      }
    }
    expect(n >= 40, `only ${n} places round the platforms were stood on`);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Coming back: a first visit is offered only the way in; where he was is kept, and the next visit may go on from
  // there or begin again.
  resume: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low" + BARE, { enter: false });
    const ready = async () => { await t.page.waitForFunction(() => document.body.dataset.ready === "1" && !document.getElementById("enterBtn").disabled, null, { timeout: 240000 }); };
    await ready(); let L = await t.page.evaluate(() => window.__left());
    expect((await t.page.textContent("#enterBtn")) === "入山" && !L.again && !L.offer.going, "a first visit should be offered only the way in: " + JSON.stringify(L.offer));
    await t.page.click("#enterBtn"); const start = await t.state();
    // He goes up to the bell, earns nothing, and the page is left.
    await t.page.evaluate(() => { const p = window.__places.bell; window.__pose(p.at[0] - 1.5, p.at[1] - 2, 0.4, 0); });
    await t.until(async () => { const p = (await t.page.evaluate(() => window.__left())).place; return p && Math.abs(p.x - 14) < 0.2 && p.label === "钟楼"; }, 60000, "where he stands was never kept");
    await t.page.reload(); await ready(); L = await t.page.evaluate(() => window.__left());
    expect((await t.page.textContent("#enterBtn")) === "接着走" && L.again && (await t.page.textContent("#againBtn")) === "从头走起", "coming back should offer to go on or begin again: " + JSON.stringify(L.offer));
    expect((await t.page.textContent("#titleSeals")).includes("上回走到钟楼"), "the title should say where he was: " + (await t.page.textContent("#titleSeals")));
    await t.shot("e2e-resume"); await t.page.click("#enterBtn"); let st = await t.state();
    expect(Math.abs(st.x - 14) < 0.3 && Math.abs(st.yaw - 0.4) < 0.05, "he is not where he was left: " + JSON.stringify([st.x, st.z, st.yaw]));
    // (The observance is started without handing its promise back: the page would wait for the whole of it.)
    // With a seal in the book, beginning again is asked twice, empties the book and starts at the foot of the path.
    await t.page.evaluate(() => { const p = window.__places.well; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); window.__rite("well"); }); await t.until(async () => (await t.journey()).seals.well > 0, 120000, "no seal to lose");
    await t.until(async () => !(await t.page.isVisible("#toast")), 30000, "the seal never left the picture"); await t.page.waitForTimeout(2600);
    await t.page.reload(); await ready();
    expect((await t.page.textContent("#titleSeals")).includes("已得一印"), "the seal was not remembered: " + (await t.page.textContent("#titleSeals")) + " " + JSON.stringify((await t.journey()).seals));
    await t.page.click("#againBtn"); expect((await t.page.textContent("#againBtn")).includes("朱印清空") && !(await t.page.evaluate(() => document.body.classList.contains("entered"))), "beginning again should ask a second time");
    await t.page.click("#againBtn"); await t.until(() => t.page.evaluate(() => document.body.classList.contains("entered")), 20000, "he did not set out again");
    expect(await t.page.evaluate(() => window.__opening().active), "beginning again from the foot of the path should show the mountain again (src/opening.js)");
    await t.page.keyboard.press("Escape"); await t.until(() => t.page.evaluate(() => !window.__opening().active), 60000, "Esc did not pass over the opening");
    st = await t.state(); const j = await t.journey();
    expect(j.count === 0 && Math.abs(st.x - start.x) < 0.3 && Math.abs(st.z - start.z) < 0.6, "beginning again should empty the book and stand him at the start: " + JSON.stringify([j.count, st.x, st.z, start.x, start.z]));
    // A seal that has been earned is the way back to its place: earn the well's again, walk off, open the book, press the seal.
    await t.page.evaluate(() => { const p = window.__places.well; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); window.__rite("well"); }); await t.until(async () => (await t.journey()).seals.well > 0, 120000, "no seal to go back to");
    await t.until(async () => !(await t.page.isVisible("#toast")), 30000, "the seal never left the picture");
    await t.page.evaluate(() => window.__pose(0, 30, 0, 0)); await t.page.evaluate(() => window.__book());
    await t.until(() => t.page.isVisible("#book"), 30000, "the book did not open");
    const go = await t.page.$$eval(".seal-go", (bs) => bs.map((b) => [b.dataset.id, b.getAttribute("aria-label"), b.getBoundingClientRect().width, b.getBoundingClientRect().height]));
    expect(go.length === 1 && go[0][0] === "well" && go[0][1] === "回到龙井" && go[0][2] >= 40 && go[0][3] >= 44, "only the earned seal should be a way back, and large enough for a thumb: " + JSON.stringify(go));
    expect(await t.page.isVisible("#bookGo"), "the book should say a seal can be pressed");
    await t.page.click('.seal-go[data-id="well"]');
    const well = await t.page.evaluate(() => window.__places.well.at);
    await t.until(async () => { const y = await t.state(); return !(await t.page.isVisible("#book")) && Math.hypot(y.x - well[0], y.z - well[1]) < 0.2; }, 30000, "pressing the seal did not take him back to the well");
    expect((await t.page.evaluate(() => window.__rites().went)) === 1, "the way back was not counted");
    await t.page.waitForTimeout(2600); await t.page.reload(); await ready(); expect((await t.page.textContent("#enterBtn")) === "接着走" && (await t.page.textContent("#titleSeals")).includes("龙井"), "he should be offered to go on from the well: " + (await t.page.textContent("#titleSeals")));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Up the summit pavilion (#101): into its room, to the stair's foot, up behind the veil; round the balcony with his
  // own eyes (V does not take him out of them), into the railing and not over it, a photograph; the page left and
  // opened again finds him up there; then down to the stair's foot, the view he had below, and out of the door. It
  // photographs, so it draws.
  loft: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&view=third", { enter: false });
    const ready = async () => { await t.page.waitForFunction(() => document.body.dataset.ready === "1" && !document.getElementById("enterBtn").disabled, null, { timeout: 240000 }); };
    const clear = () => t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted");
    const act = () => t.page.evaluate(() => { const b = document.getElementById("act"); return b && !b.hidden ? b.dataset.word : null; });
    const at = async (p, d = 0.2) => { const s = await t.state(); return Math.hypot(s.x - p[0], s.z - p[1]) < d; };
    await ready(); await t.page.click("#enterBtn"); await t.page.waitForFunction(() => document.body.classList.contains("entered"));
    // A first visitor is shown the mountain before the walk is theirs (src/opening.js), and a key pressed meanwhile only passes
    // over it, so an E at the stair's foot was lost whenever a slow machine was still flying it (#233): hand the walk back first,
    // as `open()` in lib.cjs does for the scenarios that step in themselves.
    if (await t.page.evaluate(() => !!window.__opening && window.__opening().active)) { await t.page.keyboard.press("Escape"); await t.page.waitForFunction(() => !window.__opening().active, null, { timeout: 120000 }); }
    await t.page.evaluate(() => window.__inside("lingxiao")); await t.until(async () => (await t.state()).room === "lingxiao", 30000, "could not go into the summit pavilion"); await clear();
    expect((await t.page.evaluate(() => window.__hud())).said.includes("stair"), "going in did not say the stair is there: " + JSON.stringify((await t.page.evaluate(() => window.__hud())).said));
    const foot = (await t.state()).stair; expect(foot, "the summit pavilion's room has no stair");
    await t.page.evaluate((p) => window.__walk([p]), foot); await t.until(async () => (await act()) === "登楼", 60000, "walking to the stair's foot did not offer 登楼");
    await t.page.keyboard.press("e"); await t.until(async () => (await t.state()).up === "lingxiao", 30000, "E at the stair's foot did not take him up"); await clear();
    const L = await t.page.evaluate(() => window.__lofts.lingxiao); let s = await t.state();
    expect(!s.inside && s.view === "first" && Math.abs(s.h - L.floor) < 0.02 && Math.abs(s.yaw - L.face) < 0.05 && (await at(L.door, 0.1)), "up there he should stand at the top storey's door, facing south, with his own eyes: " + JSON.stringify(s));
    expect((await t.page.evaluate(() => window.__music().zone)) === "summit", "the music up there should be the summit's");
    // Up there he sees with his own eyes only: the summit mat's shot (#87, src/director.js), asked for from the balcony, is refused.
    expect((await t.page.evaluate(() => window.__direct("sit"))) === false && (await t.page.evaluate(() => window.__director().phase)) === "idle", "a place's shot was taken up on the balcony: " + JSON.stringify(await t.page.evaluate(() => window.__director())));
    await t.page.keyboard.press("v"); await t.frames(2); s = await t.state();
    expect(s.view === "first" && (await t.page.evaluate(() => window.__hud())).said.includes("upView"), "V took him out of his own eyes up there, or said nothing: " + s.view);
    // Round the balcony, every corner turned, and back to the door.
    const r = (L.half.wall + L.half.edge) / 2, [cx, cz] = L.at;
    for (const p of [[cx + r, cz + r], [cx + r, cz - r], [cx - r, cz - r], [cx - r, cz + r], L.door]) { await t.page.evaluate((q) => window.__walk([q]), p); await t.until(() => at(p, 0.2), 60000, `he did not get round to (${p.map((v) => v.toFixed(2))})`); }
    expect((await t.state()).up === "lingxiao" && Math.abs((await t.state()).h - L.floor) < 0.02, "going round he left the balcony");
    // Straight at the railing, hurrying, and a jump there: he stays on the balcony.
    await t.page.evaluate((y) => window.__pose(window.__lofts.lingxiao.door[0] + 1.3, window.__lofts.lingxiao.door[1], y, 0), L.face);
    await t.page.keyboard.down("Shift"); await t.page.keyboard.down("w"); await t.frames(20); await t.page.keyboard.press("Space"); await t.frames(20); await t.page.keyboard.up("w"); await t.page.keyboard.up("Shift"); await t.frames(10);
    s = await t.state(); expect(Math.abs(s.h - L.floor) < 0.02 && Math.abs(s.z - L.at[1]) <= L.half.edge - 0.16 - 0.38 + 0.02 && !s.jumping, "he went into or over the railing: " + JSON.stringify(s));
    // A tap down on the court below does not send him anywhere.
    await t.page.evaluate((y) => window.__pose(window.__lofts.lingxiao.door[0] + 1.3, window.__lofts.lingxiao.door[1], y, -0.6), L.face); await t.frames(3);
    const box = await t.page.$("canvas").then((c) => c.boundingBox()); await t.page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85); await t.frames(5);
    expect(!(await t.state()).target, "a tap on the court far below sent him walking");
    // A photograph up there.
    await t.page.evaluate(() => window.__photo(true)); await t.frames(2); const c = await t.page.evaluate(async () => { const k = await window.__capture(); return { w: k.w, h: k.h, size: k.url.length }; }); expect(Math.max(c.w, c.h) >= 1000 && c.size > 100000, "no photograph from the balcony: " + JSON.stringify(c)); await t.page.evaluate(() => window.__photo(false)); await t.frames(2);
    // Left and opened again, he is still up there.
    await t.until(async () => { const p = (await t.page.evaluate(() => window.__left())).place; return p && p.up === "lingxiao"; }, 30000, "where he stood up there was never kept");
    await t.page.reload(); await ready();
    expect((await t.page.textContent("#titleSeals")).includes("凌霄阁上"), "the title should say he was up on the pavilion: " + (await t.page.textContent("#titleSeals")) + " " + JSON.stringify(await t.page.evaluate(() => [window.__left(), localStorage.getItem("yunjing.place.v1")])));
    await t.page.click("#enterBtn"); await t.frames(3); s = await t.state();
    expect(s.up === "lingxiao" && Math.abs(s.h - L.floor) < 0.02 && s.view === "first", "coming back he is not up on the balcony: " + JSON.stringify(s));
    await t.shot("e2e-loft");
    // Down from the door, to the stair's foot, the view he had below; and out of the hall.
    await t.page.evaluate((p) => window.__walk([p]), L.door); await t.until(async () => (await act()) === "下楼", 60000, "the door up there did not offer 下楼");
    await t.page.keyboard.press("e"); await t.until(async () => (await t.state()).room === "lingxiao" && !(await t.state()).up, 30000, "E at the door did not take him down"); await clear();
    s = await t.state(); expect(Math.hypot(s.x - s.stair[0], s.z - s.stair[1]) < 0.1 && s.h < -50, "coming down he is not at the stair's foot: " + JSON.stringify(s));
    expect(s.view === "third", "coming down he should see as he did below (from behind him): " + s.view);
    await t.page.evaluate(() => window.__inside(null)); await t.until(async () => !(await t.state()).inside, 30000, "could not leave the pavilion"); await clear();
    s = await t.state(); expect(!s.up && !s.inside && s.h > 19, "out of the door he should stand on the summit: " + JSON.stringify(s));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // What his hands do, at the pace a visitor sees it: the rope drawn and the bell rung three times, the bowl lifted
  // and drunk from, a stool and a cushion sat on, the incense bowed with and set in the ash.
  rites: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&enter&view=third&season=summer&time=day");
    const at = (id, dx = 0.3, dz = 0.3) => t.page.evaluate(([k, d, e]) => { const p = window.__places[k]; window.__pose(p.at[0] + d, p.at[1] + e, 0, 0); }, [id, dx, dz]);
    const offered = (word) => t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === word, 40000, `"${word}" was not offered`);
    const seen = (what, fn, ms = 120000) => t.page.waitForFunction(fn, null, { timeout: ms, polling: 100 }).catch(() => { throw new Error(what); });
    const R = () => t.page.evaluate(() => window.__rites());
    // The bell.
    // The bell: the first press takes the rope and rings once; every stroke after it is one more press, when the log
    // has come back off the bronze. Nothing rings by itself, and walking off (here Esc) lets the rope go.
    await at("bell", 0.3, -0.3); await offered("撞钟"); await t.page.click("#act");
    await seen("he never took the rope", () => window.__rites().bell.grip > 0.9);
    await seen("the log was never drawn back", () => window.__rites().bell.drawn > 0.15);
    await t.until(async () => (await t.journey()).strikes === 1, 60000, "the first press did not ring");
    let lo = 0; const low = async () => { lo = Math.min(lo, (await R()).bell.log); };
    // (Seconds, not frames: a stroke would come on the observances' clock, not with frames.)
    await t.page.waitForTimeout(6000); await low(); expect((await t.journey()).strikes === 1 && (await R()).bell.pulls === 1, "the bell rang again without a press");
    for (const n of [2, 3]) { await seen("the rope never came back to hand", () => window.__rites().bell.ready); await t.page.click("#act"); await t.until(async () => { await low(); return (await t.journey()).strikes === n; }, 30000, `stroke ${n} did not sound`); }
    await t.until(async () => (await t.journey()).seals.bell > 0, 30000, "three strokes earned no seal");
    // Two presses one on the other are one pull: the second comes while the log is still being drawn back.
    await seen("the rope never came back to hand", () => window.__rites().bell.ready);
    const p0 = (await R()).bell.pulls; await t.page.evaluate(() => { const b = document.getElementById("act"); b.click(); b.click(); });
    await t.until(async () => (await R()).bell.pulls > p0, 30000, "the pull after the seal did not ring"); await t.page.waitForTimeout(3000);
    expect((await R()).bell.pulls === p0 + 1, "two presses at once rang the bell twice");
    let r = await R(); expect(lo >= -0.181 && r.bell.log >= -0.181, "the log went into the bell: " + lo);
    expect((await t.journey()).rite === "bell" && r.bell.grip > 0.9, "he should still hold the rope after the third stroke");
    await t.page.keyboard.press("Escape");
    await t.until(async () => (await R()).bell.grip === 0 && (await t.journey()).rite === null, 60000, "he never let the rope go");
    // Tea: the bowl leaves the table, is tilted at his lips three times, and is set down again.
    await at("tea"); await offered("吃茶"); await t.page.click("#act");
    await seen("for tea he did not sit on the stool as on a chair", () => window.__yard().pose === "chair");
    await seen("the bowl never left the table", () => window.__rites().tea.lift > 0.1);
    await seen("the bowl was never tilted to drink", () => window.__rites().tea.tilt > 0.3);
    await t.until(async () => (await t.journey()).seals.tea > 0, 120000, "no seal for tea"); r = await R();
    expect(r.tea.sips === 3 && Math.abs(r.tea.lift) < 0.01 && r.tea.held === 0, "the bowl is not back on the table after three sips: " + JSON.stringify(r.tea));
    // And he sits on: breathing, now and then looking out over the court, until 起身.
    expect((await t.journey()).rite === "tea", "he should stay at the table after his tea");
    await offered("起身"); await seen("he never looked up from the table", () => Math.abs(window.__rites().look) > 0.2, 60000);
    expect((await R()).breath !== null, "he is not breathing as he sits"); await t.shot("e2e-tea-linger");
    await t.page.click("#act"); await t.until(async () => (await t.journey()).rite === null && !(await t.page.evaluate(() => window.__yard().staged)), 20000, "起身 did not stand him up");
    // Any stool may be sat on: the one across the table.
    await t.until(async () => !(await t.page.isVisible("#toast")), 30000, "the seal never left the picture");
    await t.page.evaluate(() => { const s = window.__seats[2]; window.__pose(s.at[0] + 0.5, s.at[1] - 0.9, 0, 0); });
    await offered("坐下"); const before = (await R()).sat, hops = (await t.state()).climbs; await t.page.click("#act");
    await t.until(async () => (await R()).sat === before + 1 && (await t.page.evaluate(() => window.__probe().monkBox)) !== undefined, 30000, "he did not sit on the stool");
    expect((await t.state()).pose === "chair", "on a stool he should sit as on a chair, not cross-legged: " + (await t.state()).pose);
    expect((await t.state()).climbs === hops + 1, "too short to step onto a stool, he should hop up onto it");
    // Incense in the great hall, and a cushion in the meditation hall.
    await t.page.evaluate(() => window.__inside("main")); await t.until(() => t.inHall(), 30000, "could not go in");
    await at("incense", 0.2); await offered("上香"); await t.page.click("#act");
    await seen("the sticks never appeared", () => window.__rites().incense.shown);
    await seen("he never bowed with them", () => window.__rites().bow > 0.3);
    await t.until(async () => (await R()).incense.planted, 120000, "the sticks were never set in the ash"); r = await R();
    const bowl = await t.page.evaluate(() => window.__places.incense.bowl);
    expect(Math.hypot(r.incense.at[0] - bowl[0], r.incense.at[2] - bowl[2]) < 0.02 && r.incense.smoke, "the sticks are not in the bowl, smoking: " + JSON.stringify(r.incense));
    await t.until(async () => (await t.journey()).seals.incense > 0, 60000, "no seal for incense");
    await t.page.evaluate(() => window.__inside("chan")); await t.until(async () => (await t.page.evaluate(() => window.__journey().entered && window.__yard().doorway !== undefined)), 30000, "could not go into the meditation hall");
    await t.until(async () => !(await t.page.isVisible("#toast")), 30000, "the seal never left the picture");
    await t.page.evaluate(() => { const s = window.__seats.find((k) => k.room === "chan"); window.__pose(s.at[0], s.at[1] + (s.face === 0 ? 1.2 : -1.2), 0, 0); });
    await offered("坐下"); const n = (await R()).sat, hopsN = (await t.state()).climbs; await t.page.click("#act"); await t.until(async () => (await R()).sat === n + 1, 30000, "he did not sit on the platform");
    expect((await t.state()).pose === "sit", "on a cushion he should sit cross-legged: " + (await t.state()).pose);
    expect((await t.state()).climbs === hopsN + 1, "the meditation hall's cushions lie on a platform as high as a stool: he should hop up onto it too");
    await t.shot("e2e-rites"); expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The eye goes to each place's own shot while an observance is made (src/director.js; the well's waits for #99), and back: by itself just before
  // the observance ends, at once on a step, a drag or Esc; it stays on the bell's shot however often the bell is rung;
  // the pause menu turns it off; a system that asks for reduced motion is given the ink, never a swing; and the camera
  // raised in the middle of a swing frames the shot.
  director: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&enter&view=third&season=summer&time=day" + BARE, { viewport: { width: 960, height: 540 } });
    const at = (id, dx = 0.3, dz = 0.3) => t.page.evaluate(([k, d, e]) => { const p = window.__places[k]; window.__pose(p.at[0] + d, p.at[1] + e, Math.PI - p.face, 0.05); }, [id, dx, dz]);
    const offered = (word) => t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === word, 40000, `"${word}" was not offered`);
    const D = () => t.page.evaluate(() => window.__director());
    const reach = (what, fn, ms = 90000) => t.page.waitForFunction(fn, null, { timeout: ms, polling: 50 }).catch(async () => { throw new Error(what + " | " + JSON.stringify(await D())); });
    const quiet = () => t.page.evaluate(() => document.body.classList.contains("directing"));
    // The lamp: in, rested on, and home again by itself before he is done; the marks over the picture step aside meanwhile.
    await at("lamp"); await offered("燃灯"); await t.page.click("#act");
    await reach("the lamp's shot was never gone to", () => window.__director().id === "lamp" && window.__director().phase !== "idle");
    expect(await quiet(), "the way and the slips should step aside while the eye is on a shot");
    expect((await t.journey()).rings === 0, "the brush rings on the ground should not be drawn on a shot");
    expect(await t.page.evaluate(() => getComputedStyle(document.getElementById("hint")).opacity !== "0" || !document.getElementById("hint").textContent), "the hint line should stay: it says what to do now");
    await reach("the lamp's shot was never reached", () => window.__director().phase === "hold" || window.__director().phase === "out");
    await reach("the eye never came back from the lamp by itself", () => window.__director().phase === "idle" && window.__director().backs >= 1, 60000);
    expect(!(await quiet()), "what steps aside should come back with the eye");
    await t.frames(2); expect((await t.journey()).rings > 0, "the rings still owed should be drawn again once the eye is home");
    await t.until(async () => (await t.journey()).seals.lamp > 0, 60000, "no seal for the lamp");
    // The 功德箱 (#202): the eye goes to the box's own shot in the hall and is home again before the sheet comes; the hand reaches the slot.
    await t.page.evaluate(() => window.__inside("main")); await t.frames(3);
    await t.page.evaluate(() => { const p = window.__gallery["main-box"]; window.__pose(p.at[0], p.at[1] + 0.2, Math.PI - p.face, 0.05); });
    await offered("合掌"); await t.page.click("#act");
    await reach("the box's shot was never gone to", () => window.__director().id === "main-box" && window.__director().phase !== "idle");
    await reach("the box's shot was never reached", () => window.__director().id === "main-box" && window.__director().phase === "hold");
    expect(await quiet(), "the way and the slips should step aside while the eye is on the box's shot");
    await reach("the eye never came back from the box by itself", () => window.__director().phase === "idle" && window.__director().backs >= 1, 90000);
    await t.until(async () => (await t.page.evaluate(() => window.__ui().stack.includes("offering"))) || (await t.journey()).rite === null, 60000, "the coin went in and nothing followed");
    if (await t.page.evaluate(() => window.__ui().stack.includes("offering"))) { await t.page.keyboard.press("Escape"); await t.until(async () => (await t.journey()).rite === null, 20000, "he is still at the box"); }
    await t.page.evaluate(() => window.__inside(null)); await t.frames(3);
    // The well: watched from where the eye follows him (its shot is kept but not gone to until #99: the niche is unlit).
    // The eye must not leave him at any moment of the observance.
    const g0 = await D(); await at("well"); await offered("观水"); await t.page.click("#act");
    await t.page.waitForFunction(() => window.__journey().rite === "well", null, { timeout: 60000, polling: 50 });
    let left = false; while ((await t.journey()).rite === "well") { const s = await D(); if (s.phase !== "idle" || s.blends + s.cuts !== g0.blends + g0.cuts) left = true; await t.page.waitForTimeout(100); }
    expect(!left, "at the well the eye should stay with him (its shot waits for #99)");
    await t.until(async () => (await t.journey()).seals.well > 0, 60000, "no seal for the well");
    let d;
    // The bell: on its shot it stays, press after press; Esc lets go of the rope and brings the eye home.
    await at("bell", 0.3, -0.3); await offered("撞钟"); await t.page.click("#act");
    await reach("the bell's shot was never reached", () => window.__director().id === "bell" && window.__director().phase === "hold");
    const b1 = (await D()).backs;
    for (const n of [2, 3]) { await reach("the rope never came back to hand", () => window.__rites().bell.ready, 60000); await t.page.click("#act"); await t.until(async () => (await t.page.evaluate(() => window.__rites().bell.pulls)) >= n, 40000, `stroke ${n} did not sound`); }
    d = await D(); expect(d.phase === "hold" && d.id === "bell" && d.backs === b1 && d.w === 1, "ringing again should keep the eye on the bell's shot: " + JSON.stringify(d));
    expect(await t.page.isVisible("#act"), "撞钟 should still be offered on the bell's shot");
    await t.page.keyboard.press("Escape");
    d = await D(); expect(d.phase === "out" || d.phase === "idle", "Esc did not send the eye home: " + JSON.stringify(d));
    await reach("the eye never got home from the bell", () => window.__director().phase === "idle" && window.__journey().rite === null, 30000);
    expect(!(await t.page.evaluate(() => window.__ui().stack.includes("menu"))), "Esc on a shot should bring the eye home, not open the pause menu");
    // Tea: a drag of the view brings the eye home, and he stays at his tea.
    await at("tea"); await offered("吃茶"); await t.page.click("#act");
    await reach("the tea's shot was never reached", () => window.__director().id === "tea" && window.__director().phase === "hold");
    await t.page.mouse.move(480, 270); await t.page.mouse.down(); for (let x = 490; x <= 600; x += 10) await t.page.mouse.move(x, 272); await t.page.mouse.up();
    d = await D(); expect(d.phase === "out" || d.phase === "idle", "a drag did not send the eye home: " + JSON.stringify(d));
    expect((await t.journey()).rite === "tea", "a drag should only bring the eye home, not stand him up from his tea");
    await reach("the eye never got home from the tea", () => window.__director().phase === "idle", 30000);
    await offered("起身"); await t.page.click("#act"); await t.until(async () => (await t.journey()).rite === null, 20000, "起身 did not stand him up");
    // The camera raised in the middle of the swing to the bell frames the shot itself.
    await t.until(async () => !(await t.page.isVisible("#toast")), 30000, "the seal never left the picture");
    await at("bell", 0.3, -0.3); await offered("撞钟"); await t.page.click("#act");
    await reach("the bell's shot was never gone to", () => window.__director().id === "bell" && window.__director().phase !== "idle");
    await t.page.keyboard.press("p"); await t.until(() => t.page.evaluate(() => window.__probe().photo), 20000, "the camera was not raised");
    d = await D(); expect(d.phase === "hold" && d.w === 1, "raised in the middle of a swing, the camera should frame the shot: " + JSON.stringify(d));
    // The shutter on the shot: the print is the shot's own picture (the eye stands where the shot puts it when it is drawn).
    const before = await t.page.evaluate(() => window.__probe().camDist), print = await t.page.evaluate(async () => { const c = await window.__capture(); return { w: c.w, h: c.h, d: window.__director(), cam: window.__probe().camDist }; });
    expect(print.w > 0 && print.d.phase === "hold" && Math.abs(print.cam - before) < 0.05, "the photograph should be drawn from the shot: " + JSON.stringify({ before, ...print, d: print.d.phase }));
    // A step (W) sends the eye home at once, and walks him away from the rope.
    await t.page.keyboard.press("p"); await t.until(async () => !(await t.page.evaluate(() => window.__probe().photo)), 20000, "the camera was not lowered");
    const b0 = (await D()).backs; await t.page.keyboard.down("w"); await t.frames(2); await t.page.keyboard.up("w");
    d = await D(); expect(d.backs === b0 + 1 && (d.phase === "out" || d.phase === "idle"), "a step did not send the eye home: " + JSON.stringify(d));
    await reach("the eye never got home", () => window.__director().phase === "idle" && window.__journey().rite === null, 30000);
    // Every swing so far was made, none cut behind the ink (the owner: 打卡时用动画，不要硬切转场).
    d = await D(); expect(d.cuts === 0 && d.blends > 0, "a swing was cut instead of made: " + JSON.stringify(d));
    // Turned off in the pause menu: the bell is rung from where the eye follows him.
    await t.page.keyboard.press("Escape"); await t.until(() => t.page.evaluate(() => window.__ui().stack.includes("menu")), 10000, "the pause menu did not open");
    expect((await t.page.getAttribute("#setAutocam", "aria-pressed")) === "true", "自动镜头 should be on unless turned off");
    await t.page.click("#setAutocam"); expect((await t.page.evaluate(() => window.__settings().autocam)) === false, "自动镜头 did not turn off");
    await t.page.click("#menuResume");
    const n0 = (await D()).blends + (await D()).cuts;
    await at("bell", 0.3, -0.3); await offered("撞钟"); await t.page.click("#act");
    await reach("he never took the rope", () => window.__rites().bell.grip > 0.9, 60000); await t.frames(4);
    d = await D(); expect(d.phase === "idle" && d.blends + d.cuts === n0, "with 自动镜头 off the eye should stay with him: " + JSON.stringify(d));
    await t.page.keyboard.press("Escape"); await t.until(async () => (await t.journey()).rite === null, 30000, "he never let the rope go");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    // The rest of the observances, made quicker (?fast): the incense in the great hall, the library's slip (taken, the eye
    // comes home), the lamp from his own eyes (and back into them), and the summit, where the close takes the eye from
    // the shot and the director lets go.
    const f = await open(b, base, "q=low&enter&fast=1&view=third&season=summer&time=day" + BARE, { viewport: { width: 960, height: 540 } });
    const fat = (id, dx = 0.1, dz = 0.1) => f.page.evaluate(([k, d, e]) => { const p = window.__places[k]; window.__pose(p.at[0] + d, p.at[1] + e, Math.PI - p.face, 0.05); }, [id, dx, dz]);
    const fword = (w) => f.until(async () => (await f.page.isVisible("#act")) && (await f.page.getAttribute("#act", "data-word")) === w, 40000, `"${w}" was not offered`);
    const fsee = (what, fn, ms = 90000) => f.page.waitForFunction(fn, null, { timeout: ms, polling: 50 }).catch(async () => { throw new Error(what + " | " + JSON.stringify(await f.page.evaluate(() => window.__director()))); });
    await f.page.evaluate(() => window.__inside("main")); await f.until(() => f.inHall(), 30000, "could not go into the great hall");
    await fat("incense"); await fword("上香"); await f.page.click("#act");
    await fsee("the incense's shot was never gone to", () => window.__director().id === "incense" && window.__director().phase !== "idle");
    await fsee("the eye never came home from the incense", () => window.__journey().seals.incense > 0 && window.__director().phase === "idle", 120000);
    await f.page.evaluate(() => window.__inside(null)); await f.until(async () => !(await f.inHall()), 30000, "could not come out");
    await fat("sutra"); await fword("请一句"); await f.page.click("#act");
    await fsee("the library's shot was never gone to", () => window.__director().id === "sutra" && window.__director().phase !== "idle");
    await fsee("the slip was never held out", () => window.__ui().stack.includes("slip"), 60000);
    expect((await f.page.evaluate(() => window.__director().phase)) !== "idle", "the eye should stay on the shot while the slip is read");
    await f.page.keyboard.press("e"); await fsee("the eye never came home once the slip was taken", () => window.__director().phase === "idle" && window.__journey().rite === null, 60000);
    await f.page.keyboard.press("v"); await f.until(async () => (await f.probe()).view === "first", 10000, "no first person");
    await f.until(async () => !(await f.page.isVisible("#toast")), 30000, "the seal never left the picture");
    await fat("lamp"); await fword("燃灯"); await f.page.click("#act");
    await fsee("from his own eyes the lamp's shot was never gone to", () => window.__director().id === "lamp" && window.__director().phase !== "idle");
    await fsee("never came home into his own eyes", () => window.__director().phase === "idle" && window.__journey().rite === null, 60000);
    let p = await f.probe(); expect(p.view === "first" && p.camDist < 0.8 && !p.monk, "back home, the eye should be his own again: " + JSON.stringify({ view: p.view, camDist: p.camDist, monk: p.monk }));
    await f.page.keyboard.press("v");
    await fat("sit", 0, 0.4); await fword("静坐"); await f.page.click("#act");
    await fsee("the summit's shot was never gone to", () => window.__director().id === "sit" && window.__director().phase !== "idle");
    await fsee("the close never began", () => window.__rites().closing === true, 120000);
    await fsee("the director should let the close have the eye", () => window.__director().phase === "idle", 10000);
    expect((await f.page.evaluate(() => window.__director().cuts)) === 0, "a swing was cut instead of made (fast page)");
    expect(f.errors.length === 0, f.errors.join("\n")); await f.close();
    // Reduced motion: never a swing, only the ink, there and back.
    const r = await open(b, base, "q=low&enter&view=third&season=summer&time=day" + BARE, { viewport: { width: 960, height: 540 }, reducedMotion: "reduce" });
    await r.page.evaluate(() => { const p = window.__places.bell; window.__pose(p.at[0] + 0.3, p.at[1] - 0.3, Math.PI, 0.05); });
    await r.until(async () => (await r.page.isVisible("#act")) && (await r.page.getAttribute("#act", "data-word")) === "撞钟", 40000, "撞钟 was not offered");
    await r.page.click("#act");
    let saw = 0; await r.page.waitForFunction(() => window.__director().phase === "hold", null, { timeout: 90000, polling: 50 });
    d = await r.page.evaluate(() => window.__director()); expect(d.cuts === 1 && d.blends === 0 && d.why === "reduced", "with reduced motion the eye should go behind the ink: " + JSON.stringify(d));
    await r.page.keyboard.press("Escape"); await r.page.waitForFunction(() => window.__director().phase === "idle", null, { timeout: 60000, polling: 50 });
    d = await r.page.evaluate(() => window.__director()); expect(d.cuts === 2 && d.blends === 0, "and come home behind it: " + JSON.stringify(d)); saw++;
    expect(r.errors.length === 0, r.errors.join("\n")); await r.close();
  } },
  // A phone's screen going dark in the middle of the close (#169): the passage asks the screen to stay awake (Screen
  // Wake Lock, recorded by a stub), keeps no time while the page is hidden, does not take the tap that brings the page
  // back for a skip, and lets the screen go when it is over. `document.hidden` is stood in for here; the page is not
  // really hidden, but every reader of it is.
  screen: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=0,30,0,-0.05&view=third" + BARE, { init: () => {
      window.__wake = [];
      Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async (type) => { window.__wake.push("request:" + type); return { release: async () => { window.__wake.push("release"); }, addEventListener() {} }; } } });
      let hidden = false;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
      window.__setHidden = (v) => { hidden = v; document.dispatchEvent(new Event("visibilitychange")); };
    } });
    const R = () => t.page.evaluate(() => window.__rites()), wake = () => t.page.evaluate(() => window.__wake.slice());
    await t.page.evaluate(() => { void window.__ending(); });   // it is a promise; do not wait for the whole close here
    await t.until(async () => (await R()).closing === true, 60000, "the close never began");
    await t.until(async () => (await wake()).includes("request:screen"), 30000, "the close did not ask the screen to stay awake");
    // The page is hidden and the close's place read in one breath: a round trip between the two (tens of milliseconds, more on a slow machine) is time the close rightly kept.
    const u0 = await t.page.evaluate(() => { window.__setHidden(true); return window.__rites().close.u; }); await t.page.waitForTimeout(700);
    const u1 = (await R()).close.u;
    expect(u1 - u0 < 0.03, "the close kept time behind a dark screen: " + JSON.stringify([u0, u1]));
    await t.page.evaluate(() => { window.__setHidden(false); document.getElementById("ending").click(); });   // the wake tap, at once
    expect((await R()).closing === true, "the tap that brought the page back skipped the close");
    await t.page.waitForTimeout(1000);
    await t.page.evaluate(() => document.getElementById("ending").click());
    await t.until(async () => (await R()).ended >= 1, 30000, "a later tap did not pass over the close");
    await t.until(async () => (await wake()).includes("release"), 15000, "the wake lock was not let go after the close");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The opening after 入山 (src/opening.js, issue #110): a first visitor sees the summit and is brought down the mountain
  // to him before the walk is theirs; nothing lies over the picture meanwhile; the bell sounds at the click and the music
  // waits; the first line about walking comes only after; at the gate the prologue's title rises and leaves, once. A
  // returning visitor steps straight in; a click brings the eye down at once, never cut; with reduced motion only the
  // ink; with 自动镜头 off no opening, only the bell. Waits on the page's own state, never on seconds.
  opening: { tier: 2, async run(b, base) {
    const vp = { viewport: { width: 960, height: 540 } }, O = (t) => t.page.evaluate(() => window.__opening());
    const reach = (t, what, fn, arg, ms = 120000) => t.page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).catch(async () => { throw new Error(what + " | " + JSON.stringify(await O(t))); });
    const stepIn = async (t) => { await t.page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 120000 }); await t.page.click("#enterBtn"); };
    // A first visit.
    const t = await open(b, base, "q=low" + BARE, { enter: false, ...vp });
    await stepIn(t); let o = await O(t);
    expect(o.active && o.mode === "fly", "a first visitor should be shown the opening: " + JSON.stringify(o));
    expect(o.cues.mountainBell === 1 && o.cues.musicHeld, "the bell should sound at the click, and the music wait: " + JSON.stringify(o.cues));
    expect(await t.page.evaluate(() => document.body.classList.contains("opening") && getComputedStyle(document.getElementById("bookBtn")).opacity === "0" && getComputedStyle(document.getElementById("goal")).opacity === "0" && getComputedStyle(document.querySelector(".rail")).opacity === "0"), "nothing but the picture while the opening plays");
    await reach(t, "the eye never started down the mountain", () => window.__opening().phase === "fly" && window.__opening().s > 1);
    o = await O(t); expect(o.hint === null && !(await t.page.evaluate(() => document.getElementById("hint").classList.contains("on"))), "how to walk should not be said before the walk is his: " + JSON.stringify(o));
    expect(o.waited >= 1500, "the eye should wait on the first picture before moving: " + o.waited);
    const start = await t.state();
    await reach(t, "the opening never handed the walk back", () => window.__opening().phase === "done", null, 180000);
    o = await O(t); expect(!o.skipped && o.cuts === 0 && !o.cues.musicHeld, "it should end of itself, uncut, and let the music go: " + JSON.stringify(o));
    await reach(t, "how to walk was never said after the opening", () => window.__hud().tip === "walk");
    expect(!(await t.page.evaluate(() => document.body.classList.contains("opening"))), "what lies over the picture should come back");
    expect((await t.page.evaluate(() => window.__music())).started, "the music should begin once the walk is his");
    let st = await t.state(); expect(Math.hypot(st.x - start.x, st.z - start.z) < 0.01, "he should not have moved during the opening");
    // The prologue's title: not walking there backwards; then once, round the screen wall, the gate before him; not again.
    const gateYaw = (x, z) => Math.atan2(-x, z - 40);
    await t.page.evaluate(([y]) => window.__pose(6.6, 53.4, y, 0.05), [gateYaw(6.6, 53.4) + Math.PI]); await t.frames(6);
    expect((await t.page.evaluate(() => window.__prologue())).shown === 0, "the title rose for a visitor facing away from the gate");
    await t.page.evaluate(([y]) => window.__pose(8.5, 58, y, 0.05), [-0.3]); await t.frames(3);
    expect((await t.page.evaluate(() => window.__prologue())).shown === 0, "the title rose before the screen wall");
    await t.page.keyboard.down("w"); await reach(t, "the title never rose at the gate", () => window.__prologue().on, null, 90000); await t.page.keyboard.up("w");
    let P = await t.page.evaluate(() => window.__prologue()); expect(P.shown === 1 && /序章/.test(P.text) && /云径禅寺/.test(P.text), "the title should say 序章 云径禅寺: " + JSON.stringify(P));
    { const cu = await t.page.evaluate(() => window.__cues()), mu = await t.page.evaluate(() => window.__music());
      expect(cu.prologue === 1, "the title should sound once: " + JSON.stringify(cu));
      // With the music playing, the title's note is the first note of the gate's first phrase, begun with it.
      expect(mu.started && mu.state === "running" && cu.titled === 1 && mu.section === "gate", "the gate's first phrase should begin with the title: " + JSON.stringify({ cu, section: mu.section })); }
    await reach(t, "the title never left", () => !window.__prologue().on && document.getElementById("prologue").hidden, null, 60000);
    await t.page.evaluate(([y]) => window.__pose(8.5, 58, y, 0.05), [-0.3]); await t.frames(3); await t.page.keyboard.down("w");
    await t.until(async () => (await t.state()).z < 52, 60000, "he never came round the wall again"); await t.page.keyboard.up("w");
    expect((await t.page.evaluate(() => window.__prologue())).shown === 1, "the title should rise once in a pilgrimage");
    // Coming back: 接着走, no opening, no bell, no title.
    await t.page.waitForTimeout(2600); await t.page.reload({ waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    expect((await t.page.textContent("#enterBtn")) === "接着走", "a returning visitor should be offered to go on");
    await stepIn(t); await t.frames(3); o = await O(t);
    expect(!o.active && o.phase === "idle" && o.cues.mountainBell === 0, "a returning visitor should step straight in: " + JSON.stringify(o));
    expect((await t.page.evaluate(() => window.__prologue())).titled, "the title is kept for the pilgrimage");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    // A click brings it down at once: the rest of the same way, never cut; the click walks nobody anywhere.
    const k = await open(b, base, "q=low" + BARE, { enter: false, ...vp });
    await stepIn(k); await reach(k, "the eye never started down", () => window.__opening().phase === "fly" && window.__opening().s > 1);
    const before = await k.state(); await k.page.mouse.click(480, 300);
    await reach(k, "a click did not bring the eye down", () => window.__opening().phase === "done", null, 60000);
    o = await O(k); expect(o.skipped && o.cuts === 0, "skipped, and not cut: " + JSON.stringify(o));
    st = await k.state(); expect(Math.hypot(st.x - before.x, st.z - before.z) < 0.01 && !st.target, "the click that skipped should not walk him: " + JSON.stringify(st));
    await reach(k, "how to walk was never said after a skip", () => window.__hud().tip === "walk");
    expect(k.errors.length === 0, k.errors.join("\n")); await k.close();
    // Reduced motion: the summit held, then only the ink, the bell as ever.
    const r = await open(b, base, "q=low" + BARE, { enter: false, ...vp, reducedMotion: "reduce" });
    await stepIn(r); o = await O(r); expect(o.mode === "ink" && o.cues.mountainBell === 1, "with reduced motion: the ink, and the bell: " + JSON.stringify(o));
    await reach(r, "the ink never closed and opened", () => window.__opening().phase === "done", null, 120000);
    o = await O(r); expect(o.cuts === 1, "one cut behind the ink: " + JSON.stringify(o));
    expect(r.errors.length === 0, r.errors.join("\n")); await r.close();
    // 自动镜头 off: no opening, from behind him at once; the bell still sounds.
    const a = await open(b, base, "q=low" + BARE, { enter: false, ...vp });
    await a.page.evaluate(() => { localStorage.setItem("yunjing.settings.v1", JSON.stringify({ autocam: false })); }); await a.page.reload({ waitUntil: "commit" }); await a.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    await stepIn(a); await a.frames(3); o = await O(a);
    expect(!o.active && o.phase === "idle" && o.cues.mountainBell === 1, "with 自动镜头 off, no opening, but the bell: " + JSON.stringify(o));
    await reach(a, "how to walk was never said", () => window.__hud().tip === "walk");
    expect(a.errors.length === 0, a.errors.join("\n")); await a.close();
  } },
  // Round the hall, up both terraces and the stair between the tea rows, to the porch of the summit pavilion.
  summit: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=19.5,0,0,0" + BARE);
    await t.page.evaluate(() => window.__walk([[19.5, -28], [0, -28], [0, -36], [13.6, -36], [13.6, -60], [0, -61], [0, -69.2], [-13, -69.2], [-13, -89], [0, -89.5], [0, -120], [0, -123]]));
    await t.until(async () => (await t.state()).h > 20.8, 300000, "never reached the summit porch");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A tap on the bell reaches it; the bell and drum sound with the partials they were built from.
  sound: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&show=court" + BARE);
    await t.page.evaluate(() => window.__strike("bell")); await t.page.waitForTimeout(700);
    const bell = await t.page.evaluate(() => window.__listen("effects"));   // the effects bus alone: the music shares the bell's G
    expect(bell.state === "running" && bell.rms > 0.003, "the bell made no sound: " + JSON.stringify(bell));
    expect(bell.peaks.some(([hz]) => Math.abs(hz - 98) < 8 || Math.abs(hz - 196) < 8), "the bell's fundamental is missing: " + JSON.stringify(bell.peaks));
    const drum = await t.page.evaluate(() => { window.__strike("drum"); const t0 = performance.now(); while (performance.now() - t0 < 150); return window.__listen("effects"); }); expect(drum.peaks.some(([hz]) => hz < 120), "the drum has no low end: " + JSON.stringify(drum.peaks));
    // A great bell is long: eight seconds after the stroke its hum and fundamental are still there.
    await t.page.waitForTimeout(7000);
    const late = await t.page.evaluate(() => window.__listen("effects"));
    expect(late.rms > 0.004 && late.peaks.some(([hz]) => Math.abs(hz - 49) < 6 || Math.abs(hz - 98) < 6), "the bell had died away within eight seconds: " + JSON.stringify(late));
    // Struck over and over, the bell keeps no more than three strokes ringing: the oldest fades as a new one comes.
    for (let i = 0; i < 6; i++) { await t.page.evaluate(() => window.__strike("bell")); await t.page.waitForTimeout(300); }
    const bells = await t.page.evaluate(() => window.__bells());
    expect(bells.ringing <= 3 && bells.struck >= 7, "six strokes in a row should leave at most three ringing: " + JSON.stringify(bells));
    // The dragon well: silent from the court; standing at it, a drop is heard and rings go out across the water.
    expect((await t.page.evaluate(() => window.__well())).level === 0, "the well is heard from the court");
    const pool = await t.page.evaluate(() => window.__places.well.pool);
    await t.page.evaluate(([x, , z]) => window.__pose(x, z + 2.6, 0, -0.35), pool);   // the pool is [x, y, z]
    await t.frames(3);
    const w = await t.page.evaluate(() => window.__well(true)); expect(w.level > 0.5, "standing at the well it is not heard: " + JSON.stringify(w));
    await t.frames(3); expect((await t.page.evaluate(() => window.__well())).rings > 0, "the drop sent no ring across the water");
    // Two culms knocking in the bamboo: the sound is made and counted on the place's bus.
    // (Played and listened to within one call, as the steps are: the place's bus carries nothing else here.)
    const k = await t.page.evaluate(() => { const r = window.__knock(true), t0 = performance.now(); while (performance.now() - t0 < 60); return { ...r, heard: window.__listen("ambience") }; });
    expect(k.knocks >= 1 && k.heard.rms > 0.0005, "the culms made no knock: " + JSON.stringify(k));
    // The wind heard keeps the picture's clock (#267): the ambience's last gust was taken at the page's time, not at a
    // count of its own begun at the first touch (it ticks four times a second, so within a second of now).
    { await t.page.evaluate(() => window.__music(true)); await t.page.waitForTimeout(800);   // the place heard: its ticks run on the audio's own timer
      const a = await t.page.evaluate(() => ({ ...window.__knock(), now: performance.now() / 1000 }));
      expect(a.gustT !== null && Math.abs(a.now - a.gustT) < 1.0, "the wind heard is not on the picture's clock: " + JSON.stringify(a)); }
    // The third stroke of the bell, the first time: the birds in the old trees by the tower go up, with a rattle of wings.
    await t.page.evaluate(() => { for (let i = 0; i < 3; i++) window.dispatchEvent(new CustomEvent("struck", { detail: "bell" })); });
    await t.frames(3);
    const fl = await t.page.evaluate(() => ({ ...window.__flock(), ...window.__cues() }));
    expect(fl.flights === 1 && fl.flying && fl.flutter >= 1, "the third stroke should send the birds up: " + JSON.stringify(fl));
    const bd = await t.page.evaluate(() => { const r = window.__bird(true), t0 = performance.now(); while (performance.now() - t0 < 140); return { ...r, heard: window.__listen("ambience") }; });
    expect(bd.birds >= 1 && bd.heard.rms > 0.0003, "no bird sang: " + JSON.stringify(bd));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The music: it begins with the first sound, follows him from place to place once he has settled, ignores pacing
  // along a boundary, steps back for the bell, answers its own slider, goes indoors with him, and is only ever one.
  music: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,29,0,0&view=first" + BARE);
    const m = () => t.page.evaluate(() => window.__music());
    expect(!(await m()).started, "the music should wait for the visitor's first touch");
    await t.page.evaluate(() => window.__music(true));
    await t.until(async () => { const s = await m(); return s.state === "running" && s.phrases >= 1 && s.sounding > 0; }, 30000, "the music never began");
    let s = await m(); expect(s.zone === "court" && s.section === "court" && s.players === 1, "the first court should be heard as the court: " + JSON.stringify(s));
    // A step over the line into the gate and straight back, timed on the audio clock (a slow page may hold a pose
    // longer than meant; only a step back within the two seconds is judged): the music stays where it was.
    const away = await t.page.evaluate(() => new Promise((done) => { const c0 = window.__music().clock; window.__pose(0, 41, 0, 0); setTimeout(() => { window.__pose(0, 39, 0, 0); done(window.__music().clock - c0); }, 300); }));
    await t.page.waitForTimeout(2500); s = await m();
    if (away < 1.5) expect(s.zone === "court", `a step over a boundary and back (${away.toFixed(2)} s) should not change the music: ` + JSON.stringify(s));
    else console.log(`     (music: the step back took ${away.toFixed(2)} s of audio time on this machine; the boundary check was skipped)`);
    // Down to the bamboo: once settled there, the bamboo's music follows.
    await t.page.evaluate(() => window.__pose(21.3, 91.5, 0, 0.3));   // the arrival view, at the foot of the path
    await t.until(async () => (await m()).zone === "grove", 15000, "standing in the bamboo was never heard as the bamboo");
    await t.until(async () => (await m()).section === "grove", 60000, "the bamboo's music never began");
    // The bell: the music steps back, then returns of itself.
    await t.page.evaluate(() => window.__strike("bell")); await t.page.waitForTimeout(800);
    s = await m(); expect(s.ducked && s.duck < 0.5, "the music should step back for the bell: " + JSON.stringify(s));
    await t.until(async () => (await m()).duck > 0.9, 30000, "the music never came back after the bell");
    // Its own level, apart from everything else.
    // The three levels under the whole volume are folded until asked for (分开调).
    await t.page.keyboard.press("Escape"); await t.until(() => t.page.isVisible("#setVolume"), 10000, "the menu has no volume");
    expect(!(await t.page.isVisible("#setMusic")), "the music's own level should be folded until asked for");
    await t.page.click("#menuMix"); await t.until(() => t.page.isVisible("#setMusic"), 10000, "分开调 did not open the music level");
    await t.page.evaluate(() => { const el = document.getElementById("setMusic"); el.value = "0"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await t.page.waitForTimeout(600); s = await m(); expect(s.levels.music === 0 && s.level < 0.05, "the music slider should silence the music: " + JSON.stringify(s));
    // Struck and listened to within one call: a busy page can let the drum die between two calls.
    const drum = await t.page.evaluate(() => { window.__strike("drum"); const t0 = performance.now(); while (performance.now() - t0 < 150); return window.__listen("effects"); });
    expect(drum.rms > 0.003, "with the music silenced the drum should still be heard: " + JSON.stringify(drum));
    expect((await t.page.evaluate(() => window.__settings())).music === 0, "the music level was not kept");
    await t.page.evaluate(() => { const el = document.getElementById("setMusic"); el.value = "0.7"; el.dispatchEvent(new Event("input", { bubbles: true })); }); await t.page.keyboard.press("Escape");
    // Sitting on after tea hushes the music; standing brings it back. Either holds even when it falls inside the music's
    // stepping back for a stroke (the drum here, the seal's chime at the tea table): the audio clock, so seconds.
    await t.page.evaluate(() => { window.__strike("drum"); window.__hush(true); }); await t.page.waitForTimeout(9000);
    s = await m(); expect(s.hushed && s.duck < 0.45, "sitting down inside a stroke's ducking should leave the music hushed: " + JSON.stringify(s));
    await t.page.evaluate(() => { window.__strike("drum"); window.__hush(false); }); await t.page.waitForTimeout(9000);
    s = await m(); expect(!s.hushed && s.duck > 0.9, "standing up inside a stroke's ducking should bring the music back: " + JSON.stringify(s));
    // Into a hall and out: the hall's reverb and music, and still one player however often sound is asked for.
    await t.page.evaluate(() => window.__inside("main"));
    await t.until(async () => { const x = await m(); return x.zone === "hall" && x.room === "hall"; }, 30000, "inside the hall was never heard as the hall");
    await t.page.evaluate(() => window.__inside(null)); await t.page.evaluate(() => window.__music(true)); await t.page.evaluate(() => window.__music(true));
    await t.until(async () => (await m()).room === "court", 30000, "coming out did not bring the court's reverb back");
    s = await m(); expect(s.players === 1 && s.starts >= 3, "asking for sound again must not start a second player: " + JSON.stringify(s));
    // In the background the sound stops, and nothing piles up: on return it picks up where it was.
    const hide = (h) => t.page.evaluate((x) => { Object.defineProperty(document, "hidden", { configurable: true, get: () => x }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (x ? "hidden" : "visible") }); document.dispatchEvent(new Event("visibilitychange")); }, h);
    await hide(true); await t.until(async () => (await m()).state === "suspended", 10000, "the sound went on in the background");
    const c0 = (await m()).clock; await t.page.waitForTimeout(1500); expect(Math.abs((await m()).clock - c0) < 0.05, "the audio clock should stand still in the background");
    await hide(false); await t.until(async () => (await m()).state === "running", 10000, "the sound did not come back with the page");
    expect((await m()).players === 1, "coming back must not start a second player");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Every season at every hour draws, and they look as different as they should.
  // Under the eaves of the main hall, the gate, the library and the Guanyin hall, looking up at the bracket sets over
  // the front columns on a summer day (issue #212): the sets must read as timber against the limed band between them,
  // not as black cut-outs. What is timber and what is the band is asked of the picture itself (`__pick` on a grid);
  // the brightness compared is luminance in linear light, as the eye adds it up, and the sets must have at least
  // 18% of the band's.
  eaves: { tier: 2, async run(b, base) {
    const W = 960, H = 540, t = await open(b, base, "q=low&shot=1&view=third&season=summer&time=day&cam=0,-1,0,0.1", { viewport: { width: W, height: H } });
    // [x, where the eye stands, where the front columns' heads are, how high it looks over the ground it stands on]
    const views = { main: [0, -1.0, -6.3, 5.6], gate: [0, 47.5, 43.0, 4.6], library: [0, -40.6, -44.8, 5.9], guanyin: [0, -70.9, -75.1, 5.0] };
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }, Y = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const seen = {};
    for (const [name, v] of Object.entries(views)) {
      await t.page.evaluate((v) => { window.__pose(v[0], v[1], 0, 0.1); const g = window.__yard().h; window.__look([v[0], g + 2.2, v[1]], [v[0], g + v[3], v[2]]); }, v); await t.frames(3);
      // Every 10 px (#274): at every 20 px which points fell on a bracket set and which on the band moved with a centimetre of
      // the eye's height, enough to swing the ratio by three points (the baked floor is the drawn paving, 1.2 cm over the stone).
      const grid = await t.page.evaluate(([W, H]) => { const r = []; for (let y = 5; y < H * 0.62; y += 10) for (let x = 5; x < W; x += 10) { const h = window.__pick(x, y, 1)[0]; if (h) r.push([x, y, h.material, h.at[1]]); } return r; }, [W, H]);
      const band = grid.filter((g) => g[2] === "plaster"), ys = band.map((g) => g[3]).sort((a, b) => a - b);
      expect(band.length > 20, `${name}: the limed band under the eave is not in view (${band.length} samples)`);
      const lo = ys[Math.floor(ys.length * 0.05)], hi = ys[Math.floor(ys.length * 0.95)], r0 = Math.min(...band.map((g) => g[1])), r1 = Math.max(...band.map((g) => g[1]));
      const inBand = band.filter((g) => g[3] >= lo && g[3] <= hi), wood = grid.filter((g) => /^wood[XYZV]$/.test(g[2]) && g[1] >= r0 && g[1] <= r1 && g[3] >= lo && g[3] <= hi + 0.25);
      expect(wood.length > 20, `${name}: no bracket sets in view (${wood.length} samples)`);
      const p = await t.page.evaluate((pts) => window.__probe(pts), [...wood, ...inBand].map((g) => [g[0], g[1]]));
      const mean = (a) => a.reduce((s, c) => s + Y(c), 0) / a.length, w = mean(p.at.slice(0, wood.length)), bd = mean(p.at.slice(wood.length));
      seen[name] = { wood: +w.toFixed(4), band: +bd.toFixed(4), ratio: +(w / bd).toFixed(3) };
    }
    console.log("    eaves:", JSON.stringify(seen));
    for (const [name, s] of Object.entries(seen)) expect(s.ratio >= 0.18, `${name}: under the eave the bracket sets are a black cut-out: ${(s.ratio * 100).toFixed(1)}% of the band's light (want 18%)`);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  moods: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&shot=1&view=first&show=court"), seen = {};
    for (const s of ["spring", "summer", "autumn", "winter"]) for (const h of ["dawn", "day", "dusk", "night"]) {
      await t.page.evaluate(([a, c]) => window.__mood(a, c), [s, h]); await t.page.waitForTimeout(300);
      const p = await t.probe(); seen[s + "-" + h] = p;
      expect(p.season === s && p.time === h, `asked for ${s} ${h}, got ${p.season} ${p.time}`);
      expect(p.lum > 6 && p.lum < 240, `${s} ${h}: the picture is blank (${p.lum.toFixed(1)})`);
      expect((await t.page.textContent("#moodTag")).length >= 5, "the season is not named on screen");
    }
    for (const s of ["spring", "summer", "autumn", "winter"]) {
      expect(seen[s + "-day"].lum > seen[s + "-night"].lum * 1.6, `${s}: day should be much brighter than night (${seen[s + "-day"].lum.toFixed(0)} vs ${seen[s + "-night"].lum.toFixed(0)})`);
      expect(seen[s + "-night"].b > seen[s + "-night"].r, `${s}: night should be blue`);
      expect(seen[s + "-dusk"].r > seen[s + "-dusk"].b, `${s}: dusk should be warm`);
      expect(seen[s + "-night"].lamp > 0 && seen[s + "-day"].lamp === 0, `${s}: lamps`);
    }
    expect(seen["winter-day"].snow === 1 && seen["summer-day"].snow === 0, "snow belongs to winter");
    expect(seen["winter-day"].lum > seen["summer-day"].lum, "snow should brighten the court");
    // The controls on screen do the same thing.
    await t.page.evaluate(() => document.body.classList.remove("bare"));
    await t.page.evaluate(() => document.body.classList.add("seasons"));   // as once the book has been filled (the seasons scenario does it for real)
    await t.page.keyboard.press("t"); expect(await t.page.isVisible("#moodPanel"), "the season panel did not open");
    await t.page.click('#moodPanel [data-season="autumn"]'); await t.page.click('#moodPanel [data-time="dusk"]');
    const p = await t.probe(); expect(p.season === "autumn" && p.time === "dusk", "the panel's buttons did not change the season");
    expect((await t.page.getAttribute('#moodPanel [data-season="autumn"]', "aria-pressed")) === "true", "the chosen season is not marked");
    await t.shot("e2e-autumn-dusk");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A pull request's preview opens with the debug panel showing, and ?debug=0 keeps it shut. The preview's own name
  // (<deployment>-temple-walk-preview.<account>.workers.dev) is pointed at the test server for the browser alone.
  // The workbench on a preview: ?seals= is a book for this visit only, ?at= stands him at a place, ?play=ending plays the
  // close there. The published page (here, the plain test host) ignores them all and keeps the visitor's own book.
  // The censer before the great hall (#217): at night the ends of the incense glow in the mouth and light it, and the
  // body round it stays dark; by day the smoke rises and leans with the breeze that carries the falling things; in snow the
  // cap is white and the warm lip is not; more incense burns at dawn than at dusk.
  censer: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&shot=1&view=first&cam=0,20,0,0&season=summer&time=night");
    const look = () => t.page.evaluate(() => { window.__look([0.05, 1.95, 14.6], [0, 1.35, 13]); });
    await look(); await t.frames(3);
    const night = await t.page.evaluate(() => window.__censer([[0, 1.49, 0.05], [0, 0.86, 0.565], [0.3, 0.8, 0.48]]));
    expect(night.ember === 1 && night.incense < 0.2, `night: the incense should be a few glowing ends (${JSON.stringify(night)})`);
    expect(night.lum[0] > Math.max(night.lum[1], night.lum[2]) * 1.5, `night: the mouth should be brighter than the body round it (${night.lum.map((v) => v?.toFixed(1))})`);
    await t.page.evaluate(() => window.__mood("autumn", "dawn")); await t.frames(2);
    const dawn = await t.page.evaluate(() => window.__censer());
    await t.page.evaluate(() => window.__mood("autumn", "dusk")); await t.frames(2);
    const dusk = await t.page.evaluate(() => window.__censer());
    expect(dawn.incense > dusk.incense && dawn.smoke.opacity > dusk.smoke.opacity, "more incense and smoke at dawn than at dusk");
    expect(dusk.leaves === 1 && dusk.petals === 0, "autumn lays its leaves on the censer");
    const [wx, wz] = dusk.wind; expect(Math.hypot(wx, wz) > 0.05, `the breeze should blow (${dusk.wind})`);
    await t.page.evaluate(() => window.__mood("winter", "day")); await look(); await t.frames(3);
    const snow = await t.page.evaluate(() => window.__censer([[0, 1.935, 0.49], [0, 1.465, 0.452], [0, 1.4, 0.416]]));
    expect(snow.lum[0] > snow.lum[1] * 1.4 && snow.lum[0] > snow.lum[2] * 1.4, `winter: snow on the eave, none on the warm lip (${snow.lum.map((v) => v?.toFixed(1))})`);
    await t.shot("e2e-censer-winter");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  bench: { tier: 2, async run(b, base) {
    const { chromium } = require("playwright"), port = new URL(base).port, host = `http://pr-1-temple-walk-preview.test:${port}/`;
    const pb = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", `--host-resolver-rules=MAP pr-1-temple-walk-preview.test 127.0.0.1`] });
    try {
      let t = await open(pb, host, "q=low&fast=1&debug=0&seals=all&at=tea" + BARE, { enter: false });
      await t.until(async () => (await t.journey()).near === "tea", 120000, "?at=tea did not stand him at the tea table");
      let j = await t.journey(); expect(j.count === 7 && j.entered, "?seals=all should give a full book and step in: " + JSON.stringify({ count: j.count, entered: j.entered }));
      expect(!(await t.page.evaluate(() => localStorage.getItem("yunjing.journey.v1"))), "?seals= must not write the visitor's own book");
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
      t = await open(pb, host, "q=low&fast=1&debug=0&seals=bell&play=ending" + BARE, { enter: false });
      await t.until(async () => (await t.page.evaluate(() => window.__rites().closing || window.__rites().ended > 0)), 120000, "?play=ending did not play the close");
      expect((await t.journey()).count === 1, "the close should play over the book that was asked for");
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    } finally { await pb.close(); }
    const t = await open(b, base, "q=low&fast=1&seals=all&at=tea&cam=0,30,0,0" + BARE);
    await t.frames(6); const j = await t.journey();
    expect(j.count === 0 && j.near !== "tea", "the published page should ignore ?seals= and ?at=: " + JSON.stringify({ count: j.count, near: j.near }));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  "preview-debug": { tier: 2, async run(b, base) {
    const { chromium } = require("playwright"), port = new URL(base).port, host = `http://pr-1-temple-walk-preview.test:${port}/`;
    const pb = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", `--host-resolver-rules=MAP pr-1-temple-walk-preview.test 127.0.0.1`] });
    try {
      let t = await open(pb, host, "q=low&cam=0,30,0,0" + BARE);
      await t.until(() => t.page.evaluate(() => !!document.querySelector(".lil-gui")), 60000, "the preview did not open the debug panel");
      // What stops him, drawn (#274): nothing of it exists until the switch is on; on, the floor's cells round him, his outline and the ball round his eye; off, nothing is left.
      const before = await t.page.evaluate(async () => ({ viz: await window.__walkviz(), calls: window.__yard().calls }));
      expect(before.viz.on === false && before.viz.objects === 0, "the collision drawing should not exist before it is switched on: " + JSON.stringify(before.viz));
      const on = await t.page.evaluate(() => window.__walkviz(true)); await t.frames(3);
      const drawn = await t.page.evaluate(() => window.__walkviz());
      expect(on.on && drawn.grid === "outdoors" && drawn.open > 5000 && drawn.shut > 0 && drawn.outline && drawn.eyeR > 0.2 && drawn.objects === 3, "switched on, it should draw the cells round him, his outline and his eye: " + JSON.stringify(drawn));
      const off = await t.page.evaluate(() => window.__walkviz(false)); await t.frames(2);
      expect(off.on === false && off.objects === 0 && off.inScene === false && before.viz.inScene === false, "switched off, nothing of it should be left in the scene: " + JSON.stringify(off));
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
      t = await open(b, base, "q=low&cam=0,30,0,0" + BARE); await t.frames(2);
      expect(await t.page.evaluate(() => typeof window.__walkviz === "undefined"), "the published site should not carry the collision drawing's switch");
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
      t = await open(pb, host, "q=low&cam=0,30,0,0&debug=0" + BARE); await t.frames(6);
      expect(!(await t.page.evaluate(() => !!document.querySelector(".lil-gui"))), "?debug=0 should keep the panel shut on a preview");
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    } finally { await pb.close(); }
  } },
  // From behind him and through his eyes.
  views: { tier: 2, async run(b, base) {
    // `devpose` and `debug` are working aids (src/devpose.js, src/debug.js): the published site must neither show them
    // nor touch the address (the panel opens only on the dev server and a pull request's preview).
    // `body=sculpt` asks for the sculpted body, which the page no longer wears unasked: this is where it is seen to arrive.
    const t = await open(b, base, "q=low&shot=1&cam=0,24,0,-0.05&view=third&devpose&debug&body=sculpt");
    await t.until(async () => (await t.state()).dressed === true, 90000, "the sculpted body never arrived on the novice (app/shared/models/novice.glb)");   // fetched after the first frames; a missing or ill-fitting file leaves him as built in code, and this fails
    let p = await t.probe(); expect(p.view === "third" && p.monk && p.camDist > 2.5, "third person: the eye should stand behind him: " + JSON.stringify(p));
    await t.page.evaluate(() => document.body.classList.remove("bare"));
    await t.page.keyboard.press("v"); await t.page.waitForTimeout(600);
    p = await t.probe(); expect(p.view === "first" && !p.monk && p.monkBox === null && p.camDist < 0.8, "first person: the eye should be his own: " + JSON.stringify(p));
    await t.page.keyboard.press("v"); await t.page.waitForTimeout(1500);
    p = await t.probe(); expect(p.view === "third" && p.monk, "back to third person");
    // Without a button: drawing the eye all the way in to him, and on, puts it behind his eyes; drawing it out stands it behind him again.
    await t.page.mouse.move(400, 300); for (let i = 0; i < 6; i++) { await t.page.mouse.wheel(0, -300); await t.frames(1); }
    expect((await t.probe()).view === "third", "a few notches in should only bring the eye nearer");
    for (let i = 0; i < 16; i++) { await t.page.mouse.wheel(0, -300); await t.frames(1); }
    expect((await t.probe()).view === "first", "pushing on past the nearest should give him his own eyes");
    for (let i = 0; i < 6; i++) { await t.page.mouse.wheel(0, 300); await t.frames(1); }
    p = await t.probe(); expect(p.view === "third" && p.monk, "drawing out of his eyes should stand the eye behind him again");
    for (let i = 0; i < 7; i++) { await t.page.mouse.wheel(0, 300); await t.frames(1); }   // and back out to about where the eye usually stands (6.2 m)
    // With his back to the court's east wall, the eye comes in close rather than passing through it.
    await t.page.evaluate(() => window.__pose(20.5, 30, -Math.PI / 2, -0.05)); await t.frames(3);
    p = await t.probe(); expect(p.camDist < 1.6, "the eye went through the court wall: " + p.camDist);
    expect(await t.page.evaluate(() => location.search === "?q=low&shot=1&cam=0,24,0,-0.05&view=third&devpose&debug&body=sculpt" && window.__devpose === undefined && window.__debug === undefined && !document.getElementById("debug") && !document.querySelector(".lil-gui")), "the published page should leave ?devpose and ?debug alone");
    // Under the gate, where there is room behind him, it stays back.
    await t.page.evaluate(() => window.__pose(0, 33, 0, -0.05)); await t.frames(14);
    p = await t.probe(); expect(p.camDist > 3.5, "the eye should fall back again in the open: " + p.camDist);
    // The console's link to this view (`__debugURL`, src/link.js): the published page hands out an address that opens on
    // the same place, look and mood. It carries `devpose`, inert here and followed by a dev server.
    const link = await t.page.evaluate(() => window.__debugURL());
    expect(typeof link === "string" && /[?&]cam=0,33,0,-0\.05(&|$)/.test(link) && !/[?&]shot=/.test(link) && /[?&]devpose(&|$)/.test(link), "the console's link is not the address of this view: " + link);
    const search = new URL(link).search.slice(1), before = await t.state();
    const u = await open(b, base, search, { enter: false });
    const after = await u.state();
    expect(after.x === before.x && after.z === before.z && Math.abs(after.yaw - before.yaw) < 1e-3 && Math.abs(after.pitch - before.pitch) < 1e-3
      && after.view === before.view && after.season === before.season && after.time === before.time,
      "the console's link does not open where he stood: " + JSON.stringify({ before, after }));
    expect(await u.page.evaluate(() => location.search) === "?" + search, "the published page should not write the console's devpose into the address");
    expect(u.errors.length === 0, u.errors.join("\n")); await u.close();
    // A right-click is the browser's own menu, except in the middle of a look-drag, where it can only interrupt: the
    // canvas takes it just then, and gives it back when the drag is let go.
    const menu = () => t.page.evaluate(() => { const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); document.getElementById("yardGl").dispatchEvent(e); return e.defaultPrevented; });
    expect((await menu()) === false, "a right-click with no drag should be the browser's own menu");
    await t.page.mouse.move(210, 400); await t.page.mouse.down(); await t.page.mouse.move(280, 400, { steps: 6 });
    expect((await menu()) === true, "a right-click in the middle of a look-drag should not open the browser's menu");
    await t.page.mouse.up();
    expect((await menu()) === false, "after the drag is let go, the browser's menu should be back");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A quiet photo interface on desktop and touch: settings stay out of the scenery until requested.
  "photo-ui": { tier: 2, async run(b, base) {
    for (const touch of [false, true]) {
      const t = await open(b, base, "q=low&cam=0,24,0.35,-0.06&view=third", { viewport: touch ? { width: 390, height: 844 } : { width: 960, height: 600 }, hasTouch: touch, isMobile: touch });
      await t.page.waitForSelector("#photoBtn", { timeout: 120000 }); await t.frames(12);   // let the eye behind him come to rest
      const before = await t.probe(), was = await t.state();
      await t.page.click("#photoBtn", { timeout: 120000 }); await t.frames(2);
      // The camera is raised on exactly what he was looking at: the same eye, angle and distance, the whole view, the novice where he stood.
      let p = await t.probe(), now = await t.state(); expect(p.photo && p.aspect === "screen" && p.zoom === 1 && Math.abs(p.fov - before.fov) < 0.01 && p.monk === before.monk, "the camera should open on the view as it was: " + JSON.stringify([before.fov, p.fov, p.aspect, p.zoom, before.monk, p.monk]));
      expect(Math.abs(now.yaw - was.yaw) < 1e-3 && Math.abs(now.pitch - was.pitch) < 1e-3 && Math.abs(p.camDist - before.camDist) < 0.05, "raising the camera moved the view: " + JSON.stringify([was.yaw, now.yaw, was.pitch, now.pitch, before.camDist, p.camDist]));
      // The viewfinder over the whole view: four corners a little in from the edges, no paper laid over it.
      { const fr = await t.page.evaluate(() => { const r = document.getElementById("frame").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, whole: document.body.classList.contains("whole"), finder: getComputedStyle(document.getElementById("finder")).display, mask: getComputedStyle(document.getElementById("finder")).maskImage || getComputedStyle(document.getElementById("finder")).webkitMaskImage }; });
        expect(fr.whole && fr.finder !== "none" && fr.x > 10 && fr.y > 10 && (fr.mask === "none" || !fr.mask), "over the whole view the finder should be corners only: " + JSON.stringify(fr)); }
      if (!touch) {   // a drag does not turn the camera; the wheel draws nearer and farther, within bounds
        await t.page.mouse.move(480, 300); await t.page.mouse.down(); await t.page.mouse.move(640, 240, { steps: 6 }); await t.page.mouse.up(); await t.frames(2);
        now = await t.state(); expect(Math.abs(now.yaw - was.yaw) < 1e-3 && Math.abs(now.pitch - was.pitch) < 1e-3, "a drag turned the camera"); expect(!(await t.page.isVisible("#print")), "a drag took a photograph");
        await t.page.mouse.wheel(0, -400); await t.frames(2); p = await t.probe(); expect(p.zoom > 1 && p.fov < before.fov - 1, "the wheel did not draw the view nearer");
        // Forty turns of the wheel at once, dispatched inside the page: one at a time through the driver each waits on a
        // software-rendered frame, which cost two minutes of the scenario.
        await t.page.evaluate(() => { const c = document.getElementById("yardGl"); for (let i = 0; i < 40; i++) c.dispatchEvent(new WheelEvent("wheel", { deltaY: 400, bubbles: true, cancelable: true })); }); await t.frames(2); p = await t.probe(); expect(p.zoom >= 0.69 && p.zoom < 1 && p.fov < 100, "the wheel lets the view out without end: " + JSON.stringify([p.zoom, p.fov]));
      }
      expect(!(await t.page.isVisible("#photoSettings")) && (await t.page.getAttribute("#photoSettingsToggle", "aria-expanded")) === "false", "settings should start folded");
      expect((await t.page.locator('#photoBar button:visible').count()) === 2, "only settings and the shutter belong on the lower bar");
      for (const id of ["shutter", "photoSettingsToggle", "photoClose"]) { const r = await t.page.locator("#" + id).boundingBox(); expect(r && r.width >= 44 && r.height >= 44 && r.x >= 0 && r.y >= 0, id + " is not a reachable touch target"); }
      await t.page.click("#photoSettingsToggle");
      expect(await t.page.isVisible("#photoSettings"), "settings did not open");
      const panel = await t.page.locator("#photoSettings").boundingBox(); const size = t.page.viewportSize(); expect(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= size.width && panel.y + panel.height <= size.height, "settings leave the viewport");
      // The thirds, on at first, off when put away, and remembered.
      expect(await t.page.isVisible("#frame .third"), "the thirds should be on until put away");
      await t.page.click("#thirdsToggle"); expect(!(await t.page.isVisible("#frame .third")) && !(await t.page.evaluate(() => window.__settings().thirds)), "the thirds did not go off");
      await t.page.click("#thirdsToggle"); expect(await t.page.isVisible("#frame .third"), "the thirds did not come back on");
      await t.page.click("#monkToggle"); await t.frames(1); expect(!(await t.probe()).monk, "he could not step out of the picture");
      await t.page.click("#monkToggle"); await t.frames(1); expect((await t.probe()).monk, "he could not step back into it");
      await t.page.keyboard.press("Escape"); expect(!(await t.page.isVisible("#photoSettings")) && (await t.probe()).photo, "first Escape should close settings only");
      await t.page.keyboard.press("Escape"); expect(!(await t.probe()).photo && (await t.page.isVisible("#photoBtn")), "second Escape should return to walking");
      await t.page.click("#photoBtn"); expect(!(await t.page.isVisible("#photoSettings")), "settings should stay folded on re-entry");
      p = await t.probe(); expect(p.zoom === 1 && Math.abs(p.fov - before.fov) < 0.01, "the camera should open afresh on the view, not where the last one was left");
      await t.shot(touch ? "photo-clean-touch" : "photo-clean-desktop");
      if (!touch) {   // the left button on the picture is the shutter
        await t.page.mouse.click(480, 260); await t.until(() => t.page.isVisible("#print"), 300000, "a click on the picture did not take the photograph");
        const shot = await t.page.evaluate(() => new Promise((r) => { const im = new Image(); im.onload = () => r([im.naturalWidth, im.naturalHeight]); im.src = document.getElementById("printImg").src; }));
        expect(shot[0] >= 1600 && shot[0] > shot[1], "the photograph is not a large picture of the whole view: " + shot);
        // While the print is out the picture is held still: no frame is drawn, the still covers the view; the shutter
        // and the seal were heard. (Seconds: nothing is drawn, so there are no frames to wait on.)
        const sounds = await t.page.evaluate(() => window.__shots());
        expect(sounds.shutter >= 1 && sounds.stamp >= 1, "the shutter and the seal should sound: " + JSON.stringify(sounds));
        const f0 = (await t.state()).frames, drift0 = JSON.stringify(await t.page.evaluate(() => window.__drift(200))), lit0 = JSON.stringify(await t.page.evaluate(() => window.__litter(0, true))); await t.page.waitForTimeout(1500);
        expect(lit0 === JSON.stringify(await t.page.evaluate(() => window.__litter(0, true))), "the leaves on the ground moved while the print was out (#267)");
        // The leaves, those in the air and those lying on the ground, stand with it (#219).
        expect(drift0 === JSON.stringify(await t.page.evaluate(() => window.__drift(200))), "the falling leaves moved while the print was out");
        const held = await t.page.evaluate(() => ({ frames: window.__yard().frames, frozen: document.body.classList.contains("frozen"), still: getComputedStyle(document.getElementById("still")).display }));
        expect(held.frozen && held.still !== "none" && held.frames === f0, "the picture should stand still while the print is out: " + JSON.stringify(held) + " from " + f0);
        await t.page.click("#printBack"); await t.frames(2);
        expect(!(await t.probe()).frozen && !(await t.page.evaluate(() => document.body.classList.contains("frozen"))), "putting the print away should let the picture move again");
      }
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    }
  } },
  // Photograph mode: clear scenery, optional figure, three shapes, the mounted card, and back to walking.
  photo: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&shot=1&view=third&season=autumn&time=dusk&cam=0,24,0,-0.06");   // the low tier, for software rendering
    await t.page.evaluate(() => document.body.classList.remove("bare"));
    await t.page.click("#photoBtn", { timeout: 120000 }); await t.frames(3);
    for (const id of ["photoBar", "shutter", "photoClose"]) expect(await t.page.isVisible("#" + id), `#${id} missing in photograph mode`);
    expect(!(await t.page.isVisible("#photoBtn")), "the walking controls should leave");
    let p = await t.probe(); expect(p.photo && p.monk && p.aspect === "screen", "seen from behind him, the photograph should start as the view was, the novice in it");
    const wide = p.fov;
    await t.page.click("#photoSettingsToggle");
    await t.page.click("#monkToggle"); p = await t.probe(); expect(!p.monk, "he should be able to step out of the picture"); await t.page.click("#monkToggle");
    await t.page.click('[data-lens="3.2"]'); p = await t.probe(); expect(p.fov < wide / 2.5, "drawing in close did not narrow the view");
    await t.page.click('[data-lens="1.8"]'); await t.page.click("#prayToggle"); await t.page.waitForTimeout(2500);
    {   // the whole view, mounted: the card is the picture with a margin round it and a foot under it for the verse
      const c = await t.page.evaluate(() => window.__capture()), v = t.page.viewportSize(), m = 0.055 * Math.min(c.w, c.h), shape = (c.w - 2 * m) / (c.h - m - 0.2 * (c.w - 2 * m) / Math.max(1, v.width / v.height > 1 ? v.width / v.height : 1));
      expect((c.w > c.h) === (v.width > v.height * 1.3) && Math.abs(shape / (v.width / v.height) - 1) < 0.12, "the whole-view photograph is not the shape of the view: " + [c.w, c.h, v.width, v.height, shape.toFixed(3)]);
    }
    const sizes = {};
    for (const a of ["tall", "square", "wide"]) {
      await t.page.click(`[data-aspect="${a}"]`);
      const box = await t.page.evaluate(() => { const r = document.getElementById("frame").getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight, r.left, r.top]; });
      expect(box[4] >= 0 && box[5] >= 0 && box[0] <= box[2] && box[1] <= box[3], `the ${a} frame does not fit the screen`);
      const c = await t.page.evaluate(() => window.__capture()); sizes[a] = [c.w, c.h];
      if (a === "tall") fs.writeFileSync(path.join(out, "card.jpg"), Buffer.from(c.url.split(",")[1], "base64"));
      expect(c.url.length > 200000, `the ${a} photograph is nearly empty`);
    }
    expect(sizes.tall[1] > sizes.tall[0] && sizes.wide[0] > sizes.wide[1] && Math.abs(sizes.square[0] - (sizes.square[1] - (sizes.square[1] - sizes.square[0]))) < 2, "the three shapes came out wrong: " + JSON.stringify(sizes));
    await t.page.click("#shutter", { timeout: 300000 });   // drawing the large picture holds the page for as long as it takes
    await t.until(() => t.page.isVisible("#print"), 120000, "the print never appeared");
    expect((await t.page.getAttribute("#saveLink", "href")).startsWith("blob:"), "nothing to save"); expect(/秋暮/.test(await t.page.getAttribute("#saveLink", "download")), "the file should be named for the season and hour");
    await t.page.click("#printBack"); await t.page.click("#photoClose"); await t.page.waitForTimeout(500);
    p = await t.probe(); expect(!p.photo && (await t.page.isVisible("#photoBtn")), "did not return to walking");
    expect((await t.state()).running, "the walk did not resume"); expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // With a keyboard and mouse, as such games are played: W walks, Shift hurries, E does what is offered, V and B and P open things.
  keys: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third" + BARE, { viewport: { width: 900, height: 600 } });
    expect(!(await t.page.isVisible("#keys")) && !(await t.page.isVisible("#stick")), "nothing about the controls should sit on the picture uninvited");
    await t.page.keyboard.press("h"); expect(await t.page.isVisible("#keys") && (await t.page.textContent("#keys")).includes("行走"), "H should open the list of keys");
    await t.page.keyboard.press("Escape"); expect(!(await t.page.isVisible("#keys")), "Esc should close the list of keys");
    const z0 = (await t.state()).z; await t.page.keyboard.down("w"); await t.frames(6); await t.page.keyboard.up("w");
    const z1 = (await t.state()).z; expect(z1 < z0 - 0.15, `W should walk him forward: ${z0} to ${z1}`);
    expect((await t.page.evaluate(() => window.__visit().metres)) > 0.1, "the visit should remember how far he has walked");
    await t.page.keyboard.down("Shift"); await t.page.keyboard.down("w"); await t.frames(6); await t.page.keyboard.up("w"); await t.page.keyboard.up("Shift");
    const z2 = (await t.state()).z; expect(z1 - z2 > (z0 - z1) * 1.4, `Shift should hurry him: ${(z0 - z1).toFixed(2)} then ${(z1 - z2).toFixed(2)}`);
    await t.page.keyboard.press("v"); expect((await t.probe()).view === "first", "V should change the view"); await t.page.keyboard.press("v");
    const d0 = (await t.probe()).camDist; await t.page.mouse.move(450, 300); for (let i = 0; i < 4; i++) await t.page.mouse.wheel(0, 300); await t.frames(16);
    const d1 = (await t.probe()).camDist; expect(d1 > d0 + 1, `the wheel should draw the eye back: ${d0} to ${d1}`);
    // The page is there at once, as paper, before its seals are drawn onto it: within the frame the key was pressed in.
    const opened = await t.page.evaluate(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true })); return !!document.getElementById("book").open; });
    expect(opened, "B should open the book's page at once, not after it is drawn");
    await t.until(() => t.page.evaluate(() => !document.getElementById("bookPage").classList.contains("drawing")), 60000, "the book's page was never written on");
    // One seal to a sheet: the book closes with one, and saving or sharing are written in ink.
    expect(await t.page.evaluate(() => [...document.querySelectorAll("#book .stamp")].filter((e) => e.offsetParent).map((e) => e.id).join()) === "bookClose", "the book should carry exactly one seal, 合上");
    await t.page.keyboard.press("Escape"); expect(!(await t.page.isVisible("#book")), "Esc should close it");
    await t.page.evaluate(() => { const p = window.__places.bell; window.__pose(p.at[0], p.at[1], 0, 0); }); await t.until(() => t.page.isVisible("#act"), 30000, "nothing offered before the bell");
    await t.page.keyboard.press("e"); await t.until(async () => (await t.journey()).strikes === 1, 30000, "E should strike the bell");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Esc with nothing open is the pause menu: what the visitor sets there is kept, and there is a way back to the start.
  menu: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=first", { viewport: { width: 800, height: 500 } });
    expect(!(await t.page.isVisible("#menu")), "the menu should wait to be asked for");
    await t.page.keyboard.press("Escape"); expect(await t.page.isVisible("#menu") && (await t.page.textContent("#menu")).includes("环顾快慢"), "Esc with nothing open should bring the pause menu");
    const z0 = (await t.state()).z; await t.page.keyboard.down("w"); await t.frames(4); await t.page.keyboard.up("w"); expect(Math.abs((await t.state()).z - z0) < 0.01, "he should stand still while the menu is open");
    await t.page.keyboard.press("v"); await t.page.mouse.click(90, 420); await t.page.mouse.wheel(0, 300); await t.frames(3);
    { const p = await t.probe(), st0 = await t.state(); expect(p.view === "first" && st0.target === null && !(await t.page.evaluate(() => document.pointerLockElement)), "nothing behind the open menu should answer a key, a click or the wheel"); }
    await t.page.click("#setInvert"); await t.page.evaluate(() => { for (const [id, v] of [["setSens", "1.8"], ["setVolume", "0.3"]]) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); } });
    await t.page.click('#menu [data-q="medium"]'); expect(await t.page.isVisible("#qualityNote"), "a change of tier should say when it takes effect");
    let st = await t.page.evaluate(() => window.__settings()); expect(st.invertY === true && st.sens === 1.8 && st.volume === 0.3 && st.quality === "medium", "the menu did not set what it shows: " + JSON.stringify(st));
    // The page of thanks opens over the menu, lists the 14 ColBase pictures and links the licence summary the build carries; Esc puts away only it.
    await t.page.click("#menuCredits"); await t.until(() => t.page.isVisible("#credits"), 10000, "the menu has no way to the page of thanks");
    { const c = await t.page.evaluate(() => ({ text: document.getElementById("creditsBody").textContent, links: [...document.querySelectorAll("#creditsBody a")].map((a) => a.href), modal: window.__ui().modal }));
      expect(c.text.includes("ColBase") && c.text.includes("Poly Haven") && c.text.includes("Basis Universal") && c.text.includes("Yunjing Kai"), "the page of thanks lacks a source: " + c.text.slice(0, 120));
      expect(c.links.filter((h) => /colbase\.nich\.go\.jp\/collection_items\//.test(h)).length === 15, "the page should link 14 ColBase items and the plaque's: " + c.links.length);
      const notice = c.links.find((h) => /THIRD-PARTY-NOTICES\.txt$/.test(h)), ofl = c.links.find((h) => /OFL\.txt$/.test(h)); expect(notice && ofl, "the page does not link the licence summary and the font licence");
      for (const [h, name] of [[notice, "three.js"], [notice, "Basis Universal"], [ofl, "SIL OPEN FONT LICENSE"]]) { const body = await t.page.evaluate(async (u) => { const r = await fetch(u); return r.ok ? (await r.text()) : "HTTP " + r.status; }, h); expect(body.toUpperCase().includes(name.toUpperCase()), `${h} should open and name ${name}: ${body.slice(0, 60)}`); } }
    await t.page.keyboard.press("Escape"); expect(!(await t.page.isVisible("#credits")) && (await t.page.isVisible("#menu")), "Esc should put away the page of thanks and leave the menu");
    await t.page.keyboard.press("Escape"); expect(!(await t.page.isVisible("#menu")), "Esc should close the menu again");
    // Laid out for the screen (#134): across on a computer's wide screen with nothing to scroll, one column on a tall one, two on a phone held sideways.
    await t.page.evaluate(() => document.body.classList.add("seasons"));   // the seasons' rows are the tallest case
    await t.page.keyboard.press("Escape"); await t.until(() => t.page.isVisible("#menu"), 10000, "no menu for the layout check");
    const lay = async (w, h) => { await t.page.setViewportSize({ width: w, height: h }); await t.frames(2);
      return t.page.evaluate(() => { const c = document.querySelector("#menu .card"), r = c.getBoundingClientRect(), cs = getComputedStyle(c), a = document.querySelector("#menu .grp-view").getBoundingClientRect(), b = document.querySelector("#menu .grp-ctl").getBoundingClientRect();
        return { w: r.width, h: r.height, fits: c.scrollHeight <= c.clientHeight, cols: cs.gridTemplateColumns.split(" ").length, side: b.left >= a.right - 1, centred: Math.abs(r.left + r.width / 2 - innerWidth / 2) < 2, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, clipped: [...document.querySelectorAll("#menu .opts, #menu .row")].some((o) => o.scrollWidth > o.clientWidth + 1) }; }); };
    for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]]) { const m = await lay(w, h); expect(m.cols === 2 && m.side && m.w > m.h && m.fits && !m.clipped && m.centred && m.inside && m.w <= 960, `the menu should lie across at ${w}x${h}, whole and centred: ` + JSON.stringify(m)); }
    for (const [w, h] of [[390, 844], [768, 1024]]) { const m = await lay(w, h); expect(m.cols === 1 && m.inside && m.h > m.w, `the menu should stay one column at ${w}x${h}: ` + JSON.stringify(m)); }
    // On a phone held upright the parts can be told at a glance: the ear's heading is in sight without scrolling (#185).
    { await lay(390, 844); const r = await t.page.evaluate(() => { const c = document.querySelector("#menu .card"); c.scrollTop = 0; const hs = [...document.querySelectorAll("#menu .grp-name h3")], cr = c.getBoundingClientRect(), ear = hs[2].getBoundingClientRect(), foot = document.querySelector("#menu .row").getBoundingClientRect(); return { names: hs.map((e) => e.textContent), said: hs.map((e) => e.getAttribute("aria-label")), bottom: Math.round(ear.bottom), foot: Math.round(foot.top), card: Math.round(cr.bottom) }; });
      // named as the Heart Sutra names the senses, and read aloud in plain words
      expect(r.names.join("") === "眼身耳意" && r.said.join("") === "画面操作声音文字", "the menu's parts should be 眼 身 耳 意, read aloud as 画面 操作 声音 文字: " + JSON.stringify(r));
      expect(r.bottom <= Math.min(r.card, r.foot), "on a 390x844 phone the ear's heading should be in sight without scrolling, above the menu's foot: " + JSON.stringify(r)); }
    { const m = await lay(844, 390); expect(m.cols === 2 && m.inside, "a phone held sideways keeps its two columns: " + JSON.stringify(m)); }
    // Tab goes down the left column, then the right, then the foot: the order the eye reads it in.
    { await t.page.setViewportSize({ width: 1366, height: 768 }); await t.frames(2); const seq = [];
      const n = await t.page.evaluate(() => [...document.querySelectorAll("#menu button, #menu input")].filter((e) => e.offsetParent && !e.disabled).length);
      await t.page.evaluate(() => document.querySelector("#menu .grp-view button, #menu .grp-view input").focus());
      for (let i = 0; i < n; i++) { seq.push(await t.page.evaluate(() => { const a = document.activeElement; return a.closest(".grp-view") ? "L" : a.closest(".grp-ctl") ? "R" : a.closest("#menu") ? "F" : "?"; })); await t.page.keyboard.press("Tab"); }
      expect(/^L+R+F+$/.test(seq.join("")), "Tab should go through the left column, then the right, then the foot: " + seq.join("")); }
    await t.page.setViewportSize({ width: 800, height: 500 }); await t.page.keyboard.press("Escape"); await t.until(async () => !(await t.page.isVisible("#menu")), 10000, "Esc did not close the menu");
    // Kept for next time: a new page finds them, and the look really is the other way up.
    await t.page.goto(base + "?cam=0,30,0,0&view=first&q=low", { waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    st = await t.page.evaluate(() => window.__settings()); expect(st.invertY === true && st.sens === 1.8 && st.volume === 0.3, "the settings were not kept: " + JSON.stringify(st));
    const p0 = (await t.state()).pitch; await t.page.mouse.move(400, 250); await t.page.mouse.down(); await t.page.mouse.move(400, 330, { steps: 4 }); await t.page.mouse.up(); await t.frames(2);
    expect((await t.state()).pitch > p0 + 0.05, "with the look inverted, a drag down should look up");
    // A way back to where the path begins.
    await t.page.click("#menuBtn"); await t.until(() => t.page.isVisible("#menu"), 10000, "the menu chip did not open the menu"); await t.page.click("#menuHome"); await t.frames(3);
    const s = await t.state(); expect(s.z > 85 && s.h < -10 && !(await t.page.isVisible("#menu")), "回到起点 should put him back at the foot of the path: " + JSON.stringify([s.x, s.z, s.h]));
    await t.page.evaluate(() => localStorage.removeItem("yunjing.settings.v1"));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The pause menu laid across a wide screen, in every language at three sizes: nothing to scroll and no row wider than its box.
  // Apart from `menu` so that it can run beside every push: the place is built and not drawn, a minute or two (#177).
  menufit: { tier: 2, async run(b, base) {
    // (English's Follow the hour is the longest hour row.)
    for (const lg of ["zh", "ja", "en", "ko"]) { const u = await open(b, base, "q=low&cam=0,30,0,0&view=first&lang=" + lg + BARE, { viewport: { width: 1280, height: 720 } });
      await u.page.evaluate(() => document.body.classList.add("seasons")); await u.page.keyboard.press("Escape"); await u.until(() => u.page.isVisible("#menu"), 20000, "no menu in " + lg); await u.frames(2);
      for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]]) { await u.page.setViewportSize({ width: w, height: h }); await u.frames(2);
        const m = await u.page.evaluate(() => { const c = document.querySelector("#menu .card"); return { fits: c.scrollHeight <= c.clientHeight, clipped: [...document.querySelectorAll("#menu .opts, #menu .row")].some((o) => o.scrollWidth > o.clientWidth + 1) }; });
        expect(m.fits && !m.clipped, `the menu should lie whole at ${w}x${h} in ${lg}: ` + JSON.stringify(m)); }
      // and on a phone held upright, the parts named at first sight: the ear's heading above the foot, unscrolled (#185)
      await u.page.setViewportSize({ width: 390, height: 844 }); await u.frames(2);
      const ph = await u.page.evaluate(() => { const c = document.querySelector("#menu .card"); c.scrollTop = 0; const hs = [...document.querySelectorAll("#menu .grp-name h3")]; return { names: hs.length, ear: hs[2] ? Math.round(hs[2].getBoundingClientRect().bottom) : null, foot: Math.round(document.querySelector("#menu .row").getBoundingClientRect().top) }; });
      expect(ph.names === 4 && ph.ear <= ph.foot, `on a 390x844 phone in ${lg} the ear's heading should be in sight above the menu's foot: ` + JSON.stringify(ph));
      // and the four ways to another language are all there at first sight: each the thing a thumb lands on at its middle,
      // above the foot, and a thumb's size (#195: English and 한국어 had gone under the foot)
      const langs = await u.page.evaluate(() => { const foot = document.querySelector("#menu .row").getBoundingClientRect().top; return [...document.querySelectorAll("#menu [data-lang]")].map((e) => { const q = e.getBoundingClientRect(), hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { l: e.dataset.lang, ok: !!hit && (hit === e || e.contains(hit)) && q.bottom <= foot + 0.5 && q.height >= 43.5 && q.width >= 43.5, top: Math.round(q.top), bottom: Math.round(q.bottom), foot: Math.round(foot), on: hit && !(hit === e || e.contains(hit)) ? (hit.id || hit.className || hit.tagName) : null }; }); });
      expect(langs.every((x) => x.ok), `on a 390x844 phone in ${lg} all four languages should be in sight, above the foot and free to press: ` + JSON.stringify(langs.filter((x) => !x.ok)));
      // and nothing written on the sheet lies half under the foot at first sight: any block of words that shows within the
      // sheet keeps clear of the foot's box, whatever is added to the menu later (#195: the group's invitation, half hidden)
      const under = await u.page.evaluate(() => { const c = document.querySelector("#menu .card"); c.scrollTop = 0; const cr = c.getBoundingClientRect(), foot = document.querySelector("#menu .row"), f = foot.getBoundingClientRect(), out = [];
        for (const el of c.querySelectorAll("*")) { if (foot.contains(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          const st = getComputedStyle(el), r = el.getBoundingClientRect(); if (!r.width || !r.height || st.visibility === "hidden" || el.closest("[hidden]")) continue;
          const shows = r.bottom > cr.top && r.top < cr.bottom; if (shows && r.bottom > f.top + 0.5 && r.top < f.bottom - 0.5) out.push(`${el.id || el.className || el.tagName} "${el.textContent.trim().slice(0, 8)}" ${Math.round(r.top)}-${Math.round(r.bottom)}`); }
        return { foot: Math.round(f.top), out }; });
      expect(!under.out.length, `on a 390x844 phone in ${lg} no words on the menu should lie under its foot (top ${under.foot}): ` + under.out.join(" | "));
      await u.close(); }
  } },
  // What opens over the walk lies on one stack: Esc puts away the top one, an open sheet holds the walk and the keys, and
  // the focus goes into the sheet and comes back to what opened it.
  layers: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third" + BARE, { viewport: { width: 900, height: 600 } });
    const ui = () => t.page.evaluate(() => window.__ui());
    await t.page.keyboard.press("t"); let u = await ui(); expect(!u.stack.length, "before the book is filled T offers no seasons: " + JSON.stringify(u));
    await t.page.evaluate(() => document.body.classList.add("seasons"));   // as once it has been
    await t.page.keyboard.press("h"); await t.page.keyboard.press("t");
    u = await ui(); expect(u.stack.join() === "keys,moodPanel" && !u.modal, "H then T should lay two panels: " + JSON.stringify(u));
    await t.page.keyboard.press("Escape"); u = await ui(); expect(u.stack.join() === "keys" && (await t.page.isVisible("#keys")) && !(await t.page.isVisible("#moodPanel")), "Esc should put away only the top panel: " + JSON.stringify(u));
    await t.page.keyboard.press("Escape"); u = await ui(); expect(!u.stack.length && !(await t.page.isVisible("#menu")), "the second Esc should close the keys, not bring the menu: " + JSON.stringify(u));
    await t.page.keyboard.press("Escape"); u = await ui(); expect(u.stack.join() === "menu" && u.modal && u.focus === "menu", "with nothing open Esc brings the menu, and the focus goes into it: " + JSON.stringify(u));
    // The menu is a sheet of paper torn to its own size, and its one button that matters is a seal (src/paper.js, src/ui.css).
    await t.until(() => t.page.evaluate(() => getComputedStyle(document.querySelector("#menu .card"), "::before").webkitMaskImage.startsWith("url(")), 20000, "the menu's paper was never given its torn edge");
    expect(await t.page.evaluate(() => ["--paper-tile", "--brush-ink", "--enso-red", "--stamp"].every((k) => document.documentElement.style.getPropertyValue(k).startsWith("url("))), "the paper, the strokes and the seals were not drawn");
    await t.page.keyboard.press("Escape"); u = await ui(); expect(!u.stack.length && u.focus !== "menu", "Esc closes the menu and the focus leaves it: " + JSON.stringify(u));
    // The book: opened by its chip, the walk and a jump held while it is open, Tab kept among its buttons, the focus given back.
    await t.page.click("#bookBtn"); await t.until(async () => (await ui()).stack.join() === "book", 60000, "the chip did not open the book");
    const z0 = (await t.state()).z; await t.page.keyboard.down("w"); await t.frames(4); await t.page.keyboard.up("w"); await t.page.keyboard.press(" "); await t.frames(2);
    let s = await t.state(); expect(Math.abs(s.z - z0) < 0.01 && !s.jumping, "behind the open book he should neither walk nor jump: " + JSON.stringify([z0, s.z, s.jumping]));
    await t.page.keyboard.press("Tab"); expect(await t.page.evaluate(() => document.getElementById("book").contains(document.activeElement)), "Tab should move among the book's own buttons");
    await t.page.keyboard.press("Escape"); u = await ui(); expect(!u.stack.length && !(await t.page.isVisible("#book")) && u.focus === "bookBtn", "Esc should close the book and give the focus back to its chip: " + JSON.stringify(u));
    await t.page.evaluate(() => document.activeElement?.blur());
    await t.page.keyboard.press("b"); await t.until(() => t.page.isVisible("#book"), 60000, "B did not open the book"); await t.page.keyboard.press("b"); expect(!(await t.page.isVisible("#book")), "B should close the book it opened");
    // The raised camera, its settings over it.
    await t.page.click("#photoBtn"); await t.page.click("#photoSettingsToggle"); u = await ui(); expect(u.stack.join() === "photo,photoSettings" && !u.modal, "the settings should lie over the raised camera: " + JSON.stringify(u));
    await t.page.keyboard.press("Escape"); u = await ui(); expect(u.stack.join() === "photo" && u.focus === "photoSettingsToggle", "Esc folds the settings and leaves the focus on their button: " + JSON.stringify(u));
    await t.page.keyboard.press("Escape"); u = await ui(); expect(!u.stack.length && !(await t.probe()).photo, "the next Esc lowers the camera: " + JSON.stringify(u));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The feedback group's card: its JSON and QR code come from R2 (src/community.js), answered here so no real code is
  // needed. It opens over the pause menu as one more sheet, says when to join by, hides an expired code, and can retry.
  community: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third" + BARE, { viewport: { width: 900, height: 600 } });
    const ui = () => t.page.evaluate(() => window.__ui());
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
    let config = { enabled: true, image: "test.png", expiresAt: "2099-01-01T00:00:00+08:00" }, broken = false;
    await t.page.route("**/temple-walk/community/**", (r) => r.request().url().endsWith("current.json")
      ? (broken ? r.fulfill({ status: 503, body: "" }) : r.fulfill({ contentType: "application/json", body: JSON.stringify(config) }))
      : r.fulfill({ contentType: "image/png", body: PNG }));
    expect(await t.page.evaluate(() => !document.getElementById("titleCommunity").hidden), "the title should offer the feedback group");
    await t.page.keyboard.press("Escape"); await t.page.click("#menuCommunity");
    await t.until(() => t.page.isVisible("#communityImage"), 20000, "the card never showed the code");
    let u = await ui(); expect(u.stack.join() === "menu,community" && u.modal, "the card should lie over the menu: " + JSON.stringify(u));
    expect((await t.page.textContent("#communityExpiry")).includes("1月1日") && (await t.page.getAttribute("#communityOriginal", "href")).endsWith("/temple-walk/community/test.png"), "the card should say when to join by and link the image beside its JSON");
    await t.page.keyboard.press("Escape"); u = await ui(); expect(u.stack.join() === "menu" && u.focus === "menuCommunity", "Esc should put away only the card: " + JSON.stringify(u));
    expect(!(await t.page.getAttribute("#communityImage", "src")), "a closed card should let go of the code");
    config = { ...config, expiresAt: "2026-01-01T00:00:00+08:00" }; await t.page.click("#menuCommunity");
    await t.until(async () => (await t.page.textContent("#communityStatus")).includes("正在更新"), 20000, "an expired code was not withheld");
    expect(!(await t.page.isVisible("#communityImage")) && (await t.page.isVisible("#communityRetry")), "an expired code must not show");
    await t.page.click("#communityClose"); broken = true; await t.page.click("#menuCommunity");
    await t.until(async () => (await t.page.textContent("#communityStatus")).includes("无法加载"), 20000, "a failed load said nothing");
    broken = false; config = { ...config, expiresAt: "2099-01-01T00:00:00+08:00" }; await t.page.click("#communityRetry");
    await t.until(() => t.page.isVisible("#communityImage"), 20000, "retrying did not bring the code");
    await t.page.keyboard.press("Escape"); await t.page.keyboard.press("Escape"); u = await ui(); expect(!u.stack.length, "two Esc should close the card and the menu: " + JSON.stringify(u));
    const errors = t.errors.filter((e) => !e.includes("/temple-walk/community/current.json")); expect(errors.length === 0, errors.join("\n")); await t.close();
  } },
  // The seasons are the visitor's once the book has been filled: not offered before, offered after in the photograph's
  // settings, the pause menu and T, said once, and still open after 重新朝山 empties the book for a second walk.
  // #135: with the book filled the hour is "随时辰" (the clock) until a hand chooses one; the choice is for this page only.
  hour: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&enter=1" + BARE, { viewport: { width: 900, height: 600 } });
    // Before the book has been filled the prologue is walked by day, whatever the clock says.
    expect((await t.probe()).time === "day", "a first visit should be walked by day: " + (await t.probe()).time);
    await t.page.evaluate((ids) => localStorage.setItem("yunjing.journey.v1", JSON.stringify({ v: 1, born: 1, seals: Object.fromEntries(ids.map((id, i) => [id, 10 + i])), strikes: 3, verse: null, done: 20 })), ["bell", "incense", "tea", "sutra", "well", "lamp", "summit"]);
    await t.page.reload({ waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    const pressed = (sel) => t.page.getAttribute(sel, "aria-pressed");
    await t.page.keyboard.press("Escape");
    expect(await t.page.$eval('#menu .opts:has([data-follow]) > :first-child', (e) => e.hasAttribute("data-follow")), "「随时辰」 is not the first choice in the menu's hour row");
    expect(await pressed("#menu [data-follow]") === "true" && await pressed('#menu [data-time="dawn"]') === "false" && await pressed('#menu [data-time="day"]') === "false", "the ring should sit on 「随时辰」, not on the hour that happens to be now");
    await t.page.click('#menu [data-time="dawn"]');
    expect((await t.probe()).time === "dawn" && await pressed("#menu [data-follow]") === "false" && await pressed('#menu [data-time="dawn"]') === "true", "choosing 晨 did not hold");
    await t.page.click("#menu [data-follow]");
    expect(await pressed("#menu [data-follow]") === "true", "「随时辰」 did not take the ring back");
    await t.page.click('#menu [data-time="night"]');
    expect(await t.page.evaluate(() => Object.keys(localStorage).every((k) => !/hour|time|mood|season/i.test(k))), "the chosen hour was stored");
    await t.page.reload({ waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    await t.page.keyboard.press("Escape");
    expect(await pressed("#menu [data-follow]") === "true" && await pressed('#menu [data-time="night"]') === "false", "after a reload the hour should be 「随时辰」 again");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  seasons: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third" + BARE, { viewport: { width: 900, height: 600 } });
    const offered = () => t.page.evaluate(() => document.body.classList.contains("seasons"));
    expect(!(await offered()), "a new visitor should not be offered the seasons");
    await t.page.click("#photoBtn"); await t.page.click("#photoSettingsToggle");
    expect(await t.page.isVisible("#photoSettings") && !(await t.page.isVisible('#photoSettings [data-season="winter"]')), "the photograph's settings offer seasons too early");
    await t.page.keyboard.press("Escape"); await t.page.keyboard.press("Escape");
    await t.page.keyboard.press("Escape"); expect(await t.page.isVisible("#menu") && !(await t.page.isVisible('#menu [data-season="winter"]')), "the menu offers seasons too early");
    await t.page.keyboard.press("Escape");
    // A full book, as the page itself stores it, and a fresh visit.
    await t.page.evaluate((ids) => localStorage.setItem("yunjing.journey.v1", JSON.stringify({ v: 1, born: 1, seals: Object.fromEntries(ids.map((id, i) => [id, 10 + i])), strikes: 3, verse: null, done: 20 })), ["bell", "incense", "tea", "sutra", "well", "lamp", "sit"]);
    await t.page.reload({ waitUntil: "commit" }); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    expect(await offered(), "a filled book should open the seasons");
    await t.page.keyboard.press("Escape"); expect(await t.page.isVisible('#menu [data-season="winter"]') && await t.page.isVisible('#menu [data-time="night"]'), "the menu should offer the seasons and hours");
    await t.page.click('#menu [data-season="winter"]'); await t.page.click('#menu [data-time="dusk"]');
    let p = await t.probe(); expect(p.season === "winter" && p.time === "dusk", "the menu's seasons did not change the place: " + JSON.stringify([p.season, p.time]));
    await t.page.keyboard.press("Escape");
    await t.page.click("#photoBtn"); await t.page.click("#photoSettingsToggle");
    expect(await t.page.isVisible('#photoSettings [data-season="spring"]'), "the photograph's settings should offer the seasons");
    await t.page.click('#photoSettings [data-season="spring"]'); expect((await t.probe()).season === "spring", "the photograph's seasons did not change the place");
    await t.page.keyboard.press("Escape"); await t.page.keyboard.press("Escape");
    await t.page.keyboard.press("t"); expect(await t.page.isVisible("#moodPanel"), "T should open the seasons once they are the visitor's"); await t.page.keyboard.press("Escape");
    // Begin the book again: the seals go, the seasons stay, and closing the book says once that they are open.
    await t.page.click("#bookBtn"); await t.until(() => t.page.isVisible("#book"), 60000, "the seal at the top left did not open the book");
    await t.page.click("#bookReset"); await t.page.click("#bookReset");
    await t.until(async () => !(await t.page.isVisible("#book")), 20000, "重新朝山 did not close the book");
    const j = await t.journey(); expect(j.count === 0 && j.opened && j.told, "重新朝山 should empty the book and keep the seasons, having said so: " + JSON.stringify({ count: j.count, opened: j.opened, told: j.told }));
    expect(await offered() && (await t.page.evaluate(() => window.__hud().said)).includes("seasons"), "the seasons should stay open, and the visitor be told");
    await t.page.evaluate(() => localStorage.removeItem("yunjing.journey.v1"));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Space jumps: he leaves the ground, comes down where he stood (or a little on, if he was walking), and nothing else happens.
  // The switches behind the debug panel, on the published page: each part of the scene and each pass can be put out
  // and back while the walk goes on, a named view can be jumped to, and a room still hides the courts.
  parts: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=medium&cam=0,24,0,0.1&view=first&season=autumn&time=dusk", { viewport: { width: 640, height: 360 } });
    const part = (n, on) => t.page.evaluate(([n, on]) => window.__part(n, on), [n, on]);
    const census = () => t.page.evaluate(() => window.__census());
    const all = await t.page.evaluate(() => window.__part());
    for (const n of ["site", "sky", "ground", "backdrop", "bamboo", "props", "trees", "drift", "reflect", "bloom", "shadow"]) expect(all[n] === true, `"${n}" should be offered and drawn: ` + JSON.stringify(all));
    expect(!("monk" in all) && !("interior" in all) && (await part("monk", false)) === null, "the novice and the rooms are the walk's to show, not the panel's");
    expect((await part("bamboo", false)) === false && (await census()).bamboo.hidden, "the bamboo did not go out");
    expect((await part("bamboo", true)) === true && !(await census()).bamboo.hidden, "the bamboo did not come back");
    let y = await t.state(); expect(y.planar === 0.5, "the medium tier draws the mirror: " + y.planar);
    await part("reflect", false); y = await t.state(); expect(y.planar === 0, "the mirror did not go out");
    await part("reflect", true); y = await t.state(); expect(y.planar === 0.5, "the mirror did not come back at the tier's size");
    for (const n of ["bloom", "shadow"]) { expect((await part(n, false)) === false, n + " did not go out"); await t.frames(2); expect((await part(n, true)) === true, n + " did not come back"); await t.frames(2); }
    // The film's finish: the halation, the colour table and the mist's layers switch on every tier; the occlusion and
    // the depth of field are the high tier's, and the middle tier refuses them (the finish scenario looks at the high).
    for (const n of ["halation", "lut", "layers"]) { expect((await part(n, false)) === false, n + " did not go out"); await t.frames(2); expect((await part(n, true)) === true, n + " did not come back"); await t.frames(2); }
    for (const n of ["gtao", "dof"]) expect((await part(n, true)) === null, `the medium tier should not offer ${n}`);
    { const f = (await t.probe()).post; expect(!f.depth && !f.gtao && f.lut && f.halation, "the medium tier's finish: no depth or occlusion, a colour table and halation at dusk: " + JSON.stringify(f)); }
    expect(y.season === "autumn" && y.time === "dusk" && y.view === "first" && y.fov > 0, "__yard should say the hour and the view: " + JSON.stringify(y));
    // A named view, without loading again; an unknown one is refused.
    expect(await t.page.evaluate(() => window.__show("gate")), "__show refused a named view"); y = await t.state();
    expect(y.x === 0 && y.z === 49.5, "__show did not stand him at the gate view: " + JSON.stringify([y.x, y.z]));
    expect(!(await t.page.evaluate(() => window.__show("nowhere"))), "__show should refuse a view that does not exist");
    // Indoors the courts stay hidden even when switched on; out again, a part switched off stays off.
    await t.page.evaluate(() => window.__inside("chan")); await t.until(async () => (await t.state()).room === "chan", 60000, "could not go into the meditation hall");
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted");
    expect((await part("site", true)) === true && (await census()).site.hidden, "a court was drawn inside a room");
    await part("site", false);
    expect(await t.page.evaluate(() => window.__show("court")), "__show could not leave the room"); y = await t.state();
    expect(!y.inside && y.z === 29 && (await census()).site.hidden, "out of the room, a part switched off should stay off: " + JSON.stringify([y.inside, y.z]));
    expect((await part("site", true)) === true && !(await census()).site.hidden, "the buildings did not come back outdoors");
    await t.frames(2); const p = await t.probe(); expect(p.lum > 12 && p.lum < 245, "the picture is blank after the switches: " + p.lum.toFixed(1));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The film's finish on the high tier (docs/t00/art-goal.md, first stage): the scene's depth is kept and the occlusion
  // drawn from it; at dusk a colour table and halation; the mist lies in layers; a fixed view (?shot) is focused, the walk
  // is not; each part goes out with ?off=; summer by day (J01) keeps no table, no halation and plain air; the low tier
  // keeps no depth.
  finish: { tier: 2, async run(b, base) {
    const look = async (q, w = 480, h = 200) => { const t = await open(b, base, q, { viewport: { width: w, height: h } }); await t.frames(2); const p = await t.probe(); expect(t.errors.length === 0, q + ": " + t.errors.join("\n")); await t.close(); return p; };
    let p = await look("q=high&cam=0,29,0,0.1&view=first&season=autumn&time=dusk");
    expect(p.post.depth && p.post.gtao && p.post.lut && p.post.halation && !p.post.dof && p.layers > 0 && p.soft && p.governed === 0, "the high tier at dusk, walking: " + JSON.stringify([p.post, p.layers, p.soft]));
    // The colour table is baked when the hour changes, never per frame (it once was, at 20 ms of CPU a frame).
    { const t = await open(b, base, "q=high&cam=0,29,0,0.1&view=first&season=autumn&time=dusk", { viewport: { width: 320, height: 160 } }); await t.frames(2);
      const n0 = (await t.probe()).post.bakes; await t.frames(6); const n1 = (await t.probe()).post.bakes;
      expect(n0 >= 1 && n1 === n0, `the colour table was baked again while walking: ${n0} → ${n1}`);
      await t.page.evaluate(() => window.__mood("winter", "dawn")); await t.frames(2);
      expect((await t.probe()).post.bakes === n1 + 1, "a new hour should bake its table once"); await t.close(); }
    p = await look("q=high&shot=1&show=art3&view=third&season=autumn&time=dusk");
    expect(p.post.dof && p.post.focus > 2 && p.post.focus < 12, "a fixed view should be focused on him: " + JSON.stringify(p.post));
    p = await look("q=high&cam=0,29,0,0.1&view=first&season=autumn&time=dusk&off=gtao,lut,halation,layers,dof");
    expect(!p.post.gtao && !p.post.lut && !p.post.halation && p.layers === 0, "?off= should put out each part of the finish: " + JSON.stringify([p.post, p.layers]));
    p = await look("q=high&shot=1&show=cam06");
    expect(p.season === "summer" && p.time === "day" && !p.post.lut && !p.post.halation && p.layers === 0 && p.post.gtao, "J01 keeps its colour and its air: " + JSON.stringify([p.post, p.layers]));
    p = await look("q=low&cam=0,29,0,0.1&view=first&season=autumn&time=dusk");
    expect(!p.post.depth && !p.post.gtao && !p.post.dof && p.post.lut && !p.soft, "the low tier keeps no depth, draws no occlusion and no soft shadows: " + JSON.stringify([p.post, p.soft]));
  } },
  jump: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third" + BARE, { viewport: { width: 640, height: 400 } });
    const sample = () => t.page.evaluate(() => { window.__jump = []; const read = () => { const s = window.__yard(); window.__jump.push([s.footY, s.jumping, s.z]); if (window.__jump.length < 400 && (s.jumping || window.__jump.length < 3)) requestAnimationFrame(read); }; requestAnimationFrame(read); });
    // #141: the patch that stands for his shadow keeps to the ground under him all through the jump, fainter at the top.
    await t.page.evaluate(() => { window.__sh = []; const read = () => { const s = window.__yard(); window.__sh.push([s.footY, s.h, s.shadowY, s.shadowOp]); if (window.__shOn) requestAnimationFrame(read); }; window.__shOn = true;; requestAnimationFrame(read); });
    const z0 = (await t.state()).z; await sample(); await t.page.keyboard.press("Space");
    await t.until(async () => (await t.page.evaluate(() => window.__jump.some((j) => j[1]))) && !(await t.state()).jumping, 120000, "Space did not send him up and bring him down");
    let js = await t.page.evaluate(() => window.__jump), top = Math.max(...js.map((j) => j[0]));
    expect(top > 0.2 && top < 0.7, `a child's jump should be a hand or two high, not ${top}`); expect(Math.abs((await t.state()).footY) < 0.001 && Math.abs((await t.state()).z - z0) < 0.02, "he should land where he stood");
    const sh = await t.page.evaluate(() => { window.__shOn = false; return window.__sh; }), shTop = Math.max(...sh.map((q) => q[0]));
    expect(shTop > 0.2 && sh.every((q) => Math.abs(q[2] - (q[1] + 0.03)) < 0.02), "his shadow should stay on the ground in every frame of the jump: " + JSON.stringify(sh.filter((q) => Math.abs(q[2] - (q[1] + 0.03)) >= 0.02).slice(0, 3)));
    expect(sh.find((q) => q[0] === shTop)[3] < sh[0][3] - 0.05 && Math.abs(sh[sh.length - 1][3] - sh[0][3]) < 0.01, "his shadow should be fainter at the top and as before when down");
    expect(!(await t.page.isVisible("#book")) && !(await t.page.isVisible("#slip")), "a jump should open nothing");
    await t.page.keyboard.down("w"); await t.frames(2); await sample(); await t.page.keyboard.press("Space");
    await t.until(async () => (await t.page.evaluate(() => window.__jump.some((j) => j[1]))) && !(await t.state()).jumping, 120000, "he never came down from a running jump");
    await t.page.keyboard.up("w"); js = (await t.page.evaluate(() => window.__jump)).filter((j) => j[1]);
    expect(js.length >= 2 && js[js.length - 1][2] < js[0][2] - 0.02, "he should carry on forward through the air");
    // #143: from the court, facing the meditation hall's low porch (0.45 m), Space jumps up onto it along an arc of his own jump,
    // and walking at the same edge still stops him.
    await t.page.evaluate(() => window.__pose(12.4, 8, Math.PI / 2, 0.1)); await t.frames(3);
    await t.page.keyboard.down("w"); await t.frames(8); await t.page.keyboard.up("w"); await t.frames(2);
    expect((await t.state()).x < 12.8, "walking at the porch edge from the court should still stop him");
    await t.page.evaluate(() => window.__pose(12.4, 8, Math.PI / 2, 0.1)); await t.frames(3);
    await t.page.evaluate(() => { window.__up = []; window.__upOn = true; const read = () => { const s = window.__yard(); window.__up.push([s.x, s.footY, s.dropping]); if (window.__upOn) requestAnimationFrame(read); }; requestAnimationFrame(read); });
    await t.page.keyboard.press("Space");
    await t.until(async () => { const s = await t.state(); return !s.dropping && s.h === 0.45 && s.x > 13.2; }, 120000, "Space did not take him up onto the low porch");
    const up = await t.page.evaluate(() => { window.__upOn = false; return window.__up; });
    expect(up.filter((q) => q[2]).length >= 3 && up.some((q) => q[1] > 0.2 && q[1] < 0.44) && Math.max(...up.map((q) => q[1])) < 0.47, "the way up should be a rise and a fall, not a teleport, and no higher than his jump: " + JSON.stringify(up.filter((q) => q[2]).map((q) => [q[0], q[1]]).slice(0, 8)));
    expect(Math.abs((await t.state()).footY - 0.45) < 0.001, "he should stand on the porch");
    await t.shot("jump-up");
    // Where something is offered, Space still jumps and E still does it.
    await t.page.evaluate(() => { const p = window.__places.bell; window.__pose(p.at[0], p.at[1], 0, 0); }); await t.until(() => t.page.isVisible("#act"), 30000, "nothing offered before the bell");
    await t.page.keyboard.press("Space"); await t.frames(3); expect((await t.journey()).strikes === 0, "Space should not strike the bell any more");
    // At the tea house's tables (issue 16): held W, then Shift with W, and Space each time he is down, straight at a
    // table from the porch beside it. Every frame he is outside the table and his width, and he lands on the porch.
    for (const [x, z, shift] of [[-13.2, 11.3, false], [-13.25, 6.9, true], [-13.2, 16.7, true]]) {
      const tz = z < 14 ? 9.1 : 18.9; await t.page.evaluate(async () => { if (window.__yard().inside) await window.__inside(null); }); await t.frames(2);
      await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0), [x, z, Math.atan2(-13.83 - x, -(tz - z))]); await t.frames(3);
      await t.page.evaluate(() => { window.__tea = []; window.__teaOn = true; const read = () => { const s = window.__yard(); window.__tea.push([s.x, s.z, s.footY, s.jumping || s.dropping, s.dropping]); if (window.__teaOn) requestAnimationFrame(read); }; requestAnimationFrame(read); });
      if (shift) await t.page.keyboard.down("Shift"); await t.page.keyboard.down("w");
      for (let k = 0; k < 3; k++) { await t.page.keyboard.press("Space"); await t.until(async () => !(await t.state()).jumping, 120000, "he did not come down at the tea table"); await t.frames(2); }
      await t.page.keyboard.up("w"); if (shift) await t.page.keyboard.up("Shift");
      const all = (await t.page.evaluate(() => { window.__teaOn = false; return window.__tea; })).filter((q) => q[2] > -1);   // (going round the table and on, he may walk in at the tea house's door: the room is not the porch)
      // (Going on past the table he may come to an end of the porch the baked floor opens, #265, where Space hops down off its
      // edge: from there on he is no longer at the table.)
      const off = all.findIndex((q) => q[4]), tea = off < 0 ? all : all.slice(0, off);
      // (How near: the written plan keeps him BODY, 0.37 m, off the table's rectangle; the grid baked from the drawn meshes keeps
      // him his outline's reach at the table's height, 0.343 m, less half a cell (#265, as tests/unit/walkers.mjs keptOff).)
      const m = (await t.page.evaluate(() => window.__walker().mode)) === "old" ? 0.37 : 0.343 - 0.046;
      const inside = tea.filter(([px, pz]) => px > -14.09 - m && px < -13.57 + m && pz > tz - 0.75 - m && pz < tz + 0.75 + m);
      expect(tea.some((q) => q[3]) && inside.length === 0, `jumping at the tea table from (${x}, ${z}) he came within his width of it: ${JSON.stringify(inside.slice(0, 3))} (${tea.length} frames outdoors, ${tea.filter((q) => q[3]).length} in the air)`);
      expect(tea.filter((q) => !q[3]).every((q) => Math.abs(q[2] - 0.45) < 0.01), `between jumps at the tea table he should stand on the porch (from ${x}, ${z}): ` + JSON.stringify(tea.slice(0, 2)) + JSON.stringify(tea.filter((q) => !q[3] && Math.abs(q[2] - 0.45) >= 0.01).slice(0, 3)));
    }
    await t.shot("jump-tea");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A deliberate low ledge hop: normal walking stays blocked; Space or the touch button clears it.
  // The 功德箱 (#202): a free coin in the great hall, and in the web build a sheet with one link to the sponsor page.
  offering: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low" + BARE);
    await t.page.evaluate(() => window.__inside("main")); await t.frames(3);
    const box = await t.page.evaluate(() => window.__gallery["main-box"]); expect(box && box.item.offering, "the great hall has no offering box");
    const kept = async () => { const j = await t.journey(); return JSON.stringify({ seals: j.seals, count: j.count, strikes: j.strikes, earned: j.earned }); }, book = await kept();
    await t.page.evaluate((p) => window.__pose(p.at[0], p.at[1] + 0.2, 0, 0), box);
    await t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === "合掌", 30000, "standing before the box offered no 合掌");
    await t.page.click("#act");
    // Frame by frame, while the coin goes in: the eye goes to the box's own shot and is back before the sheet; the coin is in his
    // fingers until it is let go and gone on the frame it passes the lid; its sound is asked for within 80 ms of that.
    const seen = await t.page.evaluate(() => new Promise((done) => {
      const s = { phases: [], frames: [], sheet: null }; const t0 = performance.now();
      const tick = () => {
        const d = window.__director(), c = window.__coin(), open = !!document.getElementById("offering")?.open;
        s.phases.push(d.phase); s.frames.push({ vis: c.visible, passed: c.passedAt, released: c.released, y: c.y });
        if (open) { s.sheet = { directed: c.directed, phase: d.phase }; s.coin = c; return done(s); }
        if (performance.now() - t0 > 150000) return done(s);
        requestAnimationFrame(tick);
      }; tick();
    }));
    expect(seen.sheet, "the coin was dropped and no sheet followed");
    expect(seen.phases.includes("hold"), "the eye never came to rest on the box's shot: " + [...new Set(seen.phases)]);
    expect(seen.sheet.phase === "idle" && !seen.sheet.directed, "the sheet opened while the eye was still away: " + JSON.stringify(seen.sheet));
    const pass = seen.frames.findIndex((f) => f.passed !== null);
    expect(pass > 0 && seen.frames[pass - 1].vis && !seen.frames[pass].vis && seen.frames.slice(0, pass).some((f) => f.released), "the coin should be seen, let go, and gone on the frame it passes the lid: " + JSON.stringify(seen.frames.slice(Math.max(0, pass - 2), pass + 2)));
    const lag = seen.coin.at - seen.coin.passedAt;
    expect(lag >= 0 && lag <= 80, `the sound was asked for ${lag.toFixed(0)} ms after the coin went in`);
    const links = await t.page.$$eval("#offering a", (as) => as.map((a) => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent })));
    const UTM = "https://rushiwowen.co/donate?utm_source=temple-walk&utm_medium=game&utm_campaign=offering-box&utm_content=";
    expect(links.length === 2 && links.every((l) => l.target === "_blank" && /noopener/.test(l.rel)), "the Chinese sheet should hold two links, each to a new tab: " + JSON.stringify(links));
    expect(links[0].href === UTM + "zh", "the button is not the sponsor page in Chinese: " + links[0].href);
    expect(links[0].text === "支持如是我闻与本游戏的制作", "the button's words are not the agreed ones");
    expect(links[1].href === UTM + "zh-qr" && links[1].text === "付款后可在护持页登记", "the registration link is wrong: " + JSON.stringify(links[1]));
    const qr = await t.page.evaluate(() => { const i = document.getElementById("offeringQrImg"), r = i && i.getBoundingClientRect(); return i && { ok: i.complete && i.naturalWidth === 1152, w: r.width, h: r.height, src: i.getAttribute("src"), shown: !!i.offsetParent }; });
    expect(qr && qr.ok && qr.shown && qr.w >= 220 && qr.h >= 220 && /wechat-support-2026-08-28/.test(qr.src), "the code is not shown whole and large enough: " + JSON.stringify(qr));
    // The sheet is built after the page opened, and is torn like every sheet (paper.js watches what is added to the body).
    const torn = await t.page.evaluate(() => document.querySelector(".offering-card").style.getPropertyValue("--deckle") || "");
    expect(/^url\(/.test(torn), "the offering sheet has no torn edge of its own (--deckle is the plain-rectangle fallback): " + torn.slice(0, 20));
    const words = await t.page.textContent("#offering");
    expect(!/功德无量|供养|募捐/.test(words), "the sheet used a word it must not");
    const zone = await t.page.textContent(".offering-qr"); expect(!/功德|供养|布施|回向/.test(zone) && zone.includes("微信扫码，支持如是我闻与本游戏的制作"), "the code's zone says the wrong thing: " + zone);
    const ev = await t.page.evaluate(() => (globalThis.__events || []).map((e) => e.name + ":" + e.data.lang));
    expect(ev.filter((e) => e.startsWith("offering.qr")).join() === "offering.qr:zh", "offering.qr should be sent once, with lang only: " + ev);
    expect(JSON.stringify(await t.page.evaluate(() => window.__hud())).match(/功德|护持|如是我闻/) === null, "the hint line spoke of the box");
    await t.page.keyboard.press("Escape"); await t.until(async () => !(await t.page.isVisible("#offering")), 20000, "Esc did not put the sheet away");
    expect((await kept()) === book, "a coin changed the book: " + book + " -> " + (await kept()));
    await t.until(async () => (await t.journey()).rite === null, 20000, "he is still at the box");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    // In the other three languages the same sheet carries the same code, its words in that language, the sponsor button still the
    // chief way in (above the code), the registration link `<lang>-qr`, and one offering.qr each (the coin's way there is the zh run's).
    const LANGS = { en: { path: "co/en/donate", alt: "WeChat Pay code", scan: "WeChat Pay (optional)", reg: "After paying, you can register on the support page" },
      ja: { path: "co/ja/donate", alt: "WeChat Pay のコード", scan: "WeChat Pay（任意）", reg: "支払い後はご支援ページで登録" },
      ko: { path: "co/en/donate", alt: "WeChat Pay 코드", scan: "WeChat Pay(선택)", reg: "결제한 뒤 후원 페이지에서 등록할 수 있습니다" } };
    for (const [lang, want] of Object.entries(LANGS)) {
      const e = await open(b, base, `q=low&lang=${lang}` + BARE);
      await e.until(() => e.page.evaluate(() => typeof window.__offeringSheet === "function"), 60000, `no sheet hook (${lang})`);
      await e.until(() => e.page.evaluate(() => window.__offeringSheet()), 60000, `no sheet in ${lang}`);
      await e.frames(2);
      const ls = await e.page.$$eval("#offering a", (as) => as.map((a) => ({ href: a.href, text: a.textContent, y: a.getBoundingClientRect().top })));
      expect(ls.length === 2 && ls[0].href === UTM.replace("co/donate", want.path) + lang && ls[1].href === UTM.replace("co/donate", want.path) + lang + "-qr", `${lang}: the sheet's two links are wrong: ` + JSON.stringify(ls));
      expect(ls[0].text !== "支持如是我闻与本游戏的制作" && ls[1].text === want.reg && (lang === "ja" || !/[\u4e00-\u9fff]/.test(ls[0].text + ls[1].text)), `${lang}: the links' words are not in ${lang}: ` + JSON.stringify(ls.map((l) => l.text)));
      const q = await e.page.evaluate(() => { const i = document.getElementById("offeringQrImg"), r = i.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth === 1152, w: r.width, alt: i.alt, y: r.top, scan: document.getElementById("offeringScan").textContent, how: document.getElementById("offeringHow").textContent }; });
      expect(q.ok && q.w >= 220 && q.alt === want.alt && q.scan.startsWith(want.scan), `${lang}: the code or its words are wrong: ` + JSON.stringify(q));
      expect(q.scan !== "微信扫码，支持如是我闻与本游戏的制作" && q.how !== "用微信扫一扫" && (lang === "ja" || !/[\u4e00-\u9fff]/.test(q.scan + q.how)), `${lang}: Chinese left beside the code: ` + q.scan + " | " + q.how);
      expect(ls[0].y < q.y, `${lang}: the sponsor button should lie above the code`);
      const ev = await e.page.evaluate(() => (globalThis.__events || []).filter((x) => x.name === "offering.qr").map((x) => x.data.lang));
      expect(ev.join() === lang, `${lang}: offering.qr should be sent once with lang: ` + ev);
      expect(e.errors.length === 0, e.errors.join("\n")); await e.close();
    }
    return;
  } },
  drop: { tier: 2, async run(b, base) {
    for (const touch of [false, true]) {
      // (The meditation hall's porch: its neighbour the tea house has a deeper one now, with tables on it.)
      const t = await open(b, base, "q=low&cam=13.65,11,-1.570796,0.22&view=third&season=summer&time=day", touch ? { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true } : { viewport: { width: 640, height: 360 } });
      await t.until(() => t.page.isVisible(touch ? "#jumpBtn" : "#dropBtn"), 30000, "the low unrailed porch offers no way down");
      if (touch) { await t.until(async () => (await t.page.textContent("#jumpBtn")).trim() === "下台阶", 30000, "before the porch's edge the ring should say 下台阶"); expect(!(await t.page.isVisible("#dropBtn")), "the porch's own chip is the ring on a touch screen"); }
      if (!touch) {
        await t.page.keyboard.down("w"); await t.frames(8); await t.page.keyboard.up("w");
        // (Where the porch's edge is, from the walker that answers: written, or found in the baked floor, #265.)
        const line = await t.page.evaluate(() => { const s = window.__yard(); return window.__drops().filter((e) => e.normal[0] === -1 && Math.abs(e.top - 0.45) < 0.02 && Math.min(e.a[1], e.b[1]) < s.z && Math.max(e.a[1], e.b[1]) > s.z).map((e) => e.a[0])[0]; });
        const edge = await t.state(); expect(line !== undefined && edge.h === 0.45 && edge.x >= line - 0.01, `ordinary walking should still stop at the porch edge (${edge.x} by ${line})`);
      } else {
        const r = await t.page.locator("#jumpBtn").boundingBox(); expect(r.width >= 44 && r.height >= 44 && r.x >= 0 && r.x + r.width <= 390, "touch drop control is too small or outside the screen");
      }
      await t.page.evaluate(() => { window.__dropSamples = []; window.__dropRecording = true; const read = () => { const s = window.__yard(); window.__dropSamples.push({ x: s.x, y: s.footY, dropping: s.dropping }); if (window.__dropRecording) requestAnimationFrame(read); }; requestAnimationFrame(read); });
      if (touch) await t.page.tap("#jumpBtn"); else await t.page.keyboard.press("Space");
      await t.until(async () => { const s = await t.state(); return !s.dropping && s.h === 0 && s.x < 12.7; }, 120000, "the low porch hop never reached its clear landing");
      const samples = await t.page.evaluate(() => { window.__dropRecording = false; return window.__dropSamples; });
      expect(samples.filter(s => s.dropping).length >= 3 && samples.some(s => s.y > 0.5) && samples.some(s => s.y > 0 && s.y < 0.4), "the hop must rise and descend continuously, not teleport");
      expect(samples.every(s => s.y >= -0.001), "the hop fell through its landing");
      await t.shot(touch ? "drop-touch" : "drop-space");
      if (!touch) { const x = (await t.state()).x; await t.page.keyboard.press("Space"); await t.frames(3); expect(!(await t.state()).dropping && Math.abs((await t.state()).x - x) < 0.03, "Space on ordinary ground should not start an unrestricted jump"); }
      expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    }
  } },
  // Real keyboard movement over visible treads, uphill and back down without smoothing the novice into stone.
  stairs: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=21.3,86.8,0,0.04&view=third&season=summer&time=day", { viewport: { width: 640, height: 360 } });
    await t.page.evaluate(() => {
      window.__stairRegression = { active: true, samples: [] };
      const read = () => { const s = window.__yard(); window.__stairRegression.samples.push({ z: s.z, floor: s.groundY, feet: s.footY, body: s.bodyY }); if (window.__stairRegression.active) requestAnimationFrame(read); };
      requestAnimationFrame(read);
    });
    const start = await t.state();
    await t.page.keyboard.down("w"); await t.frames(14); await t.page.keyboard.up("w");
    const high = await t.state(); expect(high.h > start.h + 0.2, "W did not climb the visible steps"); await t.shot("stairs-up");
    await t.page.keyboard.down("s"); await t.frames(14); await t.page.keyboard.up("s");
    const low = await t.state(); expect(low.h < high.h - 0.2, "S did not return down the steps"); await t.shot("stairs-down");
    const samples = await t.page.evaluate(() => { window.__stairRegression.active = false; return window.__stairRegression.samples; });
    expect(samples.length >= 28 && samples.every(s => Number.isFinite(s.feet) && s.feet + 0.001 >= s.floor), "the novice's root sank into a tread: " + JSON.stringify(samples));
    const bodyDelta = Math.max(...samples.slice(1).map((s, i) => Math.abs(s.body - samples[i].body)));
    expect(Number.isFinite(bodyDelta) && bodyDelta < 0.08, `the torso still pops a whole step: ${bodyDelta} metres/frame`);
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "stairs-grounding.json"), JSON.stringify(samples, null, 2));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
    // An address from an older ?devpose, cut to centimetres at the edge of the Guanyin terrace's stair: it falls just inside
    // the stop by the cheek. He must come back standing on the treads, not sunk to the terrace below them.
    const edge = await open(b, base, "q=low&cam=2.1,-63.37,-0.582,-0.204&view=third&season=autumn&time=night", { viewport: { width: 640, height: 360 } });
    const at = await edge.state(); expect(at.h > 2.8 && at.footY > 2.8, "he came back sunk into the stair: " + JSON.stringify({ x: at.x, z: at.z, h: at.h, footY: at.footY }));
    expect(edge.errors.length === 0, edge.errors.join("\n")); await edge.close();
  } },
  // Click-drag (including trackpad presses) and locked movement must agree on look direction; the raised photo camera does not turn.
  camera: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=first" + BARE, { viewport: { width: 900, height: 600 } });
    for (const mode of ["first", "third", "photo"]) {
      if (mode === "third") await t.page.keyboard.press("v");
      if (mode === "photo") await t.page.click("#photoBtn");
      const before = await t.state();
      await t.page.mouse.move(420, 320); await t.page.mouse.down();
      await t.page.mouse.move(460, 360, { steps: 4 }); await t.page.mouse.up();
      const after = await t.state();
      // With the camera raised for a photograph the view is held as it was: a drag does not turn it (docs/PHOTO-MODE.md).
      if (mode === "photo") expect(Math.abs(after.yaw - before.yaw) < 1e-6 && Math.abs(after.pitch - before.pitch) < 1e-6,
        `photo: dragging must not turn the raised camera: ${JSON.stringify({ before, after })}`);
      else expect(after.yaw > before.yaw + 0.05 && after.pitch < before.pitch - 0.05,
        `${mode}: dragging right/down must look right/down: ${JSON.stringify({ before, after })}`);
      expect(after.target === null, `${mode}: dragging must not also walk`);
      // The reverse movement should undo the rotation without crossing a pitch limit.
      await t.page.mouse.move(460, 360); await t.page.mouse.down();
      await t.page.mouse.move(420, 320, { steps: 4 }); await t.page.mouse.up();
      const back = await t.state();
      expect(Math.abs(back.yaw - before.yaw) < 0.02 && Math.abs(back.pitch - before.pitch) < 0.02,
        `${mode}: reverse drag did not restore the view`);
    }
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The measured walk: from the bamboo up to the first court and back, timed, with the numbers offered at the end.
  tour: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&tour=8x1&enter&view=first&season=summer&time=day", { viewport: { width: 640, height: 360 }, enter: false });
    let far = 99, hi = -99;
    await t.until(async () => { const s = await t.state(); far = Math.min(far, s.z); hi = Math.max(hi, s.h); return (await t.page.evaluate(() => window.__tour().done)); }, 400000, "the measured walk never finished");
    const r = await t.page.evaluate(() => window.__tour().result);
    expect(r.runs.length === 1 && r.runs[0].frames > 3 && r.runs[0].p95_ms > 0 && r.runs[0].fps_mean > 0, "the walk was not measured: " + JSON.stringify(r.runs.map((x) => [x.frames, x.p95_ms])));
    expect(r.tier === "low" && r.size[0] === 640 && r.view === "first" && typeof r.gpu === "string" && r.load_ms > 0, "the measurement does not say what it was made on");
    expect(far < 84 && hi > -13.5, `the walk should set off up the stair from the bamboo: reached z=${far}, height ${hi}`);   // how far he gets depends on how many frames the machine draws
    expect(await t.page.isVisible("#tour") && (await t.page.textContent("#tour")).includes("p95"), "the numbers were not shown");

    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // On a phone: touch to look, a tap to walk, controls inside the screen and large enough for a thumb.
  phone: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=0,30,0,0&view=first" + BARE, { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    // #142: a phone has one faint ring lower right, across from the stick, that jumps and, before a porch's edge, hops down or up.
    expect(await t.page.isVisible("#jumpBtn"), "a phone should be given a jump ring lower right");
    { const r = await t.page.evaluate(() => { const b = document.getElementById("jumpBtn").getBoundingClientRect(), k = document.getElementById("stick").getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight, k.right]; });
      expect(r[2] <= r[4] && r[3] <= r[5] && r[2] - r[0] >= 56 && r[3] - r[1] >= 56 && r[0] > r[4] / 2 && r[0] > r[6], `the jump ring is misplaced or too small: ${r}`); }
    expect((await t.page.textContent("#jumpBtn")).trim() === "跳", "away from any porch the ring says 跳");
    { const y0 = (await t.state()).footY; await t.page.evaluate(() => { window.__j = []; window.__jOn = true; const read = () => { window.__j.push(window.__yard().footY); if (window.__jOn) requestAnimationFrame(read); }; requestAnimationFrame(read); });
      await t.page.touchscreen.tap(...(await t.page.evaluate(() => { const b = document.getElementById("jumpBtn").getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })));
      await t.until(async () => (await t.page.evaluate(() => window.__j)).some((h) => h > y0 + 0.2), 60000, "pressing the ring did not take him off the ground");
      await t.until(async () => !(await t.state()).jumping, 60000, "he never came down"); await t.page.evaluate(() => { window.__jOn = false; });
      expect(Math.abs((await t.state()).footY - y0) < 0.01, "he should land where he took off"); }
    // with a sheet open it cannot be pressed
    await t.page.evaluate(() => window.__menu(true)); await t.frames(2); expect(!(await t.page.isVisible("#jumpBtn")), "the ring should be put away under a sheet"); await t.page.evaluate(() => window.__menu(false)); await t.frames(2);
    for (const id of ["photoBtn", "menuBtn", "bookBtn"]) {
      const r = await t.page.evaluate((i) => { const b = document.getElementById(i).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight]; }, id);
      expect(r[0] >= 0 && r[1] >= 0 && r[2] <= r[4] && r[3] <= r[5], `#${id} hangs off the screen`); expect(r[2] - r[0] >= 40 && r[3] - r[1] >= 38, `#${id} is too small to tap`);
    }
    expect(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), "the page scrolls");
    // A sheet that scrolls carries its own paper: paper drawn behind the words is drawn away with them (seen on a phone, the pause menu's lower rows bare).
    const bare = await t.page.evaluate(() => [...document.querySelectorAll(".paper:not(.scrolls)")].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY)).map((el) => el.id || el.parentElement.id));
    expect(bare.length === 0, "these sheets scroll but leave their paper behind: " + bare.join(", "));
    expect(await t.page.isVisible("#stick") && !(await t.page.isVisible("#keys")), "a phone should be given a thumb-stick, not a list of keys");
    expect((await t.page.textContent("#hint")).includes("圆盘"), "a phone should be told about the thumb-stick, not about keys");
    const z0 = (await t.state()).z; await t.page.touchscreen.tap(195, 560);   // the paving a few steps ahead of him
    await t.until(async () => (await t.state()).z < z0 - 2, 120000, "a tap on the ground ahead did not start a walk");
    // The thumb-stick, pushed up, walks him the way he is looking.
    const sb = await t.page.evaluate(() => { const r = document.getElementById("stick").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await t.until(async () => (await t.state()).target === null, 60000, "the walk never finished");
    const zs = (await t.state()).z, cdp0 = await t.page.context().newCDPSession(t.page);
    await cdp0.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sb[0], y: sb[1], id: 7 }] });
    await cdp0.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sb[0], y: sb[1] - 44, id: 7 }] });
    await t.frames(5); await cdp0.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect((await t.state()).z < zs - 0.5, "the thumb-stick did not walk him forward");
    // Dragging a finger turns the view and does not send him anywhere.
    const cdp = await t.page.context().newCDPSession(t.page), pt = (x, y) => [{ x, y, id: 1 }];
    await t.until(async () => (await t.state()).target === null, 60000, "the walk never finished");
    const before = await t.state();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(120, 400) });
    for (let x = 140; x <= 300; x += 20) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, 400) });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await t.frames(2); const after = await t.state();
    expect(after.target === null && Math.hypot(after.x - before.x, after.z - before.z) < 0.3, "a drag should turn the view, not walk");
    expect(Math.abs(after.yaw - before.yaw) > 0.3, `a drag of 180 px should turn the view: ${before.yaw} to ${after.yaw}`);
    // Two fingers drawn apart bring the eye nearer, together send it back (he starts in his own eyes, so first back out).
    const two = async (from, to) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195 - from, y: 400, id: 3 }, { x: 195 + from, y: 400, id: 4 }] });
      for (let k = 1; k <= 8; k++) { const d = from + ((to - from) * k) / 8; await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195 - d, y: 400, id: 3 }, { x: 195 + d, y: 400, id: 4 }] }); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await t.frames(6); };
    await two(120, 20); await two(120, 20); const far = (await t.probe()).camDist; await two(30, 140); const near = (await t.probe()).camDist;
    expect(far > 0.5 && near < far - 0.3, `a pinch should move the eye: drawn together to ${far}, apart to ${near}`);
    // At the bell and over tea the stick is how a thumb lets go: pushed, he lets go of the rope, or stands up from his stool.
    const push = async () => { await cdp0.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sb[0], y: sb[1], id: 8 }] }); await cdp0.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sb[0], y: sb[1] - 44, id: 8 }] }); await t.frames(4); await cdp0.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
    const at = (id) => t.page.evaluate((k) => { const p = window.__places[k]; window.__pose(p.at[0] + 0.3, p.at[1] - 0.3, 0, 0); }, id);
    const word = () => t.page.getAttribute("#act", "data-word");
    await at("bell"); await t.until(async () => (await t.page.isVisible("#act")) && (await word()) === "撞钟", 30000, "撞钟 was not offered to a thumb");
    await t.page.tap("#act"); await t.until(async () => (await t.page.evaluate(() => window.__rites().bell.grip)) > 0.9, 60000, "a tap did not take the rope");
    await push(); await t.until(async () => (await t.journey()).rite === null && (await t.page.evaluate(() => window.__rites().bell.grip)) === 0, 30000, "the stick did not let go of the rope");
    await at("tea"); await t.until(async () => (await t.page.isVisible("#act")) && (await word()) === "吃茶", 30000, "吃茶 was not offered to a thumb");
    await t.page.tap("#act"); await t.until(async () => (await t.page.isVisible("#act")) && (await word()) === "起身", 120000, "he did not sit on after the tea");
    await push(); await t.until(async () => (await t.journey()).rite === null && !(await t.state()).staged, 30000, "the stick did not stand him up from the tea");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
};

(async () => {
  const args = process.argv.slice(2), most = args.includes("--quick") ? 1 : args.includes("--smoke") ? 2 : 3, named = args.filter((a) => !a.startsWith("--"));
  // --shard=2/4: the second of four parts of the list, taken in turn, so that four machines can share a whole run.
  const shard = (args.find((a) => a.startsWith("--shard=")) || "").slice(8).split("/").map(Number), part = (list) => (shard.length === 2 && shard[1] > 0 ? list.filter((_, i) => i % shard[1] === shard[0] - 1) : list);
  const names = part(named.length ? named : Object.keys(scenarios).filter((n) => scenarios[n].tier <= most));
  for (const n of names) if (!scenarios[n]) { console.error(`no scenario "${n}"; there are: ${Object.keys(scenarios).join(", ")}`); process.exit(2); }
  const srv = await serve(), browser = await launch(), report = [];
  for (const n of names) {
    const t0 = Date.now(); let error = null;
    try { await scenarios[n].run(browser, srv.base); } catch (e) { error = String(e.message || e).slice(0, 1500); }
    // A scenario that threw left the pages it had opened drawing on, and every later scenario of the shard shared the machine with them (#177).
    for (const c of browser.contexts()) await c.close().catch(() => {});
    const secs = Math.round((Date.now() - t0) / 1000); report.push({ name: n, ok: !error, secs, error });
    // Written after every scenario: a shard cut off by the job's time limit still leaves what it had finished (#177).
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "e2e-report.json"), JSON.stringify(report, null, 2));
    console.log(`${error ? "FAIL" : "ok  "} ${n.padEnd(8)} ${String(secs).padStart(4)}s${error ? "\n     " + error.split("\n").join("\n     ") : ""}`);
  }
  await browser.close(); srv.close();
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "e2e-report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => !r.ok).length;
  console.log(bad ? `${bad} of ${report.length} scenarios failed` : `all ${report.length} scenarios passed`);
  process.exit(bad ? 1 : 0);
})();
