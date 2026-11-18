// What the drawn walker weighs (#161 spike): the baked grid as a file (as stored now, and packed: heights in
// millimetres as Int16 and the open/shut bit), gzip'd, and how long reading it back takes; and the BVH over everything
// drawn on the whole plan, not only the trial region (time and memory), to say what a phone would be asked.
//   node --expose-gc tools/spike/weigh.mjs
import "../../tests/unit/dom-stub.mjs";
import { gzipSync, gunzipSync } from "node:zlib";
import * as THREE from "three";
import { namedMaterials } from "./mats.mjs";
import { drawnWalker } from "./drawn.mjs";
import { gather } from "../../app/src/spike/meshwalker.js";
const { createWalker, buildSite } = await import("../../app/src/site.js?real");
const { createTrees } = await import("../../app/src/trees.js");
const site = buildSite(namedMaterials()), w = drawnWalker(site, createWalker(site)), out = {};
for (const [k, G] of Object.entries(w.grids)) {
  const N = G.nx * G.nz, raw = Buffer.concat([Buffer.from(G.h.buffer), Buffer.from(G.cause.buffer), Buffer.from(G.shut.buffer)]);
  const mm = new Int16Array(N); for (let i = 0; i < N; i++) mm[i] = Math.round((G.h[i] - (k === "room" ? -60 : 0)) * 1000);
  const bits = new Uint8Array(Math.ceil(N / 8)); for (let i = 0; i < N; i++) if (G.shut[i]) bits[i >> 3] |= 1 << (i & 7);
  const packed = Buffer.concat([Buffer.from(mm.buffer), Buffer.from(bits.buffer)]), gz = gzipSync(packed, { level: 9 });
  const t = performance.now(); for (let r = 0; r < 10; r++) gunzipSync(gz); const unzipMs = (performance.now() - t) / 10;
  out[k] = { cells: N, rawKB: Math.round(raw.length / 1024), rawGzipKB: Math.round(gzipSync(raw, { level: 9 }).length / 1024), packedKB: Math.round(packed.length / 1024), packedGzipKB: Math.round(gz.length / 1024), gunzipMs: +unzipMs.toFixed(1) };
}
// The whole plan: every building, the trees, no region.
const extra = new THREE.Scene(); createTrees(extra, namedMaterials(), site.trees, { a2c: false }); extra.updateMatrixWorld(true);
global.gc?.(); const m0 = process.memoryUsage();
const t0 = performance.now(); const all = gather([site.root, extra], new THREE.Box3(new THREE.Vector3(-1e4, -1e4, -1e4), new THREE.Vector3(1e4, 1e4, 1e4))); const ms = performance.now() - t0;
global.gc?.(); const m1 = process.memoryUsage();
out.wholePlanBVH = { tris: all.tris, ms: Math.round(ms), heapMB: +((m1.heapUsed - m0.heapUsed) / 1048576).toFixed(1), externalMB: +(((m1.external + m1.arrayBuffers) - (m0.external + m0.arrayBuffers)) / 1048576).toFixed(1) };
console.log(JSON.stringify(out, null, 1));
