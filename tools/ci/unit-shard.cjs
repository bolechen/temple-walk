// Which unit-test files one CI machine runs (#442): every tests/unit/*.test.mjs goes to exactly one of N machines, the longest first
// to the machine with the least so far (the same longest-processing-time plan as tests/e2e/shards.cjs), by the seconds in
// tests/unit/durations.json. A file nobody has timed counts as the median one, so a new test lands somewhere sensible
// before anyone has measured it. Printed one path per line, ready for `node --test $(...)`.
//
//   node tools/ci/unit-shard.cjs i/N        the files machine i of N runs
//   node tools/ci/unit-shard.cjs plan N     who runs what, for how long
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "../../tests/unit");
const SHARDS = 5;
/** Longest a machine's share may be counted at, seconds: the PR's checks are held to three minutes from first check to `verify`. */
const BUDGET = 110;

const files = () => fs.readdirSync(DIR).filter((f) => f.endsWith(".test.mjs")).sort();
const durations = () => JSON.parse(fs.readFileSync(path.join(DIR, "durations.json"), "utf8")).files;

/** @param {string[]} names @param {number} n @param {Record<string, number>} [d] */
function plan(names, n, d = durations()) {
  const v = Object.values(d).sort((a, b) => a - b), median = v.length ? v[v.length >> 1] : 5;
  const secs = (/** @type {string} */ x) => (x in d ? d[x] : median);
  const loads = Array(n).fill(0), parts = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
  for (const x of [...names].sort((a, b) => secs(b) - secs(a) || (a < b ? -1 : 1))) {
    let k = 0; for (let i = 1; i < n; i++) if (loads[i] < loads[k]) k = i;
    parts[k].push(x); loads[k] += secs(x);
  }
  return { parts: parts.map((p) => names.filter((x) => p.includes(x))), loads };
}
module.exports = { plan, files, durations, SHARDS, BUDGET };

if (require.main === module) {
  const [a, b] = process.argv.slice(2);
  if (a === "plan") { const n = Number(b || SHARDS), { parts, loads } = plan(files(), n); parts.forEach((p, i) => console.log(`shard ${i + 1}/${n}: ${loads[i].toFixed(1)} s  ${p.length} files  ${p.slice(0, 4).join(" ")}…`)); }
  else {
    const m = /^(\d+)\/(\d+)$/.exec(a || ""); if (!m || +m[1] < 1 || +m[1] > +m[2]) { console.error("usage: unit-shard.cjs i/N"); process.exit(2); }
    console.log(plan(files(), +m[2]).parts[+m[1] - 1].map((f) => `tests/unit/${f}`).join("\n"));
  }
}
