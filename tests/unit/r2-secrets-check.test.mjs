// #247: a missing repository secret is named, not left to a vague signature error. The script the smoke test runs is
// tried here with each of the four blanked in turn (and with none), so the message is held without touching a secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const SCRIPT = new URL("../../tools/ci/r2-secrets-check.sh", import.meta.url).pathname;
const FULL = { AWS_ACCESS_KEY_ID: "k", AWS_SECRET_ACCESS_KEY: "s", R2_ENDPOINT: "https://x.invalid", R2_BUCKET: "b" };
const NAMES = { AWS_ACCESS_KEY_ID: "R2_ACCESS_KEY_ID", AWS_SECRET_ACCESS_KEY: "R2_SECRET_ACCESS_KEY", R2_ENDPOINT: "R2_ENDPOINT", R2_BUCKET: "R2_BUCKET" };
const run = (env) => spawnSync("bash", [SCRIPT], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

test("all four set: passes and prints no value", () => {
  const r = run(FULL);
  assert.equal(r.status, 0);
  for (const v of Object.values(FULL)) assert.ok(!(r.stdout + r.stderr).includes(v) || v.length < 2, "a value was printed");
});

for (const [env, name] of Object.entries(NAMES)) {
  for (const how of ["empty", "unset"]) {
    test(`${name} ${how}: fails and names it, and only it`, () => {
      const e = { ...FULL }; if (how === "empty") e[env] = ""; else delete e[env];
      const r = run(e), out = r.stdout + r.stderr;
      assert.equal(r.status, 1);
      assert.ok(out.includes(`missing or empty: ${name}`), out);
      for (const other of Object.values(NAMES)) if (other !== name) assert.ok(!out.includes(other), `${other} named though set`);
    });
  }
}

test("all four missing: names all four, in order", () => {
  const r = run({});
  assert.equal(r.status, 1);
  assert.ok((r.stdout + r.stderr).includes("missing or empty: R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET"));
});

test("the smoke workflow uses the script, so the message that is tested is the message that is shown", () => {
  const y = fs.readFileSync(new URL("../../.github/workflows/r2-smoke.yml", import.meta.url), "utf8");
  assert.match(y, /bash tools\/ci\/r2-secrets-check\.sh/);
  assert.doesNotMatch(y, /missing="\$missing R2_/);
});
