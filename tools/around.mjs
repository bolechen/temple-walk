// The walk-round survey (#252): from the plan's own data, every kind of thing set out in the place and, from the baked floor,
// where a visitor can stand to look at each from every side; plus a seeded draw of tourists' eyes over the open floor.
//   node tools/around.mjs [outdir]            → <outdir>/plan.json, <outdir>/around-plan.cjs (what the job is handed) and
//                                               inventory.md (the list, with the data each kind was read from). Default tools/out/around.
//   node tools/around.mjs --count            only print the numbers
// The pictures are drawn by tools/around-shots.cjs (locally, or as a T4 job: tools/around-gpu.sh); a contact sheet by
// tools/around-sheet.py. tests/unit/around.test.mjs holds the list to the data.
import { mkdirSync, writeFileSync } from "node:fs";
import { buildDrawn } from "./walk/scene.mjs";
import { inventory, pick, stationsFor, visitors, floor, EYE, HIGH } from "./around/plan.mjs";
import { ensure, prepare } from "./bake-walk.mjs";
import { levelFromCommandLine, levelObject, walkFile } from "./walk/level-arg.mjs";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2), out = args.find((a) => !a.startsWith("--")) || "tools/out/around";
// Which level (docs/t05/LEVEL-SPLIT.md S6): --level=<id>, the prologue by default; its floor, from the cache or baked (a minute).
const id = levelFromCommandLine(), L = await levelObject(id);
ensure(prepare(L));
const drawn = buildDrawn(L), fl = floor(readFileSync(walkFile(id))), all = inventory(drawn), chosen = pick(all);
const items = chosen.map((i) => ({ ...i, stations: stationsFor(i, fl) }));
const v = visitors(fl, 200);
const cls = {}; for (const i of all) (cls[i.cls] ||= { n: 0, shown: 0, source: i.source }).n++;
for (const i of items) cls[i.cls].shown++;
const stats = { classes: cls, items: items.length, stations: items.reduce((n, i) => n + i.stations.filter((s) => s.stand).length, 0), cannot: items.reduce((n, i) => n + i.stations.filter((s) => !s.stand).length, 0), visitors: v.stations.length, openCells: v.cells, floorHeader: { geometry: fl.header.grids.map((g) => g.geometry).join(",").slice(0, 40) } };
if (args.includes("--count")) { console.log(JSON.stringify(stats, null, 1)); process.exit(0); }
mkdirSync(out, { recursive: true });
const plan = { eye: EYE, high: HIGH, items, visitors: v.stations, stats };
writeFileSync(`${out}/plan.json`, JSON.stringify(plan));
writeFileSync(`${out}/around-plan.cjs`, `module.exports=${JSON.stringify(plan)};\n`);
const md = ["# 清单：场上每一类东西，从哪份数据读到", "", "| 类 | 总数 | 拍的 | 数据来源 |", "|---|---|---|---|", ...Object.entries(cls).map(([k, c]) => `| ${k} | ${c.n} | ${c.shown} | ${c.source} |`), "",
  `共 ${items.length} 件，${stats.stations} 个站位（含斜俯视），${stats.cannot} 个方向「站不到」；游客眼 ${stats.visitors} 个，取自 ${stats.openCells} 个可走格子。`, "",
  "## 站不到的方向", "", ...items.flatMap((i) => i.stations.filter((s) => !s.stand).map((s) => `- ${i.cls} ${i.id}${i.room ? "（" + i.room + " 殿内）" : ""}：${s.side}，${s.why}`))];
writeFileSync(`${out}/inventory.md`, md.join("\n") + "\n");
console.log(`plan: ${items.length} items, ${stats.stations} stations (${stats.cannot} cannot be stood at), ${v.stations.length} visitors → ${out}`);
