// What a page does on the card, kept as the evidence for #379 (run with T4_CMD="node tests/e2e/diag/jump.cjs" tools/ci/t4-launch.sh diag); not a scenario.
const { serve, launch, open, renderer } = require("../lib.cjs");
(async () => {
  const srv = await serve(), b = await launch();
  const t = await open(b, srv.base, "q=low&cam=0,30,0,0&view=third&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway", { viewport: { width: 640, height: 400 } });
  await t.page.evaluate(() => { window.__sh = []; const read = () => { const s = window.__yard(); window.__sh.push([s.footY, s.h, s.shadowY, s.shadowOp, s.jumping, performance.now() | 0]); if (window.__shOn) requestAnimationFrame(read); }; window.__shOn = true; requestAnimationFrame(read); });
  await t.frames(3); await t.page.keyboard.press("Space");
  await t.until(async () => !(await t.state()).jumping, 60000, "jump never ended"); await t.frames(5);
  const sh = await t.page.evaluate(() => { window.__shOn = false; return window.__sh; });
  const top = Math.max(...sh.map((q) => q[0])), ti = sh.findIndex((q) => q[0] === top);
  const fmt = (q) => q.map((v) => typeof v === "number" ? +v.toFixed(3) : v);
  console.log("n", sh.length, "first", JSON.stringify(sh.slice(0, 4).map(fmt)), "top@", ti, JSON.stringify(fmt(sh[ti])), "last", JSON.stringify(sh.slice(-3).map(fmt)));
  const jumping = sh.filter((q) => q[4]); console.log("jumping frames", jumping.length, "opacity range", Math.min(...sh.map((q) => q[3])), Math.max(...sh.map((q) => q[3])));
  await b.close(); srv.close();
})();
