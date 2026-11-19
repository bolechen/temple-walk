// His own eyes have a size (#265; the owner and the lead, 2026-11-19, the spike's §九 list): seen from them the picture is
// cut off by the camera's near plane, whose corners lie BAKE.EYE_R from the eye at the widest view the page draws. So on
// every cell of the first court where the grid lets him stand, nothing drawn comes nearer his eye than that, or a wall cut
// open by the near plane shows its inside. Asked of the drawn meshes themselves (the bake's own bounding volume
// hierarchy), not of the grid: every fourth cell each way, at the eye and at the near plane's top and bottom.
// About a minute: run with `pnpm run nearplane` (and `nearplane:grid`), not with the quick unit tests.
import test from "node:test"; import assert from "node:assert/strict";
import * as THREE from "three";
import { inflateRawSync } from "node:zlib";
const { buildDrawn, gridsOf } = await import("../../tools/walk/scene.mjs");
const { gather, BAKE, eyeR } = await import("../../tools/walk/bake.mjs");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { decode } = await import("../../app/src/walkgrid.js");
const { courtRegion, keepFor } = await import("../../app/src/gridwalker.js");
const { SITE, LEVELS } = await import("../../app/src/site.js?real");
const { FOV_RANGE } = await import("../../app/src/settings.js");

test("the eye's room is the near plane's: BAKE.EYE_R covers its corners at the widest view the settings allow", () => {
  assert.ok(BAKE.EYE_R >= eyeR(0.1, FOV_RANGE[1]) - 1e-9, `the near plane's corners lie ${eyeR(0.1, FOV_RANGE[1]).toFixed(3)} m from the eye, the bake keeps ${BAKE.EYE_R}`);
});

test("wherever the grid lets him stand in the first court, nothing drawn is within the near plane's reach of his own eyes", () => {
  const file = ensure(prepare()), drawn = buildDrawn(), region = courtRegion(drawn.site, SITE, LEVELS[0]);
  const g = decode(file.bytes, (b) => inflateRawSync(b), keepFor("court", region)).grids[0];
  const out = gridsOf(drawn).find((q) => q.id === "outdoors"), box = { ...out.box, x0: region.x0, x1: region.x1, z0: region.z0, z1: region.z1, bottom: -2, top: 8 };
  const S = gather(out.roots, box);
  const tol = BAKE.step * 0.71 + 0.01, p = new THREE.Vector3(), hit = {}, bad = new Map();
  let n = 0;
  for (let j = 0; j < g.nz; j += 4) for (let i = 0; i < g.nx; i += 4) {
    const k = j * g.nx + i; if (g.state[k]) continue;
    const x = g.x0 + (i + 0.5) * g.step, z = g.z0 + (j + 0.5) * g.step; if (x <= region.x0 || x >= region.x1 || z <= region.z0 || z >= region.z1) continue;
    const y = g.height[k] / 100 + g.base; n++;
    for (const dy of [-BAKE.EYE_R, 0, Math.min(BAKE.EYE_R, BAKE.CLEAR - BAKE.EYE)]) {
      p.set(x, y + BAKE.EYE + dy, z);
      const h = S.bvh.closestPointToPoint(p, hit, 0, BAKE.EYE_R);
      if (h && h.distance < BAKE.EYE_R - tol) { const name = S.names[S.mat[(S.bvh.geometry.index.array[h.faceIndex * 3] / 3) | 0]] || "?", key = `${name}`, r = bad.get(key) || { cells: 0, nearest: 9, at: null }; r.cells++; if (h.distance < r.nearest) { r.nearest = +h.distance.toFixed(3); r.at = [+x.toFixed(2), +z.toFixed(2), +p.y.toFixed(2)]; } bad.set(key, r); break; }
    }
  }
  assert.ok(n > 5000, `only ${n} cells looked at`);
  assert.deepEqual(Object.fromEntries(bad), {}, "his own eyes come nearer than the near plane's corners");
});
