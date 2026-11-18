// His reach from his centre at every 5 cm of height, over every pose, as tools/edges.mjs measures it from the real
// models (both bodies), written to tools/walk/outline.json for the bake (tools/walk/bake.mjs): the floor is kept his
// reach off whatever stands at each height, the same solid of revolution the edge sweep checks against. A new body
// (#163) is measured again with this, and the grid baked again (its fingerprint includes this file).
//   node tools/walk/outline.mjs
import { writeFileSync } from "node:fs";
const { outline } = await import("../edges.mjs");
const o = outline();
writeFileSync(new URL("./outline.json", import.meta.url), JSON.stringify({ bin: 0.05, reach: Array.from(o, (v) => +v.toFixed(3)), low: Array.from(o.low, (v) => +v.toFixed(3)) }) + "\n");
