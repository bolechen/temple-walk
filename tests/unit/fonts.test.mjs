// The typefaces in app/shared/fonts are cut down from the originals, which makes each a Modified Version under the SIL
// Open Font License, and a Modified Version may not carry a Reserved Font Name (docs/t00/LICENSING-AUDIT.md, §三.2).
// Two of the originals declare one: LXGW WenKai ('霞鹜', '霞鶩', '落霞孤鹜', '落霞孤鶩', 'LXGW') and Nanum Brush Script
// ('Nanum', and the Naver and NanumBrush forms). The page names its faces "Yunjing …" in CSS, so what the file calls
// itself inside can be anything else.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { nameRecords } from "./woff2-names.mjs";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../app/shared/fonts");
// Each file's reserved names, as the original's OFL.txt declares them; the other fonts declare none.
const RESERVED = {
  "kai.woff2": ["霞鹜", "霞鶩", "落霞孤鹜", "落霞孤鶩", "LXGW"],
  "hand-ko.woff2": ["Nanum", "Naver"],
};
// The records that name the font. The copyright (0), the licence (13, 14) and the maker's and designer's own names and
// addresses (8, 9, 11, 12) are notices that must travel with it unchanged, and may mention a reserved name as the
// owner's; the trademark line (7) names the mark itself and is not carried by a font that no longer bears it.
const NAMING = new Set([1, 2, 3, 4, 6, 7, 16, 17, 21, 22, 25]);

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".woff2")).sort();

test("every font file is declared here, so a new one has to say whether its original reserves a name", () => {
  assert.equal(files.length, 16);
  assert.deepEqual(Object.keys(RESERVED).filter((f) => !files.includes(f)), [], "a file named here is gone");
});

test("the reader finds the names of a .woff2", () => {
  const rec = nameRecords(path.join(DIR, "serif.woff2"));
  assert.ok(rec.some((r) => r.id === 1 && /Noto Serif SC/.test(r.text)), JSON.stringify(rec.slice(0, 4)));
});

test("no font file names itself with a Reserved Font Name of its original", () => {
  for (const f of files) {
    const bad = [];
    for (const r of nameRecords(path.join(DIR, f))) {
      if (!NAMING.has(r.id)) continue;
      for (const n of RESERVED[f] || []) if (r.text.toLowerCase().includes(n.toLowerCase())) bad.push(`name ${r.id} "${r.text}" holds "${n}"`);
    }
    assert.deepEqual(bad, [], `${f}: ${bad.join("; ")}`);
  }
});

test("the files that were renamed still carry their original's copyright notice and licence", () => {
  const kai = nameRecords(path.join(DIR, "kai.woff2")), ko = nameRecords(path.join(DIR, "hand-ko.woff2"));
  assert.ok(kai.some((r) => r.id === 0 && /LXGW/.test(r.text) && /Copyright/.test(r.text)), "kai: the copyright line is gone");
  assert.ok(kai.some((r) => r.id === 13 && /Open Font License/.test(r.text)), "kai: the licence line is gone");
  assert.ok(ko.some((r) => r.id === 0 && /NHN Corporation/.test(r.text)), "hand-ko: the copyright line is gone");
});
