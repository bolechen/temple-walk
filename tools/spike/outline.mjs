// His reach from his centre at every 5 cm of height, over every pose, as tools/edges.mjs measures it from the real
// models (both bodies): written to tools/spike/outline.json for the drawn walker, so that the walker's notion of his
// width is the same solid of revolution the edge sweep checks against, not a cylinder of BODY.
import { writeFileSync } from "node:fs";
const { outline } = await import("../edges.mjs");
const o = outline();
writeFileSync(new URL("../../app/src/spike/outline.json", import.meta.url), JSON.stringify({ bin: 0.05, reach: Array.from(o, (v) => +v.toFixed(3)), low: Array.from(o.low, (v) => +v.toFixed(3)) }) + "\n");
