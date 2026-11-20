// A lamp lit for someone (#343) as it is seen: the card that goes with the link, and the lamp (with its slip) shown to whoever opens it.
//
//     node tools/lamp-views.cjs [outdir] [--langs=zh,en] [--wish=3]     → tools/out/lamp/lamp-card-<lang>.jpg, lamp-arrival-<lang>.png, a contact sheet
//
// The card is read off the page's own sheet (the book's journey kept in memory, as ?seals= does); the arrival is the page opened
// with the link's fragment, drawn whole, a moment after the lamp is shown.
const fs = require("fs"), path = require("path");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");
(async () => {
  const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").slice(n.length + 3) || d, dir = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "lamp");
  const langs = arg("langs", "zh,ja,en,ko").split(","), wish = +arg("wish", "3"); fs.mkdirSync(dir, { recursive: true });
  const { bookFrom } = await import("../app/src/journey.js"), { encodeLamp } = await import("../app/src/wishes.js");
  const srv = await serve(), b = await launch(), hash = "#" + encodeLamp({ wish, season: "autumn", time: "dusk" });
  for (const lang of langs) {
    const a = await open(b, srv.base, `q=low&lang=${lang}&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway`, { init: `localStorage.setItem("yunjing.journey.v1", ${JSON.stringify(bookFrom("lamp"))}); localStorage.setItem("yunjing.lang.v1", "${lang}");` });
    await a.page.evaluate(() => { const p = window.__places.lamp; window.__pose(p.at[0], p.at[1], 0, 0); });
    await a.until(async () => (await a.page.isVisible("#act")), 60000, "no button"); await a.page.click("#act"); await a.page.locator("#blessList [data-wish]").nth(wish).click();
    await a.page.waitForFunction(() => { const i = document.getElementById("blessImg"); return i.complete && i.naturalWidth === 1080; }, null, { timeout: 60000 });
    const b64 = await a.page.evaluate(async () => { const r = await (await fetch(document.getElementById("blessSave").href)).blob(), u8 = new Uint8Array(await r.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); });
    fs.writeFileSync(path.join(dir, `lamp-card-${lang}.jpg`), Buffer.from(b64, "base64")); await a.close();
    const r = await open(b, srv.base, `q=low&lang=${lang}&fast=1&season=autumn&time=dusk` + hash);
    await r.until(() => r.page.evaluate(() => window.__lamp().shown), 120000, "not shown"); await r.until(async () => /./.test(await r.page.textContent("#say")), 60000, "no line"); await r.frames(3);
    await r.page.waitForTimeout(1500); await r.shot(`lamp-arrival-${lang}`); fs.copyFileSync(path.join(require("../tests/e2e/lib.cjs").out, `lamp-arrival-${lang}.png`), path.join(dir, `lamp-arrival-${lang}.png`)); await r.close();
    console.log("wrote", lang);
  }
  await b.close(); srv.close();
})();
