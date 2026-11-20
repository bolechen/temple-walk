const { serve, launch, open } = require("/home/user/temple-walk/tests/e2e/lib.cjs");
(async () => {
  const srv = await serve(), b = await launch(), out = {};
  for (const q of ["high", "medium", "low"]) for (const v of ["tea", "court"]) {
    const t = await open(b, srv.base, `q=${q}&show=${v}&season=summer&time=day&shot=0`, { viewport: { width: 320, height: 180 } });
    await t.frames(3); const m = async () => { await t.frames(2); const p = await t.probe(); return p.mean || p.rgb || p.lum; };
    const pr = async () => (await t.probe());
    const a = await pr(); await t.page.evaluate(() => window.__photo(true)); await t.frames(3); const c = await pr();
    out[q + "/" + v] = { before: a.lum, raised: c.lum, dof: [a.post.dof, c.post.dof] }; await t.close();
  }
  console.log(JSON.stringify(out)); await b.close(); srv.close();
})();
