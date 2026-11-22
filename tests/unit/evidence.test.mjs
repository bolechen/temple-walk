// Evidence lives outside git (issue #223): what the offline half of tools/evidence.mjs must hold. Nothing here uses the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { urlOf, remoteOf, manifestProblems, checkTree, isText, push, verifyTmp, retryWait, CONFIG } from "../../tools/evidence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REV = "a".repeat(40);
const good = { version: 1, dataset: "x/y", files: [{ path: "a.jpg", bytes: 3, sha256: "b".repeat(64), rev: REV }] };

test("the address is made in one place, from the config's base and the pinned commit", () => {
  assert.equal(urlOf("t00/x/a b.jpg", REV, "https://h/r/"), `https://h/r/${REV}/t00/x/a%20b.jpg`);
  // The copy readers use is the owner's own domain (#247); Hugging Face's `resolve/` form is the original, kept as the fallback.
  assert.equal(CONFIG.base, "https://evidence.dev.rushiwowen.co/");
  assert.match(CONFIG.fallback, /^https:\/\/huggingface\.co\/datasets\/.+\/resolve\/$/);
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

test("CI's check: an evidence folder holds at most one picture (png, jpg, webp); the rest is pushed and listed in the manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ev-"));
  try {
    const dir = path.join(root, "docs/t00/evidence/x"), other = path.join(root, "docs/t00/evidence/y");
    fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify(good));
    fs.writeFileSync(path.join(other, "MANIFEST.json"), JSON.stringify(good));
    fs.writeFileSync(path.join(dir, "collage.jpg"), Buffer.alloc(1000));
    fs.writeFileSync(path.join(other, "a.png"), Buffer.alloc(1000));       // one in each folder: fine
    assert.deepEqual(checkTree(root), []);
    fs.writeFileSync(path.join(dir, "second.png"), Buffer.alloc(1000));    // two in one folder
    const bad = checkTree(root).join("\n");
    assert.match(bad, /docs\/t00\/evidence\/x: 2 pictures/);
    assert.match(bad, /collage\.jpg/); assert.match(bad, /second\.png/);
    assert.ok(!/evidence\/y/.test(bad), "the other folder is not blamed");
    fs.rmSync(path.join(dir, "second.png"));
    fs.writeFileSync(path.join(dir, "third.webp"), Buffer.alloc(1000));    // webp counts, case does not matter
    assert.match(checkTree(root).join("\n"), /2 pictures/);
    fs.rmSync(path.join(dir, "third.webp"));
    fs.mkdirSync(path.join(dir, "sub"), { recursive: true });
    fs.writeFileSync(path.join(dir, "sub", "Deep.JPG"), Buffer.alloc(1000)); // a picture in a subfolder counts toward its folder
    assert.match(checkTree(root).join("\n"), /evidence\/x: 2 pictures/);
    fs.rmSync(path.join(dir, "sub"), { recursive: true });
    assert.deepEqual(checkTree(root), []);
    // text and films are not pictures here
    fs.writeFileSync(path.join(dir, "README.md"), "x"); fs.writeFileSync(path.join(dir, "run.webm"), Buffer.alloc(1000));
    assert.deepEqual(checkTree(root), []);
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

// The nightly run of 2026-11-19 (44597656836): one picture's body was cut off halfway at the public address
// ("terminated") and the whole check went red, though the bucket held it whole. A body cut off is asked for again; a
// body that arrives whole but wrong is still a failure.
test("verify asks again for a body cut off halfway, and still fails one that arrives whole and wrong", async () => {
  const { verify, sha256 } = await import("../../tools/evidence.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-")), dir = path.join(root, "docs/t00/evidence/cut");
  fs.mkdirSync(dir, { recursive: true });
  const bytes = Buffer.from("a whole picture");
  fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify({ version: 1, dataset: "x/y", files: [{ path: "a.jpg", bytes: bytes.length, sha256: sha256(bytes), rev: REV }] }));
  const real = globalThis.fetch;
  const cut = () => new Response(new ReadableStream({ start(c) { c.enqueue(bytes.subarray(0, 4)); c.error(new TypeError("terminated")); } }), { status: 200 });
  try {
    let calls = 0;
    globalThis.fetch = async () => (++calls === 1 ? cut() : new Response(bytes, { status: 200 }));
    assert.deepEqual(await verify({ all: true, root, log: () => {} }), [], "a body cut off once should be asked for again");
    assert.equal(calls, 2);
    globalThis.fetch = async () => new Response(Buffer.from("a whole fiction!"), { status: 200 });
    assert.equal((await verify({ all: true, root, log: () => {} })).length, 1, "a whole body with other bytes is a failure, not asked again");
  } finally { globalThis.fetch = real; fs.rmSync(root, { recursive: true, force: true }); }
});

test("verify-store reads two objects of the same bytes into two different files (#288: they raced on one and the mirror run went red every time)", () => {
  const same = "c".repeat(64), a = verifyTmp({ key: "rev/t00/288-form/shots/gable-top-after.png", sha256: same }), b = verifyTmp({ key: "rev/t00/288-form/shots/gable-top-before.png", sha256: same });
  assert.notEqual(a, b, "two keys of one content share a file name");
  assert.equal(a, verifyTmp({ key: "rev/t00/288-form/shots/gable-top-after.png", sha256: same }), "one key keeps its name");
});

// A store that turns us away for asking too often is waited on, as it asks or for seconds that double, and never
// longer than a minute; any other failure keeps its short pause (run 45060329278: 62 files met 429 from the original store).
test("a busy store (429, 503) is waited on as it asks, or for doubling seconds, never over a minute", () => {
  assert.equal(retryWait(429, "7", 0), 7000);
  assert.equal(retryWait(503, "300", 0), 60000);
  assert.equal(retryWait(429, null, 0), 4000);
  assert.equal(retryWait(429, null, 2), 16000);
  assert.equal(retryWait(429, "soon", 5), 60000);
  assert.equal(retryWait(500, "7", 1), 600);
});
