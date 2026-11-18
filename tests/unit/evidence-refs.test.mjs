// No reference may point at an evidence file that is neither in the repository nor in a manifest (issue #223).
// Two kinds of reference are told apart. A Markdown link or image (`](x.jpg)`, `src="x.jpg"`) has to open from where
// it stands, so it must be a full address or a file that is really there. A path written as a name (in backticks, in a
// JSON record of what was delivered or reviewed) is an identifier: it must be a file in the repository or an entry of
// some manifest, which is how a reader (the Site, an independent reviewer) finds the bytes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { manifestsUnder } from "../../tools/evidence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXT = "jpg|jpeg|png|webm|mp4|gif|webp";
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 }).split("\0").filter(Boolean);
const have = new Set(tracked.filter((f) => fs.existsSync(path.join(ROOT, f))));
const listed = new Set();
for (const mf of manifestsUnder(ROOT)) {
  const dir = path.relative(ROOT, path.dirname(mf)).split(path.sep).join("/");
  for (const f of JSON.parse(fs.readFileSync(mf, "utf8")).files) listed.add(`${dir}/${f.path}`);
}
const there = (p) => have.has(p) || listed.has(p);
const readers = tracked.filter((f) => /\.(md|json)$/.test(f) && !f.endsWith("MANIFEST.json") && !/^(tools\/out|node_modules)\//.test(f) || f === "llms.txt");

test("a path written as a name that points under an evidence folder is in the repository or in a manifest", () => {
  // A name is made of ASCII path characters; a shorthand such as `CAM-0N.jpg` or `CAM-01..06.jpg` stands for several files and names none.
  const re = new RegExp(`docs/[A-Za-z0-9_-]+/evidence/(?:[A-Za-z0-9._+-]+/)*[A-Za-z0-9._+-]+?\\.(?:${EXT})(?![A-Za-z0-9])`, "g");
  const shorthand = /\.\.|-0N\./;
  const missing = [];
  for (const f of readers) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of text.matchAll(re)) if (!shorthand.test(m[0]) && !there(m[0])) missing.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual([...new Set(missing)].slice(0, 30), []);
});

test("a Markdown link or image to a picture or film is a full address or a file that is there", () => {
  const re = new RegExp(`(?:\\]\\(|src="|href=")([^)"\\s]+?\\.(?:${EXT}))(?:["\\s)]|$)`, "gi");
  const broken = [];
  for (const f of tracked.filter((x) => x.endsWith(".md") && fs.existsSync(path.join(ROOT, x)))) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of text.matchAll(re)) {
      const t = m[1].split("#")[0];
      if (/^https?:\/\//.test(t)) continue;
      const rel = t.startsWith("/") ? t.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(f), t));
      if (!have.has(rel)) broken.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(broken)].slice(0, 30), []);
});
