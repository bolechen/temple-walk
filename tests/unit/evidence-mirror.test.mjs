// The mirror's keys are the part of each file's address after the base (#247): <rev>/<level>/<dir>/<path>, so that
// changing `base` is the only step a reader needs, and nothing the mirror does needs the bucket's credentials to check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mirrorEntries, urlOf, mirror, CONFIG } from "../../tools/evidence.mjs";

test("every mirror key is the address after `base`, and no key repeats", () => {
  const entries = mirrorEntries();
  assert.ok(entries.length > 0);
  const keys = new Set();
  for (const e of entries) {
    assert.equal(urlOf(e.remote, e.rev, "X/"), `X/${e.key}`);
    assert.match(e.key, /^[0-9a-f]{40}\/[^/]+\/.+/);
    assert.ok(!keys.has(e.key), `repeated ${e.key}`);
    keys.add(e.key);
  }
});

test("fallback and base are both full addresses ending in a slash", () => {
  for (const k of ["base", "fallback"]) assert.match(CONFIG[k], /^https:\/\/.+\/$/, k);
});

test("a mirror without its four secrets says which are missing and sends nothing", async () => {
  const keep = { ...process.env };
  for (const n of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET"]) delete process.env[n];
  process.env.R2_BUCKET = "x";
  try {
    await assert.rejects(() => mirror({ log() {} }), /missing or empty: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT$/);
  } finally { Object.assign(process.env, keep); if (!("R2_BUCKET" in keep)) delete process.env.R2_BUCKET; }
});
