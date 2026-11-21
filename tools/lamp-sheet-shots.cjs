// The lamp sheet (#343) as three screens see it, in every language, before a line is chosen and after: a desktop 16:9, a phone upright and a
// phone on its side. → tools/out/lamp-sheet/<lang>-<screen>-<list|card>.png and a contact sheet per language. Looked at, not asserted:
// mobile-audit measures the paper's place (`placed`) and the controls; this is for the eye.
const fs = require("fs"), path = require("path");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");
(async () => {
  const dir = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "lamp-sheet"); fs.mkdirSync(dir, { recursive: true });
  const langs = ((process.argv.find((a) => a.startsWith("--langs=")) || "").slice(8) || "zh,ja,en,ko").split(",");
  const screens = { desktop: { viewport: { width: 1280, height: 720 } }, upright: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, side: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };
  const srv = await serve(), b = await launch(), made = [];
  for (const lang of langs) for (const [screen, ctx] of Object.entries(screens)) {
    const t = await open(b, srv.base, `q=low&lang=${lang}&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway`, ctx);
    await t.page.evaluate(() => window.__bless()); await t.page.waitForTimeout(1500); const a = path.join(dir, `${lang}-${screen}-list.png`); await t.page.screenshot({ path: a });
    await t.page.evaluate(() => window.__bless(7)); await t.page.waitForFunction(() => !document.getElementById("blessActs").hidden, null, { timeout: 60000 }); await t.page.waitForTimeout(800);
    const c = path.join(dir, `${lang}-${screen}-card.png`); await t.page.screenshot({ path: c }); made.push(a, c); await t.close(); console.log("shot", lang, screen);
  }
  await b.close(); srv.close();
})();
