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
