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
  "bang.woff2": ["霞鹜", "霞鶩", "落霞孤鹜", "落霞孤鶩", "LXGW"],   // LXGW WenKai TC, bold (#192): its family reserves these; cut as Yunjing Bang
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

// The board face is evened character by character (app/src/board-weights.js, tools/board-ink.py --write, #192): every
// character a board is written with in that face has its evening, within the tool's limit, so a board added later
// cannot go up without the tool having been run for it.
test("every character the board face writes on a name board has its evening", async () => {
  const { WEIGHT } = await import("../../app/src/board-weights.js");
  const src = fs.readdirSync(path.join(DIR, "../../src")).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(DIR, "../../src", f), "utf8")).join("");
  const OLD = Object.fromEntries([...src.match(/const OLD = \{([^}]*)\}/)[1].matchAll(/(\S): "(\S)"/g)].map((m) => [m[1], m[2]]));
  const texts = [...src.matchAll(/plaque: \{ text: (?:sx > 0 \? "(\S+)" : )?"(\S+)"([^}]*)\}/g)].filter((m) => !/hand:/.test(m[3])).flatMap((m) => [m[1], m[2]].filter(Boolean))
    .concat([...src.matchAll(/plaque: "(\S+)"/g)].map((m) => m[1]), [...src.matchAll(/makePlaque\("(\S+)"([^)]*)\)/g)].filter((m) => !/hand:/.test(m[2])).map((m) => m[1]),
      [...src.matchAll(/makeWallPanel\("(\S+)"([^)]*)\)/g)].filter((m) => !/hand:/.test(m[2])).map((m) => m[1]));
  const chars = new Set(texts.join("").split("").map((c) => OLD[c] || c));
  assert.ok(chars.size > 20, `only ${chars.size} characters found on the boards`);
  assert.deepEqual([...chars].filter((c) => !(c in WEIGHT)), [], "characters with no evening: run python3 tools/board-ink.py --write");
  assert.deepEqual(Object.entries(WEIGHT).filter(([, w]) => Math.abs(w) > 0.025), [], "an evening beyond the tool's limit");
});
