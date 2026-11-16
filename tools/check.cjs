// Every script in the app must at least parse. Vendored libraries are skipped.
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app"), files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "vendor" && f !== "node_modules") walk(p); } else if (f.endsWith(".js")) files.push(p); } })(root);
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { bad++; console.error(String(e.stderr).split("\n").slice(0, 6).join("\n")); } }
// Shader fragments handed to procMat are wrapped in one line of braces: a trailing // comment would swallow the closing brace.
const mats = fs.readFileSync(path.join(root, "src", "materials.js"), "utf8");
for (const m of mats.matchAll(/`([^`]*)`/g)) { const last = m[1].trimEnd().split("\n").pop(); if (/\/\/[^\n]*$/.test(last) && /col|rough_|bump_|ao_/.test(m[1])) { bad++; console.error("materials.js: a shader fragment ends in a // comment:\n  " + last.trim().slice(0, 120)); } }
// Every character the page writes must be in the typefaces cut for it (tools/fonts.py). The debug panel (src/debug.js)
// is left out: it exists only on the dev server and is drawn by lil-gui in the system's own font, not in the cut faces.
const DEV_ONLY = [path.join(root, "src", "debug.js")];
const have = new Set(fs.readFileSync(path.join(root, "shared", "fonts", "chars.txt"), "utf8")), missing = new Set();
for (const f of [...files.filter((f) => !f.includes(path.sep + "textures" + path.sep) && !DEV_ONLY.includes(f)), path.join(root, "index.html"), path.join(root, "src", "ui.css")]) for (const c of fs.readFileSync(f, "utf8")) if (c.codePointAt(0) > 0x2000 && !(c.codePointAt(0) >= 0xe000 && c.codePointAt(0) <= 0xf8ff) && !have.has(c)) missing.add(c);
if (missing.size) { bad++; console.error("characters used but not in app/shared/fonts (run tools/fonts.py): " + [...missing].join("")); }
// The end-to-end scenarios are written many statements to a line: a // comment set down in the middle of one silences
// every statement after it, and the scenario then passes without having waited for anything.
{ const e2e = path.join(__dirname, "..", "tests", "e2e", "run.cjs");
  fs.readFileSync(e2e, "utf8").split("\n").forEach((line, i) => { if (/;\s+\/\/ .*(\bawait |\bexpect\()/.test(line)) { bad++; console.error(`tests/e2e/run.cjs:${i + 1}: a // comment in the middle of the line cuts off the statements after it`); } }); }
console.log(`${files.length} files checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
