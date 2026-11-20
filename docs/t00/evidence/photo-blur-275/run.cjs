const { serve, launch, open } = require("/home/user/temple-walk/tests/e2e/lib.cjs");
const fs = require("fs"), O = "/home/user/temple-walk/tools/out/e275/";
(async () => {
  const srv = await serve(), b = await launch(), rep = {};
  for (const v of ["tea", "court", "cam04"]) {
    const t = await open(b, srv.base, `q=high&show=${v}&season=summer&time=day`, { viewport: { width: 640, height: 360 } });
    await t.frames(3);
    const shot = async (n) => { await t.frames(3); await t.page.screenshot({ path: `${O}${v}-${n}.png`, timeout: 300000 }); };
    await shot("0-before"); const p0 = await t.probe();
    await t.page.evaluate(() => window.__photo(true)); await shot("1-raised-off"); const p1 = await t.probe();
    // noise floor: two successive frames of the same raised view
    await shot("1b-raised-off-again");
    let cap;
    if (v === "court") { cap = await t.page.evaluate(() => window.__capture()); fs.writeFileSync(`${O}court-capture-off.jpg`, Buffer.from(cap.url.split(",")[1], "base64")); }
    await t.page.evaluate(() => document.getElementById("photoSettingsToggle").click()); await t.page.evaluate(() => document.getElementById("blurToggle").click()); await t.page.evaluate(() => document.getElementById("photoSettingsToggle").click());
    await shot("2-raised-on"); const p2 = await t.probe();
    if (v === "court") { cap = await t.page.evaluate(() => window.__capture()); fs.writeFileSync(`${O}court-capture-on.jpg`, Buffer.from(cap.url.split(",")[1], "base64")); }
    rep[v] = { dof: [p0.post.dof, p1.post.dof, p2.post.dof], focus: p2.post.focus, errors: t.errors };
    await t.close();
  }
  rep.shot = {};
  for (const c of ["cam01","cam02","cam03","cam04","cam05","cam06"]) {
    const t = await open(b, srv.base, `q=high&shot=1&show=${c}`, { viewport: { width: 480, height: 270 } }); await t.frames(2);
    rep.shot[c] = (await t.probe()).post.dof; await t.close();
  }
  fs.writeFileSync(O + "report.json", JSON.stringify(rep, null, 1)); console.log(JSON.stringify(rep)); await b.close(); srv.close();
})();
