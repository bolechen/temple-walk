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
