// Checks that every relative link and image in README.md points at a file that exists, and that every <img>/![]() has alt text.
import fs from "node:fs"; import path from "node:path";
const root = path.resolve(import.meta.dirname, ".."), text = fs.readFileSync(path.join(root, "README.md"), "utf8");
let bad = 0;
for (const m of text.matchAll(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g)) {
  const [, img, alt, href] = m;
  if (img && !alt.trim()) { console.log("no alt:", href); bad++; }
  if (/^[a-z]+:|^#/.test(href)) continue;
  if (!fs.existsSync(path.join(root, decodeURIComponent(href.split("#")[0])))) { console.log("missing:", href); bad++; }
}
for (const m of text.matchAll(/<img\b[^>]*>/g)) if (!/\balt="[^"]+"/.test(m[0])) { console.log("no alt:", m[0]); bad++; }
console.log(bad ? `${bad} problem(s)` : "README links and alt text ok"); process.exit(bad ? 1 : 0);
