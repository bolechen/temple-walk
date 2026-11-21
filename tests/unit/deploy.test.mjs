// Where a build is served decides whether it counts visitors and whether a search engine may take it (#308, app/src/deploy.js).
// Only a production build holds the counter's address; the other two say they are not to be indexed. The only way to be
// sure is to build each target and look in what comes out (as channel.test.mjs does for the sponsor page).
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import { deployOf, DEPLOYS, DEPLOY } from "../../app/src/deploy.js";

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
});

test("only the production build holds the counter's address and may be indexed; canary and preview hold neither, and the unnamed build is a preview", () => {
  for (const target of ["production", "canary", "preview", undefined]) {
    const out = build(target), name = target || "unset";
    try {
      const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
      const hits = withCounter(out), headers = path.join(out, "_headers");
      // The shared page of seals (#319) points at the main site in every build, whichever address serves it: the code's address and the foot's host are constants in the bundle, (the page of seals and the photo card both write MAIN.host).
      const bundle = walk(out).filter((f) => /\.js$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
      assert.ok(!/location\.host\s*\+\s*location\.pathname/.test(bundle), `${name}: a page still reads its own address for a footer (photo card or page of seals)`);
      assert.ok(bundle.includes("https://temple.rushiwowen.co/") && bundle.includes("?utm_source=goshuin&utm_medium=share&utm_content="), `${name}: the shared page's code does not name the main site`);
      if (target === "production") {
        assert.ok(hits.includes("index.html"), "production: the counter is not in the page");
        assert.ok(!/name="robots"/.test(html), "production: the page keeps itself out of search"); assert.ok(!/X-Robots-Tag/.test(fs.readFileSync(headers, "utf8")), "production: a noindex header");
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

// The canary is shown to testers and is production in every way but four (noindex, no counter, the version line, and the
// levels still being made, which it lists as a preview does: the owner, 2026-11-21, 「t05 改成 canary 可以测」): the debug
// panel and the workbench addresses (?debug, ?seals, ?at, ?play, ?devpose) are a pull request preview's, found by the
// preview's hostname in the page, never by the build target. So the canary's pages open no more than production's: the same
// gate, as many times, no mention of the canary's own address; and its code is a preview's, byte for byte but for the
// target's name, so that what it holds beyond production's is what a preview holds (level-bench.test.mjs: T05).
test("the canary build opens no debug panel and no workbench address that production does not", () => {
  const prod = build("production"), canary = build("canary"), preview = build("preview");
  try {
    const scripts = (out) => walk(out).filter((f) => /\.js$/.test(f)).map((f) => [path.basename(f), fs.readFileSync(f, "utf8")]);
    const gate = /-temple-walk-preview/g, count = (list) => list.reduce((n, [, s]) => n + (s.match(gate) || []).length, 0);
    const p = scripts(prod), c = scripts(canary), v = scripts(preview);
    assert.ok(count(p) > 0, "the preview gate is not in the production bundle: the test looks in the wrong place");
    assert.equal(count(c), count(p), "the canary's bundle has a different number of preview gates than production's");
    for (const [name, s] of c) assert.ok(!s.includes("temple-walk-canary"), `${name} names the canary's own address: a gate that opens something there`);
    // The same code: the same scripts, byte for byte, once the build's own name for its target is set aside. That one
    // word is folded in on purpose (#310: the pause menu says which build it is), and it changes the content hashes the
    // bundler names the files by and by which they import each other, so those are set aside too.
    const bare = (n) => n.replace(/-[A-Za-z0-9_-]{8}\.js$/, ".js"), same = (src) => src.replace(/-[A-Za-z0-9_-]{8}\.js/g, ".js").replace(/(["'`])(preview|canary)\1/g, "$1T$1");
    assert.deepEqual(c.map(([n]) => bare(n)).sort(), v.map(([n]) => bare(n)).sort(), "the canary's scripts are not a preview's (a different build, not the same code)");
    const previewCode = new Set(v.map(([n, src]) => bare(n) + "\n" + same(src)));   // (two files may share a name once their hashes are set aside: shared/textures/index.js and assets/index-*.js)
    for (const [n, src] of c) assert.ok(previewCode.has(bare(n) + "\n" + same(src)), `${n}: the canary's code differs from a preview's by more than the name of its target`);
    // And every script production has, the canary has too: what it holds beyond is only added.
    const names = new Set(c.map(([n]) => bare(n))); for (const [n] of p) assert.ok(names.has(bare(n)), `${n}: in production's build but not the canary's`);
  } finally { for (const o of [prod, canary, preview]) fs.rmSync(o, { recursive: true, force: true }); }
});

// The cache headers (#308, `HEADERS` in vite.config.mjs): one file, the same cache rules for production, canary and preview, so that
// what a tester is shown is cached as the public page is. What the bundler names by its content never changes under its name.
test("the three builds send the same cache headers: hashed files for a year, the page and version.json always asked", () => {
  const files = {};
  for (const target of ["production", "canary", "preview"]) {
    const out = build(target);
    try {
      const text = fs.readFileSync(path.join(out, "_headers"), "utf8");
      files[target] = text.replace(/\/\*\n  X-Robots-Tag[^\n]*\n/, "");   // the one rule that differs, taken out
      // every file under assets/ is named by its content: a rule for a year over a plain name would pin a stale file
      for (const f of fs.readdirSync(path.join(out, "assets"))) assert.match(f, /-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/, `${target}: assets/${f} has no content hash but the rule over assets/ makes it immutable`);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
  assert.equal(files.canary, files.production, "canary's cache rules differ from production's");
  assert.equal(files.preview, files.production, "a preview's cache rules differ from production's");
  const rules = Object.fromEntries(files.production.split(/\n(?=\S)/).map((b) => { const [p, ...h] = b.trim().split("\n"); return [p, h.map((x) => x.trim())]; }));
  const year = ["Cache-Control: public, max-age=31536000, immutable"];
  assert.deepEqual(rules["/assets/*"], year);
  assert.deepEqual(rules["/shared/doorways/*.webp"], year); assert.deepEqual(rules["/shared/doorways/*.png"], year);
  for (const p of ["/", "/index.html", "/version.json"]) assert.deepEqual(rules[p], ["Cache-Control: no-cache"], p);
  // what is fetched by a plain name keeps the platform's revalidation: no rule of ours over shared/ as a whole, over the doorways' manifest, or over the floor
  for (const p of Object.keys(rules)) assert.ok(!["/shared/*", "/shared/doorways/*"].includes(p) && !/^\/shared\/(walk|textures|models)\b/.test(p) && !/t00\.(json|bin)/.test(p), `a rule over ${p} would cache a plain name`);
});
