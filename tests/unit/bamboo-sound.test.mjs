// Two culms knocking in the wind: only in a strong gust, only deep in the bamboo at the start, and rare.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { knockReady } = await import("../../app/src/audio.js");
// The same two slow waves the ambience draws its gusts from, a quarter second at a time over ten minutes.
const gusts = Array.from({ length: 2400 }, (_, i) => { const t = (i + 1) * 0.25; return 0.5 + 0.3 * Math.sin(t * 0.11) + 0.2 * Math.sin(t * 0.043 + 1.7); });

test("in the grove the culms can knock only in the strongest part of a gust", () => {
  const share = gusts.filter((g) => knockReady(g, 1)).length / gusts.length;
  assert.ok(share > 0.03 && share < 0.35, `ready ${(share * 100).toFixed(1)}% of the time`);
  assert.ok(!knockReady(0.6, 1), "a middling wind knocked them");
});

test("out of the bamboo at the start (the courts, the thinner stands higher up) they never knock", () => {
  for (const grove of [0, 0.12, 0.55]) assert.ok(!gusts.some((g) => knockReady(g, grove)), `knocked at grove ${grove}`);
});

// Birds, after Chang Jian: out on the mountain they sing, within the walls only bell and chime are heard.
const { birdGap } = await import("../../app/src/audio.js");
test("birds sing in the bamboo and on the path up, never within the walls, the halls or the summit's court", () => {
  for (const zone of ["court", "gate", "hall", "upper", "summit"]) for (const time of ["dawn", "day", "dusk", "night"]) assert.equal(birdGap(zone, time, "summer"), 0, `a bird in ${zone} at ${time}`);
  assert.ok(birdGap("grove", "day", "summer") > 0 && birdGap("stair", "day", "summer") > 0);
});
test("most at first light, fewer by day, a last few at dusk, none at night, few in winter", () => {
  const g = (time, season = "summer") => birdGap("grove", time, season);
  assert.ok(g("dawn") < g("day") && g("day") < g("dusk"), "dawn should be the busiest");
  assert.equal(g("night"), 0); assert.equal(g("night", "winter"), 0);
  assert.ok(g("day", "winter") > g("day") * 2, "winter is not quieter");
  assert.ok(g("dawn") >= 5, "so many birds that they crowd the quiet");
});

// The wind heard and the wind seen are one wind (#267): the ambience takes its gusts from the picture's clock, the same
// moment the trees let go of their leaves by (wind.js's shedAt) and the smoke leans by.
const { gustHeard } = await import("../../app/src/audio.js");
const { gust, windAt } = await import("../../app/src/wind.js");
test("the gust heard at a moment is the gust the leaves and the smoke are drawn by at that moment", () => {
  for (const t of [0, 3.25, 41.5, 133.75, 600.1, 3601.9, 86400.5]) {
    // Whatever the ambience's own count says (it began at the first touch, and stops in the background), the page's clock wins.
    for (const own of [0, 12.5, t - 37, t + 210]) assert.equal(gustHeard({ t }, own), gust(t), `heard and seen differ at t=${t}, own=${own}`);
    // The breeze the smoke and the falling leaves are carried by (yard.js: windAt at the frame's t) is that same gust.
    assert.equal(windAt(1, t), 0.35 + 0.65 * gust(t));
  }
  // A page that gives no clock keeps the ambience's own count, as before.
  assert.equal(gustHeard({}, 17.25), gust(17.25));
});
