// A cell that is open to him has a height (#477). The bake looks at the borders, the erosion and the last flood with a floor the
// first flood did not reach counted as floor (`hx`), but what it writes is the height of the floor the first flood did reach (`h`),
// and a cell the last flood walks into that the first never reached would be open with no height, which the walker answers by
// asking the written plan. None is: asserted for every cell of every grid of the two levels baked.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { levelObject, walkFile } = await import("../../tools/walk/level-arg.mjs");
const { decode } = await import("../../app/src/walkgrid.js");

for (const id of ["t00", "t05"]) {
  test(`${id}: every open cell of every baked grid has a floor height`, async () => {
    const prep = prepare(await levelObject(id)); ensure(prep);
    const decoded = decode(new Uint8Array(readFileSync(walkFile(id))), (b) => inflateRawSync(b)), bad = [];
    let open = 0;
    for (const g of decoded.grids) {
      for (let k = 0; k < g.nx * g.nz; k++) {
        if (g.state[k] !== 0) continue; open++;
        if (g.height[k] === -32768) { const i = k % g.nx, j = (k - i) / g.nx; bad.push(`${g.id} (${(g.x0 + (i + 0.5) * g.step).toFixed(2)}, ${(g.z0 + (j + 0.5) * g.step).toFixed(2)})`); }
      }
    }
    assert.ok(open > 100000, `${open} open cells looked at`);
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} open cells with no height`);
  });
}
