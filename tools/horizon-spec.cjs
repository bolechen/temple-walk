// The JSON spec for tools/gpu-render.sh that draws the views issue #114 names, in the four moods, plus the first
// court's cost on both tiers. usage: node tools/horizon-spec.cjs [tag]   (tag is put in each file name: before | after)
const tag = process.argv[2] || "after", moods = [["summer", "day"], ["autumn", "dusk"], ["winter", "day"], ["spring", "dawn"]];
const cam = (name, x, z, yaw, pitch) => moods.map(([s, t]) => ({ file: `${tag}-${name}_${s}-${t}`, query: `shot=1&q=high&view=first&season=${s}&time=${t}&cam=${x},${z},${yaw},${pitch}` }));
const shots = [
  ...cam("bamboo-s", 21.3, 91.6, 3.142, 0.04), ...cam("bamboo-e", 21.3, 91.6, 1.571, 0.04), ...cam("bamboo-w", 21.3, 91.6, -1.571, 0.04), ...cam("bamboo-n", 21.3, 91.6, 0, 0.04),
  ...cam("lx-e", -3, -119.6, 1.571, 0.04), ...cam("lx-w", 3, -119.6, -1.571, 0.04), ...cam("stair-out", 10.2, 77.4, 2.5, -0.02),
  ...moods.map(([s, t]) => ({ file: `${tag}-lookback_${s}-${t}`, query: `shot=1&q=high&show=lookback&season=${s}&time=${t}` })),
];
console.log(JSON.stringify({ seconds: 6, size: [1600, 900], bench: [
  { view: "court", q: "high", size: [1920, 1080], season: "autumn", time: "dusk" },
  { view: "court", q: "low", size: [390, 844], scale: 3, season: "autumn", time: "dusk" } ], shots }));
