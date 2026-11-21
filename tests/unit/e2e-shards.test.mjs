// A whole end-to-end run is shared among as many machines as the list needs (twelve or more, #376) by each scenario's measured time (#335, tests/e2e/shards.cjs). Taken in
// turn, four machines ran 35, 39, 45 and 48 minutes of the same list; these tests hold the new way to what it is for: every
// scenario on exactly one machine, the same answer everywhere, and none much longer than another.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const { plan, parseShard, defined, read, secsOf, machines, BUDGET, FEWEST } = createRequire(import.meta.url)("../../tests/e2e/shards.cjs");
const ROOT = fileURLToPath(new URL("../..", import.meta.url)), all = defined(), data = read(), N = machines(all, data);   // N is whatever the list needs now (#376)
const e2e = fs.readFileSync(new URL("../../.github/workflows/e2e.yml", import.meta.url), "utf8");

test("every scenario of the suite is on exactly one machine", () => {
  assert.ok(all.length >= 55, `only ${all.length} scenarios were found in run.cjs: the pattern that reads them is wrong`);
  const { parts } = plan(all, N);
  assert.equal(parts.length, N);
  assert.deepEqual(parts.flat().sort(), [...all].sort(), "a scenario is missing or on two machines");
  for (const [i, p] of parts.entries()) assert.ok(p.length > 0, `machine ${i + 1} has nothing to run`);
});

test("the answer is the same on every machine and for any order of the list", () => {
  const a = plan(all, N).parts, b = plan([...all].reverse(), N).parts, c = plan(all, N).parts;
  assert.deepEqual(c, a, "asked twice, two answers");
  assert.deepEqual(b.map((p) => [...p].sort()), a.map((p) => [...p].sort()), "the list's order changes who runs what");
});

test("no machine runs much longer than another, and none runs longer than the target leaves room for", () => {
  const { loads } = plan(all, N), max = Math.max(...loads), min = Math.min(...loads);
  // 25 minutes is the target for a machine from start to end. About two of them are setup (measured 74 to 110 s), and what a
  // scenario takes varies from one run and one machine to the next by 10 to 60 % (eight machines counted at 20.8 min each ran 17.8 to
  // 29.1, run 44675254911): so the count has to leave a third and more of room.
  assert.ok(max <= BUDGET, `the longest machine is counted at ${(max / 60).toFixed(1)} min over ${N} machines: refresh durations.json (machines() already adds machines up to its limit, so a single scenario is too long)`);
  assert.ok(max - min <= 0.1 * max, `the machines are counted at ${(min / 60).toFixed(1)} to ${(max / 60).toFixed(1)} min`);
  // what it replaced: taken in turn, the same times give the 25-to-48-minute spread of 2026-11-20
  const secs = secsOf(data.scenarios), turn = Array.from({ length: 4 }, (_, k) => all.filter((_, i) => i % 4 === k).reduce((n, x) => n + secs(x), 0));
  assert.ok(Math.max(...turn) > 1.2 * Math.min(...turn), "the old way was not uneven on these times: the comparison says nothing");
});

test("the first machine, which also runs the quick checks, is given less of the list", () => {
  const { loads } = plan(all, N), withoutExtra = plan(all, N, { ...data, extra: {} });
  assert.ok(data.extra["1"] >= 300, "the extra of machine 1 was dropped from durations.json");
  const first = (parts) => parts[0].reduce((n, x) => n + secsOf(data.scenarios)(x), 0);
  assert.ok(first(plan(all, N).parts) < first(withoutExtra.parts), "machine 1 is given as much as the others although it has more to do");
  assert.ok(Math.abs(loads[0] - loads[1]) < 0.1 * loads[1]);
});

test("a scenario nobody has timed yet is counted as the median one, and still goes somewhere", () => {
  const { parts } = plan([...all, "brand-new"], N);
  assert.equal(parts.flat().filter((x) => x === "brand-new").length, 1);
  const v = Object.values(data.scenarios).sort((a, b) => a - b);
  assert.equal(secsOf(data.scenarios)("brand-new"), v[v.length >> 1]);
});

test("durations.json names scenarios that exist: a renamed one is not left timed under its old name", () => {
  const stale = Object.keys(data.scenarios).filter((n) => !all.includes(n));
  assert.deepEqual(stale, [], `timed but not in run.cjs: ${stale.join(", ")}`);
  for (const [n, s] of Object.entries(data.scenarios)) assert.ok(Number.isFinite(s) && s > 0, `${n}: ${s}`);
});

test("a shard that is not one of the machines is refused, and none asked for is none", () => {
  assert.deepEqual(parseShard(["--smoke", "--shard=3/8"]), [3, 8]);
  assert.equal(parseShard(["boot", "stairs"]), null);
  for (const bad of ["--shard=9/8", "--shard=0/8", "--shard=1/0", "--shard=x/8", "--shard=1", "--shard=1.5/8"]) assert.throws(() => parseShard([bad]), /expected i\/N/, bad);
  // and run.cjs asks it, and shares by the same plan
  const run = fs.readFileSync(new URL("../../tests/e2e/run.cjs", import.meta.url), "utf8");
  assert.match(run, /parseShard\(args\)/); assert.match(run, /plan\(list, shard\[1\]\)\.parts\[shard\[0\] - 1\]/);
  assert.doesNotMatch(run, /i % shard\[1\]/, "the old way of taking them in turn is still in run.cjs");
});

test("a scenario that no longer fits adds a machine, instead of stopping the tests (#376)", () => {
  const now = machines(all, data);
  assert.ok(now >= FEWEST);
  // twenty more scenarios of five minutes each, as a development session might add over a week
  const more = Array.from({ length: 20 }, (_, i) => `added-${i}`), grown = { ...data, scenarios: { ...data.scenarios, ...Object.fromEntries(more.map((n) => [n, 300])) } };
  const n = machines([...all, ...more], grown);
  assert.ok(n > now, `${n} machines for the longer list, ${now} for this one`);
  const { loads, parts } = plan([...all, ...more], n, grown);
  assert.ok(Math.max(...loads) <= BUDGET, "the longer list still has a machine over its budget");
  assert.deepEqual(parts.flat().sort(), [...all, ...more].sort());
  // and never fewer than the twelve it began with, however short the list
  assert.equal(machines(all.slice(0, 5), data), FEWEST);
  assert.throws(() => machines(["huge"], { scenarios: { huge: BUDGET + 60 }, extra: {} }), /a single scenario is too long/);
});

test("e2e.yml: the machines are counted by the plan, the command shares by the same count, the evidence reads stay on one, and a branch's run does not cancel the nightly one", () => {
  const full = e2e.slice(e2e.indexOf("\n  full:"), e2e.indexOf("\n  t4-pack:") > 0 ? e2e.indexOf("\n  t4-pack:") : undefined);
  assert.doesNotMatch(full, /shard: \[[\d, ]+\]/, "the machines are listed by hand again");
  assert.match(e2e, /shard: \$\{\{ fromJson\(needs\.shards\.outputs\.matrix\) \}\}/, "the matrix is not the plan's");
  assert.match(e2e, /--shard=\$\{\{ matrix\.shard \}\}\/\$\{\{ needs\.shards\.outputs\.count \}\}/, "the command shares by a different number than the matrix has");
  assert.match(e2e, /run: node tests\/e2e\/shards\.cjs matrix >> "\$GITHUB_OUTPUT"/);
  const evidence = [...e2e.matchAll(/- name: [^\n]*(?:S3|public address|original store)[^\n]*\n\s+if: ([^\n]+)/g)].map((m) => m[1]);
  assert.equal(evidence.length, 3, "the three evidence reads were not found");
  for (const cond of evidence) assert.match(cond, /matrix\.shard == 1\b/, `an evidence read on every machine: ${cond}`);
  assert.match(e2e, /group: e2e-\$\{\{ github\.event_name == 'push' && 'regression' \|\| github\.event_name == 'workflow_dispatch' && format\('manual-\{0\}', github\.run_id\) \|\| format\('full-\{0\}', github\.ref\) \}\}/, "a full run on a branch is not the nightly run's group (a hand-started one is its own, e2e-concurrency.test.mjs)");
  assert.match(e2e, /cancel-in-progress: \$\{\{ github\.event_name != 'workflow_dispatch' \}\}/);
});

test("`node tests/e2e/shards.cjs matrix` writes what a workflow reads", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(process.execPath, [ROOT + "tests/e2e/shards.cjs", "matrix"], { encoding: "utf8" }).trim().split("\n");
  assert.equal(out[0], `matrix=${JSON.stringify(Array.from({ length: N }, (_, i) => i + 1))}`); assert.equal(out[1], `count=${N}`);
});
