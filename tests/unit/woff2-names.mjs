// Reads the naming table of a .woff2 file in plain Node, with no font library: the WOFF2 container is one Brotli stream
// holding every table in directory order, and the `name` table is never transformed, so it can be cut straight out.
import fs from "node:fs"; import zlib from "node:zlib";

// The tags a table directory entry may name by number (WOFF2 §5.1); 63 means a four-letter tag follows.
const KNOWN = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];

/** Every name record of a .woff2 file: `{ id, platform, text }`. @param {string} file */
export function nameRecords(file) {
  const b = fs.readFileSync(file);
  if (b.toString("latin1", 0, 4) !== "wOF2") throw new Error(file + " is not a WOFF2 file");
  const nTables = b.readUInt16BE(12), compressed = b.readUInt32BE(20); let p = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const c = b[p++]; v = v * 128 + (c & 127); if (!(c & 128)) return v; } throw new Error("bad UIntBase128"); };
  const tables = [];
  for (let i = 0; i < nTables; i++) {
    const flags = b[p++], idx = flags & 63, version = flags >> 6, tag = idx === 63 ? (p += 4, b.toString("latin1", p - 4, p)) : KNOWN[idx];
    const orig = base128(); let length = orig;
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : tag === "hmtx" ? version === 1 : false;
    if (transformed) length = base128();
    tables.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(b.subarray(p, p + compressed));
  let at = 0, name = null; for (const t of tables) { if (t.tag === "name") name = data.subarray(at, at + t.length); at += t.length; }
  if (!name) throw new Error(file + " has no name table");
  const count = name.readUInt16BE(2), strings = name.readUInt16BE(4), out = [];
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12, platform = name.readUInt16BE(r), id = name.readUInt16BE(r + 6), len = name.readUInt16BE(r + 8), off = strings + name.readUInt16BE(r + 10);
    const raw = name.subarray(off, off + len), text = platform === 0 || platform === 3 ? Buffer.from(raw).swap16().toString("utf16le") : raw.toString("latin1");
    out.push({ id, platform, text });
  }
  return out;
}
