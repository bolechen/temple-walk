// Bake the floor he may stand on into app/shared/walk/<level>.bin (#194; the method is in tools/walk/bake.mjs, the
// file in app/src/walkgrid.js). The page does not read it yet.
//
// The grid is a build product, not kept in git: it is named by one fingerprint of everything it is baked from (the
// triangles each grid gathers, his outline, the bake's settings, the written plan's walk data, the places checked) and
// kept under that name in node_modules/.cache/walk/ (CI keeps that folder in its cache). Building the place and taking
// the fingerprint costs about three seconds; a bake only when that name has not been baked before.
//
//   node tools/bake-walk.mjs            the grid for the place as it is now → app/shared/walk/<level>.bin (from the cache, or baked)
//   node tools/bake-walk.mjs --level=<id>   that level's floor (#405; the prologue, t00, when none is named; an unknown name: exit 1)
//   node tools/bake-walk.mjs --list     only print the levels there are, one to a line (CI bakes and compares each)
//   node tools/bake-walk.mjs --key      only print the fingerprint (CI names its cache by it)
//   node tools/bake-walk.mjs --force    bake every grid again
//   node tools/bake-walk.mjs --out=<file>   bake afresh into another file (to compare two bakes byte for byte)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { buildDrawn, gridsOf, targetsOf, partsOf, planText } from "./walk/scene.mjs";
import { gather, bakeGrid, oldReach, cellsOf, bodyPrint, textHash, BAKE, OUTLINE } from "./walk/bake.mjs";
import { encode, decode, readHeader, VERSION } from "../app/src/walkgrid.js";
import { DEFAULT_LEVEL, levelFromCommandLine, levelIds, levelObject, walkFile } from "./walk/level-arg.mjs";
// The written plan's own walker, whatever loader runs this: under tools/walk/swap.mjs (the unit tests on the grid) a bare
// import of site.js is the grid's walker, and a bake made there would record the grid's reach as the written plan's.
const { createWalker } = await import("../app/src/site.js?real");
export { createWalker as writtenWalker };

const MAIN = !!process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
/** The level this process bakes: --level=<id> when this tool is run, the prologue when it is imported (#405). */
export const LEVEL = MAIN ? levelFromCommandLine() : DEFAULT_LEVEL;
const THE_LEVEL = await levelObject(LEVEL);
export const FILE = walkFile(LEVEL);
/** The file a prepared place's floor is kept in: its level's own. */
const fileOf = (prep) => walkFile(prep.drawn.level.id);

/** The intents a grid closes (a hall's doorway past where the door takes him in), as a fingerprint: change one and that grid is stale. */
const closedPrint = (g) => textHash(JSON.stringify(g.closed || []));

/** The place built and every grid gathered, with the fingerprints of what each would be baked from. */
export function prepare(level = THE_LEVEL) {
  const t0 = performance.now(), drawn = buildDrawn(level), t1 = performance.now();
  const grids = gridsOf(drawn).map((g) => ({ ...g, S: gather(g.roots, g.box, g.postBase ?? 0) }));
  const t2 = performance.now();
  const defs = textHash(JSON.stringify({ targets: targetsOf(drawn), parts: partsOf(drawn) }));
  return { drawn, grids, body: bodyPrint(), plan: textHash(planText(drawn)), defs, ms: { build: Math.round(t1 - t0), gather: Math.round(t2 - t1) } };
}

/** Which grids of the file at `file` no longer match `prep` (all of them if there is no file, or the plan or body changed). */
export function staleness(prep, file = fileOf(prep)) {
  if (!existsSync(file)) return { stale: prep.grids.map((g) => g.id), why: "no file", header: null };
  let header; try { header = readHeader(readFileSync(file)).header; } catch (e) { return { stale: prep.grids.map((g) => g.id), why: String(e.message), header: null }; }
  if (header.body !== prep.body) return { stale: prep.grids.map((g) => g.id), why: "his outline or the bake's settings changed", header };
  const was = new Map(header.grids.map((g) => [g.id, g]));
  const stale = prep.grids.filter((g) => { const w = was.get(g.id); return !w || w.geometry !== g.S.print || w.x0 !== g.box.x0 || w.z0 !== g.box.z0 || (w.closed || "") !== closedPrint(g); }).map((g) => g.id);
  const planStale = header.plan !== prep.plan || header.defs !== prep.defs, gone = header.grids.some((g) => !prep.grids.find((p) => p.id === g.id));
  return { stale, planStale, gone, why: stale.length ? `triangles changed in ${stale.join(", ")}` : planStale ? "the written plan's walk data, or the places checked, changed" : gone ? "a grid is gone" : "", header };
}

/** Bake (reusing what is fresh in the old file) and return the file's bytes and what it cost. */
export function bake(prep, { force = false, file = fileOf(prep) } = {}) {
  const { stale, header: oldHeader } = force ? { stale: prep.grids.map((g) => g.id), header: null } : staleness(prep, file);
  const old = oldHeader && !force ? decode(readFileSync(file), (b) => inflateRawSync(b)) : null;
  // The written plan's walker of the level baked: the prologue's from site.js?real (never the swapped one, above); any other
  // level's is its own, which the swap does not touch.
  const level = prep.drawn.level, walker = (level.id === DEFAULT_LEVEL ? createWalker : level.createWalker)(prep.drawn.site), targets = targetsOf(prep.drawn), cells = [], grids = [], ms = {};
  for (const g of prep.grids) {
    const t0 = performance.now(); let baked;
    const keep = old && !stale.includes(g.id) ? old.grids.find((o) => o.id === g.id) : null;
    if (keep) {   // fresh: its heights and states as they were
      const N = keep.nx * keep.nz, h = new Float32Array(N); for (let k = 0; k < N; k++) h[k] = keep.height[k] === -32768 ? NaN : keep.height[k] / 100 + g.base;
      baked = { x0: keep.x0, z0: keep.z0, nx: keep.nx, nz: keep.nz, step: keep.step, h, state: Uint8Array.from(keep.state), names: keep.names, ms: { reused: 0 } };
    } else baked = bakeGrid(g.S, g.box, g.seeds, undefined, g.closed);
    const t1 = performance.now();
    g.enter(walker); const bits = oldReach(walker, baked, g.seeds); g.enter(walker); walker.setRoom(null); walker.setLoft?.(null);
    const t2 = performance.now();
    const area = (n) => +(n * baked.step * baked.step).toFixed(2);
    let open = 0, oldOpen = 0; for (let k = 0; k < baked.nx * baked.nz; k++) { if (!baked.state[k]) open++; if ((bits[k >> 3] >> (k & 7)) & 1) oldOpen++; }
    grids.push({ id: g.id, kind: g.kind, name: g.name, x0: baked.x0, z0: baked.z0, nx: baked.nx, nz: baked.nz, step: baked.step, base: g.base, seeds: g.seeds, geometry: g.S.print, closed: closedPrint(g), tris: g.S.tris, names: baked.names, open: area(open), oldOpen: area(oldOpen) });
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
  const header = { level: prep.drawn.level.id, format: VERSION, bake: BAKE, outline: OUTLINE, body: prep.body, plan: prep.plan, defs: prep.defs, grids, targets, parts: partsOf(prep.drawn) };
  return { bytes: encode(header, cells, (b) => deflateRawSync(b, { level: 9 })), header, ms, stale };
}

/** One name for everything a bake depends on: the grids' triangles and extents, his outline, the settings, the plan, the places checked. */
export const keyOf = (prep) => textHash(JSON.stringify({ format: VERSION, body: prep.body, plan: prep.plan, defs: prep.defs, grids: prep.grids.map((g) => [g.id, g.S.print, g.box, g.closed || []]) }));
export const CACHE = process.env.WALK_CACHE || fileURLToPath(new URL("../node_modules/.cache/walk/", import.meta.url));

/**
 * The grid for the place as it is now in FILE: taken from the cache when this key was baked before (here, or by CI's
 * cache), else baked (keeping whatever grids of the file already there are still fresh) and put in the cache.
 */
export function ensure(prep, { force = false, file = fileOf(prep) } = {}) {
  const key = keyOf(prep), cached = join(CACHE, `${prep.drawn.level.id}-${key}.bin`);
  mkdirSync(dirname(file), { recursive: true });
  if (!force && existsSync(cached)) { const bytes = readFileSync(cached); if (!existsSync(file) || Buffer.compare(readFileSync(file), bytes)) writeFileSync(file, bytes); return { key, hit: true, bytes, header: readHeader(bytes).header }; }
  const r = bake(prep, { force, file });
  writeFileSync(file, r.bytes); mkdirSync(CACHE, { recursive: true }); writeFileSync(cached, r.bytes);
  return { key, hit: false, ...r };
}

if (MAIN) {
  const arg = (k) => process.argv.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
  if (arg("list")) { console.log(levelIds().join("\n")); process.exit(0); }
  // Every level unless one is named (#405): the build, the unit tests and CI bake whatever levels there are.
  const ids = arg("level") ? [LEVEL] : levelIds();
  if (arg("out") && ids.length > 1) { console.error("--out bakes one level's floor: name it with --level=<id>"); process.exit(1); }
  // One fingerprint a level, joined in the levels' order: with the prologue alone it is the prologue's, as before.
  if (arg("key")) { const keys = []; for (const id of ids) keys.push(keyOf(prepare(await levelObject(id)))); console.log(keys.join("-")); process.exit(0); }
  for (const id of ids) {
    const file = walkFile(id), out = arg("out")?.split("=")[1] || file, t0 = performance.now();
    const prep = prepare(await levelObject(id));
    console.log(`${id}: built in ${prep.ms.build} ms, gathered ${prep.grids.reduce((s, g) => s + g.S.tris, 0)} triangles into ${prep.grids.length} grids in ${prep.ms.gather} ms`);
    const r = ensure(prep, { force: !!arg("force") || out !== file, file: out });
    if (r.hit) console.log(`${out}: from the cache (${r.key}), ${Math.round(performance.now() - t0)} ms`);
    else {
      for (const [g, m] of Object.entries(r.ms)) console.log(`  ${g.padEnd(16)} ${JSON.stringify(m)}`);
      console.log(`baked ${out} (${r.key}): ${(r.bytes.length / 1024).toFixed(1)} KB in ${Math.round(performance.now() - t0)} ms`);
    }
    const lost = r.header.targets.filter((t) => !t.new || !t.old);
    console.log(`${r.header.targets.length} places checked, ${lost.length} not reached`);
    for (const t of lost) console.log(`  not reached: ${t.kind} ${t.id} (${t.grid}) drawn ${t.new} plan ${t.old}`);
  }
}
