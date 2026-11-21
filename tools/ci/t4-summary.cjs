// A few lines for a T4 shard's job summary: what drew it, how long each scenario took, which failed (#335). Reads the folder the launcher brought back.
const fs = require("fs"), path = require("path");
const dir = process.argv[2] || "tools/out", read = (f) => { try { return fs.readFileSync(path.join(dir, f), "utf8").trim(); } catch { return ""; } };
const report = (() => { try { return JSON.parse(read("e2e-report.json")); } catch { return null; } })();
console.log(`### T4 shard\n\nRenderer: ${read("e2e-renderer.txt") || "unknown (no report came back)"}\n`);
if (!report) process.exit(0);
const total = report.reduce((a, r) => a + r.secs, 0), bad = report.filter((r) => !r.ok);
console.log(`${report.length} scenarios, ${total} s of scenarios, ${bad.length} failed.\n\n| scenario | s | |\n|---|---|---|`);
for (const r of report) console.log(`| ${r.name} | ${r.secs} | ${r.ok ? "ok" : "FAIL"} |`);
for (const r of bad) console.log(`\n**${r.name}**: \`${String(r.error || "").split("\\n")[0].slice(0, 300)}\``);
