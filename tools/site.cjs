// The built site the tests and tools open: dist/, as Vite writes it and as it is published. Asking for it builds it
// first when anything in app/ (or the build's own settings) is newer than the last build, so a tool never draws a
// stale page. TEMPLE_SITE names a site already built (the GPU job is handed one).
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path");
const top = path.join(__dirname, ".."), app = path.join(top, "app"), dist = path.join(top, "dist"), stamp = path.join(dist, ".built");
// app/shared/doorways/ is written by the build itself (tools/bake-doorways.mjs, after Vite): it does not make the build stale.
function newest(d) { let t = 0; for (const f of fs.readdirSync(d)) { if (f === "node_modules" || path.join(d, f) === path.join(app, "shared", "doorways")) continue; const p = path.join(d, f), s = fs.statSync(p); t = Math.max(t, s.isDirectory() ? newest(p) : s.mtimeMs); } return t; }
function site() {
  if (process.env.TEMPLE_SITE) return path.resolve(process.env.TEMPLE_SITE);
  const want = Math.max(newest(app), ...["vite.config.mjs", "package.json"].map((f) => fs.statSync(path.join(top, f)).mtimeMs));
  if (!fs.existsSync(stamp) || fs.statSync(stamp).mtimeMs < want) {
    execFileSync(process.execPath, [path.join(top, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn"], { cwd: top, stdio: ["ignore", "inherit", "inherit"] });
    // The rooms seen through the doors (#218): from the cache, or drawn in this site if their fingerprint is new.
    if (!process.env.TEMPLE_NO_DOORWAYS) execFileSync(process.execPath, [path.join(top, "tools", "bake-doorways.mjs")], { cwd: top, stdio: ["ignore", "inherit", "inherit"] });
    fs.writeFileSync(stamp, new Date().toISOString() + "\n");
  }
  return dist;
}
module.exports = { site };
