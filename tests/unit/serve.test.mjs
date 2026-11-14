// The little server the tests and tools open the page through: it serves app/ to this machine and nothing else.
import test from "node:test"; import assert from "node:assert/strict";
import http from "node:http"; import { createRequire } from "node:module";
let lib = null; try { lib = createRequire(import.meta.url)("../e2e/lib.cjs"); } catch {}   // needs Playwright to be installed, as the end-to-end tests do

const get = (base, path) => new Promise((resolve, reject) => {
  const u = new URL(base); http.get({ host: u.hostname, port: u.port, path }, (res) => { let n = 0; res.on("data", (d) => (n += d.length)).on("end", () => resolve({ status: res.statusCode, bytes: n })); }).on("error", reject);
});
test("the test server serves the app, and only the app, and only to this machine", { skip: !lib && "Playwright is not installed" }, async () => {
  const s = await lib.serve(); try {
    assert.equal(new URL(s.base).hostname, "127.0.0.1");
    assert.equal((await get(s.base, "/")).status, 200); assert.equal((await get(s.base, "/src/site.js")).status, 200);
    for (const path of ["/../CLAUDE.md", "/..%2FCLAUDE.md", "/%2e%2e/CLAUDE.md", "/src/../../CLAUDE.md", "/..%5CCLAUDE.md", "//etc/passwd", "/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"])
      assert.equal((await get(s.base, path)).status, 404, `${path} climbed out of the app`);
    assert.equal((await get(s.base, "/%E0%A4%A")).status, 404, "a bad escape should be refused, not thrown on");
    assert.equal((await get(s.base, "/src")).status, 404, "a directory is not a file");
    assert.equal((await get(s.base, "/")).status, 200, "the server should still be standing");
  } finally { s.close(); }
});
