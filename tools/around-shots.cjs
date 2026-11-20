// Draws the walk-round survey's pictures (#252) from the plan tools/around.mjs wrote. One page for each place the eye is
// stood in (outdoors, each hall's room, the summit pavilion's top storey), the eye put at each station with __look(at, to)
// and photographed after the page has drawn again: every picture is of what a visitor standing there would see.
//   node tools/around-shots.cjs [--plan=tools/out/around/plan.json] [--out=tools/out/around/shots] [--only=items|visitors]
//        [--limit=N] [--size=960x540] [--vsize=320x180] [--class=匾,建筑]       locally, on SwiftShader: slow, for trying the script
//   as a job: tools/around-gpu.sh (job.cjs calls run() with `open`)
// Files: items/<n>-<side>.jpg, visitors/<n>-<yaw>-<level|up>.jpg; shots.json lists each with its class, id, address and eye.
const fs = require("fs"), path = require("path");
const SIDE_YAWS = [0, 90, 180, 270], UP = (20 * Math.PI) / 180;
const cam = (eye, to) => { const dx = to[0] - eye[0], dy = to[1] - eye[1], dz = to[2] - eye[2]; return { yaw: Math.PI - Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
const r2 = (v) => Math.round(v * 100) / 100;
const addr = (eye, to, where) => { const c = cam(eye, to); return `?${where ? where + "&" : ""}cam=${r2(eye[0])},${r2(eye[2])},${r2(c.yaw)},${r2(c.pitch)}`; };

/** The page each station is looked at in: where the eye must be stood (a room, or the top storey) for the right floor and light. */
const where = (g) => (g === "outdoors" ? "" : g.startsWith("room:") ? "in=" + g.slice(5) : g.startsWith("loft:") ? "up=" + g.slice(5) : "");
const gridOf = (i) => (i.room ? "room:" + i.room : "outdoors");

async function run({ open, out, plan: planArg, size = [960, 540], vsize = [320, 180], only, limit = 1e9, classes, visitorIds, camcheckFrom = [], extras = [], camcheck = [], inspect = false, hideMonk = false, log = console.log }) {
  const plan = typeof planArg === "string" ? (planArg.endsWith(".json") ? JSON.parse(fs.readFileSync(planArg, "utf8")) : require(path.resolve(planArg))) : planArg;
  fs.mkdirSync(out + "/items", { recursive: true }); fs.mkdirSync(out + "/visitors", { recursive: true });
  const work = new Map(), key = (g) => g;   // grid → list of shots
  const push = (g, s) => (work.get(key(g)) || work.set(key(g), []).get(key(g))).push(s);
  let n = 0;
  if (only !== "visitors") plan.items.forEach((it, ii) => { if (classes && !classes.includes(it.cls)) return; for (const st of it.stations) if (st.stand) { if (n++ >= limit) return; push(gridOf(it), { kind: "item", file: `items/${String(ii).padStart(3, "0")}-${st.side}.jpg`, cls: it.cls, id: it.id, side: st.side, eye: st.eye, to: [it.at[0], it.at[1], it.at[2]], size }); } });
  if (only !== "items") plan.visitors.forEach((v, vi) => { if (vi >= limit || (visitorIds && !visitorIds.includes(vi))) return; for (const lvl of [0, UP]) for (const yaw of SIDE_YAWS) { const a = (yaw * Math.PI) / 180, c = Math.cos(lvl); push(v.grid, { kind: "visitor", file: `visitors/${String(vi).padStart(3, "0")}-${yaw}-${lvl ? "up" : "level"}.jpg`, cls: "游客眼", id: String(vi), side: `${yaw}°${lvl ? " up20" : ""}`, eye: v.eye, to: [v.eye[0] + Math.sin(a) * c * 10, v.eye[1] + Math.sin(lvl) * 10, v.eye[2] + Math.cos(a) * c * 10], size: vsize }); } });
  for (const e of extras) push(e.grid, { kind: "extra", file: `extras/${e.name}.jpg`, cls: e.cls || "补拍", id: e.name, side: e.note || "", eye: e.eye, to: e.to, size: e.size || size });
  fs.mkdirSync(out + "/extras", { recursive: true });
  const done = [], t0 = Date.now();
  for (const [grid, shots] of work) {
    const w = where(grid), { ctx, page } = await open(`shot=1&q=high&view=first${w ? "&" + w : "&show=arrive"}`, shots[0].size, 1, { locale: "zh-CN" });
    const draw = async (k = 3) => { const f = await page.evaluate(() => window.__yard().frames); await page.waitForFunction((x) => window.__yard().frames >= x, f + k, { timeout: 300000 }); };
    if (grid.startsWith("room:")) await page.waitForFunction(() => { try { return !/loading/.test(JSON.stringify(window.__figures())); } catch { return true; } }, null, { timeout: 60000 }).catch(() => log(grid + ": figures still loading"));   // the statue is fetched when the room is first entered
    let cur = shots[0].size.join("x");
    for (const s of shots) {
      if (s.size.join("x") !== cur) { await page.setViewportSize({ width: s.size[0], height: s.size[1] }); cur = s.size.join("x"); }
      // The novice stands where the walker is, and the eye (__look) is put anywhere: stand him far from the eye so that his hat is not in front of the lens.
      if (hideMonk) await page.evaluate(([e]) => window.__pose(e[0] + 400, e[2] + 400, 0, 0), [s.eye]);
      await page.evaluate(([a, b]) => window.__look(a, b), [s.eye, s.to]); await draw();
      await page.screenshot({ path: path.join(out, s.file), type: "jpeg", quality: 80, timeout: 120000 });
      const rec = { file: s.file, cls: s.cls, id: s.id, side: s.side, grid, eye: s.eye, to: s.to.map(r2), url: addr(s.eye, s.to, w) };
      if (inspect) Object.assign(rec, await page.evaluate(([e, sz]) => ({ pick: window.__pick(sz[0] / 2, sz[1] / 2, 3), blocked: window.__blocked(e[0], e[2]) }), [s.eye, s.size]));
      done.push(rec);
    }
    log(`${grid}: ${shots.length} pictures`); await ctx.close();
  }
  // Is the address the shots.json gives the picture? Each is opened as a visitor's link (no __look) and drawn once more.
  fs.mkdirSync(out + "/camcheck", { recursive: true });
  for (const c of camcheckFrom) { const d = done.find((x) => x.cls === "游客眼" && x.id === String(c.id) && x.side === c.side); if (d) camcheck.push({ file: c.file, url: (d.grid.startsWith("room:") ? "in=" + d.grid.slice(5) + "&" : "") + d.url.replace(/^\?(in=[^&]*&|up=[^&]*&)?/, "") }); }
  for (const c of camcheck) { const { ctx, page } = await open("shot=1&q=high&view=first&" + c.url.replace(/^\?/, ""), c.size || size); await page.waitForFunction(() => window.__yard().frames > 5); await page.screenshot({ path: path.join(out, "camcheck", c.file), type: "jpeg", quality: 80 }); await ctx.close(); done.push({ file: "camcheck/" + c.file, cls: "地址核对", id: c.file, side: "", url: c.url }); }
  fs.writeFileSync(path.join(out, "shots.json"), JSON.stringify({ made: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), shots: done }, null, 1));
  return { pictures: done.length, seconds: Math.round((Date.now() - t0) / 1000) };
}
module.exports = { run, cam, addr };

if (require.main === module) (async () => {
  const lib = require("../tests/e2e/lib.cjs"), A = (k, d) => (process.argv.find((a) => a.startsWith("--" + k + "=")) || "").slice(k.length + 3) || d, dim = (s) => s.split("x").map(Number);
  const srv = await lib.serve(), browser = await lib.launch();
  const open = async (query, [w, h]) => { const o = await lib.open(browser, srv.base, query, { viewport: { width: w, height: h } }); await o.page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 300000 }); return { ctx: { close: () => o.close() }, page: o.page }; };
  const cls = A("class", ""), r = await run({ open, out: A("out", "tools/out/around/shots"), plan: A("plan", "tools/out/around/plan.json"), size: dim(A("size", "960x540")), vsize: dim(A("vsize", "320x180")), only: A("only", ""), limit: +A("limit", 1e9), classes: cls ? cls.split(",") : null });
  console.log(r); await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
