// The owner's WeChat payment code on the 功德箱's sheet (#202): one file in the repository, named by the date of the parent
// project's version, kept in step with the register's note of where it came from (what its hash is), shown only in the
// languages' interfaces, and in no build but the web one (tests/unit/channel.test.mjs scans the others).
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
import "./dom-stub.mjs";
const { parseCSV } = await import("./asset-register.test.mjs");
const { donateURL, qrFor, QR_OPEN } = await import("../../app/src/donate.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FILE = "app/web/wechat-support-2026-08-28.jpg", bytes = fs.readFileSync(path.join(ROOT, FILE));
const row = parseCSV(fs.readFileSync(path.join(ROOT, "docs/t00/asset-register.csv"), "utf8")).find((r) => r.file === FILE);

test("the code is one JPEG of 1152 × 1152 in app/web/, outside the folders the build copies whole, named by the parent project's version", () => {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, "not a JPEG"); let w = 0, h = 0;
  for (let i = 2; i < bytes.length - 9;) { if (bytes[i] !== 0xff) break; const m = bytes[i + 1]; if (m >= 0xc0 && m <= 0xc3) { h = bytes.readUInt16BE(i + 5); w = bytes.readUInt16BE(i + 7); break; } i += 2 + bytes.readUInt16BE(i + 2); }
  assert.deepEqual([w, h], [1152, 1152]);
  const cfg = fs.readFileSync(path.join(ROOT, "vite.config.mjs"), "utf8"), kept = cfg.match(/const KEPT = \[([^\]]*)\]/)[1];
  assert.ok(!/"web"/.test(kept), "app/web/ must not be one of the folders the build copies whole (KEPT in vite.config.mjs)");
  assert.match(path.basename(FILE), /^wechat-support-\d{4}-\d{2}-\d{2}\.jpg$/);
});

test("the register names the file, says where it came from and what its hash is, and the hash is the file's", () => {
  assert.ok(row, "no row in docs/t00/asset-register.csv for " + FILE);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.ok(row.source.includes(sha), `the register's note does not hold the file's sha256 ${sha}`);
  assert.match(row.source, /parent project/); assert.match(row.source, /changes its code/);
  assert.match(row.used_for, /web build/);
});

test("it is shown in every language, and the registration link carries its own campaign content", () => {
  for (const l of ["zh", "en", "ja", "ko"]) assert.equal(qrFor(l), true, l);   // all four (the owner, 2026-11-19: Chinese players abroad)
  assert.equal(QR_OPEN, true, "the owner chose it open when the sheet opens (2026-11-18); folding it is a change of that decision");
  const u = new URL(donateURL("zh", "zh-qr"));
  assert.equal(u.pathname, "/donate"); assert.equal(u.searchParams.get("utm_content"), "zh-qr"); assert.equal(u.searchParams.get("utm_campaign"), "offering-box");
  assert.equal(new URL(donateURL("zh")).searchParams.get("utm_content"), "zh", "the button keeps the language as its content");
  for (const l of ["en", "ja", "ko"]) assert.equal(new URL(donateURL(l, l + "-qr")).searchParams.get("utm_content"), l + "-qr", l);
  assert.equal(new URL(donateURL("ko", "ko-qr")).pathname, "/en/donate", "a Korean reader is still sent to the English page");
});

test("the words beside the code do not say what the sheet must not (功德、供养、布施、回向), and the code's lines are all in the other languages' tables", async () => {
  const src = fs.readFileSync(path.join(ROOT, "app/src/donate.js"), "utf8");
  const lines = [...src.matchAll(/\bt\("([^"]+)"\)/g)].map((m) => m[1]).filter((l) => l !== "功德箱");
  assert.ok(lines.length >= 8, "donate.js's lines were not found");
  for (const l of lines) assert.ok(!/功德|供养|布施|回向|募捐/.test(l), `「${l}」`);
  for (const lang of ["en", "ja", "ko"]) { const table = (await import(`../../app/locales/${lang}.js`)).default; for (const l of lines) assert.ok(table[l], `${lang} lacks 「${l}」`); }
});
