// The leaves coming down with the gusts and lying where they fell (#267), filmed on the GPU job (job.cjs's `script`):
// the picture is held (`?shot`) and the falling run on a frame's worth at a time by `__litter(secs)`, so the minute is
// filmed as it would pass. Frames are JPEGs in <out>/; tools/litter-film.cjs does the same in software.
//   EXTRA_FILES=tools/gpu/litter-film-job.cjs tools/gpu-render.sh t4-small '{"script":"litter-film-job.cjs","args":{"from":90,"secs":60,"fps":12}}'
const fs = require("fs"), path = require("path");
async function run({ open, out, cam = "-7.5,33,-0.38,-0.32", season = "autumn", time = "day", from = 90, secs = 60, fps = 12, size = [1280, 720], log = console.log }) {
  fs.mkdirSync(out, { recursive: true });
  const { ctx, page } = await open(`shot=1&q=high&cam=${cam}&season=${season}&time=${time}`, size, 1);
  await page.waitForTimeout(2500);
  await page.evaluate((s) => window.__litter(s), from);
  const timeline = [];
  for (let i = 0; i < secs * fps; i++) {
    const r = await page.evaluate((dt) => window.__litter(dt), 1 / fps);
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    await page.screenshot({ path: path.join(out, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 88 });
    if (i % fps === 0) { const row = { t: from + i / fps, kept: r.kept, landed: r.landed }; timeline.push(row); log("film", JSON.stringify(row)); }
  }
  await ctx.close();
  return timeline;
}
module.exports = { run };
