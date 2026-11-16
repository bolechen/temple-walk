// Every line the page may show, as the Chinese it is written in: what the translation tables (locales/ja.js, en.js,
// ko.js) must hold. Read from the sources themselves, so a line added to the page and not to the tables
// fails i18n.test.mjs. Shared with nothing else; kept apart so the test reads as a list of rules.
import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("../../app/", import.meta.url).pathname;
const CJK = /[㐀-鿿　-〿＀-￯]/;
// Not translated, on purpose: the dev server's panel and measuring walk, the WeChat group's card (offered only in
// Chinese), and the tables themselves.
export const SKIP = ["src/debug.js", "src/tour.js", "src/community.js", "src/i18n.js"];
// Each language button is written in its own language, and is never translated.
export const OWN_NAMES = ["中文", "日本語", "English", "한국어"];

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const unquote = (q, s) => (q === "`" ? s : JSON.parse(`"${s.replace(/\\'/g, "'")}"`));

/** The first argument of every t("…") / tr("…") call whose text is written out. */
export function calledKeys() {
  const files = ["yard.js", "loading.js", ...fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".js")).map((f) => `src/${f}`)].filter((f) => !SKIP.includes(f));
  const keys = new Map();
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/(?<![\w.$])(?:t|tr)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1\s*[,)]/g)) {
      if (m[1] === "`" && m[2].includes("${")) continue;
      const k = unquote(m[1], m[2]); if (CJK.test(k)) keys.set(k, f);
    }
  }
  return keys;
}

/** The page as written: text nodes, the attributes that are read, and words broken by <br>. */
export function pageKeys() {
  // The WeChat group's card and its two invitations are offered only in Chinese (src/community.js).
  const html = read("index.html").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<dialog[^>]*id="community"[\s\S]*?<\/dialog>/, "").replace(/<div class="community-invite"[\s\S]*?<\/div>/, "").replace(/<button[^>]*id="titleCommunity"[^>]*>[^<]*<\/button>/, "");
  const keys = new Set();
  for (const m of html.matchAll(/>([^<>]+)</g)) { const k = m[1].trim(); if (k && CJK.test(k)) keys.add(k); }
  for (const m of html.matchAll(/\s(?:aria-label|alt|title|content)="([^"]*)"/g)) { const k = m[1].trim(); if (k && CJK.test(k)) keys.add(k); }
  for (const m of html.matchAll(/>((?:[^<>]+<br>)+[^<>]+)</g)) keys.add(m[1].trim());
  for (const m of html.matchAll(/<title>([^<]+)<\/title>/g)) keys.add(m[1].trim());
  for (const n of OWN_NAMES) keys.delete(n);
  // A word broken by <br> is translated whole; its pieces are not lines of their own.
  for (const k of [...keys]) if (k.includes("<br>")) for (const p of k.split("<br>")) keys.delete(p.trim());
  return keys;
}

/** The lines kept as data and shown through t() at the moment they are shown. */
export async function dataKeys() {
  const { SEALS, VERSES } = await import("../../app/src/journey.js");
  const { NAMES, LINES } = await import("../../app/src/mood.js");
  const keys = new Set();
  for (const s of SEALS) for (const k of ["seal", "place", "act", "line", "hint"]) keys.add(s[k]);
  for (const [text, from] of VERSES) { keys.add(text); keys.add(from); }
  for (const k of Object.values(NAMES)) keys.add(k);
  for (const pair of Object.values(LINES)) for (const k of pair) keys.add(k);
  // The leaves in the halls and the empty frame: title and text, read from the source (interior.js needs a page).
  const interior = read("src/interior.js");
  for (const m of interior.matchAll(/title: "([^"]+)", text: "([^"]+)"/g)) { keys.add(m[1]); keys.add(m[2]); }
  // The halls' names, said on entering and kept as where he was left.
  for (const m of read("src/site.js").matchAll(/hall: \{[^}]*name: "([^"]+)"/g)) keys.add(m[1]);
  keys.add("山路上");
  // Words each table needs for the action button and the calligraphy (game.js translates these as they are shown).
  for (const k of ["撞钟", "起身", "观看", "坐下", "圆", "奉拜", "云径", "云径禅寺", "年代", "质地", "尺寸", "收藏"]) keys.add(k);
  return keys;
}

export async function allKeys() {
  return new Set([...calledKeys().keys(), ...pageKeys(), ...(await dataKeys())]);
}
