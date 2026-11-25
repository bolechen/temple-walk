// How nearly the seated novice's outline is the design sheet's (#664): intersection over union from the front and from
// his side, and the two laid over each other as pictures → tools/out/novice-sit/{front,side}.png and report.json.
//
//   node tools/novice-sit-iou.mjs [outdir]
//
// What is compared and how the two are brought to one scale: tools/novice-sit-lib.mjs.
import "../tests/unit/dom-stub.mjs";
import fs from "node:fs";
import path from "node:path";
const { createMonk } = await import("../app/src/monk.js");
const { VIEWS, refMask, seat, triangles, overlay, overlayPNG } = await import("./novice-sit-lib.mjs");

const out = path.resolve(process.argv[2] || new URL("./out/novice-sit/", import.meta.url).pathname); fs.mkdirSync(out, { recursive: true });
const monk = seat(createMonk), tris = triangles(monk), report = {};
for (const [name, { across }] of Object.entries(VIEWS)) {
  const o = overlay(tris, across, await refMask(name));
  await overlayPNG(o, path.join(out, `${name}.png`));
  report[name] = { iou: +o.iou.toFixed(4), pxPerMetre: +o.scale.toFixed(1), onlyOurs: o.ours - o.both, onlySheet: o.ref - o.both };
  console.log(`${name}: IoU ${o.iou.toFixed(4)} (${o.scale.toFixed(0)} px to the metre; only ours ${o.ours - o.both} px, only the sheet's ${o.ref - o.both} px)`);
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
