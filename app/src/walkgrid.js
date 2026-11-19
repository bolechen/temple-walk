// The floor he may stand on, baked when the site is built (#194, the second step of #161's migration): for each place
// a walk is laid out on (the courts and the path up to them, the top storey of the summit pavilion, each room under
// the courts), a grid of 5 cm cells saying the height of the floor there and whether he may stand in it, and if not,
// what stops him. `tools/bake-walk.mjs` bakes it in Node from the meshes as they are drawn and writes
// `app/shared/walk/<level>.bin`; the page walks on it (app/src/gridwalker.js).
//
// The file: four bytes "TWWG", the format's version and the header's length (little-endian u32 each), the header as
// JSON, then the cells, compressed (deflate, raw), grid after grid in the header's order. For each grid, per cell:
//   height  Int16, centimetres above the grid's `base`, wherever the flood reached a floor (a shut cell keeps its floor
//           too: the foot of a wall, the edge of a porch, so that his shoes and a ledge's foot can be measured); NO_FLOOR
//           where it reached none
//   state   Uint8: 0 open; otherwise 1 + the index into the header's `names` of what shut it (a material, "ledge",
//           "nofloor", "unreached")
//   old     one bit a cell, packed eight to a byte: could he reach this cell on the walker of the written plan
//           (createWalker in site.js), from the same seeds. Kept while both walkers exist, so that a change to either
//           shows in the comparison CI makes (tools/walk-diff.mjs).
// The header carries the fingerprints of what it was baked from (`geometry`: the gathered triangles; `body`: his
// outline and the bake's own settings; `plan`: the written plan's walk data), which tests and the build compare with
// the present ones, the grids' extents, and the named places checked for whether they can still be walked to.

export const MAGIC = "TWWG", VERSION = 1, NO_FLOOR = -32768;

/** Bytes a grid's cells take in the body, and where its three parts start. @param {{ nx: number, nz: number }} g */
export function layout(g) {
  const n = g.nx * g.nz, bits = Math.ceil(n / 8);
  return { n, height: 0, state: n * 2, old: n * 3, bytes: n * 3 + bits };
}

/**
 * The file from a header and, for each grid in `header.grids`, its cells.
 * @param {any} header @param {{ height: Int16Array, state: Uint8Array, old: Uint8Array }[]} cells
 * @param {(b: Uint8Array) => Uint8Array} deflate deflate-raw, from whatever the caller has (node:zlib in the tools)
 */
export function encode(header, cells, deflate) {
  const parts = header.grids.map((/** @type {any} */ g, /** @type {number} */ i) => {
    const L = layout(g), c = cells[i], b = new Uint8Array(L.bytes);
    b.set(new Uint8Array(c.height.buffer, c.height.byteOffset, L.n * 2), L.height); b.set(c.state, L.state); b.set(c.old, L.old);
    return b;
  });
  const body = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { body.set(p, o); o += p.length; }
  const head = new TextEncoder().encode(JSON.stringify(header)), packed = deflate(body);
  const out = new Uint8Array(12 + head.length + packed.length), dv = new DataView(out.buffer);
  out.set(new TextEncoder().encode(MAGIC), 0); dv.setUint32(4, VERSION, true); dv.setUint32(8, head.length, true);
  out.set(head, 12); out.set(packed, 12 + head.length);
  return out;
}

/** Only the header (cheap: nothing is inflated). @param {Uint8Array} bytes */
export function readHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== MAGIC) throw new Error("not a baked walk grid");
  const version = dv.getUint32(4, true); if (version !== VERSION) throw new Error(`walk grid version ${version}, this code reads ${VERSION}`);
  const n = dv.getUint32(8, true);
  return { header: JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + n))), at: 12 + n };
}

/**
 * The header and each grid with its cells, ready to ask. `keep(g)`, if given, says what of each grid to keep: undefined
 * for all of it (with the written plan's bits), false for none, a box { x0, x1, z0, z1 } for only the cells inside it, or
 * "floors" for only the rows and columns a floor was reached in (the page, #274: the hillside round the courts is
 * a third of the outdoor grid), cut out of the inflated body row by row, so that the page never holds a second copy.
 * @param {Uint8Array} bytes @param {(b: Uint8Array) => Uint8Array} inflate
 * @param {(g: any) => ({ x0: number, x1: number, z0: number, z1: number } | "floors" | false | undefined)} [keep]
 */
export function decode(bytes, inflate, keep) {
  const { header, at } = readHeader(bytes), body = inflate(bytes.subarray(at));
  let o = 0; const grids = [];
  for (const g of header.grids) {
    const L = layout(g), from = o, want = keep ? keep(g) : undefined; o += L.bytes;
    if (want === false) continue;
    if (want) {
      let i0, j0, nx, nz;
      if (want === "floors") {   // only the rows and columns a floor was reached in (a NO_FLOOR height is the bytes 00 80)
        let a = g.nx, b = -1, c = g.nz, d = -1;
        for (let j = 0, at = from + L.height + 1; j < g.nz; j++) for (let i = 0; i < g.nx; i++, at += 2) if (body[at] !== 0x80 || body[at - 1] !== 0) { if (i < a) a = i; if (i > b) b = i; if (j < c) c = j; if (j > d) d = j; }
        i0 = Math.min(a, b + 1); j0 = Math.min(c, d + 1); nx = Math.max(0, b - a + 1); nz = Math.max(0, d - c + 1);
      } else {
        i0 = Math.max(0, Math.floor((want.x0 - g.x0) / g.step)); j0 = Math.max(0, Math.floor((want.z0 - g.z0) / g.step));
        nx = Math.max(0, Math.min(g.nx, Math.ceil((want.x1 - g.x0) / g.step)) - i0); nz = Math.max(0, Math.min(g.nz, Math.ceil((want.z1 - g.z0) / g.step)) - j0);
      }
      const height = new Int16Array(nx * nz), state = new Uint8Array(nx * nz), hb = new Uint8Array(height.buffer);
      for (let j = 0; j < nz; j++) {
        const k = (j + j0) * g.nx + i0;
        hb.set(body.subarray(from + L.height + k * 2, from + L.height + (k + nx) * 2), j * nx * 2);
        state.set(body.subarray(from + L.state + k, from + L.state + k + nx), j * nx);
      }
      const c = { ...g, x0: g.x0 + i0 * g.step, z0: g.z0 + j0 * g.step, nx, nz, cropped: true };
      grids.push({ ...c, height, state, old: null, cell: (/** @type {number} */ x, /** @type {number} */ z) => cellOf(c, x, z) });
      continue;
    }
    const part = new Uint8Array(L.bytes); part.set(body.subarray(from, from + L.bytes));   // (a copy, so that the heights start on an even byte)
    const height = new Int16Array(part.buffer, part.byteOffset + L.height, L.n), state = part.subarray(L.state, L.state + L.n), old = part.subarray(L.old, L.bytes);
    grids.push({ ...g, height, state, old, cell: (/** @type {number} */ x, /** @type {number} */ z) => cellOf(g, x, z) });
  }
  return { header, grids };
}

/**
 * The cells of a file inflated in the page, where node:zlib is not: the browser's own DecompressionStream (deflate-raw).
 * @param {Uint8Array} bytes the whole file @returns {Promise<Uint8Array>} what decode's `inflate` is to return
 */
export async function inflateRawAsync(bytes) {
  const { at } = readHeader(bytes);
  const stream = new Blob([bytes.slice(at)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The cell (x, z) falls in, or -1 outside the grid. @param {{ x0: number, z0: number, nx: number, nz: number, step: number }} g @param {number} x @param {number} z */
export function cellOf(g, x, z) {
  const i = Math.floor((x - g.x0) / g.step), j = Math.floor((z - g.z0) / g.step);
  return i < 0 || j < 0 || i >= g.nx || j >= g.nz ? -1 : j * g.nx + i;
}

/** Whether the old walker reached cell k. @param {Uint8Array} old @param {number} k */
export const oldReached = (old, k) => (old[k >> 3] >> (k & 7)) & 1;
