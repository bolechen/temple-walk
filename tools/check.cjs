// Every script in the app must at least parse. Vendored libraries are skipped.
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app"), files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "v") walk(p); } else if (f.endsWith(".js")) files.push(p); } })(root);
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { bad++; console.error(String(e.stderr).split("\n").slice(0, 6).join("\n")); } }
// Shader fragments handed to procMat are wrapped in one line of braces: a trailing // comment would swallow the closing brace.
const mats = fs.readFileSync(path.join(root, "src", "materials.js"), "utf8");
for (const m of mats.matchAll(/`([^`]*)`/g)) { const last = m[1].trimEnd().split("\n").pop(); if (/\/\/[^\n]*$/.test(last) && /col|rough_|bump_|ao_/.test(m[1])) { bad++; console.error("materials.js: a shader fragment ends in a // comment:\n  " + last.trim().slice(0, 120)); } }
console.log(`${files.length} files checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
