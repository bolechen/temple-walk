// A build's channel (src/channel.js) decides whether a way to the sponsor page is in it at all (issue #202). The only way
// to be sure the address is not in a Steam or storefront package is to build each channel and look in what comes out.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SECRETS = ["rushiwowen.co/donate", "utm_campaign", "offering-box"];   // the address, and its tags, as the web build holds them
const TEXT = /\.(js|mjs|css|html|json|txt|svg|map)$/;

/** Every file under a folder, as [relative path, bytes]. */
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name), base) : [[path.relative(base, path.join(dir, e.name)), path.join(dir, e.name)]]);
function build(channel) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `temple-${channel || "default"}-`));
  const env = { ...process.env }; if (channel) env.VITE_CHANNEL = channel; else delete env.VITE_CHANNEL;
  execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env, stdio: ["ignore", "inherit", "pipe"] });
  return out;
}
/** What in a built site mentions the address or its tags (text files only; the models and textures are binary). */
const found = (out) => walk(out).filter(([rel]) => TEXT.test(rel)).flatMap(([rel, abs]) => { const s = fs.readFileSync(abs, "utf8"); return SECRETS.filter((x) => s.includes(x)).map((x) => `${rel}: ${x}`); });

test("the web build holds the sponsor page's address, once, in the file that builds the sheet", () => {
  for (const channel of [undefined, "web"]) {
    const out = build(channel);
    try {
      const hits = found(out); assert.ok(hits.some((h) => h.includes("utm_campaign")), `${channel || "default"}: the campaign tags are not in the build`);
      const files = new Set(hits.filter((h) => h.includes("utm_campaign")).map((h) => h.split(":")[0])); assert.equal(files.size, 1, `the address is in ${[...files].join(", ")}`);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
});

test("the steam and platform builds hold neither the address nor its tags in any text file", () => {
  for (const channel of ["steam", "platform"]) {
    const out = build(channel);
    try {
      assert.deepEqual(found(out), [], `${channel}: the sponsor page leaked into the build`);
      for (const [rel, abs] of walk(out)) assert.ok(!fs.readFileSync(abs).includes("rushiwowen.co/donate"), `${channel}: ${rel} holds the address`);
      for (const [rel, abs] of walk(out)) if (TEXT.test(rel)) assert.ok(!/offeringGo|offering-box|mountOffering\(\{/.test(fs.readFileSync(abs, "utf8")), `${channel}: ${rel} holds the sheet`);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
});

test("a channel the build does not know fails it", () => {
  assert.throws(() => build("itch"), (e) => /VITE_CHANNEL/.test(String(e.stderr)));
});
