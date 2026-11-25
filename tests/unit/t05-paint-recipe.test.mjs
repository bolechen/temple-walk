// The painted statues' recipe and anchors (issue #463, tools/t05-hall): what the review stage's shader and its measuring rely on.
// The zone numbers 14, 15 and 16 are the lips, the halo's body and the head disc in the zone-id picture (stage.js zoneIds), so a
// recipe may hold at most 13 zones; every figure's anchors place the lotus's upper tier under its top and carry no lighting compensation; a zone that takes a
// per-figure gain says which; and the gold is not painted along the lower edge of an inner garment (mask.py `open: "below"`).
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../../tools/t05-hall/", import.meta.url);
const recipe = JSON.parse(readFileSync(new URL("paint/recipe.json", dir), "utf8"));
const anchors = readdirSync(new URL("paint/", dir)).filter((f) => /-t05\.json$|^sakyamuni-370\.json$/.test(f)).map((f) => [f, JSON.parse(readFileSync(new URL("paint/" + f, dir), "utf8")).anchors]);

test("the recipe's zones: at most 13, uniquely named, gains name a known kind", () => {
  assert.ok(recipe.zones.length <= 13);
  assert.equal(new Set(recipe.zones.map((z) => z.name)).size, recipe.zones.length);
  for (const z of recipe.zones) if (z.gain !== undefined) assert.ok(["lotus", "inner"].includes(z.gain), z.name);
  assert.ok(recipe.zones.some((z) => z.name === "座上"));
});
test("every figure places the lotus's upper tier under the top of its throne", () => {
  assert.equal(anchors.length, 7);
  // the white box's light compensation is the review stage's, in the run's spec (specs/t05-paint-463.json), never in a figure's anchors
  for (const [f, a] of anchors) { assert.ok(a.lotusUp > 0 && a.lotusUp < a.plinthTop, f); assert.equal(a.lotusGain, undefined, f); }
});
test("the gold is cut off below every garment it rings", () => {
  for (const f of readdirSync(new URL("masks/", dir)).filter((f) => /-front\.json$/.test(f))) {
    const s = JSON.parse(readFileSync(new URL("masks/" + f, dir), "utf8"));
    // Śākyamuni goes bare on the right: his gold rings the bare chest, whose lower edge is the robe's own border, so it stays open
    if (!s.channels.some((c) => c.zone === "内衣")) continue;
    for (const c of s.channels) if (c.zone === "衣缘描金" && c.ring_of !== undefined) assert.equal(c.open, "below", f);
  }
});

test("the run's spec carries the compensation, the same for the two end figures", () => {
  const spec = JSON.parse(readFileSync(new URL("specs/t05-paint-463.json", dir), "utf8"));
  const gains = spec.statues.filter((s) => s.lotusGain !== undefined);
  assert.equal(gains.length, 2); assert.equal(gains[0].lotusGain, gains[1].lotusGain); assert.equal(gains[0].halo.gain, gains[1].halo.gain);
});

test("the inner garment's tint for the two end figures is in the spec, and the zones that take it say so", () => {
  const spec = JSON.parse(readFileSync(new URL("specs/t05-paint-463.json", dir), "utf8"));
  assert.equal(spec.statues.filter((s) => s.innerTint !== undefined).length, 2);
  for (const n of ["胸衣", "内衣"]) assert.equal(recipe.zones.find((z) => z.name === n).gain, "inner");
  for (const [f, a] of anchors) assert.equal(a.innerTint, undefined, f);
});

test("a figure that names where its lips lie (lipAt) draws a closed mouth: a lens at most 0.06 m high, below the eyes and above its mouth anchor's chin pad", () => {
  const withAt = anchors.filter(([, a]) => a.lipAt);
  assert.ok(withAt.length >= 3);
  for (const [f, a] of withAt) { assert.ok(a.lipH <= 0.06, f); assert.ok(a.lipAt[1] > a.mouth[1] && a.lipAt[1] < a.eyeL[1], f); assert.ok(a.lipHalf > 0.1 && a.lipHalf < 0.2, f); }
});

test("a seam lift is named whole (half-height and strength) and only on a figure whose mouth shows as one dark line", () => {
  const withSeam = anchors.filter(([, a]) => a.seamLift !== undefined || a.seamH !== undefined);
  assert.ok(withSeam.length >= 1 && withSeam.length <= 2, "a lift for one or two figures, not a recipe for all");
  for (const [f, a] of withSeam) { assert.ok(a.seamH > 0.005 && a.seamH < 0.03, f); assert.ok(a.seamLift > 0 && a.seamLift <= 0.6, f); }
});
