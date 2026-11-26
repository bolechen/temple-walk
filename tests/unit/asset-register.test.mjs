// Every picture, model, typeface, scanned surface and compiled decoder that goes into the published site is a row of
// docs/t00/asset-register.csv, where its source, its licence and whether it may be sold with the game are written down
// (docs/t00/LICENSING-AUDIT.md). A file added to app/ without a row there fails here; so does a row that names a file
// under app/ that is no longer there.
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTER = path.join(ROOT, "docs/t00/asset-register.csv");
// What is a file the page fetches or shows as it is, rather than code that the build bundles.
const ASSET = /\.(webp|png|jpe?g|gif|svg|avif|glb|gltf|bin|ktx2|basis|woff2?|ttf|otf|wasm|mp3|ogg|wav|m4a|flac|mp4|webm)$/i;

// A small CSV reader: quoted fields may hold commas and doubled quotes.
export function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some((f) => f !== "")) rows.push(row); row = []; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows; return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// The `file` column names one path, or several: "app/shared/textures/wood_a.webp + wood_n.jpg" (a bare name is a
// sibling of the path before it), "app/src/building.js site.js" (the same), "app/vendor/basis/" (a whole folder).
export function filesOf(cell) {
  const out = []; let dir = null;
  for (const tok of cell.split(/[\s+;]+/).filter(Boolean)) {
    if (!/^[\w.\-/]+$/.test(tok)) continue;
    if (tok.includes("/")) { out.push(tok); dir = tok.endsWith("/") ? tok : path.posix.dirname(tok) + "/"; }
    else if (dir && /\.\w+$/.test(tok)) out.push(dir + tok);
  }
  return out;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(path.relative(ROOT, p).split(path.sep).join("/"));
  }
  return out;
}

const rows = parseCSV(fs.readFileSync(REGISTER, "utf8"));
const named = rows.flatMap((r) => filesOf(r.file).map((f) => ({ f, id: r.asset_id })));
const covers = (file) => named.some(({ f }) => f === file || (f.endsWith("/") && file.startsWith(f)));

test("the register's file column is read as the paths it names", () => {
  assert.deepEqual(filesOf("app/shared/textures/wood_a.webp + wood_n.jpg"), ["app/shared/textures/wood_a.webp", "app/shared/textures/wood_n.jpg"]);
  assert.deepEqual(filesOf("app/src/building.js site.js"), ["app/src/building.js", "app/src/site.js"]);
  assert.deepEqual(filesOf("not in repository"), []);
  assert.ok(covers("app/levels/t00/boards/shijia.webp"));
});

test("every asset file under app/ that goes into the site has a row in the register", () => {
  const files = walk(path.join(ROOT, "app")).filter((f) => ASSET.test(f));
  assert.ok(files.length > 50, `found only ${files.length} asset files under app/`);
  const missing = files.filter((f) => !covers(f));
  assert.deepEqual(missing, [], `asset files with no row in docs/t00/asset-register.csv:\n  ${missing.join("\n  ")}`);
});

test("every file under app/ that the register names is there", () => {
  // app/vendor/ is copied out of node_modules at install (tools/setup.mjs), and app/shared/walk/ and app/shared/doorways/
  // baked at build (tools/bake-walk.mjs, tools/bake-doorways.mjs); none of them is in git. Nor is app/shared/models/t05/ (the seven Buddhas, #701: fetched by tools/setup.mjs once published).
  const gone = named.filter(({ f }) => f.startsWith("app/") && !f.startsWith("app/vendor/") && !f.startsWith("app/shared/walk/") && !f.startsWith("app/shared/doorways/") && !f.startsWith("app/shared/models/t05/") && !fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(gone, [], `rows naming files that are not under app/:\n  ${gone.map((g) => `${g.id}: ${g.f}`).join("\n  ")}`);
});

test("every row says whether it may be sold with the game, whether it must be credited, where its terms are and when they were read", () => {
  const STATUS = new Set(["yes", "conditional", "no", "unverified"]);
  for (const r of rows) {
    assert.ok(STATUS.has(r.commercial_use), `${r.asset_id}: commercial_use is "${r.commercial_use}"`);
    assert.ok(r.attribution_required, `${r.asset_id}: attribution_required is empty`);
    assert.ok(r.license_url, `${r.asset_id}: license_url is empty`);
    assert.match(r.checked_on, /^\d{4}-\d{2}-\d{2}$/, `${r.asset_id}: checked_on`);
  }
  assert.equal(new Set(rows.map((r) => r.asset_id)).size, rows.length, "asset ids are unique");
});
