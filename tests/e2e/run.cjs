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
    const t = await open(b, base, "q=low", { enter: false, observeLoading: true });
    // First the title: the temple's name, a way in, and nothing else in the way.
    expect(await t.page.isVisible("#title") && (await t.page.textContent("#title h1")) === "山门之外" && (await t.page.textContent("#title .sub")).includes("云径禅寺"), "the title is missing");
    expect(!(await t.page.isVisible("#photoBtn")) && !(await t.page.isVisible("#bookBtn")) && !(await t.page.isVisible("#act")), "the walking controls should wait behind the title");
    expect(await t.page.evaluate(() => document.fonts.check('40px "Yunjing Brush"', "云径禅寺") && document.fonts.check('20px "Yunjing Serif"', "朱印") && document.fonts.check('20px "Yunjing Kai"', "朱印")), "the temple's own typefaces did not load");
    await t.page.waitForFunction(() => !document.getElementById("enterBtn").disabled, null, { timeout: 60000 });
    await t.page.keyboard.press("Space"); await t.until(() => t.page.evaluate(() => document.getElementById("title").hidden), 30000, "the title never left");
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
  // Up the old path, round the screen wall, through the gate, across the court, in at the door; incense; out again.
  walk: { tier: 3, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1");
    await t.page.evaluate(() => window.__walk([[21.3, 81.5], [21.3, 77.5], [11, 77.5], [0, 77.5], [0, 62.5], [8.5, 60], [8.5, 49], [0, 46.5], [0, 2], [0, -6.0]]));
    let lo = 0, hi = -99;
    await t.until(async () => { const s = await t.state(); lo = Math.min(lo, s.h); hi = Math.max(hi, s.h); return t.inHall(); }, 700000, "the walk in never reached the hall");
    expect(lo < -14 && hi >= 1.4, `the climb should go from the foot of the path to the hall's platform; went ${lo} to ${hi}`);
    // Indoors: a real room. He stands on its floor, far below the court, with the figures before him.
    await t.until(async () => !(await t.page.evaluate(() => document.getElementById("veil").className)), 30000, "the veil never lifted");
    let s = await t.state(); expect(s.inside && s.h < -50 && s.z > 5, "should stand just inside the door: " + JSON.stringify(s));
    await t.until(() => t.page.evaluate(() => window.__figures() === "here"), 120000, "the figures never arrived"); await t.frames(3); await t.shot("e2e-hall");
    // He can walk about in it, the columns stop him, and a frame on the wall can be looked at.
    const cx = await t.page.evaluate(() => window.__places.incense.at[0]), go = (pts) => t.page.evaluate(([c, p]) => window.__walk(p.map(([x, z]) => [c + x, z])), [cx, pts]);   // every hall has its own room; this one's middle is at cx
    await go([[-6, 5], [-11.7, 5.05]]); await t.until(async () => (await t.journey()).look === "main-w1", 60000, "standing before a frame offered nothing");
    expect((await t.page.getAttribute("#act", "data-word")) === "观看", "the frame should offer a look"); await t.page.click("#act");
    await t.until(() => t.page.isVisible("#slip"), 20000, "the frame showed nothing");
    expect((await t.page.textContent("#slipText")) === "入山帖" && (await t.page.textContent("#slipFrom")).includes("山门之外"), "the first frame in the great hall should hold its leaf of the story"); await t.page.click("#slipTake");
    await go([[-9, 3]]); await t.frames(20); s = await t.state(); expect(Math.hypot(s.x - cx + 9, s.z - 3) > 0.45, "he walked through a column");
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
    const t = await open(b, base, "q=low&view=first&cam=0.3,2.2,0,0.05", { hasTouch: true });
    await t.page.touchscreen.tap(210, 300); await t.until(t.inHall, 300000, "a tap on the hall never led inside");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A tap on the ground sends him to the spot tapped, on every level of the mountain and on the stairs between.
  taps: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&view=first&cam=0,30,0,0", { hasTouch: true });
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
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // Every hall with a door can be gone into, has a room of its own with frames on its walls, and lets him out again where he came in.
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
      const view = require("../../tools/hall-views.cjs").find((v) => v.hall === h.id);
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
  snow: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&season=winter&time=day&cam=6.5,19.5,0,0&view=third");
    expect((await t.page.evaluate(() => window.__trail())).on, "in winter the snow should be ready to take his prints");
    // Off the swept axis, through the snow of the court, toward the door of the meditation hall.
    await t.page.evaluate(() => window.__walk([[6.5, 17], [6.5, 14.5]])); await t.until(async () => (await t.state()).target === null && (await t.state()).route === 0, 240000, "he never walked across the snow");
    const walked = await t.page.evaluate(() => window.__trail()); expect(walked.stamps >= 6 && walked.last, "five metres of snow should hold more prints than " + walked.stamps);
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
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The whole pilgrimage: seven observances, a seal for each, the book filling, and all of it remembered.
  pilgrimage: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&fast=1&seed=4");
    const at = (id) => t.page.evaluate((k) => window.__journey && (() => { const p = window.__places[k]; window.__pose(p.at[0] + 0.3, p.at[1] + 0.3, 0, 0); })(), id);
    const seal = async (id, what) => t.until(async () => (await t.journey()).seals[id] > 0, 90000, `no seal for ${what}`);
    let j = await t.journey(); expect(j.count === 0 && j.next === "bell", "a new book should be empty");
    // The bell: stand in its ring, and strike three times.
    await at("bell"); await t.until(() => t.page.isVisible("#act"), 30000, "standing before the bell offered nothing");
    expect((await t.page.getAttribute("#act", "data-word")) === "撞钟", "the button should say what can be done");
    for (let i = 0; i < 3; i++) { await t.page.click("#act"); await t.frames(2); if (i < 2) await t.until(() => t.page.isVisible("#act"), 20000, "the bell could not be struck again"); }
    await seal("bell", "the bell"); expect((await t.page.textContent("#toastName")).includes("闻钟") && (await t.page.getAttribute("#toastSeal", "src")).startsWith("data:image"), "no seal was shown");
    expect((await t.page.textContent("#bookBtn")).includes("一"), "the book's button should count the seals");
    // Tea, the well, the lamp: walk into the ring, press, wait.
    for (const [id, word] of [["tea", "吃茶"], ["well", "观水"], ["lamp", "燃灯"]]) {
      await at(id); await t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === word, 30000, `nothing offered at ${id}`);
      await t.page.click("#act"); await seal(id, id);
    }
    expect((await t.journey()).lampLit, "the lamp should stay lit");
    // The library gives a line, which must be taken.
    await at("sutra"); await t.until(() => t.page.isVisible("#act"), 30000, "nothing offered at the library"); await t.page.click("#act");
    await t.until(() => t.page.isVisible("#slip"), 60000, "no slip was given"); const line = await t.page.textContent("#slipText"); expect(line.length > 3, "the slip is blank");
    await t.page.click("#slipTake"); await seal("sutra", "the library"); expect((await t.journey()).verse.text === line, "the line was not kept");
    // The book survives leaving and coming back.
    await t.page.reload(); await t.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
    expect((await t.page.textContent("#titleSeals")).includes("五"), "the title should say how many seals are held");
    await t.page.waitForFunction(() => !document.getElementById("enterBtn").disabled); await t.page.click("#enterBtn");
    j = await t.journey(); expect(j.count === 5 && j.lampLit && j.next === "incense", "the book was not remembered: " + JSON.stringify(j));
    // Sitting on the summit, then incense (as the hall reports it): the seventh seal opens the book.
    await at("sit"); await t.until(() => t.page.isVisible("#act"), 30000, "nothing offered on the summit"); await t.page.click("#act");
    await t.until(() => t.page.isVisible("#breath"), 60000, "no breath to follow"); await seal("sit", "sitting");
    await t.page.evaluate(() => window.__inside(true)); await t.until(() => t.inHall(), 30000, "could not go in");
    await at("incense"); await t.until(async () => (await t.page.isVisible("#act")) && (await t.page.getAttribute("#act", "data-word")) === "上香", 30000, "nothing offered before the altar"); await t.page.click("#act");
    await t.until(() => t.page.isVisible("#book"), 60000, "the full book never opened");
    j = await t.journey(); expect(j.done && j.count === 7 && j.book && j.book[0] === 1200, "the book is not complete: " + JSON.stringify(j));
    expect((await t.page.getAttribute("#bookSave", "href")).startsWith("blob:"), "nothing to save"); await t.shot("e2e-book");
    await t.page.click("#bookClose"); expect(!(await t.page.isVisible("#act")), "nothing should be offered once every seal is held");
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
    const bell = await t.page.evaluate(() => window.__listen("effects"));   // the effects bus alone: the music shares the bell's G
    expect(bell.state === "running" && bell.rms > 0.003, "the bell made no sound: " + JSON.stringify(bell));
    expect(bell.peaks.some(([hz]) => Math.abs(hz - 98) < 8 || Math.abs(hz - 196) < 8), "the bell's fundamental is missing: " + JSON.stringify(bell.peaks));
    await t.page.evaluate(() => window.__strike("drum")); await t.page.waitForTimeout(150);
    const drum = await t.page.evaluate(() => window.__listen("effects")); expect(drum.peaks.some(([hz]) => hz < 120), "the drum has no low end: " + JSON.stringify(drum.peaks));
    // The dragon well: silent from the court; standing at it, a drop is heard and rings go out across the water.
    expect((await t.page.evaluate(() => window.__well())).level === 0, "the well is heard from the court");
    const pool = await t.page.evaluate(() => window.__places.well.pool);
    await t.page.evaluate(([x, , z]) => window.__pose(x, z + 2.6, 0, -0.35), pool);   // the pool is [x, y, z] await t.frames(3);
    const w = await t.page.evaluate(() => window.__well(true)); expect(w.level > 0.5, "standing at the well it is not heard: " + JSON.stringify(w));
    await t.frames(3); expect((await t.page.evaluate(() => window.__well())).rings > 0, "the drop sent no ring across the water");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // The music: it begins with the first sound, follows him from place to place once he has settled, ignores pacing
  // along a boundary, steps back for the bell, answers its own slider, goes indoors with him, and is only ever one.
  music: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,29,0,0&view=first");
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
    await t.page.keyboard.press("Escape"); await t.until(() => t.page.isVisible("#setMusic"), 10000, "the menu has no music level");
    await t.page.evaluate(() => { const el = document.getElementById("setMusic"); el.value = "0"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await t.page.waitForTimeout(600); s = await m(); expect(s.levels.music === 0 && s.level < 0.05, "the music slider should silence the music: " + JSON.stringify(s));
    await t.page.evaluate(() => window.__strike("drum")); await t.page.waitForTimeout(150);
    expect((await t.page.evaluate(() => window.__listen("effects"))).rms > 0.003, "with the music silenced the drum should still be heard");
    expect((await t.page.evaluate(() => window.__settings())).music === 0, "the music level was not kept");
    await t.page.evaluate(() => { const el = document.getElementById("setMusic"); el.value = "0.7"; el.dispatchEvent(new Event("input", { bubbles: true })); }); await t.page.keyboard.press("Escape");
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
  // From behind him and through his eyes.
  views: { tier: 2, async run(b, base) {
    // `devpose` is a dev-server aid (src/devpose.js): the published build must neither carry it nor touch the address.
    const t = await open(b, base, "q=low&shot=1&cam=0,24,0,-0.05&view=third&devpose");
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
    expect(await t.page.evaluate(() => location.search === "?q=low&shot=1&cam=0,24,0,-0.05&view=third&devpose" && window.__devpose === undefined), "the published page should leave ?devpose alone");
    // Under the gate, where there is room behind him, it stays back.
    await t.page.evaluate(() => window.__pose(0, 33, 0, -0.05)); await t.frames(14);
    p = await t.probe(); expect(p.camDist > 3.5, "the eye should fall back again in the open: " + p.camDist);
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
      expect(!(await t.page.isVisible("#frame")), "the whole view needs no frame drawn over it");
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
        await t.page.click("#printBack");
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
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third", { viewport: { width: 900, height: 600 } });
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
    await t.page.keyboard.press("b"); await t.until(() => t.page.isVisible("#book"), 60000, "B should open the book"); await t.page.keyboard.press("Escape"); expect(!(await t.page.isVisible("#book")), "Esc should close it");
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
    await t.page.keyboard.press("Escape"); expect(!(await t.page.isVisible("#menu")), "Esc should close the menu again");
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
  // What opens over the walk lies on one stack: Esc puts away the top one, an open sheet holds the walk and the keys, and
  // the focus goes into the sheet and comes back to what opened it.
  layers: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third", { viewport: { width: 900, height: 600 } });
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
  // The seasons are the visitor's once the book has been filled: not offered before, offered after in the photograph's
  // settings, the pause menu and T, said once, and still open after 重新朝山 empties the book for a second walk.
  seasons: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third", { viewport: { width: 900, height: 600 } });
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
  jump: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=third", { viewport: { width: 640, height: 400 } });
    const sample = () => t.page.evaluate(() => { window.__jump = []; const read = () => { const s = window.__yard(); window.__jump.push([s.footY, s.jumping, s.z]); if (window.__jump.length < 400 && (s.jumping || window.__jump.length < 3)) requestAnimationFrame(read); }; requestAnimationFrame(read); });
    const z0 = (await t.state()).z; await sample(); await t.page.keyboard.press("Space");
    await t.until(async () => (await t.page.evaluate(() => window.__jump.some((j) => j[1]))) && !(await t.state()).jumping, 120000, "Space did not send him up and bring him down");
    let js = await t.page.evaluate(() => window.__jump), top = Math.max(...js.map((j) => j[0]));
    expect(top > 0.2 && top < 0.7, `a child's jump should be a hand or two high, not ${top}`); expect(Math.abs((await t.state()).footY) < 0.001 && Math.abs((await t.state()).z - z0) < 0.02, "he should land where he stood");
    expect(!(await t.page.isVisible("#book")) && !(await t.page.isVisible("#slip")), "a jump should open nothing");
    await t.page.keyboard.down("w"); await t.frames(2); await sample(); await t.page.keyboard.press("Space");
    await t.until(async () => (await t.page.evaluate(() => window.__jump.some((j) => j[1]))) && !(await t.state()).jumping, 120000, "he never came down from a running jump");
    await t.page.keyboard.up("w"); js = (await t.page.evaluate(() => window.__jump)).filter((j) => j[1]);
    expect(js.length >= 2 && js[js.length - 1][2] < js[0][2] - 0.02, "he should carry on forward through the air");
    // Where something is offered, Space still jumps and E still does it.
    await t.page.evaluate(() => { const p = window.__places.bell; window.__pose(p.at[0], p.at[1], 0, 0); }); await t.until(() => t.page.isVisible("#act"), 30000, "nothing offered before the bell");
    await t.page.keyboard.press("Space"); await t.frames(3); expect((await t.journey()).strikes === 0, "Space should not strike the bell any more");
    expect(t.errors.length === 0, t.errors.join("\n")); await t.close();
  } },
  // A deliberate low ledge hop: normal walking stays blocked; Space or the touch button clears it.
  drop: { tier: 2, async run(b, base) {
    for (const touch of [false, true]) {
      // (The meditation hall's porch: its neighbour the tea house has a deeper one now, with tables on it.)
      const t = await open(b, base, "q=low&cam=13.65,11,-1.570796,0.22&view=third&season=summer&time=day", touch ? { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true } : { viewport: { width: 640, height: 360 } });
      await t.until(() => t.page.isVisible("#dropBtn"), 30000, "the low unrailed porch offers no way down");
      if (!touch) {
        await t.page.keyboard.down("w"); await t.frames(8); await t.page.keyboard.up("w");
        const edge = await t.state(); expect(edge.h === 0.45 && edge.x > 13.2, "ordinary walking should still stop at the porch edge");
      } else {
        const r = await t.page.locator("#dropBtn").boundingBox(); expect(r.width >= 44 && r.height >= 44 && r.x >= 0 && r.x + r.width <= 390, "touch drop control is too small or outside the screen");
      }
      await t.page.evaluate(() => { window.__dropSamples = []; window.__dropRecording = true; const read = () => { const s = window.__yard(); window.__dropSamples.push({ x: s.x, y: s.footY, dropping: s.dropping }); if (window.__dropRecording) requestAnimationFrame(read); }; requestAnimationFrame(read); });
      if (touch) await t.page.tap("#dropBtn"); else await t.page.keyboard.press("Space");
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
  } },
  // Click-drag (including trackpad presses) and locked movement must agree on look direction; the raised photo camera does not turn.
  camera: { tier: 2, async run(b, base) {
    const t = await open(b, base, "q=low&cam=0,30,0,0&view=first", { viewport: { width: 900, height: 600 } });
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
    const t = await open(b, base, "q=low&fast=1&cam=0,30,0,0&view=first", { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    expect(!(await t.page.$("#jumpBtn")), "a phone is not given a jump button: the porch's 下台阶 shows where it is needed");
    for (const id of ["photoBtn", "menuBtn", "bookBtn"]) {
      const r = await t.page.evaluate((i) => { const b = document.getElementById(i).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight]; }, id);
      expect(r[0] >= 0 && r[1] >= 0 && r[2] <= r[4] && r[3] <= r[5], `#${id} hangs off the screen`); expect(r[2] - r[0] >= 40 && r[3] - r[1] >= 38, `#${id} is too small to tap`);
    }
    expect(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), "the page scrolls");
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
