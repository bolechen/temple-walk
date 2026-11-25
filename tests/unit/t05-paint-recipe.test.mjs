// The painted statues' recipe and anchors (issue #463, tools/t05-hall): what the review stage's shader and its measuring rely on.
// The zone numbers 14, 15 and 16 are the lips, the halo's body and the head disc in the zone-id picture (stage.js zoneIds), so a
// recipe may hold at most 13 zones; every figure's anchors place the lotus's upper tier under its top; a zone that takes a
// per-figure gain says which; and the gold is not painted along the lower edge of an inner garment (mask.py `open: "below"`).
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../../tools/t05-hall/", import.meta.url);
const recipe = JSON.parse(readFileSync(new URL("paint/recipe.json", dir), "utf8"));
const anchors = readdirSync(new URL("paint/", dir)).filter((f) => /-t05\.json$|^sakyamuni-370\.json$/.test(f)).map((f) => [f, JSON.parse(readFileSync(new URL("paint/" + f, dir), "utf8")).anchors]);

test("the recipe's zones: at most 13, uniquely named, gains name a known kind", () => {
  assert.ok(recipe.zones.length <= 13);
  assert.equal(new Set(recipe.zones.map((z) => z.name)).size, recipe.zones.length);
  for (const z of recipe.zones) if (z.gain !== undefined) assert.equal(z.gain, "lotus");
  assert.ok(recipe.zones.some((z) => z.name === "座上"));
});
test("every figure places the lotus's upper tier under the top of its throne", () => {
  assert.equal(anchors.length, 7);
  for (const [f, a] of anchors) { assert.ok(a.lotusUp > 0 && a.lotusUp < a.plinthTop, f); if (a.lotusGain !== undefined) assert.ok(a.lotusGain >= 1 && a.lotusGain <= 2, f); }
});
test("the gold is cut off below every garment it rings", () => {
  for (const f of readdirSync(new URL("masks/", dir)).filter((f) => /-front\.json$/.test(f))) {
    const s = JSON.parse(readFileSync(new URL("masks/" + f, dir), "utf8"));
    // Śākyamuni goes bare on the right: his gold rings the bare chest, whose lower edge is the robe's own border, so it stays open
    if (!s.channels.some((c) => c.zone === "内衣")) continue;
    for (const c of s.channels) if (c.zone === "衣缘描金" && c.ring_of !== undefined) assert.equal(c.open, "below", f);
  }
});
