// The great bell: struck with a log, it rings long and darkens as it fades.
import test from "node:test"; import assert from "node:assert/strict";
import { BELL } from "../../app/src/instruments.js";
import { MODE, hz } from "../../app/src/score.js";

test("the bell rings on the music's key, its hum is the last thing heard, and the high partials die first", () => {
  assert.ok(Math.abs(BELL.f0 - hz(MODE.tonic)) < 0.01, "the bell's fundamental is the tonic the music is built on");
  const [hum, prime, ...upper] = BELL.partials;
  assert.equal(hum[0], 0.5); assert.equal(prime[0], 1);
  assert.ok(hum[2] >= 40, `the hum dies in ${hum[2]} s: a great bell is heard for most of a minute`);
  assert.ok(prime[2] >= 30, `the fundamental dies in ${prime[2]} s`);
  assert.ok(hum[3] > 0.2, "the hum swells a moment after the stroke rather than starting at once");
  const all = [hum, prime, ...upper];
  for (let i = 1; i < all.length; i++) assert.ok(all[i][2] < all[i - 1][2], `partial ${all[i][0]} outlasts the one below it`);
  for (const [r, a] of upper) assert.ok(a <= prime[1], `partial ${r} is louder than the fundamental`);
});
