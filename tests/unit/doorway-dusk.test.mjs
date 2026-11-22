// A hall whose middle bay the plan leaves unlit shows a dark door at dusk, in every season (#555). The shader tells
// "after dark" from the lamp's strength, and a clear autumn dusk holds only 0.23 of it: the dark-door factor must
// therefore be fully on by a lamp strength well under that, or the room shows through as a pale slab.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { readFileSync } from "node:fs";
const { moodOf, SEASONS } = await import("../../app/src/mood.js");
const src = readFileSync(new URL("../../app/src/doorway.js", import.meta.url), "utf8");

test("the dark-door factor is fully on at the weakest dusk lamp of any season, and off by day", () => {
  const m = src.match(/c\*=mix\(1\.,mix\(uDusk[^;]*?,1\.,uWinNight\),smoothstep\(0\.,\.(\d+),uLamp\)\)/);
  assert.ok(m, "the dusk factor line is where this test looks for it");
  const edge = Number("0." + m[1]);
  for (const s of SEASONS) {
    const dusk = moodOf(s, "dusk").lamp, day = moodOf(s, "day").lamp;
    assert.ok(dusk >= edge, `${s} dusk lamp ${dusk} must reach the edge ${edge}`);
    assert.equal(day, 0, `${s} by day the lamps are out, so every room shows as it was baked`);
  }
});

test("a hall with no lamp lit holds no lamplight at dusk and dawn: the night bake is blended only for a lit hall or at night (#595)", () => {
  assert.ok(/float nb=clamp\(uLamp,0\.,1\.\)\*mix\(uLit,1\.,uWinNight\)/.test(src), "the weight of the night picture is the lamp's, times 1 at night and the hall's own lit flag otherwise");
  assert.ok(/u\.uLit\.value = lv > 0 \? 1 : 0/.test(src), "a hall is lit at dusk when the plan's middle bay is");
});

test("an unlit hall's door goes darker from far off, and a lit hall's does not (#595)", () => {
  assert.ok(/uDusk-\.14\*\(1\.-uLit\)\*smoothstep\(4\.,10\.,distance\(cameraPosition,vWP\)\)/.test(src), "the far-off floor is lowered only by (1 - uLit), beyond 4 m, full by 10 m");
});
