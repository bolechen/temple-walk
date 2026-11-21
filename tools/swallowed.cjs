// A statement hidden in a line comment (#414's review): a comment added at the end of a line of code that already went
// on, after the comment's place, with another statement. The comment then swallows it, and nothing fails until what it
// did is missed: twice in one change, the prologue's court paving was dropped from the ground's lamplit layers and every
// seat in its halls stopped being a seat. A line is flagged when code ending a statement is followed by `//` and the
// comment's own text ends in a call or an assignment closed by `;`, which prose does not. `pnpm run check` runs it over
// app/; tests/unit/swallowed.test.mjs holds it to the two it was written for and to a clean app/.
const fs = require("fs"), path = require("path");

const STATEMENT = /(?:^|\s)[A-Za-z_$][\w$.]*(?:\[[^\]]*\])?\s*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)|=\s*[^=;][^;]*)\s*;\s*$/;

/** The lines of `text` whose trailing comment ends in what reads as a statement. @returns {{ line: number, comment: string }[]} */
function swallowed(text) {
  const out = [];
  text.split("\n").forEach((line, i) => {
    const m = line.match(/^(.*?[;})\]])\s+\/\/(.*)$/);
    if (m && STATEMENT.test(m[2])) out.push({ line: i + 1, comment: m[2].trim() });
  });
  return out;
}

/** Every .js file under `dir` (but its vendored libraries) and what is swallowed in each. */
function swallowedIn(dir) {
  const hits = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { if (f !== "vendor" && f !== "node_modules") walk(p); }
      else if (p.endsWith(".js")) for (const h of swallowed(fs.readFileSync(p, "utf8"))) hits.push({ file: p, ...h });
    }
  })(dir);
  return hits;
}

module.exports = { swallowed, swallowedIn };
