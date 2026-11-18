// Bake the floor he may stand on into app/shared/walk/<level>.bin (#194; the method is in tools/walk/bake.mjs, the
// file in app/src/walkgrid.js). The page does not read it yet.
//
//   node tools/bake-walk.mjs            bake what is stale (a grid whose triangles, his outline or the bake's settings
//                                        changed), keep the rest, write the file; say so and stop if nothing is stale
//   node tools/bake-walk.mjs --check    only say whether the file is stale: exit 1 if it is (CI, the build)
//   node tools/bake-walk.mjs --build    what `pnpm build` runs: bake what is stale, but on CI fail instead (the file must be committed fresh)
//   node tools/bake-walk.mjs --force    bake every grid again
//   node tools/bake-walk.mjs --out=<file>   write elsewhere (a second bake to compare byte for byte)
//
// The file is stale when the triangles a grid is gathered from, his outline (tools/walk/outline.json), the bake's
// settings (BAKE) or the written plan's walk data differ from what its header records; the test
// tests/unit/walk-bake.test.mjs fails then too, and `pnpm build` bakes it again (on CI it fails instead).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildDrawn, gridsOf, targetsOf, partsOf, planText } from "./walk/scene.mjs";
import { gather, bakeGrid, oldReach, cellsOf, bodyPrint, textHash, BAKE } from "./walk/bake.mjs";
import { encode, decode, readHeader, VERSION } from "../app/src/walkgrid.js";
const { createWalker } = await import("../app/src/site.js");

export const LEVEL = "t00";
export const FILE = fileURLToPath(new URL(`../app/shared/walk/${LEVEL}.bin`, import.meta.url));

/** The place built and every grid gathered, with the fingerprints of what each would be baked from. */
export function prepare() {
  const t0 = performance.now(), drawn = buildDrawn(), t1 = performance.now();
  const grids = gridsOf(drawn).map((g) => ({ ...g, S: gather(g.roots, g.box, g.postBase ?? 0) }));
  const t2 = performance.now();
  const defs = textHash(JSON.stringify({ targets: targetsOf(drawn), parts: partsOf(drawn) }));
  return { drawn, grids, body: bodyPrint(), plan: textHash(planText(drawn)), defs, ms: { build: Math.round(t1 - t0), gather: Math.round(t2 - t1) } };
}

/** Which grids of the file at `file` no longer match `prep` (all of them if there is no file, or the plan or body changed). */
export function staleness(prep, file = FILE) {
  if (!existsSync(file)) return { stale: prep.grids.map((g) => g.id), why: "no file", header: null };
  let header; try { header = readHeader(readFileSync(file)).header; } catch (e) { return { stale: prep.grids.map((g) => g.id), why: String(e.message), header: null }; }
  if (header.body !== prep.body) return { stale: prep.grids.map((g) => g.id), why: "his outline or the bake's settings changed", header };
  const was = new Map(header.grids.map((g) => [g.id, g]));
  const stale = prep.grids.filter((g) => { const w = was.get(g.id); return !w || w.geometry !== g.S.print || w.x0 !== g.box.x0 || w.z0 !== g.box.z0; }).map((g) => g.id);
  const planStale = header.plan !== prep.plan || header.defs !== prep.defs, gone = header.grids.some((g) => !prep.grids.find((p) => p.id === g.id));
  return { stale, planStale, gone, why: stale.length ? `triangles changed in ${stale.join(", ")}` : planStale ? "the written plan's walk data, or the places checked, changed" : gone ? "a grid is gone" : "", header };
}

/** Bake (reusing what is fresh in the old file) and return the file's bytes and what it cost. */
export function bake(prep, { force = false, file = FILE } = {}) {
  const { stale, header: oldHeader } = force ? { stale: prep.grids.map((g) => g.id), header: null } : staleness(prep, file);
  const old = oldHeader && !force ? decode(readFileSync(file), (b) => inflateRawSync(b)) : null;
  const walker = createWalker(prep.drawn.site), targets = targetsOf(prep.drawn), cells = [], grids = [], ms = {};
  for (const g of prep.grids) {
    const t0 = performance.now(); let baked;
    const keep = old && !stale.includes(g.id) ? old.grids.find((o) => o.id === g.id) : null;
    if (keep) {   // fresh: its heights and states as they were
      const N = keep.nx * keep.nz, h = new Float32Array(N); for (let k = 0; k < N; k++) h[k] = keep.height[k] === -32768 ? NaN : keep.height[k] / 100 + g.base;
      baked = { x0: keep.x0, z0: keep.z0, nx: keep.nx, nz: keep.nz, step: keep.step, h, state: Uint8Array.from(keep.state), names: keep.names, ms: { reused: 0 } };
    } else baked = bakeGrid(g.S, g.box, g.seeds);
    const t1 = performance.now();
    g.enter(walker); const bits = oldReach(walker, baked, g.seeds); g.enter(walker); walker.setRoom(null); walker.setLoft?.(null);
    const t2 = performance.now();
    const area = (n) => +(n * baked.step * baked.step).toFixed(2);
    let open = 0, oldOpen = 0; for (let k = 0; k < baked.nx * baked.nz; k++) { if (!baked.state[k]) open++; if ((bits[k >> 3] >> (k & 7)) & 1) oldOpen++; }
    grids.push({ id: g.id, kind: g.kind, name: g.name, x0: baked.x0, z0: baked.z0, nx: baked.nx, nz: baked.nz, step: baked.step, base: g.base, seeds: g.seeds, geometry: g.S.print, tris: g.S.tris, names: baked.names, open: area(open), oldOpen: area(oldOpen) });
    cells.push(cellsOf(baked, g.base, bits));
    ms[g.id] = { bake: keep ? "kept" : baked.ms, old: Math.round(t2 - t1), total: Math.round(t2 - t0) };
    g.baked = baked; g.bits = bits;
  }
  // Can each named place still be walked to: a reached cell within its radius, on the drawn floor and on the written plan.
  for (const t of targets) {
    const g = prep.grids.find((p) => p.id === t.grid); if (!g) { t.new = t.old = false; t.missing = true; continue; }
    const B = g.baked, R = Math.ceil(t.r / B.step), ci = Math.floor((t.at[0] - B.x0) / B.step), cj = Math.floor((t.at[1] - B.z0) / B.step);
    t.new = false; t.old = false;
    for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
      if (i < 0 || j < 0 || i >= B.nx || j >= B.nz || Math.hypot((i - ci) * B.step, (j - cj) * B.step) > t.r) continue;
      const k = j * B.nx + i; if (!B.state[k]) t.new = true; if ((g.bits[k >> 3] >> (k & 7)) & 1) t.old = true;
    }
  }
  const header = { level: LEVEL, format: VERSION, bake: BAKE, body: prep.body, plan: prep.plan, defs: prep.defs, grids, targets, parts: partsOf(prep.drawn) };
  return { bytes: encode(header, cells, (b) => deflateRawSync(b, { level: 9 })), header, ms, stale };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (k) => process.argv.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
  const out = arg("out")?.split("=")[1] || FILE, t0 = performance.now();
  const prep = prepare();
  console.log(`built in ${prep.ms.build} ms, gathered ${prep.grids.reduce((s, g) => s + g.S.tris, 0)} triangles into ${prep.grids.length} grids in ${prep.ms.gather} ms`);
  const st = staleness(prep, out);
  if (arg("build") && process.env.CI && (st.stale.length || st.planStale || st.gone)) { console.error(`${out} is stale: ${st.why}. Bake it (node tools/bake-walk.mjs) and commit it.`); process.exit(1); }
  if (arg("check")) {
    if (!st.stale.length && !st.planStale && !st.gone) { console.log(`${out}: fresh`); process.exit(0); }
    console.error(`${out} is stale: ${st.why}. Run: node tools/bake-walk.mjs`); process.exit(1);
  }
  if (!arg("force") && !st.stale.length && !st.planStale && !st.gone && out === FILE) { console.log(`${out}: fresh, nothing to bake (${Math.round(performance.now() - t0)} ms)`); process.exit(0); }
  const r = bake(prep, { force: !!arg("force"), file: out === FILE ? FILE : "/nonexistent" });
  mkdirSync(new URL("../app/shared/walk/", import.meta.url), { recursive: true });
  writeFileSync(out, r.bytes);
  for (const [id, m] of Object.entries(r.ms)) console.log(`  ${id.padEnd(16)} ${JSON.stringify(m)}`);
  const lost = r.header.targets.filter((t) => !t.new || !t.old);
  console.log(`wrote ${out}: ${(r.bytes.length / 1024).toFixed(1)} KB in ${Math.round(performance.now() - t0)} ms; ${r.header.targets.length} places checked, ${lost.length} not reached`);
  for (const t of lost) console.log(`  not reached: ${t.kind} ${t.id} (${t.grid}) drawn ${t.new} plan ${t.old}`);
}
