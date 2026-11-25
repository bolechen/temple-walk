// Every script in the app must at least parse. Vendored libraries are skipped.
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app"), files = [];
for (const extra of ["worker"]) { const d = path.join(__dirname, "..", extra); for (const f of fs.readdirSync(d)) if (f.endsWith(".js")) files.push(path.join(d, f)); }   // the Worker (#340) parses too
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "vendor" && f !== "node_modules") walk(p); } else if (f.endsWith(".js")) files.push(p); } })(root);
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { bad++; console.error(String(e.stderr).split("\n").slice(0, 6).join("\n")); } }
// Shader fragments handed to procMat are wrapped in one line of braces: a trailing // comment would swallow the closing brace.
const mats = fs.readFileSync(path.join(root, "src", "materials.js"), "utf8");
for (const m of mats.matchAll(/`([^`]*)`/g)) { const last = m[1].trimEnd().split("\n").pop(); if (/\/\/[^\n]*$/.test(last) && /col|rough_|bump_|ao_/.test(m[1])) { bad++; console.error("materials.js: a shader fragment ends in a // comment:\n  " + last.trim().slice(0, 120)); } }
// Numbers that are not numbers, in a shader. GLSL leaves a power or a root of a number below zero, a logarithm of one at
// or below zero and the direction of a zero-length vector undefined: a graphics card returns something that is not a
// number, SwiftShader (which the tests draw with) returns 0, and one such pixel spread by the bloom blacked out half the
// picture before the great hall (#217, #236). A comparison with such a number is false, so `if(a<.004) discard` lets
// it through. So, in every shader fragment in app/ (Math.* in JavaScript and three's .normalize() are not looked at):
//   pow(x, …), sqrt(x), inversesqrt(x), log(x), log2(x): x is a plain non-negative number, or max(…), abs(…), clamp(…),
//     or dot(v,v);
//   normalize(x): x is not a bare difference or cross product (either may be of zero length): divide by max(length(x),ε)
//     or add a small vector;
//   if(… < …) discard / if(… > …) discard: written as if(!(… >= …)) discard, which a number that is not one also takes.
// A line that is safe for a reason the scan cannot see says so in a /* nan-ok: … */ comment.
{ const rel = (f) => path.relative(path.join(root, ".."), f), held = (a) => /^\s*(max|abs|clamp)\s*\(/.test(a) || /^\s*\d*\.?\d+\.?\s*$/.test(a) || /^\s*dot\s*\(\s*([\w.]+)\s*,\s*\1\s*\)\s*$/.test(a);
  // the first argument of a call whose name ends at `i`: up to its first top-level comma or its closing bracket
  const arg = (src, i) => { let j = i, d = 0; for (; j < src.length; j++) { const c = src[j]; if (c === "(" || c === "[") d++; else if (c === ")" || c === "]") { if (!d) break; d--; } else if (c === "," && !d) break; } return src.slice(i, j); };
  const topMinus = (a) => { let d = 0; for (let k = 1; k < a.length; k++) { const c = a[k]; if (c === "(" || c === "[") d++; else if (c === ")" || c === "]") d--; else if (c === "-" && !d && !/[eE(,*/+\-]/.test(a[k - 1].trim() ? a[k - 1] : a.slice(0, k).trim().slice(-1))) return true; } return false; };
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8"), lines = src.split("\n"), say = (at, msg) => { const n = src.slice(0, at).split("\n").length; if (/\/\*\s*nan-ok:/.test(lines[n - 1])) return; bad++; console.error(`${rel(f)}:${n}: ${msg}`); };
    for (const m of src.matchAll(/(?<![\w.$])(pow|sqrt|inversesqrt|log2|log)\s*\(/g)) { const a = arg(src, m.index + m[0].length); if (!held(a)) say(m.index, `${m[1]}(${a.trim()}) may be of a number below zero; hold it with max(…,0.) or abs(…)`); }
    for (const m of src.matchAll(/(?<![\w.$])normalize\s*\(/g)) { const a = arg(src, m.index + m[0].length).trim(); if (/^cross\s*\(/.test(a) || topMinus(a)) say(m.index, `normalize(${a}) may be of a vector of no length; divide by max(length(…),1e-6)`); }
    for (const m of src.matchAll(/if\s*\(([^;{}]*?)\)\s*discard/g)) if (/[<>]/.test(m[1]) && !/^\s*!\s*\(/.test(m[1])) say(m.index, `if(${m[1].trim()}) discard lets a number that is not one through; write if(!(…)) discard`);
  } }
// Every character the page writes must be in the typefaces cut for it (tools/fonts.py). The debug panel (src/debug.js)
// is left out: it exists only on the dev server and is drawn by lil-gui in the system's own font, not in the cut faces.
const DEV_ONLY = [path.join(root, "src", "debug.js")];
// Nor is each level's bake.js (#405): the floor's bake reads it in Node, the page never imports it (tests/unit/level-bake.test.mjs),
// and its names of the place's parts are written only into the floor's report on GitHub. Nor is its checks.js (S6): the unit
// tests and tools read it in Node (tests/unit/level-checks.test.mjs holds that), and what it names is written into manifests and reports.
const BAKE_ONLY = fs.readdirSync(path.join(root, "levels")).flatMap((d) => ["bake.js", "checks.js"].map((n) => path.join(root, "levels", d, n)));
// The Japanese, English and Korean tables (app/locales/*.js, app/levels/*/locales/*.js) are written in faces of their own, cut by
// `tools/fonts.py --lang`: each table's characters must be in its own cut, and the Chinese cut is not asked to hold them.
// So is the name of each language on its button in index.html, which is written in that language.
const TABLES = { ja: path.join(root, "locales", "ja.js"), en: path.join(root, "locales", "en.js"), ko: path.join(root, "locales", "ko.js") };
// Every level's own tables (levels/<id>/locales/<lang>.js: T00's works' cards, T05's name) are written in the same faces.
const levelTables = (l) => fs.readdirSync(path.join(root, "levels")).map((d) => path.join(root, "levels", d, "locales", `${l}.js`)).filter((f) => fs.existsSync(f));
const WORK_TABLES = { ja: levelTables("ja"), en: levelTables("en"), ko: levelTables("ko") };
const cut = (name) => new Set(fs.readFileSync(path.join(root, "shared", "fonts", name), "utf8"));
const wide = (c) => c.codePointAt(0) > 0x2000 && !(c.codePointAt(0) >= 0xe000 && c.codePointAt(0) <= 0xf8ff);
const have = cut("chars.txt"), missing = new Set();
const own = { ja: "", en: "", ko: "" };
const page = (f) => { let s = fs.readFileSync(f, "utf8"); if (f.endsWith("index.html")) s = s.replace(/<[^>]*\slang="(ja|en|ko)"[^>]*>([^<]*)</g, (m, l, text) => { own[l] += text; return ""; }); return s; };
for (const f of [...files.filter((f) => !f.includes(path.sep + "textures" + path.sep) && !DEV_ONLY.includes(f) && !BAKE_ONLY.includes(f) && !Object.values(TABLES).includes(f) && !Object.values(WORK_TABLES).flat().includes(f)), path.join(root, "index.html"), path.join(root, "src", "ui.css")]) for (const c of page(f)) if (wide(c) && !have.has(c)) missing.add(c);
if (missing.size) { bad++; console.error("characters used but not in app/shared/fonts (run tools/fonts.py): " + [...missing].join("")); }
for (const [l, f] of Object.entries(TABLES)) {
  const theirs = cut(`chars-${l}.txt`), lacking = new Set();
  // Only the translations: the keys are the Chinese, which the Chinese faces hold.
  for (const m of (fs.readFileSync(f, "utf8") + WORK_TABLES[l].map((w) => fs.readFileSync(w, "utf8")).join("")).matchAll(/:\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) for (const c of m[1]) if (wide(c) && !theirs.has(c)) lacking.add(c);
  for (const c of own[l]) if (wide(c) && !theirs.has(c)) lacking.add(c);
  if (lacking.size) { bad++; console.error(`characters in the ${l} tables but not in its faces (run tools/fonts.py --lang ${l}): ` + [...lacking].join("")); }
}
// The end-to-end scenarios are written many statements to a line: a // comment set down in the middle of one silences
// every statement after it, and the scenario then passes without having waited for anything.
{ const e2e = path.join(__dirname, "..", "tests", "e2e", "run.cjs");
  fs.readFileSync(e2e, "utf8").split("\n").forEach((line, i) => { if (/;\s+\/\/ .*(\bawait |\bexpect\()/.test(line)) { bad++; console.error(`tests/e2e/run.cjs:${i + 1}: a // comment in the middle of the line cuts off the statements after it`); } }); }
// Likewise in app/: a comment added at the end of a line of code that went on with another statement swallows it
// (tools/swallowed.cjs; twice in #414, the court's lamplit paving and every seat in the halls).
for (const h of require("./swallowed.cjs").swallowedIn(root)) { bad++; console.error(`${path.relative(path.join(__dirname, ".."), h.file)}:${h.line}: a // comment swallows a statement written after it on the same line: ${h.comment.slice(-80)}`); }
console.log(`${files.length} files checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
