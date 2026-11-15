// Diagnostic: sample the effects bus at intervals after a drum and after a bell (hooks used: diagnostic only).
const path = require("path"); const wt = process.argv[2];
const { serve, launch, open } = require(path.join(wt, "tests/e2e/lib.cjs"));
(async () => { const s = await serve(), b = await launch(); const t = await open(b, s.base, "q=low&show=court");
  for (const kind of ["drum", "bell", "drum"]) {
    const t0 = Date.now(); await t.page.evaluate((k) => window.__strike(k), kind); const rows = [];
    for (const ms of [50, 150, 300, 600, 1200, 2500]) { while (Date.now() - t0 < ms) await t.page.waitForTimeout(10); const l = await t.page.evaluate(() => window.__listen("effects")); rows.push([ms, Date.now() - t0, +l.rms.toFixed(4), l.state, (l.peaks || []).slice(0, 3)]); }
    console.log(kind, JSON.stringify(rows)); await t.page.waitForTimeout(3000);
  }
  console.log("errors", JSON.stringify(t.errors)); await b.close(); s.close(); })().catch((e) => { console.log("FAILED", e); process.exit(1); });
