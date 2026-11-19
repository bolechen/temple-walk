// The second round of the survey (#252 review): the stations the first round's contact sheets raised a question about,
// drawn full size with what the page's own picking and walker say. Writes the job's spec to stdout.
//   node tools/around/follow.mjs > spec.json      (tools/around-gpu.sh --follow runs it)
import { readFileSync } from "node:fs";
import { buildDrawn } from "../walk/scene.mjs";
import { floor } from "./plan.mjs";
const plan = JSON.parse(readFileSync("tools/out/around/plan.json", "utf8"));
const ids = [3, 4, 7, 13, 54, 94, 113, 119, 133, 137, 170, 184, 185, 187, 190, 37, 73, 155, 46, 68, 65, 69, 141, 56, 109, 154, 197, 61, 32, 192, 171];
const extras = [];
// The great hall's Buddha from behind, from farther off and a little above: the first round stood too close under the pedestal.
const fl = floor(), altar = plan.items.find((i) => i.cls === "佛像与台座" && i.id === "main");
for (const [n, dx, dz] of [["a", 3.5, -2.6], ["b", -3.5, -2.6], ["c", 0, -2.6]]) {
  const p = fl.near("room:main", altar.at[0] + dx, altar.at[2] + dz, 1.2);
  if (p) extras.push({ name: `main-altar-back-${n}`, cls: "佛像背面", grid: "room:main", eye: [p.x, p.y + 2.0, p.z], to: [altar.at[0], altar.at[1] + 0.5, altar.at[2]], note: "from farther off, eye 2 m, 3.5 m to the side" });
}
// Three addresses to open as a visitor's link and compare with the picture __look drew: level, looking up, in a hall.
const shots = (i) => ({ file: `v${i}`, url: null });
console.log(JSON.stringify({ seconds: 0, shots: [], script: "around-shots.cjs", args: { plan: "around-plan.cjs", out: "shots", size: [960, 540], vsize: [960, 540], visitorIds: ids, classes: ["殿门"], extras, inspect: true, hideMonk: true, camcheckFrom: [{ id: 4, side: "90°", file: "level.jpg" }, { id: 171, side: "180° up20", file: "up.jpg" }, { id: 3, side: "0°", file: "room.jpg" }] } }));
