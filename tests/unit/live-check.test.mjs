// After a deploy, is what is live the build just put up? (tools/ci/live-check.cjs, #308.) The first real deploy of production
// (0.6.0, run 44677475391) put the right build up and was shown red: the public address is behind a bot protection that gives a
// runner a challenge page (HTTP 403) and writes a script with a new ray id into every page it does serve, so a hash of the page
// never matches; and `curl -f … | sha256sum` took the empty answer's hash for an answer, because a pipe gives the last command's status.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { createRequire } from "node:module";
const { versionIdOf, askPage, askWrangler, newestDeployment, confirm } = createRequire(import.meta.url)("../../tools/ci/live-check.cjs");
const SHA = "bf304ed".padEnd(40, "0"), OLD = "10a30a4".padEnd(40, "0"), V1 = "fa6618fd-425c-4990-8a0c-594e89e81dc1", V0 = "897c5536-3f02-4ef1-9f90-a2ab56b86bb2";
const SITE = "https://temple.rushiwowen.co", WORKER = "temple-walk";
const CHALLENGE = '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta name="robots" content="noindex,nofollow">';
const deployed = (id, pct = 100, when = "2026-11-20T04:58:00Z") => ({ id: "d-" + when, source: "wrangler", strategy: "percentage", versions: [{ version_id: id, percentage: pct }], created_on: when });
const list = (...ds) => JSON.stringify(ds, null, 2);
const json = (o) => ({ status: 200, text: JSON.stringify(o) + "\n" });
const run = (o) => confirm({ url: SITE, sha: SHA, target: "production", worker: WORKER, versionId: V1, sleep: async () => {}, tries: 3, ...o });
const calls = () => { const c = { get: 0 }; return c; };

test("wrangler's 'Current Version ID' is read from what the deploy printed", () => {
  const out = "Uploaded temple-walk (3.67 sec)\nDeployed temple-walk triggers (0.96 sec)\n  https://temple.rushiwowen.co\nCurrent Version ID: fa6618fd-425c-4990-8a0c-594e89e81dc1\n";
  assert.equal(versionIdOf(out), V1); assert.equal(versionIdOf("nothing here"), null); assert.equal(versionIdOf(""), null);
});

test("the page says the tag's commit: confirmed by the page, and wrangler is not asked", async () => {
  let asked = false;
  const r = await run({ get: async () => json({ version: "0.6.0", commit: SHA, deploy: "production" }), wrangler: () => { asked = true; return "[]"; } });
  assert.equal(r.ok, true); assert.match(r.via, /version\.json/); assert.equal(asked, false);
});

test("the public address gives a runner a challenge page (0.6.0's case): Cloudflare's own list confirms, and the notes say why", async () => {
  const r = await run({ get: async () => ({ status: 403, text: CHALLENGE }), wrangler: () => list(deployed(V0, 100, "2026-11-20T00:52:08Z"), deployed(V1)) });
  assert.equal(r.ok, true); assert.match(r.via, /Cloudflare/); assert.ok(r.notes.some((n) => /HTTP 403, a challenge page/.test(n)), r.notes.join("|"));
});

test("an empty answer, a page that is not JSON, a challenge page served as 200, a build older than version.json: none counts as an answer", async () => {
  const wr = () => list(deployed(V1));
  for (const [what, ans, re] of [["empty", { status: 200, text: "" }, /empty answer/], ["html", { status: 200, text: "<html>hello</html>" }, /not JSON/], ["challenge as 200", { status: 200, text: CHALLENGE }, /challenge page, not JSON/],
    ["404", { status: 404, text: "Not Found" }, /HTTP 404/], ["old build", json({ version: "0.5.0" }), /no commit/], ["json null", { status: 200, text: "null" }, /no commit/]]) {
    const r = await run({ get: async () => ans, wrangler: wr });
    assert.equal(r.ok, true, `${what}: ${r.notes.join("|")}`); assert.ok(r.notes.some((n) => re.test(n)), `${what}: ${r.notes.join("|")}`);
  }
  assert.equal((await askPage(async () => { throw new Error("socket hang up"); }, SITE, SHA, "production")).kind, "unreadable");
});

test("neither way can say: red, with both reasons, and the failure is not swallowed", async () => {
  const r = await run({ get: async () => ({ status: 403, text: CHALLENGE }), wrangler: () => list(deployed(V0)) });
  assert.equal(r.ok, false); assert.equal(r.via, "none");
  const all = r.notes.join("\n"); assert.match(all, /HTTP 403/); assert.match(all, new RegExp(`newest deployment is ${V0} 100%, not ${V1}`));
  // wrangler failing too, and an unreadable list, and nothing printed by the deploy to compare with
  assert.equal((await run({ get: async () => ({ status: 403, text: "" }), wrangler: () => { throw new Error("Authentication error [code: 10000]"); } })).ok, false);
  assert.equal((await run({ get: async () => ({ status: 403, text: "" }), wrangler: () => "not json" })).ok, false);
  assert.equal((await run({ get: async () => ({ status: 403, text: "" }), wrangler: () => list(deployed(V1)), versionId: null })).ok, false, "with no version id there is nothing to compare Cloudflare's list with");
});

test("a version at less than 100 % is not the live one", async () => {
  const r = await run({ get: async () => ({ status: 403, text: "" }), wrangler: () => list(deployed(V1, 50)) });
  assert.equal(r.ok, false); assert.match(r.notes.join("\n"), /50 %, not 100 %/);
});

test("the page names another commit: asked again, the edge may be catching up; if it stays, red, and Cloudflare's list does not save it", async () => {
  const c = calls(); let n = 0;
  const stale = await run({ get: async () => { c.get++; return json({ commit: OLD, deploy: "production" }); }, wrangler: () => { n++; return list(deployed(V1)); } });
  assert.equal(stale.ok, false); assert.equal(c.get, 3, "asked once, not every try");
  assert.match(stale.notes.join("\n"), /says commit 10a30a4, not bf304ed/); assert.match(stale.notes.join("\n"), /another build/);
  // and when it catches up on the second try: confirmed by the page
  let k = 0;
  const caught = await run({ get: async () => json({ commit: ++k < 2 ? OLD : SHA }), wrangler: () => list() });
  assert.equal(caught.ok, true); assert.equal(k, 2);
  assert.equal((await askPage(async () => json({ commit: SHA, deploy: "canary" }), SITE, SHA, "production")).kind, "mismatch", "the same commit built for another place");
});

test("an unreadable page is asked twice, not for a minute: blocked does not get better by waiting", async () => {
  const c = calls(); await run({ get: async () => { c.get++; return { status: 403, text: CHALLENGE }; }, wrangler: () => list(deployed(V1)), tries: 6 });
  assert.equal(c.get, 2);
});

test("Cloudflare's newest deployment is the one with the latest created_on, whatever the order of the list", () => {
  const a = deployed(V0, 100, "2026-11-20T00:52:08Z"), b = deployed(V1, 100, "2026-11-20T04:58:00Z");
  assert.equal(newestDeployment(list(a, b)).versions[0].version_id, V1); assert.equal(newestDeployment(list(b, a)).versions[0].version_id, V1);
  assert.equal(newestDeployment("[]"), null); assert.equal(newestDeployment("{}"), null); assert.equal(newestDeployment("oops"), null);
  assert.equal(askWrangler(() => list(b, a), WORKER, V1).ok, true); assert.equal(askWrangler(() => list(a, b), WORKER, V0).ok, false, "an older version is not the live one");
  let args; askWrangler((x) => { args = x; return "[]"; }, WORKER, V1); assert.deepEqual(args, ["deployments", "list", "--name", WORKER, "--json"]);
});

test("deploy-tag.yml: the deploy's failure is not hidden by the tee, the check is the script's, and a dry run only reads", () => {
  const y = fs.readFileSync(new URL("../../.github/workflows/deploy-tag.yml", import.meta.url), "utf8");
  const step = (name) => { const i = y.indexOf(`- name: ${name}`); assert.ok(i >= 0, name); const j = y.indexOf("\n      - name:", i + 5); return y.slice(i, j < 0 ? undefined : j); };
  const publish = step("Publish the demo");
  assert.match(publish, /shell: bash\n\s*run: npx --yes wrangler@[\d.]+ deploy -c "wrangler\.\$TARGET\.jsonc" \| tee "\$RUNNER_TEMP\/deploy\.txt"/, "a pipe to tee runs under pipefail (shell: bash), and keeps what wrangler printed");
  assert.match(publish, /if: inputs\.dry_run != true/);
  const live = step("The live site is the build just deployed");
  assert.match(live, /if: inputs\.dry_run != true/); assert.match(live, /run: node tools\/ci\/live-check\.cjs\s*(?:\n|$)/); assert.doesNotMatch(live, /--now/); assert.match(live, /DEPLOY_LOG: \$\{\{ runner\.temp \}\}\/deploy\.txt/);
  const now = step("What is live now (a dry run, read-only)");
  assert.match(now, /if: inputs\.dry_run == true/); assert.match(now, /run: node tools\/ci\/live-check\.cjs --now/);
  assert.doesNotMatch(y, /curl/, "a curl in the workflow: a pipe from it gives the status of what follows");
  assert.doesNotMatch(y, /sha256sum dist\/index\.html/, "a hash of a page the zone rewrites");
  assert.match(y, /sparse-checkout: \|\n(?:\s+\S+\n)*?\s+tools\/ci\/live-check\.cjs/, "the job checks out the script");
  const v = (t) => t.match(/wrangler@([\d.]+)/)[1]; assert.equal(v(live), v(publish), "the check asks the wrangler that deployed"); assert.equal(v(now), v(publish));
});
