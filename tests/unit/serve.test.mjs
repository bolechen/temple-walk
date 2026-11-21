// The one static server of the tools and tests (tools/site.cjs `serve`, #399): paths stay under the root, types are right,
// /api/ is a Worker's empty answer, and a handler may answer first.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http";
import { createRequire } from "node:module";
const { serve, under } = createRequire(import.meta.url)("../../tools/site.cjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "serve-")); fs.mkdirSync(path.join(root, "sub")); fs.writeFileSync(path.join(root, "index.html"), "<p>hi</p>");
fs.writeFileSync(path.join(root, "a.js"), "1"); fs.writeFileSync(path.join(root, "sub", "b.glb"), "g"); fs.writeFileSync(path.join(path.dirname(root), "outside-" + path.basename(root) + ".txt"), "secret");
const get = (url, path_) => new Promise((resolve, reject) => http.get(url + path_.replace(/^\//, ""), (r) => { let b = ""; r.on("data", (d) => (b += d)); r.on("end", () => resolve({ status: r.statusCode, type: r.headers["content-type"], body: b })); }).on("error", reject));
const rawGet = (port, rawPath) => new Promise((resolve, reject) => { const r = http.request({ host: "127.0.0.1", port, path: rawPath, method: "GET" }, (x) => { let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => resolve({ status: x.statusCode, body: b })); }); r.on("error", reject); r.end(); });

test("files are served with their types, / is the index", async () => {
  const srv = await serve(root);
  try {
    assert.equal((await get(srv.base, "/")).body, "<p>hi</p>"); assert.equal((await get(srv.base, "/")).type, "text/html");
    assert.equal((await get(srv.base, "/a.js?x=1")).type, "text/javascript");
    assert.equal((await get(srv.base, "/sub/b.glb")).type, "model/gltf-binary");
    for (const [ext, type] of [[".webp", "image/webp"], [".png", "image/png"], [".jpg", "image/jpeg"], [".json", "application/json"], [".mp3", "audio/mpeg"], [".wasm", "application/wasm"], [".ktx2", "image/ktx2"], [".woff2", "font/woff2"], [".bin", "application/octet-stream"], [".svg", "image/svg+xml"], [".css", "text/css"]]) fs.writeFileSync(path.join(root, "t" + ext), "x"), assert.equal((await get(srv.base, "/t" + ext)).type, type, ext);
  } finally { srv.close(); }
});
test("a path never leaves the root, a directory or a missing file is a 404", async () => {
  const srv = await serve(root), port = srv.address().port;
  try {
    assert.equal((await rawGet(port, "/../outside-" + path.basename(root) + ".txt")).status, 404);
    assert.equal((await rawGet(port, "/%2e%2e/outside-" + path.basename(root) + ".txt")).status, 404);
    assert.equal((await rawGet(port, "/sub/../../outside-" + path.basename(root) + ".txt")).status, 404);
    assert.equal((await get(srv.base, "/sub")).status, 404); assert.equal((await get(srv.base, "/nope.js")).status, 404);
    assert.equal((await rawGet(port, "/%E0%A4%A")).status, 400);
  } finally { srv.close(); }
  assert.equal(under(root, "/../x"), path.join(root, "x")); assert.equal(under(root, "/"), root);
});
test("/api/ answers as a Worker with an empty day would, unless switched off; a handler answers first", async () => {
  const srv = await serve(root, { handler: (req, res, rel) => rel === "/page" ? (res.writeHead(200, { "content-type": "text/html" }), res.end("custom"), true) : false });
  try {
    assert.equal((await get(srv.base, "/api/traces")).body, '{"day":null,"traces":{}}'); assert.equal((await get(srv.base, "/api/anything")).status, 204);
    assert.equal((await get(srv.base, "/page")).body, "custom");
  } finally { srv.close(); }
  const bare = await serve(root, { api: false });
  try { assert.equal((await get(bare.base, "/api/traces")).status, 404); } finally { bare.close(); }
});
test("no tool or test starts a server of its own", () => {
  const { execFileSync } = require_("child_process"); let out = ""; try { out = execFileSync("git", ["grep", "-l", "createServer", "--", "tools", "tests"], { encoding: "utf8", cwd: path.join(import.meta.dirname, "..", "..") }); } catch { out = ""; }
  const files = out.split("\n").filter(Boolean).filter((f) => f !== "tools/site.cjs" && f !== "tests/unit/serve.test.mjs");
  assert.deepEqual(files, [], `these still make their own server: ${files.join(", ")}; use serve() from tools/site.cjs`);
});
const require_ = createRequire(import.meta.url);
