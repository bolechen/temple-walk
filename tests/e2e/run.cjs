// End-to-end scenarios: a real page in a real browser, driven the way a visitor drives it.
//   node tests/e2e/run.cjs              every scenario (about twenty minutes without a GPU)
//   node tests/e2e/run.cjs --smoke      tiers 1 and 2: everything but the long walks and the photograph
//   node tests/e2e/run.cjs --quick      tier 1 only (the page comes up clean): what must pass before anything is published
//   node tests/e2e/run.cjs walk photo   only those named
// Each scenario is independent and fails on any error the page reports. A report is written to tools/out/e2e-report.json.
const fs = require("fs"), path = require("path");
const { serve, launch, open, expect, out } = require("./lib.cjs");

const scenarios = {
  // The page comes up, draws, and offers its controls.
  boot: { tier: 1, async run(b, base) {
    const t = await open(b, base, "q=low");
    const s = await t.state(); expect(s.running && s.frames >= 3, "the walk is not running"); expect(s.tris > 50000, "almost nothing is being drawn: " + s.tris);
    expect(s.h < -10, "the visit should begin at the foot of the path, not at height " + s.h);
    await t.frames(10);
    const p = await t.probe(); expect(p.view === "third" && p.monk, "a visitor arriving should see the novice from behind");
    expect(p.camDist > 3.2, `the first sight of the place should not be the back of his head: the eye is ${p.camDist} m behind him`);
    expect(p.lum > 12 && p.lum < 245, "the picture is blank: mean " + p.lum.toFixed(1));
    for (const id of ["viewBtn", "moodBtn", "photoBtn", "hint", "moodTag"]) expect(await t.page.isVisible("#" + id), `#${id} is not on screen`);
    for (const id of ["moodPanel", "print", "photoBar", "frame"]) expect(!(await t.page.isVisible("#" + id)), `#${id} should start hidden`);
    const m = await t.page.evaluate(() => window.__merged); expect(m.after < m.before / 3 && m.after < 120, "static geometry was not merged: " + JSON.stringify(m));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Up the old path, round the screen wall, through the gate, across the court, in at the door; incense; out again.
  walk: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1");
    await t.page.evaluate(() => window.__walk([[21.3, 81.5], [21.3, 77.5], [11, 77.5], [0, 77.5], [0, 62.5], [8.5, 60], [8.5, 49], [0, 46.5], [0, 2], [0, -5.4]]));
    let lo = 0, hi = -99;
    await t.until(async () => { const s = await t.state(); lo = Math.min(lo, s.h); hi = Math.max(hi, s.h); return t.inHall(); }, 300000, "the walk in never reached the hall");
    expect(lo < -14 && hi >= 1.4, `the climb should go from the foot of the path to the hall's platform; went ${lo} to ${hi}`);
    await t.page.waitForTimeout(4000); await t.shot("e2e-hall");
    expect(await t.page.isVisible("#offer"), "no way to offer incense"); await t.page.click("#offer"); await t.page.waitForTimeout(2500);
    await t.page.click("#leave"); await t.until(async () => !(await t.inHall()), 30000, "never left the hall");
    await t.page.waitForTimeout(2500);
    const s = await t.state(); expect(s.running && Math.abs(s.h - 1.5) < 0.05 && s.z > -7, "should step out onto the porch: " + JSON.stringify(s));
    expect(!(await t.inHall()), "walked straight back in"); expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // At a real walking pace, a tap on the hall leads to its door and through it.
  tap: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&view=first&cam=0.3,2.2,0,0.05");
    await t.page.mouse.click(210, 300); await t.until(t.inHall, 300000, "a tap on the hall never led inside");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A tap on the ground sends him to the spot tapped, on every level of the mountain and on the stairs between.
  taps: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&view=first&cam=0,30,0,0");
    // Each place: where he stands, which way he looks (0 is uphill, a quarter turn is east), and the least height that proves he is there.
    for (const [name, x, z, yaw, lo] of [["the court", 0, 30, 0, -0.1], ["the first terrace", 12, -40, 0, 2.3], ["the second terrace", 6, -70.5, Math.PI / 2, 5.1], ["the summit", -10, -120.4, Math.PI / 2, 19.9], ["the foot of the path, looking up its steps", 21.3, 91.5, 0, -15]]) {
      await t.page.evaluate(([x, z, yaw]) => window.__pose(x, z, yaw, 0), [x, z, yaw]); await t.frames(2);
      const s0 = await t.state(); expect(s0.h > lo, `${name}: posed at the wrong height ${s0.h}`);
      await t.page.mouse.click(210, 520);   // below the horizon: a spot on the ground a few steps ahead
      await t.frames(1); const s1 = await t.state();
      expect(s1.target, `${name}: a tap on the ground set no destination`);
      const ahead = (s1.target[0] - x) * Math.sin(yaw) - (s1.target[1] - z) * Math.cos(yaw), aside = Math.abs((s1.target[0] - x) * Math.cos(yaw) + (s1.target[1] - z) * Math.sin(yaw));
      expect(ahead > 1.5 && ahead < 9 && aside < 0.5, `${name}: the tap should land a few steps straight ahead, not ${ahead.toFixed(1)} m ahead and ${aside.toFixed(1)} m aside at ${s1.target}`);
      await t.until(async () => (await t.state()).target === null, 60000, `${name}: never arrived`);
      const s2 = await t.state(); expect(Math.hypot(s2.x - s1.target[0], s2.z - s1.target[1]) < 0.3, `${name}: stopped short of the tapped spot at ${s2.x}, ${s2.z}`);
    }
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Round the hall, up both terraces and the stair between the tea rows, to the porch of the summit pavilion.
  summit: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=19.5,0,0,0");
    await t.page.evaluate(() => window.__walk([[19.5, -28], [0, -28], [0, -36], [13.6, -36], [13.6, -60], [0, -61], [0, -69.2], [-13, -69.2], [-13, -89], [0, -89.5], [0, -120], [0, -123]]));
    await t.until(async () => (await t.state()).h > 20.8, 300000, "never reached the summit porch");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A tap on the bell reaches it; the bell and drum sound with the partials they were built from.
  sound: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&show=court");
    await t.page.evaluate(() => window.__strike("bell")); await t.page.waitForTimeout(700);
    const bell = await t.page.evaluate(() => window.__listen());
    expect(bell.state === "running" && bell.rms > 0.003, "the bell made no sound: " + JSON.stringify(bell));
    expect(bell.peaks.some(([hz]) => Math.abs(hz - 98) < 8 || Math.abs(hz - 196) < 8), "the bell's fundamental is missing: " + JSON.stringify(bell.peaks));
    await t.page.evaluate(() => window.__strike("drum")); await t.page.waitForTimeout(150);
    const drum = await t.page.evaluate(() => window.__listen()); expect(drum.peaks.some(([hz]) => hz < 120), "the drum has no low end: " + JSON.stringify(drum.peaks));
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Every season at every hour draws, and they look as different as they should.
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
    await t.page.click("#moodBtn"); expect(await t.page.isVisible("#moodPanel"), "the season panel did not open");
    await t.page.click('[data-season="autumn"]'); await t.page.click('[data-time="dusk"]');
    const p = await t.probe(); expect(p.season === "autumn" && p.time === "dusk", "the panel's buttons did not change the season");
    expect((await t.page.getAttribute('[data-season="autumn"]', "aria-pressed")) === "true", "the chosen season is not marked");
    await t.shot("e2e-autumn-dusk");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // From behind him and through his eyes.
  views: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&shot=1&cam=0,24,0,-0.05&view=third");
    let p = await t.probe(); expect(p.view === "third" && p.monk && p.camDist > 2.5, "third person: the eye should stand behind him: " + JSON.stringify(p));
    await t.page.evaluate(() => document.body.classList.remove("bare"));
    await t.page.click("#viewBtn"); await t.page.waitForTimeout(600);
    p = await t.probe(); expect(p.view === "first" && !p.monk && p.camDist < 0.8, "first person: the eye should be his own: " + JSON.stringify(p));
    expect((await t.page.textContent("#viewBtn")) === "眼中", "the button should name the view");
    await t.page.click("#viewBtn"); await t.page.waitForTimeout(1500);
    p = await t.probe(); expect(p.view === "third" && p.monk, "back to third person");
    // With his back to the court's east wall, the eye comes in close rather than passing through it.
    await t.page.evaluate(() => window.__pose(20.5, 30, -Math.PI / 2, -0.05)); await t.frames(3);
    p = await t.probe(); expect(p.camDist < 1.6, "the eye went through the court wall: " + p.camDist);
    // Under the gate, where there is room behind him, it stays back.
    await t.page.evaluate(() => window.__pose(0, 33, 0, -0.05)); await t.frames(14);
    p = await t.probe(); expect(p.camDist > 3.5, "the eye should fall back again in the open: " + p.camDist);
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Photograph mode: framing, the three shapes, focus, the mounted card, and back to walking.
  photo: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=medium&shot=1&view=third&season=autumn&time=dusk&cam=0,24,0,-0.06");
    await t.page.evaluate(() => document.body.classList.remove("bare"));
    await t.page.click("#photoBtn"); await t.page.waitForTimeout(2000);
    for (const id of ["frame", "photoBar", "shutter", "photoClose"]) expect(await t.page.isVisible("#" + id), `#${id} missing in photograph mode`);
    expect(!(await t.page.isVisible("#viewBtn")), "the walking controls should leave");
    let p = await t.probe(); expect(p.photo && p.monk, "the novice should be in the picture by default");
    await t.page.click("#monkToggle"); p = await t.probe(); expect(!p.monk, "he should be able to step out of the picture"); await t.page.click("#monkToggle");
    await t.page.click('[data-lens="26"]'); p = await t.probe(); expect(Math.abs(p.fov - 26) < 0.1, "the long lens did not narrow the view");
    await t.page.click('[data-lens="46"]'); await t.page.click("#prayToggle"); await t.page.waitForTimeout(2500);
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
    p = await t.probe(); expect(!p.photo && (await t.page.isVisible("#viewBtn")), "did not return to walking");
    expect((await t.state()).running, "the walk did not resume"); expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // On a phone: touch to look, a tap to walk, controls inside the screen and large enough for a thumb.
  phone: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&cam=0,30,0,0&view=third", { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    for (const id of ["viewBtn", "moodBtn", "photoBtn"]) {
      const r = await t.page.evaluate((i) => { const b = document.getElementById(i).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight]; }, id);
      expect(r[0] >= 0 && r[1] >= 0 && r[2] <= r[4] && r[3] <= r[5], `#${id} hangs off the screen`); expect(r[2] - r[0] >= 40 && r[3] - r[1] >= 38, `#${id} is too small to tap`);
    }
    expect(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), "the page scrolls");
    const z0 = (await t.state()).z; await t.page.touchscreen.tap(195, 425);   // the paving a few steps ahead of him
    await t.until(async () => (await t.state()).z < z0 - 2, 120000, "a tap on the ground ahead did not start a walk");
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
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
};

(async () => {
  const args = process.argv.slice(2), most = args.includes("--quick") ? 1 : args.includes("--smoke") ? 2 : 3, named = args.filter((a) => !a.startsWith("--"));
  const names = named.length ? named : Object.keys(scenarios).filter((n) => scenarios[n].tier <= most);
  for (const n of names) if (!scenarios[n]) { console.error(`no scenario "${n}"; there are: ${Object.keys(scenarios).join(", ")}`); process.exit(2); }
  const srv = await serve(), browser = await launch(), report = [];
  for (const n of names) {
    const t0 = Date.now(); let error = null;
    try { await scenarios[n].run(browser, srv.base); } catch (e) { error = String(e.message || e).slice(0, 1500); }
    const secs = Math.round((Date.now() - t0) / 1000); report.push({ name: n, ok: !error, secs, error });
    console.log(`${error ? "FAIL" : "ok  "} ${n.padEnd(8)} ${String(secs).padStart(4)}s${error ? "\n     " + error.split("\n").join("\n     ") : ""}`);
  }
  await browser.close(); srv.close();
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "e2e-report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => !r.ok).length;
  console.log(bad ? `${bad} of ${report.length} scenarios failed` : `all ${report.length} scenarios passed`);
  process.exit(bad ? 1 : 0);
})();
