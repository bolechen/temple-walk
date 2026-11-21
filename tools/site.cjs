// The built site the tests and tools open: dist/, as Vite writes it and as it is published. Asking for it builds it
// first when anything in app/ (or the build's own settings) is newer than the last build, so a tool never draws a
// stale page. TEMPLE_SITE names a site already built (the GPU job is handed one).
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path"), http = require("http");
const top = path.join(__dirname, ".."), app = path.join(top, "app"), dist = path.join(top, "dist"), stamp = path.join(dist, ".built");
// app/shared/doorways/ is written by the build itself (tools/bake-doorways.mjs, after Vite): it does not make the build stale.
function newest(d) { let t = 0; for (const f of fs.readdirSync(d)) { if (f === "node_modules" || path.join(d, f) === path.join(app, "shared", "doorways")) continue; const p = path.join(d, f), s = fs.statSync(p); t = Math.max(t, s.isDirectory() ? newest(p) : s.mtimeMs); } return t; }
function site() {
  if (process.env.TEMPLE_SITE) return path.resolve(process.env.TEMPLE_SITE);
  const want = Math.max(newest(app), ...["vite.config.mjs", "package.json"].map((f) => fs.statSync(path.join(top, f)).mtimeMs));
  if (!fs.existsSync(stamp) || fs.statSync(stamp).mtimeMs < want) {
    // The floor baked from the drawn meshes first (#265: the page walks on it), as `pnpm build` does: from the cache when nothing it is baked from changed.
    execFileSync(process.execPath, [path.join(top, "tools", "bake-walk.mjs")], { cwd: top, stdio: ["ignore", "ignore", "inherit"] });
    execFileSync(process.execPath, [path.join(top, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn"], { cwd: top, stdio: ["ignore", "inherit", "inherit"] });
    // The rooms seen through the doors (#218): from the cache, or drawn in this site if their fingerprint is new.
    if (!process.env.TEMPLE_NO_DOORWAYS) execFileSync(process.execPath, [path.join(top, "tools", "bake-doorways.mjs")], { cwd: top, stdio: ["ignore", 2, 2] });   // its words to stderr: callers read the path from stdout
    fs.writeFileSync(stamp, new Date().toISOString() + "\n");
  }
  return dist;
}

// The one static server for the tools and the tests: the site's files as they are published, nothing added, and a Worker's
// empty answers for /api/ (a canary's or production's page asks it for the day's traces, #340; a scenario that wants counts
// stubs /api/ itself with `route`). A path never leaves `root`; a directory (unless the path ends in /, then its index.html) or a missing file is a 404.
//   const srv = await serve(root[, { api: true, handler }]);  srv.base is "http://127.0.0.1:<port>/", srv.close() stops it.
// `handler(req, res, rel)` is asked first (rel: the decoded path without its query) and answers true when it has answered the
// request itself: the pages some audio tools write in code, a model file served from outside root (#399).
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".cjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".wasm": "application/wasm", ".ktx2": "image/ktx2", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".txt": "text/plain", ".csv": "text/csv" };
/** Where `rel` lies under `root`, or null when it would leave it. */
function under(root, rel) {
  const base = path.resolve(root), full = path.resolve(base, "." + path.posix.normalize("/" + rel));
  return full === base || full.startsWith(base + path.sep) ? full : null;
}
function serve(root, { api = true, handler = null } = {}) {
  const srv = http.createServer((req, res) => {
    let rel; try { rel = decodeURIComponent(req.url.split("?")[0]); } catch { res.writeHead(400); return res.end(); }
    if (handler && handler(req, res, rel)) return;
    if (api && req.url.startsWith("/api/")) {
      if (req.url.startsWith("/api/traces")) { res.writeHead(200, { "content-type": "application/json" }); return res.end('{"day":null,"traces":{}}'); }
      res.writeHead(204); return res.end();
    }
    const p = under(root, rel.endsWith("/") ? rel + "index.html" : rel);   // a path ending in / is that folder's page (the other build staged at base/ for a turn-about measure, tools/gpu-render.sh BASE_SITE)
    if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => { srv.base = `http://127.0.0.1:${srv.address().port}/`; resolve(srv); }));
}
module.exports = { site, serve, under, TYPES };
