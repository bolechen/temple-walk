// The T4 path of the full end-to-end run (#335): who may start it, where the token goes, and that it fails loudly.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../../", import.meta.url).pathname;
const wf = fs.readFileSync(root + ".github/workflows/e2e.yml", "utf8");
// A job's text: from its key at two spaces to the next job's key.
const job = (name) => { const m = wf.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:\\n|$)`)); assert.ok(m, `job ${name}`); return m[1]; };

test("a pull request cannot start the workflow, so a fork cannot reach the token", () => {
  const on = wf.slice(wf.indexOf("\non:"), wf.indexOf("\npermissions:"));
  assert.doesNotMatch(on, /pull_request/);
});

test("the T4 jobs run only when asked for by hand with runner: t4, and the free machines then stand aside", () => {
  for (const n of ["t4-pack", "t4-checks", "t4"]) assert.match(job(n), /if: github\.event_name == 'workflow_dispatch' && github\.event\.inputs\.runner == 't4'/);
  assert.match(job("full"), /github\.event\.inputs\.runner != 't4'/);   // empty on the nightly run: that stays on the free machines
  assert.match(wf, /runner:\n[\s\S]*?options: \[github, t4\]\n\s+default: github/);
});

test("HF_TOKEN is read in one step of one job and nowhere else", () => {
  const uses = [...wf.matchAll(/secrets\.HF_TOKEN/g)];
  assert.equal(uses.length, 1);
  const t4 = job("t4"), at = t4.indexOf("secrets.HF_TOKEN");
  assert.ok(at > 0);
  assert.match(t4.slice(t4.lastIndexOf("- name:", at), at), /Walk this shard/);
  assert.match(t4.slice(at, at + 400), /tools\/ci\/t4-launch\.sh/);
});

test("the shards of a T4 run are the same plan as the free machines'", () => {
  assert.match(job("t4"), /shard: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10\]/);
  assert.match(job("t4"), /--shard=\$\{\{ matrix\.shard \}\}\/10/);
});

test("the launcher refuses to start with no token, naming it", () => {
  const r = spawnSync("bash", [root + "tools/ci/t4-launch.sh", "boot"], { env: { PATH: process.env.PATH, HF_TOKEN: "" }, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /HF_TOKEN is not set/);
});

test("the launcher fails on every way a Job can fail to deliver", () => {
  const s = fs.readFileSync(root + "tools/ci/t4-launch.sh", "utf8");
  for (const must of [/hf jobs inspect/, /did not complete/, /no e2e-report\.json came back/, /scenarios failed/, /Job did not start/, /hf jobs cancel/, /jobs\/\$NS\/\$JOB/]) assert.match(s, must);
});

test("the browser is told to use the card only when E2E_GPU is set, and a software run is refused then", () => {
  const lib = fs.readFileSync(root + "tests/e2e/lib.cjs", "utf8"), run = fs.readFileSync(root + "tests/e2e/run.cjs", "utf8");
  assert.match(lib, /process\.env\.E2E_GPU \? GPU_ARGS : SOFT_ARGS/);
  assert.match(run, /if \(process\.env\.E2E_GPU\) \{[\s\S]*?SwiftShader\|llvmpipe[\s\S]*?process\.exit\(3\)/);
});

test("the job summary reads a report", () => {
  const dir = fs.mkdtempSync("/tmp/t4sum-");
  fs.writeFileSync(dir + "/e2e-report.json", JSON.stringify([{ name: "boot", ok: true, secs: 5 }, { name: "x", ok: false, secs: 2, error: "boom\nmore" }]));
  fs.writeFileSync(dir + "/e2e-renderer.txt", "ANGLE (NVIDIA Tesla T4)\n");
  const r = spawnSync("node", [root + "tools/ci/t4-summary.cjs", dir], { encoding: "utf8" });
  assert.match(r.stdout, /Tesla T4/); assert.match(r.stdout, /1 failed/); assert.match(r.stdout, /\| x \| 2 \| FAIL \|/);
});
