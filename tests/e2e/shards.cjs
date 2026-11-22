// How a whole run is shared among machines (#335). A scenario's time is what it was last measured at (durations.json: seconds,
// software rendering on GitHub's free machines), the biggest go first, and each goes to the machine with the least so far
// (longest-processing-time first): the same answer on every machine, with no talk between them. Taken in turn, as it was
// before, four machines ran 25, 38, 43 and 47 minutes of the same list. A scenario nobody has timed yet counts as the
// median one; machine 1 also runs the quick checks and, when asked, the evidence reads, which `extra` says (seconds).
//
// How many machines is not written down: it is the fewest, twelve at least, that keep the longest of them within BUDGET, worked out by the
// same plan from the same times on the workflow's first job (`matrix`), so a scenario added to run.cjs that no longer fits adds a machine by
// itself instead of stopping the unit tests (#376; before it, N was a number in e2e.yml and a test failed when the list outgrew it).
//
//   node tests/e2e/shards.cjs machines                     how many machines the list needs now
//   node tests/e2e/shards.cjs matrix                       the workflow's two outputs: matrix=[1,2,…] and count=N
//   node tests/e2e/shards.cjs plan [N]                     who would run what, and for how long (N: the machines needed)
//   node tests/e2e/shards.cjs update <e2e-report.json>...  put the times of these runs into durations.json (a report is what a shard leaves in tools/out/)
const fs = require("fs"), path = require("path");
// A run on a graphics card (E2E_GPU, the T4 run) is shared by what each scenario takes there: the card draws the heavy ones three to twenty times
// faster than software does, so the free machines' seconds left some shards at 15 minutes and others at 6 (run 44967166241).
const FILE = path.join(__dirname, process.env.E2E_GPU ? "durations-t4.json" : "durations.json");
const read = () => JSON.parse(fs.readFileSync(FILE, "utf8"));

/** The seconds a scenario is counted at. @param {Record<string, number>} d */
const secsOf = (d) => { const v = Object.values(d).sort((a, b) => a - b), median = v.length ? v[v.length >> 1] : 60; return (/** @type {string} */ name) => (name in d ? d[name] : median); };

/**
 * Share `names` among `n` machines. Each machine keeps the order of the list it was asked for.
 * @param {string[]} names @param {number} n @param {{ scenarios: Record<string, number>, extra?: Record<string, number> }} [data]
 * @returns {{ parts: string[][], loads: number[] }}
 */
function plan(names, n, data = read()) {
  const secs = secsOf(data.scenarios), loads = Array.from({ length: n }, (_, i) => Number((data.extra || {})[i + 1] || 0));
  const parts = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
  for (const x of [...names].sort((a, b) => secs(b) - secs(a) || (a < b ? -1 : 1))) {
    let k = 0; for (let i = 1; i < n; i++) if (loads[i] < loads[k]) k = i;
    parts[k].push(x); loads[k] += secs(x);
  }
  return { parts: parts.map((p) => names.filter((x) => p.includes(x))), loads };
}

/** The longest a machine's share may be counted at, seconds: 25 minutes is the target from start to end, setup is about two, and a scenario varies 10 to 60 % between runs (run 44675254911). */
const BUDGET = 16 * 60, FEWEST = 12, MOST = 40;

/**
 * The fewest machines, `fewest` (FEWEST for the whole suite) at least, that keep the longest share within BUDGET.
 * @param {string[]} names @param {{ scenarios: Record<string, number>, extra?: Record<string, number> }} [data] @param {number} [fewest]
 */
function machines(names, data = read(), fewest = FEWEST) {
  for (let n = fewest; n <= MOST; n++) if (Math.max(...plan(names, n, data).loads) <= BUDGET) return n;
  throw new Error(`even ${MOST} machines leave one over ${BUDGET / 60} minutes: a single scenario is too long, or durations.json is wrong`);
}

/**
 * `--shard=i/N` from a command line: [i, N], null when there is none; a share that is not one of the N machines is an error.
 * @param {string[]} args @returns {[number, number] | null}
 */
function parseShard(args) {
  const a = args.find((x) => x.startsWith("--shard="));
  if (!a) return null;
  const [i, n] = a.slice(8).split("/").map(Number);
  if (!(Number.isInteger(i) && Number.isInteger(n) && n > 0 && i >= 1 && i <= n)) throw new Error(`${a}: expected i/N with 1 <= i <= N`);
  return [i, n];
}

/** The scenario names run.cjs defines, read from its text (it is a script, not a module). */
const defined = () => [...fs.readFileSync(path.join(__dirname, "run.cjs"), "utf8").matchAll(/^  ("?)([a-z0-9-]+)\1: \{ tier: [123]/gm)].map((m) => m[2]);

module.exports = { plan, parseShard, secsOf, read, defined, machines, BUDGET, FEWEST, MOST, FILE };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "machines") console.log(machines(defined()));
  else if (cmd === "matrix") {
    // Asked for by name (a run by hand), the scenarios named are shared by their measured times like the whole suite is, but over as few machines
    // as they need (one, when they are few): ten named at once on the first machine alone outran the job's forty minutes. A flag (--smoke) is
    // run.cjs's own selection, not a list of names: that stays on one machine.
    const asked = rest.filter(Boolean), flag = asked.some((x) => x.startsWith("--"));
    const n = !asked.length ? machines(defined()) : flag ? 1 : machines(asked, read(), 1);
    console.log(`matrix=${JSON.stringify(Array.from({ length: n }, (_, i) => i + 1))}\ncount=${n}`);
  }
  else if (cmd === "plan") {
    const n = Number(rest[0] || machines(defined())), { parts, loads } = plan(defined(), n);
    parts.forEach((p, i) => console.log(`shard ${i + 1}/${n}: ${String(Math.round(loads[i] / 60 * 10) / 10).padStart(5)} min  ${p.join(" ")}`));
  } else if (cmd === "update" && rest.length) {
    const data = read(), seen = {};
    for (const f of rest) for (const r of JSON.parse(fs.readFileSync(f, "utf8"))) if (r.ok && Number.isFinite(r.secs)) seen[r.name] = r.secs;   // a failed scenario's time says little of a passing one's
    Object.assign(data.scenarios, seen);
    data.scenarios = Object.fromEntries(Object.entries(data.scenarios).sort(([a], [b]) => (a < b ? -1 : 1)));
    fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n"); console.log(`${Object.keys(seen).length} times written to ${path.relative(process.cwd(), FILE)}`);
  } else { console.error("usage: shards.cjs machines | matrix [names…] | plan [N] | update <e2e-report.json>..."); process.exit(2); }
}
