const { serve, launch, open } = require("/home/user/temple-walk/tests/e2e/lib.cjs");
const fs = require("fs"), label = process.argv[2], O = "/home/user/temple-walk/tools/out/e275/";
(async () => {
  const srv = await serve(), b = await launch();
  for (const v of ["cam06", "cam04"]) {
    const t = await open(b, srv.base, `q=high&shot=1&show=${v}`, { viewport: { width: 960, height: 540 } });
    await t.frames(3); await t.page.screenshot({ path: `${O}shot-${v}-${label}.png`, timeout: 300000 });
    console.log(label, v, JSON.stringify((await t.probe()).post)); await t.close();
  }
  if (label === "branch") {
    const t = await open(b, srv.base, `q=high&show=cam06&season=summer&time=day`, { viewport: { width: 960, height: 540 } });
    await t.frames(3); await t.page.evaluate(() => window.__photo(true)); await t.frames(3);
    const c = await t.page.evaluate(() => window.__capture()); fs.writeFileSync(`${O}cam06-capture-off.jpg`, Buffer.from(c.url.split(",")[1], "base64"));
    console.log("capture", c.w, c.h, JSON.stringify((await t.probe()).post)); await t.close();
  }
  await b.close(); srv.close();
})();
