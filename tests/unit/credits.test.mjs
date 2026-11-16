// The page of thanks and the card's processing line (docs/t00/LICENSING-AUDIT.md, §六): what ColBase's terms ask to be
// said of an edited picture, and the credits the other licences ask for, in every language.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { execFileSync } from "node:child_process";
import "./dom-stub.mjs";
const { WORKS } = await import("../../app/levels/t00/works.js");
const { processedLine, creditSections, FONTS, NOTICES, PLAQUE_ITEM } = await import("../../app/src/credits.js");
const i18n = await import("../../app/src/i18n.js");
const colbase = Object.entries(WORKS).filter(([, w]) => /colbase\.nich\.go\.jp/.test(w.url));

test("the 14 ColBase pictures say they were edited, and no other museum's picture is made to", () => {
  assert.equal(colbase.length, 14);
  for (const [slug, w] of Object.entries(WORKS)) {
    if (/colbase/.test(w.url)) assert.ok(["resize", "crop"].includes(w.processed), `${slug}: processed is "${w.processed}"`);
    else assert.equal(w.processed, "", `${slug}: only ColBase asks for it`);
  }
});

test("the processing line is written as ColBase's own example is, with the item's address, in all four languages", () => {
  for (const lang of i18n.LANGS) {
    for (const [slug, w] of colbase) {
      const line = i18n.t(w.processed === "crop" ? "「ColBase」（{url}）加工而成：裁切、缩小并转为 WebP。" : "「ColBase」（{url}）加工而成：缩小并转为 WebP。", { url: w.url }, lang);
      assert.ok(line.includes(w.url) && /ColBase/.test(line) && /WebP/.test(line), `${lang}/${slug}: ${line}`);
      if (lang !== "zh") assert.notEqual(line, i18n.t(w.processed === "crop" ? "「ColBase」（{url}）加工而成：裁切、缩小并转为 WebP。" : "「ColBase」（{url}）加工而成：缩小并转为 WebP。", { url: w.url }), `${lang}/${slug} is not translated`);
    }
  }
  assert.equal(processedLine(WORKS["cma-luye-damo"]), "", "a Cleveland picture needs no such line");
  assert.match(processedLine(colbase[0][1]), /TB-1446/);
  assert.match(processedLine({ url: "https://colbase.nich.go.jp/x", processed: "crop" }), /裁切/);
});

test("the page of thanks names every source the audit asks for, and links the licence summary", () => {
  const sections = creditSections(), all = JSON.stringify(sections);
  for (const must of ["ColBase", "Cleveland Museum of Art", "Metropolitan Museum of Art", "Minneapolis Institute of Art", "Poly Haven", "Rob Tuytel", "Rico Cilliers", "SIL Open Font License", "three.js", "meshoptimizer", "lil-gui", "stats.js", "Basis Universal", "Apache-2.0", PLAQUE_ITEM, NOTICES, "釋迦寶殿"]) assert.ok(all.includes(must), `the page does not mention ${must}`);
  const listed = sections.flatMap((s) => s.list || []).filter((e) => e.href);
  assert.deepEqual(listed.map((e) => e.href).sort(), colbase.map(([, w]) => w.url).sort(), "the page should list all 14 ColBase items, each linked to its own page");
  for (const [slug, w] of colbase) assert.ok(listed.some((e) => e.href === w.url && e.note === w.url.replace(/^.*collection_items\//, "")), slug);
});

test("every typeface cut for the page is credited with its copyright line, and the two renamed ones say what they are called", () => {
  const files = fs.readFileSync(new URL("../../app/shared/fonts/OFL.txt", import.meta.url), "utf8");
  for (const [name, copyright, as] of FONTS) { assert.ok(/^© \d{4}/.test(copyright), name); for (const n of name.split(", ")) assert.ok(files.includes(`---- ${n} ----`) || n.startsWith("Noto Serif") || n.startsWith("Yuji") && files.includes("---- Yuji"), `${n} has no licence in OFL.txt`); if (as) assert.match(as, /^Yunjing /); }
  assert.deepEqual(FONTS.filter((f) => f[2]).map((f) => f[0]), ["LXGW WenKai", "Nanum Brush Script"]);
});

test("the licence summary on disk is what tools/notices.mjs writes", () => {
  execFileSync(process.execPath, ["tools/notices.mjs", "--check"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "pipe" });
});
