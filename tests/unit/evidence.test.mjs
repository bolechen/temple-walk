// Evidence lives outside git (issue #223): what the offline half of tools/evidence.mjs must hold. Nothing here uses the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { urlOf, remoteOf, manifestProblems, checkTree, isText, push, CONFIG } from "../../tools/evidence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REV = "a".repeat(40);
const good = { version: 1, dataset: "x/y", files: [{ path: "a.jpg", bytes: 3, sha256: "b".repeat(64), rev: REV }] };

test("the address is made in one place, from the config's base and the pinned commit", () => {
  assert.equal(urlOf("t00/x/a b.jpg", REV, "https://h/r/"), `https://h/r/${REV}/t00/x/a%20b.jpg`);
  assert.match(CONFIG.base, /\/resolve\/$/);
  assert.equal(urlOf("t00/a.jpg", REV), `${process.env.EVIDENCE_BASE || CONFIG.base}${REV}/t00/a.jpg`);
});

test("a folder under docs/<level>/evidence is kept in the store as <level>/<rest>", () => {
  assert.equal(remoteOf("docs/t00/evidence/plaque-clear-213/hall-3m.jpg"), "t00/plaque-clear-213/hall-3m.jpg");
  assert.throws(() => remoteOf("docs/t00/other/x.jpg"));
});

test("a manifest is well-formed or says why not", () => {
  assert.deepEqual(manifestProblems(good), []);
  assert.ok(manifestProblems({ ...good, version: 2 }).length);
  assert.ok(manifestProblems({ ...good, files: [{ ...good.files[0], sha256: "zz" }] }).length);
  assert.ok(manifestProblems({ ...good, files: [{ ...good.files[0], rev: "main" }] }).length, "pinned to a commit, never a branch");
  assert.ok(manifestProblems({ ...good, files: [{ ...good.files[0], path: "../a.jpg" }] }).length);
  assert.ok(manifestProblems({ ...good, files: [good.files[0], good.files[0]] }).length, "a path twice");
});

test("text stays in git; pictures and films are evidence", () => {
  for (const f of ["README.md", "report.json", "run.log", "x.cjs"]) assert.equal(isText(f), true, f);
  for (const f of ["a.jpg", "a.PNG", "a.webm", "a.mp4"]) assert.equal(isText(f), false, f);
});

test("CI's check: nothing over 1 MB under an evidence folder; bad manifests fail", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ev-"));
  try {
    const dir = path.join(root, "docs/t00/evidence/x");
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(root, "tools"), { recursive: true });
    fs.writeFileSync(path.join(dir, "small.jpg"), Buffer.alloc(1000));
    fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify(good));
    assert.deepEqual(checkTree(root), []);
    fs.writeFileSync(path.join(dir, "big.jpg"), Buffer.alloc(2 << 20));
    assert.match(checkTree(root).join("\n"), /big\.jpg.*over 1 MB/);
    fs.rmSync(path.join(dir, "big.jpg"));
    assert.deepEqual(checkTree(root), []);
    fs.writeFileSync(path.join(dir, "MANIFEST.json"), "{not json");
    assert.ok(checkTree(root).some((p) => /MANIFEST\.json/.test(p)));
    // outside an evidence folder the rule is not this tool's
    fs.mkdirSync(path.join(root, "docs/other"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/other/big.png"), Buffer.alloc(2 << 20));
    assert.ok(!checkTree(root).some((p) => /other/.test(p)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the repository itself passes the check", () => {
  assert.deepEqual(checkTree(ROOT), []);
});

test("push refuses a name the manifest holds with other bytes, before sending anything", async () => {
  const dir = path.join(ROOT, "docs/t00/evidence", `zz-refuse-${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, "a.jpg"), "new bytes");
    fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify(good));
    await assert.rejects(push(dir, { log() {} }), /refusing to overwrite .*a\.jpg/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
