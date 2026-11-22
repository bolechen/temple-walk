// The edge of a puddle in the paving shader (#496): widened where the picture would make it a line, and no water at all
// before the rain. The shader is GLSL and is not run here; what is held is what its text says and what the numbers it names
// come to (the same field steps.js's `puddleAt` reads).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { puddleAt, fbm2 } from "../../app/src/steps.js";
import { moodOf, SEASONS, TIMES } from "../../app/src/mood.js";

const src = fs.readFileSync(new URL("../../app/src/ground.js", import.meta.url), "utf8");
const line = src.split("\n").find((l) => /float puddle=smoothstep\(/.test(l));

test("the mask is written once, about the old edge, and is zero when it has not rained", () => {
  assert.ok(line, "the line that defines `puddle` is there");
  assert.match(line, /float puddle=smoothstep\(\.59-\.5\*edgeW,\.59\+\.5\*edgeW,low\)\*step\(\.001,uWet\)/, "the ramp is centred on .59 and is multiplied by step(.001, uWet)");
  assert.match(src, /float rise=smoothstep\(1\.9,2\.7,cameraPosition\.y-vWP\.y\)/, "the widening follows how high the eye is above the paving");
  assert.match(src, /float edgeW=mix\(\.04,clamp\(1\.2\*reach,\.04,\.22\),rise\)/, "the ramp is the old .04 at the lowest eye and at most .22 at a raised one");
  assert.match(src, /float deepW=pow\(max\(puddle,0\.\),1\.\+\.5\*rise\)/, "the mirror's weight is the mask itself at the lowest eye");
});

test("from his own eyes (1.6 m) the mask and the mirror are the old ones exactly: .57 to .61, weight = mask", () => {
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rise = smooth(1.9, 2.7, 1.6), W = 0.04 + (Math.min(0.22, Math.max(0.04, 1.2 * 0.35)) - 0.04) * rise;   // a far puddle: a pixel is .35 m of stone
  assert.equal(rise, 0);
  assert.ok(Math.abs(0.59 - 0.5 * W - 0.57) < 1e-12 && Math.abs(0.59 + 0.5 * W - 0.61) < 1e-12);
  assert.equal(1 + 0.5 * rise, 1, "pow(puddle, 1) is the mask");
  assert.equal(smooth(1.9, 2.7, 0.81), 0, "the following eye looking level (the default pitch: 0.81 m)");
  assert.equal(smooth(1.9, 2.7, 1.82), 0, "and looking 8 degrees down (1.82 m)");
  assert.ok(smooth(1.9, 2.7, 2.6) > 0.9, "looking 15 degrees down (about 2.6 m) it is nearly 'raised'");
  assert.equal(smooth(1.9, 2.7, 2.77), 1, "looking 17 degrees down (2.77 m) it is");
  assert.equal(smooth(1.9, 2.7, 3.35), 1, "and from above (3.35 m)");
});

test("every winter hour has uWet 0, and with it the mask is zero (step(.001, 0) = 0)", () => {
  for (const t of TIMES) assert.equal(moodOf("winter", t).wet, 0, `winter ${t}`);
  const step = (e, x) => (x < e ? 0 : 1);
  assert.equal(step(0.001, 0), 0);
  for (const s of SEASONS) if (s !== "winter") assert.ok(moodOf(s, "day").wet > 0, `${s} has some rain`);
});

test("and over the whole of the place the field never reached the old threshold in winter, so the old mask was zero there too", () => {
  // low = fbm2(.17 p + 3) + (uWet - 1) * .34. The paving lies within x +-60, z -120 .. 100 (the courts, the stair and the path);
  // 0.25 m apart is finer than the field's own wavelength (about 6 m).
  let top = -Infinity;
  for (let x = -60; x <= 60; x += 0.25) for (let z = -120; z <= 100; z += 0.25) top = Math.max(top, fbm2(x * 0.17 + 3, z * 0.17 + 3) + (0 - 1) * 0.34);
  assert.ok(top < 0.57, `winter's greatest field ${top.toFixed(3)} is under .57`);
  for (let x = -60; x <= 60; x += 1.3) for (let z = -120; z <= 100; z += 1.3) assert.equal(puddleAt(x, z, 0), 0);
});
