// The seven Buddhas' paint, zone by zone on the shipped meshes (#763): the paint's shapes worked out in Node as the page's shader works them out
// (tools/t05-paint-eval.mjs), and rays cast at each figure where a visitor looks. Held here: the curls' colour stops at the curls (the art director,
// 2026-11-26: three figures wore a flat band of it across the brow, read as a headcloth).
import test from "node:test"; import assert from "node:assert/strict";
import { existsSync } from "node:fs";
const { FIGURE_FILES, SOURCE } = await import("../../app/levels/t05/figures/registry.js");
const bin = new URL("../../app/shared/models/t05/", import.meta.url);
const skip = SOURCE.base !== null || existsSync(bin) ? false : "the seven are not published yet (registry.js SOURCE): nothing fetches them";
const E = skip ? null : await import("../../tools/t05-paint-eval.mjs");
const HAIR = "螺发", SKIN = "面与手（肤色）";

// The foot of the curls as the hair mask has it (the mask was grown over the curls from the figure's own surface, tools/t05-hall/mask.py): in the
// column of the picture at x, the height of its lowest painted row.
function curlsFoot(mask, rect, x) {
  const mpp = (rect[2] - rect[0]) / mask.w, c = Math.round((x - rect[0]) / mpp); let low = -1;
  for (let y = 0; y < mask.h; y++) if (mask.data[(y * mask.w + c) * 4] > 127) low = y;
  return low < 0 ? null : rect[3] - (low + 0.5) * mpp;
}

test("on every figure the curls' colour stops at the curls: across the brow, from over the eyes to 3 cm under the curls' foot, no skin takes it, and 5 cm above the foot the curls have it", { skip }, async () => {
  for (const { id } of FIGURE_FILES) {
    const fig = await E.loadFigure(id), A = E.anchorsOf(id), masks = await E.loadMasks(A), P = E.painter(A, masks);
    const eyeY = (A.eyeL[1] + A.eyeR[1]) / 2, band = [];
    for (let dx = -0.5; dx <= 0.501; dx += 0.1) {
      const x = A.hairFront[0] + dx, foot = curlsFoot(masks.hair, A.maskHair.rect, x); assert.ok(foot !== null && foot > eyeY + 0.2, `${id}: the curls' foot at x ${x.toFixed(2)}`);
      for (let y = eyeY + 0.15; y <= foot - 0.03; y += 0.02) {
        const h = E.cast(fig, [x, y, 9], [0, 0, -1]); if (!h || h.n[2] < 0.3) continue;
        const z = P.zoneAt(h.p, h.n); if (z === HAIR) band.push(`x ${x.toFixed(2)} y ${y.toFixed(2)} (the curls' foot ${foot.toFixed(2)})`); else assert.equal(z, SKIN, `${id}: the brow at x ${x.toFixed(2)} y ${y.toFixed(2)}`);
      }
      const up = E.cast(fig, [x, foot + 0.05, 9], [0, 0, -1]); assert.ok(up, `${id}: the curls at x ${x.toFixed(2)}`); assert.equal(P.zoneAt(up.p, up.n), HAIR, `${id}: the curls 5 cm over their foot at x ${x.toFixed(2)}`);
    }
    assert.deepEqual(band, [], `${id}: the curls' colour on the brow, under the curls`);
  }
});

test("each figure's hairline anchor stands at the curls' foot on the brow's middle (the head's height on screen is measured from it: tools/t05-zones.cjs), within 4 cm", { skip }, async () => {
  for (const { id } of FIGURE_FILES) {
    const A = E.anchorsOf(id), masks = await E.loadMasks(A), foot = curlsFoot(masks.hair, A.maskHair.rect, A.hairFront[0]);
    assert.ok(Math.abs(A.hairFront[1] - foot) <= 0.04, `${id}: hairFront at y ${A.hairFront[1]}, the curls' foot at ${foot.toFixed(3)}`);
  }
});

// The head's skin used to end at one level plane a little over the front of the collar. A robe's rim climbs from the throat over the shoulders to the
// nape (0.3 to 0.4 m higher behind than before), so everything of the robe that stood above that plane inside the head's box was painted skin: a flat band
// under the chin with both ends lying on the robe's collar, its lower edge a straight line, and a square of skin on the robe's back (the art director
// and the first review, 2026-11-26, on the T4 of 18b2024: "读成围了一圈布").
test("on every figure the head's skin stops at the robe: just over the old neck plane, the robe beside the neck and behind it takes no skin, the throat in the robe's opening does, and the lobes keep theirs", { skip }, async () => {
  for (const { id } of FIGURE_FILES) {
    const fig = await E.loadFigure(id), A = E.anchorsOf(id), P = E.painter(A, await E.loadMasks(A)), cx = A.neckFront[0], bare = id === "sakyamuni";   // he goes bare on the right: only his left shoulder wears the robe
    const zone = (o, d) => { const h = E.cast(fig, o, d); return h ? { z: P.zoneAt(h.p, h.n), p: h.p } : null; };
    // from the front, beyond every lapel (the widest opening is 0.6 m from the middle); a raised hand before the shoulder is not what is asked about
    const front = [];
    for (const dx of [-0.75, -0.7, -0.65, 0.65, 0.7, 0.75]) {
      if (bare && dx < 0) continue;
      const h = zone([cx + dx, A.neckFront[1] + 0.06, 9], [0, 0, -1]); if (!h || h.p[2] > A.neckFront[2] + 0.3) continue;
      if (h.z === SKIN) front.push(dx);
    }
    assert.deepEqual(front, [], `${id}: skin on the robe beside the neck, seen from the front (metres from the middle)`);
    // from behind, across the back of the collar
    const back = [];
    for (const dx of bare ? [0.5, 0.6, 0.7] : [-0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5]) { const h = zone([cx + dx, A.neckBack[1] + 0.05, -9], [0, 0, 1]); if (h && h.z === SKIN) back.push(dx); }
    assert.deepEqual(back, [], `${id}: skin on the robe's back under the nape (metres from the middle)`);
    // what is skin stays skin: the throat between the lapels, the chin, both lobes
    for (const [name, o] of [["the throat", [cx, A.neckFront[1] + 0.06, 9]], ["the chin", [A.mouth[0], A.mouth[1] - 0.2, 9]], ["the left lobe", [A.lobeL[0] - 0.08, A.lobeL[1] + 0.12, 9]], ["the right lobe", [A.lobeR[0] + 0.08, A.lobeR[1] + 0.12, 9]]]) {   // a lobe's anchor is the middle of the shape that covers it, which on Sakyamuni lies a little outside and under the lobe itself
      const h = zone(o, [0, 0, -1]); assert.ok(h, `${id}: ${name} was found`); assert.equal(h.z, SKIN, `${id}: ${name}`);
    }
  }
});

// Sakyamuni alone goes bare on his right (偏袒右肩): the arm, the shoulder and the shoulder blade behind it are sculpted bare, the robe passing under
// the armpit and up his back to the left shoulder. The front mask and the two hand shapes painted only what a visitor before him sees, so from the
// west aisle, which walks along his right, the outer and back half of the upper arm, the top of the shoulder and the forearm's inner flank at the
// elbow wore the robe's red (the first and the final review of 18b2024: a red patch under the elbow, hard-edged red on the shoulder's top).
test("Sakyamuni's bare right arm is skin all round: the upper arm's outside and back, the top of the shoulder, the forearm's inner flank at the elbow and the shoulder blade behind; the robe under the arm and on his left stays the robe", { skip }, async () => {
  const fig = await E.loadFigure("sakyamuni"), A = E.anchorsOf("sakyamuni"), P = E.painter(A, await E.loadMasks(A));
  const zone = (o, d) => { const h = E.cast(fig, o, d); return h ? P.zoneAt(h.p, h.n) : null; };
  const bare = [
    ["the upper arm from his right, toward the back", [-8, 5.5, -0.7], [1, 0, 0]], ["the upper arm from his right, low", [-8, 5.0, -0.6], [1, 0, 0]], ["the arm over the elbow from his right", [-8, 4.7, -0.5], [1, 0, 0]],
    ["the shoulder from his right", [-8, 5.9, -0.7], [1, 0, 0]], ["the shoulder's top from above", [-1.1, 9, -0.5], [0, -1, 0]], ["the shoulder's top by the neck from above", [-0.9, 9, -0.55], [0, -1, 0]],
    ["the forearm's inner flank at the elbow", [-1.4, 4.2, 9], [0, 0, -1]], ["the forearm's inner flank, lower", [-1.4, 4.05, 9], [0, 0, -1]],
    ["the shoulder blade from behind", [-1.0, 5.6, -9], [0, 0, 1]], ["the back by the spine from behind", [-0.4, 5.9, -9], [0, 0, 1]],
  ];
  for (const [name, o, d] of bare) assert.equal(zone(o, d), SKIN, name);
  const robe = [
    ["the robe before his belly", [-1.15, 4.3, 9], [0, 0, -1]], ["the robe across his back, under the blade", [-0.6, 4.6, -9], [0, 0, 1]], ["the robe on his back toward the left shoulder", [0.3, 5.6, -9], [0, 0, 1]],
    ["the robe on his left shoulder from above", [1.2, 9, -0.4], [0, -1, 0]], ["the robe behind the arm from his right", [-8, 4.3, -1.0], [1, 0, 0]],
  ];
  for (const [name, o, d] of robe) assert.notEqual(zone(o, d), SKIN, name);
});

// The colour a pigment has on paper: CIE L*, C* and hue from linear sRGB, as tools/t05-zones.cjs reads the picture.
function lch([r, g, b]) {
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116), a = 500 * (f(X) - f(Y)), bb = 200 * (f(Y) - f(Z));
  return { L: 116 * f(Y) - 16, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360, a, b: bb };
}
test("the hands are skin to their edges: the middle figure's raised hand to its little finger and inside the ring of thumb and finger, and the open hand in two figures' laps to the thumb and the palm's two sides; the sleeve over each wrist, the lap beside each hand and the chest seen through the ring stay the robe", { skip }, async () => {
  const down = [0, -1, 0], back = [0, 0, -1];
  const hands = {
    vipasyin: {
      skin: [["the little finger's upper half", [-1.8, 5.9, 9], back], ["the little finger's edge", [-1.9, 5.8, 9], back], ["the palm inside the ring", [-1.3, 5.6, 9], back], ["the palm inside the ring, higher", [-1.2, 5.7, 9], back],
        ["the lap hand's little-finger edge", [1.2, 4.8, 1.4], down], ["the lap hand's little-finger edge, nearer", [1.2, 4.8, 1.6], down], ["a fingertip of the lap hand", [1.4, 4.8, 1.8], down], ["the lap hand's thumb tip", [1.8, 4.8, 1.8], down]],
      robe: [["the chest seen through the ring", [-1.3, 5.7, 9], back], ["the robe beside the raised hand", [-1.0, 5.6, 9], back], ["the sleeve over the lap hand's wrist", [1.5, 4.8, 1.0], down], ["the lap beside the palm", [1.0, 4.8, 1.4], down], ["the lap beside the thumb", [2.0, 4.8, 1.4], down]],
    },
    kanakamuni: {
      skin: [["the thumb's ball", [1.7, 4.6, 1.3], down], ["the thumb", [1.8, 4.6, 1.5], down], ["the palm beside the thumb", [1.7, 4.6, 1.5], down], ["the palm's little-finger edge", [1.2, 4.6, 1.4], down], ["the palm's outer side from his right", [0.6, 3.6, 1.45], [1, 0, 0]], ["the thumb's tip from the front", [1.75, 3.65, 9], back]],
      robe: [["the sleeve over the wrist", [1.4, 4.6, 0.95], down], ["the sleeve over the wrist, by the thumb", [1.7, 4.6, 1.0], down], ["the lap beside the palm", [1.05, 4.6, 1.3], down], ["the lap beside the thumb", [2.0, 4.6, 1.3], down], ["the lap under the thumb from the front", [1.85, 3.55, 9], back]],
    },
  };
  for (const [id, { skin, robe }] of Object.entries(hands)) {
    const fig = await E.loadFigure(id), A = E.anchorsOf(id), P = E.painter(A, await E.loadMasks(A));
    const zone = (o, d) => { const h = E.cast(fig, o, d); return h ? P.zoneAt(h.p, h.n) : null; };
    for (const [name, o, d] of skin) assert.equal(zone(o, d), SKIN, `${id}: ${name}`);
    for (const [name, o, d] of robe) assert.notEqual(zone(o, d), SKIN, `${id}: ${name}`);
  }
});

const linear = (hex) => [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });

// The curls read twice as a navy cap (the first and the final review of 18b2024: one clean pigment more saturated than the figure's own robe,
// the dust of the shoulders lying on the ledge of every ring of curls in a colour next to the skin's, and a flat pale lid on the crown). They are
// painted old instead (the coordinator's decision, 2026-11-26): the crown of each curl rubbed paler and greyer, grey dust in what turns away
// between them, the whole lower in chroma, and none of the shoulders' dust.
test("the curls are painted old: a curl's crown rubbed paler and greyer, its sides and the hollows between dusted a grey that is not the skin's, no pale lid on what faces up, and nowhere more chroma than the robe's pigment", async () => {
  const { agedPigment } = await import("../../app/levels/t05/figures/paint.js"), recipe = JSON.parse((await import("node:fs")).readFileSync(new URL("../../app/levels/t05/figures/recipe.json", import.meta.url), "utf8"));
  const z = recipe.zones.find((q) => q.name === HAIR), robe = lch(linear(recipe.zones.find((q) => q.name === "袈裟").color)), skin = lch(linear(recipe.zones.find((q) => q.name === SKIN).color));
  assert.ok(z.aged, "the curls' zone says how it has aged"); assert.equal(z.dust, 0, "the shoulders' dust is not laid on the curls");
  const base = lch(linear(z.color)), crown = lch(agedPigment(z, { out: 1, grain: 1 })), side = lch(agedPigment(z, { out: 0 })), hollow = lch(agedPigment(z, { out: 0.5, hollow: 1 })), lid = lch(agedPigment(z, { out: 1, up: 1, grain: 1 }));
  assert.ok(crown.L > base.L + 5 && crown.C < base.C, `a crown is rubbed paler and greyer: L* ${crown.L.toFixed(1)} over ${base.L.toFixed(1)}, C* ${crown.C.toFixed(1)} under ${base.C.toFixed(1)}`);
  for (const [name, c] of [["a curl's side", side], ["a hollow", hollow]]) {
    assert.ok(c.C < base.C - 3, `${name} is dusted grey: C* ${c.C.toFixed(1)}`);
    assert.ok(Math.hypot(c.L - skin.L, c.a - skin.a, c.b - skin.b) > 20, `${name} is not the skin's colour`);
    assert.ok(c.L < base.L + 12, `${name} is no pale seam: L* ${c.L.toFixed(1)}`);
  }
  assert.ok(lid.L < 36, `what faces up is no pale lid: L* ${lid.L.toFixed(1)} (the shoulders' dust on the old pigment gave 37)`);
  // over a curl seen from below, as the hall's cameras see it: the crown a third of it, the sides a third, plain pigment the rest
  const mean = [0, 1, 2].map((i) => (agedPigment(z, { out: 1, grain: 0.5 })[i] + agedPigment(z, { out: 0.1 })[i] + agedPigment(z, { out: 0.71 })[i]) / 3), m = lch(mean);
  assert.ok(m.C < 9.5 && m.C < robe.C, `the curls' chroma falls: C* ${m.C.toFixed(1)} (the one pigment had 12.8; the robe's has ${robe.C.toFixed(1)})`);
  assert.ok(m.h > 245 && m.h < 262 && Math.abs(m.L - 24.7) < 4, `their hue and lightness stay: L* ${m.L.toFixed(1)}, h ${m.h.toFixed(0)}° (they were 24.7 and 255°)`);
});

// The middle figure's lotus read grey beside its neighbours' (C* 3.0 to 3.4 from the nave on the T4 of 2026-11-26, theirs 5.2 to 5.5; the line is 4):
// its gain of 1.6 lifts the lightness alone. A figure's gain may be three numbers, red, green and blue.
test("the middle figure's lotus takes a tint of its own, more red than blue, and every figure's gain reaches the paint as three numbers", async () => {
  const THREE = await import("three"), { paintMaterial } = await import("../../app/levels/t05/figures/paint.js"), { lotusGain } = await import("../../app/levels/t05/figures/registry.js");
  const recipe = JSON.parse((await import("node:fs")).readFileSync(new URL("../../app/levels/t05/figures/recipe.json", import.meta.url), "utf8"));
  const mid = lotusGain(FIGURE_FILES.find((f) => f.id === "vipasyin"));
  assert.equal(mid.length, 3); assert.ok(mid[0] > mid[1] && mid[1] > mid[2], "red over green over blue"); assert.ok(mid[0] / mid[2] > 1.2 && mid[0] / mid[2] < 1.5, "a tint, not another pigment");
  assert.deepEqual(lotusGain(FIGURE_FILES.find((f) => f.id === "kasyapa")), [1.25, 1.25, 1.25]); assert.deepEqual(lotusGain(FIGURE_FILES.find((f) => f.id === "sikhin")), [1, 1, 1]);
  const anchors = JSON.parse((await import("node:fs")).readFileSync(new URL("../../app/levels/t05/figures/anchors/vipasyin.json", import.meta.url), "utf8")).anchors;
  const m = paintMaterial(recipe, anchors, new THREE.Object3D(), { lotusGain: mid });
  assert.deepEqual(m.userData.paint.U.uLotus.value.toArray(), mid);
});
