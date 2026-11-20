// What a page does on the card, kept as the evidence for #379 (run with T4_CMD="node tests/e2e/diag/taps.cjs" tools/ci/t4-launch.sh diag); not a scenario.
const { serve, launch, open, renderer } = require("../lib.cjs");
(async () => {
  const srv = await serve(), b = await launch();
  console.log("renderer", await renderer(b));
  const t = await open(b, srv.base, "q=low&fast=1&view=first&cam=0,30,0,0&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway" , { hasTouch: true });
  for (const trial of [1, 2, 3]) {
    await t.page.evaluate(() => window.__pose(0, 30, 0, 0)); await t.frames(2);
    const s0 = await t.state(); const t0 = Date.now();
    await t.page.touchscreen.tap(210, 520);
    const seen = [];
    for (let i = 0; i < 30; i++) { const s = await t.state(); seen.push([Date.now() - t0, s.frames, s.target ? s.target.map((v) => +v.toFixed(2)) : null, s.route]); await t.page.waitForTimeout(100); }
    console.log("trial", trial, "frames at tap", s0.frames, JSON.stringify(seen.filter((_, i) => i < 4 || seen[i][2] !== seen[i - 1][2])));
    await t.page.evaluate(() => window.__walk([])); await t.frames(2);
  }
  console.log("vp", JSON.stringify(t.page.viewportSize()), "errors", t.errors);
  await b.close(); srv.close();
})();
