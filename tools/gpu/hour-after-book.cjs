// #726 on a real card, run beside tools/gpu/job.cjs as its `script`: the clock is set to 22:30 (a summer night at home), six seals
// are kept, he sits on the summit for the seventh, the close plays, the book is opened and shut. Pictures: the book open (the hour still
// day), the first frame after it is shut (the ink leaves shut over the new hour), the ink half open, the night once it is open. The page's
// clock is held still while the ink is photographed (performance.now is stubbed for those few frames), so the pictures are of known
// points of the ink, not of whatever a screenshot's delay lands on. The same flow is run on the build handed to the job and on the base
// build staged under base/ (BASE_SITE), which has no such change: there the night is asked for by hand (`__mood`), for the same view.
//   BASE_SITE=<dir of main's build> EXTRA_FILES=tools/gpu/hour-after-book.cjs tools/gpu-render.sh t4-small '{"script":"hour-after-book.cjs","args":{}}'
const fs = require("fs"), path = require("path");
exports.run = async ({ open, out, log, q = "medium", scale = 2 }) => {
  fs.mkdirSync(out, { recursive: true });
  const rows = [];
  for (const [label, at, feature] of [["this", "", true], ["base", "base/", false]]) {
    const row = { label, feature };
    try {
      const { ctx, page } = await open(`q=${q}&fast=1&seed=4&view=third&enter`, [390, 844], scale, { path: at, hasTouch: true, isMobile: true });
      await ctx.addInitScript(() => {
        const Real = Date, off = new Real(2026, 6, 15, 22, 30).getTime() - Real.now();
        window.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + off); } static now() { return Real.now() + off; } };
        if (!localStorage.getItem("test.seeded")) { localStorage.setItem("test.seeded", "1"); localStorage.setItem("yunjing.journey.v1", JSON.stringify({ v: 1, born: 1, seals: Object.fromEntries(["bell", "incense", "tea", "sutra", "well", "lamp"].map((id, i) => [id, 10 + i])), strikes: 3, verse: null, done: null, opened: null, told: false, closed: null, closedSeason: null, stamped: null })); }
      });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "commit" });
      await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 240000 });
      await page.evaluate(() => { try { window.__enter?.(); } catch {} });
      const probe = () => page.evaluate(() => { const p = window.__probe(); return { time: p.time, follow: p.follow ?? null, lamp: p.lamp }; });
      row.start = await probe();
      await page.evaluate(() => { const q = window.__places.sit; const tries = [[0, 0]]; for (let r = 1; r <= 12; r++) for (let k = 0; k < 16; k++) tries.push([Math.cos(k * Math.PI / 8) * r * 0.1, Math.sin(k * Math.PI / 8) * r * 0.1]); for (const [dx, dz] of tries) { window.__pose(q.at[0] + 0.3 + dx, q.at[1] + 0.3 + dz, 0, 0); if (!window.__walker().blockedHere) break; } });
      await page.waitForFunction(() => { const a = document.getElementById("act"); return a && a.offsetParent !== null && a.dataset.word === "静坐"; }, null, { timeout: 60000, polling: 250 });
      await page.click("#act");
      await page.waitForFunction(() => window.__rites().ended === 1, null, { timeout: 300000, polling: 500 });
      await page.keyboard.press("b");
      await page.waitForSelector("#book", { state: "visible", timeout: 120000 });
      await page.waitForTimeout(1500);
      row.beforeShut = await probe();
      await page.screenshot({ path: path.join(out, `${label}-1-book-open.png`) });
      // the page's clock held still from here to the end of the ink
      await page.evaluate(() => { const real = performance.now.bind(performance); window.__virt = null; performance.now = () => (window.__virt === null ? real() : window.__virt); window.__realNow = real;
        window.__frames = []; const tag = () => document.getElementById("moodTag").textContent, leaf = () => document.querySelector("#curtain i").style.transform;
        const f = () => { window.__frames.push({ open: document.getElementById("book").open, words: tag(), ink: leaf() }); requestAnimationFrame(f); }; requestAnimationFrame(f); window.__dayWords = tag(); window.__virt = real(); });
      await page.evaluate(() => document.getElementById("bookClose").click());   // (a click through the driver waits on a page whose clock is held)
      if (!feature) await page.evaluate(() => window.__mood("summer", "night"));   // the base build leaves the hour alone: the same night, asked for by hand
      for (let i = 0; i < 6; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const ink = () => page.evaluate(() => document.querySelector("#curtain i").style.transform || "");
      row.inkShut = await ink(); row.afterShut = await probe();
      await page.screenshot({ path: path.join(out, `${label}-2-first-frame-after-book.png`) });
      await page.evaluate(() => { window.__virt += 120 + 300; });   // HOLD 0.12 s, then half of the 0.6 s opening: smoothstep 0.5 is 0.5
      for (let i = 0; i < 6; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      row.inkHalf = await ink();
      await page.screenshot({ path: path.join(out, `${label}-3-ink-half.png`) });
      await page.evaluate(() => { window.__virt += 600; });
      for (let i = 0; i < 6; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      row.inkOpen = await ink();
      await page.evaluate(() => { window.__virt = null; });
      await page.waitForTimeout(800);
      row.after = await probe();
      await page.screenshot({ path: path.join(out, `${label}-4-night.png`) });
      row.hint = await page.evaluate(() => ({ text: document.getElementById("hint").textContent, on: document.getElementById("hint").classList.contains("on") }));
      const fr = await page.evaluate(() => ({ f: window.__frames, day: window.__dayWords })), closed = fr.f.filter((x) => !x.open);
      row.framesAfterBook = closed.length; row.framesWithOldHour = closed.filter((x) => x.words === fr.day).length;
      await ctx.close();
    } catch (e) { row.error = String(e.stack || e.message).slice(0, 600); log(label, "failed", row.error); }
    rows.push(row);
  }
  fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify(rows, null, 2));
  return rows;
};
