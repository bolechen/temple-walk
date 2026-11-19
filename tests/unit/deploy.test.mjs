// Where a build is served decides whether it counts visitors and whether a search engine may take it (#308, app/src/deploy.js).
// Only a production build holds the counter's address; the other two say they are not to be indexed. The only way to be
// sure is to build each target and look in what comes out (as channel.test.mjs does for the sponsor page).
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import { deployOf, DEPLOYS, DEPLOY, CANARY_HOST } from "../../app/src/deploy.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COUNTER = "u.rushiwowen.co", TEXT = /\.(js|mjs|css|html|json|txt|svg|map)$/;
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
function build(target) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `temple-deploy-${target || "unset"}-`));
  const env = { ...process.env }; if (target) env.VITE_DEPLOY = target; else delete env.VITE_DEPLOY;
  execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env, stdio: ["ignore", "inherit", "inherit"] });
  return out;
}
/** What in a built site mentions the counter's address (text files only). */
const withCounter = (out) => walk(out).filter((f) => TEXT.test(f) && fs.readFileSync(f, "utf8").includes(COUNTER)).map((f) => path.relative(out, f));

test("deployOf: the three targets, preview when nobody said, and nothing else", () => {
  assert.deepEqual([...DEPLOYS], ["production", "canary", "preview"]);
  for (const t of DEPLOYS) assert.equal(deployOf(t), t);
  assert.equal(deployOf(undefined), "preview"); assert.equal(deployOf(""), "preview"); assert.equal(deployOf(null), "preview");
  assert.throws(() => deployOf("prod"), /VITE_DEPLOY must be one of/);
  assert.equal(DEPLOY, "preview", "unit tests run on the unbuilt sources, which are not production");
  assert.ok(CANARY_HOST.test("temple-walk-canary.some-account.workers.dev") && !CANARY_HOST.test("127.0.0.1") && !CANARY_HOST.test("temple.rushiwowen.co"));
});

test("only the production build holds the counter's address and may be indexed; canary and preview hold neither, and the unnamed build is a preview", () => {
  for (const target of ["production", "canary", "preview", undefined]) {
    const out = build(target), name = target || "unset";
    try {
      const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
      const hits = withCounter(out), headers = path.join(out, "_headers");
      if (target === "production") {
        assert.ok(hits.includes("index.html"), "production: the counter is not in the page");
        assert.ok(!/name="robots"/.test(html), "production: the page keeps itself out of search"); assert.ok(!fs.existsSync(headers), "production: _headers");
        assert.ok(!/production-only/.test(html), "production: the markers stay in the page");
      } else {
        assert.deepEqual(hits, [], `${name}: the counter's address is in the build`);
        assert.ok(/<meta name="robots" content="noindex, nofollow">/.test(html), `${name}: no noindex in the page`);
        assert.ok(!/<script[^>]*umami|script\.js/.test(html), `${name}: a counter script is in the page`);
        assert.match(fs.readFileSync(headers, "utf8"), /X-Robots-Tag: noindex/, `${name}: no noindex header`);
        assert.ok(!/production-only/.test(html), `${name}: the markers stay in the page`);
      }
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
});
