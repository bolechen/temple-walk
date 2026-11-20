// Run inside tools/gpu/job.cjs on a real graphics card (launched by tools/t05-gpu.sh, issue #280): the white-box hall
// of seven Buddhas with no statues, with one, with three and with seven, each measured with the card made to finish
// every frame (window.hall.cost, as the site's __cost), at 1080p from the door and from the side aisle, and a picture
// of each. The seven are the three files repeated, so the number is what seven statues of that budget cost.
// A set may also say `paint` (issue #287: the figures painted by tools/t05-hall/paint/, or not) and its own `views`.
const path = require("path"), fs = require("fs");
exports.run = async ({ open, out, log, size = [1920, 1080], frames = 120, sets }) => {
  fs.mkdirSync(out, { recursive: true });
  const rows = [];
  for (const set of sets) for (const view of set.views || ["door3", "side3"]) {
    const { ctx, page } = await open(`w=${size[0]}&h=${size[1]}&ao=${set.ao === false ? 0 : 1}`, size, 1);
    await page.evaluate((l) => window.hall.setStatues(l), set.statues);
    if (set.paint !== undefined) await page.evaluate((p) => window.hall.paint(p), set.paint);
    const r = await page.evaluate(([v, n, m]) => { window.hall.setMood(m); window.hall.view(v); const s = window.hall.stats(); return { ...s, ms: window.hall.cost(n), info: window.hall.info() }; }, [view, frames, set.mood || "winter"]);
    const file = `${set.name}-${view}.png`; await page.screenshot({ path: path.join(out, file) });
    rows.push({ set: set.name, view, ao: set.ao !== false, paint: set.paint ?? null, file, ...r }); log(set.name, view, JSON.stringify(r)); await ctx.close();
  }
  return rows;
};
