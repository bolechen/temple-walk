// The shared page of seals as the game draws it (#319), in every state worth looking at, read back off the page itself.
//
//     node tools/goshuin-pages.cjs [outdir] [--langs=zh,ja] [--kinds=full,none]     pictures → tools/out/goshuin/, a contact sheet beside them (a row to a kind, a column to a language)
//
// Each picture is the file the book's 分享 button hands to the system, opened by __book() on a book kept in memory
// (journey.js's bookFrom, as ?seals= on the workbench does) and fetched from the page as bytes. `render` is also what the e2e
// scenario `goshuin` reads the code back with.
const fs = require("fs"), path = require("path");
const { serve, launch, open } = require("../tests/e2e/lib.cjs");

const LANGS = ["zh", "ja", "en", "ko"];
// full: seven seals and the library's line; fullNoLine: seven seals, no line; none: no seal; some: two seals, no line; someLine: the library's seal, so a line, among others
const KINDS = {
  full: { seals: "all" }, fullNoLine: { seals: "all", noVerse: true }, none: { seals: "none" },
  some: { seals: "bell,tea" }, someLine: { seals: "bell,sutra,tea" },
};

/** The picture's JPEG bytes, as the page's own book made them. @param {import("playwright").Browser} browser @param {string} base @param {{lang:string, kind:keyof typeof KINDS}} what */
async function render(browser, base, { lang, kind }) {
  const { bookFrom } = await import("../app/src/journey.js"), k = KINDS[kind];
  let book = bookFrom(k.seals); if (k.noVerse) book = JSON.stringify({ ...JSON.parse(book), verse: null });
  const t = await open(browser, base, `q=low&lang=${lang}&off=site,bamboo,trees,backdrop,reflect,bloom,drift,props,ground,doorway`, { enter: false, init: `localStorage.setItem("yunjing.journey.v1", ${JSON.stringify(book)}); localStorage.setItem("yunjing.lang.v1", "${lang}");` });
  try {
    await t.page.evaluate(() => window.__book());
    await t.page.waitForFunction(() => { const i = document.getElementById("bookImg"); return i && i.complete && i.naturalWidth === 1200; }, null, { timeout: 120000 });
    const b64 = await t.page.evaluate(async () => { const r = await (await fetch(document.getElementById("bookSave").href)).blob(); const u = new Uint8Array(await r.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); });
    if (t.errors.length) throw new Error(t.errors.join("\n"));
    return Buffer.from(b64, "base64");
  } finally { await t.close(); }
}
module.exports = { render, LANGS, KINDS };

if (require.main === module) (async () => {
  const sharp = require("sharp"), arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").slice(n.length + 3) || d;
  const dir = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "out", "goshuin");
  const langs = arg("langs", LANGS.join(",")).split(","), kinds = arg("kinds", Object.keys(KINDS).join(",")).split(",");
  fs.mkdirSync(dir, { recursive: true });
  const srv = await serve(), browser = await launch(), made = [];
  const rows = [];
  for (const kind of kinds) { rows.push({ kind }); for (const lang of langs) {
    const buf = await render(browser, srv.base, { lang, kind }), f = path.join(dir, `goshuin-${kind}-${lang}.jpg`); fs.writeFileSync(f, buf); made.push({ f, kind, lang }); console.log("wrote", f);
  } }
  await browser.close(); srv.close();
  // the contact sheet: a row to a kind, a column to a language, each page at a fifth of its size
  const w = 240, h = 320, sheet = [];
  for (const [r, row] of rows.entries()) for (const [c, lang] of langs.entries()) { const m = made.find((x) => x.kind === row.kind && x.lang === lang); sheet.push({ input: await sharp(m.f).resize(w, h).toBuffer(), left: c * (w + 8) + 8, top: r * (h + 8) + 8 }); }
  await sharp({ create: { width: langs.length * (w + 8) + 8, height: rows.length * (h + 8) + 8, channels: 3, background: "#777" } }).composite(sheet).jpeg({ quality: 82 }).toFile(path.join(dir, "sheet.jpg"));
  console.log("wrote", path.join(dir, "sheet.jpg"));
})();
