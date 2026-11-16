// The published site carries the licences of the libraries it is made of (docs/t00/LICENSING-AUDIT.md, §三.3): the
// bundler strips the MIT headers out of three.js, meshoptimizer, lil-gui and stats.js, and Basis Universal is Apache-2.0,
// which asks for its licence and its NOTICE. This builds the site into a scratch folder and looks in what comes out.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "temple-dist-"));
execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] });
const read = (f) => fs.readFileSync(path.join(out, f), "utf8");
test.after(() => fs.rmSync(out, { recursive: true, force: true }));

test("dist/ holds a third-party licence summary that names the five libraries", () => {
  const text = read("shared/licenses/THIRD-PARTY-NOTICES.txt");
  for (const lib of ["three.js", "meshoptimizer", "lil-gui", "stats.js", "Basis Universal"]) assert.ok(text.includes(lib), `the summary does not name ${lib}`);
});

test("the summary has each library's full licence text, not only its name", () => {
  const text = read("shared/licenses/THIRD-PARTY-NOTICES.txt");
  assert.ok(text.includes(fs.readFileSync(path.join(ROOT, "node_modules/three/LICENSE"), "utf8").trim()), "three.js's MIT text, as installed, is not in it");
  assert.ok(text.includes(fs.readFileSync(path.join(ROOT, "node_modules/meshoptimizer/LICENSE.md"), "utf8").trim()), "meshoptimizer's MIT text is not in it");
  assert.equal((text.match(/Permission is hereby granted, free of charge/g) || []).length, 4, "four MIT licences");
  assert.ok(/Apache License\s+Version 2\.0, January 2004/.test(text), "the Apache-2.0 text is not in it");
  assert.ok(/Binomial LLC/.test(text) && /Basis Universal/.test(text), "Basis's NOTICE is not in it");
  assert.ok(/Arseny Kapoulkine/.test(text) && /George Michael Brower/.test(text) && /stats\.js authors/.test(text) && /three\.js authors/.test(text), "a copyright line is missing");
});

test("the Basis transcoder's own folder carries Basis's Apache-2.0 LICENSE and its NOTICE, not three.js's MIT", () => {
  const lic = read("vendor/basis/LICENSE"), notice = read("vendor/basis/NOTICE");
  assert.ok(/Apache License\s+Version 2\.0/.test(lic) && !/MIT License/.test(lic.slice(0, 200)), "vendor/basis/LICENSE is not Apache-2.0");
  assert.ok(/Binomial LLC/.test(notice), "vendor/basis/NOTICE is not Basis's");
});
