// Run inside tools/gpu/job.cjs on a real graphics card (launched by tools/t05-gpu.sh, issue #280): the white-box hall
// of seven Buddhas with no statues, with one, with three and with seven, each measured with the card made to finish
// every frame (window.hall.cost, as the site's __cost), at 1080p from the door and from the side aisle, and a picture
// of each. The seven are the three files repeated, so the number is what seven statues of that budget cost.
// A set may also say `paint` (issue #287: the figures painted by tools/t05-hall/paint/, or not) and its own `views`.
const path = require("path"), fs = require("fs");
exports.run = async ({ open, out, log, size = [1920, 1080], frames = 120, sets }) => {
  fs.mkdirSync(out, { recursive: true });
  const rows = [];
  for (const set of sets.filter((x) => x.shots)) {   // pictures for review (issue #370): window.hall.shoot, one page
    const sz = set.size || size, { ctx, page } = await open(`w=${sz[0]}&h=${sz[1]}&ao=1`, sz, 1);
    await page.evaluate((l) => window.hall.setStatues(l), set.statues);
    for (const sh of set.shots) { await page.evaluate((s) => window.hall.shoot(s), sh.shoot); const file = `${set.name}-${sh.name}.png`;
      await page.screenshot({ path: path.join(out, file) }); rows.push({ set: set.name, view: sh.name, file, ms: 0, tris: 0, calls: 0, shot: true }); log(set.name, sh.name); }
    await ctx.close();
  }
  for (const set of sets.filter((x) => !x.shots)) for (const view of set.views || ["door3", "side3"]) {
    const sz = set.size || size, { ctx, page } = await open(`w=${sz[0]}&h=${sz[1]}&ao=${set.ao === false ? 0 : 1}&aoi=${set.aoi ?? 0.85}`, sz, 1);   // a set may name its own size (#370: the low tier at 960×540)
    await page.evaluate((l) => window.hall.setStatues(l), set.statues);
    if (set.paint !== undefined) await page.evaluate((p) => window.hall.paint(p), set.paint);
    const r = await page.evaluate(([v, n, m]) => { window.hall.setMood(m); window.hall.view(v); const s = window.hall.stats(); return { ...s, ms: window.hall.cost(n), info: window.hall.info() }; }, [view, frames, set.mood || "winter"]);
    const file = `${set.name}-${view}.png`; await page.screenshot({ path: path.join(out, file) });
    rows.push({ set: set.name, view, size: sz, ao: set.ao !== false, paint: set.paint ?? null, file, ...r }); log(set.name, view, JSON.stringify(r)); await ctx.close();
  }
  return rows;
};
