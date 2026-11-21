// Is what a Worker serves the build that was just put up? (#308; deploy-tag.yml, after `wrangler deploy`.) It asks, in this order:
//
//   1. The page's own answer: `version.json` at the address, which the build writes and the open page asks to know it is out of
//      date. JSON, not HTML, so a zone's bot protection, which writes a script into every page, leaves it alone, and its
//      `commit` is the tag's commit. Readable and right: confirmed. Readable and another commit (after waiting for the
//      edge to catch up): the visitors' answer disagrees, so that is a failure, whatever else is said.
//   2. Unreadable (a 403 or a challenge page, which is what a runner is given at the public address; nothing; not JSON; a
//      tag older than version.json): Cloudflare's own word. The Worker's newest deployment is the version this deploy made
//      ("Current Version ID" in wrangler's output) at 100 %.
//   3. Neither: failure, with every reason written down. Nothing is swallowed: a method that could not answer says so.
//
// `node tools/ci/live-check.cjs` reads URL, SHA, TARGET, WORKER, DEPLOY_LOG (what `wrangler deploy` printed) and WRANGLER
// (the package, e.g. wrangler@4.162.0) from the environment and writes its findings to the job's summary; exit 1 is a failure.
// `--now` (a dry run, which deployed nothing) only says what each method makes of what is live now, and exits 0.
const fs = require("fs"), { execFileSync } = require("child_process");

const CHALLENGE = /Just a moment|challenge-platform|cf-mitigated|Attention Required/i;

/** The version this deploy created: wrangler prints "Current Version ID: <uuid>". @param {string} text */
const versionIdOf = (text) => (String(text).match(/Current Version ID:\s*([0-9a-f-]{36})/i) || [])[1] || null;

/**
 * What version.json says of the address. kind: ok (the tag's commit), mismatch (another commit), unreadable (and why).
 * @param {(url: string) => Promise<{ status: number, text: string }>} get @param {string} url @param {string} sha @param {string} target
 * @returns {Promise<{ kind: "ok" | "mismatch" | "unreadable", reason: string, commit?: string }>}
 */
async function askPage(get, url, sha, target) {
  let r;
  try { r = await get(`${url.replace(/\/$/, "")}/version.json?live=${Date.now()}`); } catch (e) { return { kind: "unreadable", reason: `no answer (${String(e.message || e).slice(0, 80)})` }; }
  const text = String(r.text || "");
  if (r.status !== 200) return { kind: "unreadable", reason: `HTTP ${r.status}${CHALLENGE.test(text) ? ", a challenge page from the zone's bot protection" : ""}` };
  if (!text.trim()) return { kind: "unreadable", reason: "an empty answer" };
  let j; try { j = JSON.parse(text); } catch { return { kind: "unreadable", reason: CHALLENGE.test(text) ? "a challenge page, not JSON" : "not JSON" }; }
  if (!j || typeof j.commit !== "string" || !j.commit) return { kind: "unreadable", reason: "no commit in it (a build older than version.json)" };
  if (j.commit !== sha) return { kind: "mismatch", reason: `it says commit ${j.commit.slice(0, 7)}, not ${sha.slice(0, 7)}`, commit: j.commit };
  if (j.deploy && j.deploy !== target) return { kind: "mismatch", reason: `it says deploy ${j.deploy}, not ${target}`, commit: j.commit };
  return { kind: "ok", reason: `version.json says commit ${sha.slice(0, 7)}${j.deploy ? `, deploy ${j.deploy}` : ""}`, commit: j.commit };
}

/**
 * The Worker's newest deployment, from `wrangler deployments list --json`.
 * @param {string} stdout @returns {{ id?: string, versions: { version_id: string, percentage: number }[] } | null}
 */
function newestDeployment(stdout) {
  let list; try { list = JSON.parse(stdout); } catch { return null; }
  if (!Array.isArray(list) || !list.length) return null;
  return [...list].sort((a, b) => String(a.created_on).localeCompare(String(b.created_on))).pop();
}

/**
 * Cloudflare's own word: is the newest deployment of the Worker this version, at 100 %?
 * @param {(args: string[]) => string} wrangler runs wrangler with these arguments, gives its output, throws if it fails
 * @param {string} worker @param {string | null} versionId
 * @returns {{ ok: boolean, reason: string, active?: string }}
 */
function askWrangler(wrangler, worker, versionId) {
  let out; try { out = wrangler(["deployments", "list", "--name", worker, "--json"]); } catch (e) { return { ok: false, reason: `wrangler could not list the deployments (${String(e.message || e).split("\n")[0].slice(0, 100)})` }; }
  const d = newestDeployment(out);
  if (!d) return { ok: false, reason: "wrangler's list of deployments could not be read" };
  const active = (d.versions || []).map((v) => `${v.version_id} ${v.percentage}%`).join(", ");
  if (!versionId) return { ok: false, reason: `no "Current Version ID" in what wrangler deploy printed, so nothing to compare with (the newest deployment is ${active})`, active };
  const ours = (d.versions || []).find((v) => v.version_id === versionId);
  if (!ours) return { ok: false, reason: `the newest deployment is ${active}, not ${versionId}`, active };
  if (ours.percentage !== 100) return { ok: false, reason: `the version is at ${ours.percentage} %, not 100 %`, active };
  return { ok: true, reason: `Cloudflare's newest deployment of ${worker} is ${versionId} at 100 %`, active };
}

/**
 * @param {{ url: string, sha: string, target: string, worker: string, versionId: string | null,
 *   get: (url: string) => Promise<{ status: number, text: string }>, wrangler: (args: string[]) => string,
 *   sleep?: (ms: number) => Promise<void>, tries?: number, wait?: number }} o
 * @returns {Promise<{ ok: boolean, via: string, notes: string[] }>}
 */
async function confirm(o) {
  const sleep = o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))), tries = o.tries ?? 6, wait = o.wait ?? 10000, notes = [];
  let page;
  for (let i = 1; i <= tries; i++) {
    page = await askPage(o.get, o.url, o.sha, o.target);
    // Blocked or absent does not get better by waiting: ask again a couple of times, not for a minute. A page that names another commit may be the edge catching up.
    if (page.kind === "ok" || (page.kind === "unreadable" && i >= 2) || i === tries) break;
    await sleep(wait);
  }
  if (page.kind === "ok") return { ok: true, via: "the page's own version.json", notes: [page.reason] };
  notes.push(`version.json at ${o.url}: ${page.reason}`);
  const wr = askWrangler(o.wrangler, o.worker, o.versionId);
  if (page.kind === "mismatch") {   // the visitors' answer disagrees: not saved by what Cloudflare says of its own list
    notes.push(`wrangler: ${wr.reason}`, "what visitors are given is another build than the one deployed");
    return { ok: false, via: "none", notes };
  }
  if (wr.ok) return { ok: true, via: "Cloudflare's deployments (wrangler)", notes: [...notes, wr.reason] };
  notes.push(`wrangler: ${wr.reason}`);
  return { ok: false, via: "none", notes };
}

module.exports = { versionIdOf, askPage, askWrangler, newestDeployment, confirm, CHALLENGE };

if (require.main === module) (async () => {
  const E = process.env, now = process.argv.includes("--now");
  const get = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(20000), headers: { "cache-control": "no-cache" }, redirect: "follow" }); return { status: r.status, text: await r.text() }; };
  const wrangler = (args) => execFileSync("npx", ["--yes", E.WRANGLER || "wrangler@4.162.0", ...args], { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
  const summary = (lines) => { console.log(lines.join("\n")); if (E.GITHUB_STEP_SUMMARY) fs.appendFileSync(E.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n"); };
  const log = E.DEPLOY_LOG && fs.existsSync(E.DEPLOY_LOG) ? fs.readFileSync(E.DEPLOY_LOG, "utf8") : "";
  if (now) {   // a dry run: what is live now, said by each way of asking; nothing is compared with a deploy that did not happen
    const p = await askPage(get, E.URL, "0".repeat(40), E.TARGET), w = askWrangler(wrangler, E.WORKER, null);
    return summary([`- 线上现状（演练，只读）：version.json：${p.kind === "unreadable" ? "读不到，" + p.reason : p.reason}；Cloudflare 的最新部署：${w.active || w.reason}`]);
  }
  const r = await confirm({ url: E.URL, sha: E.SHA, target: E.TARGET, worker: E.WORKER, versionId: versionIdOf(log), get, wrangler });
  summary([r.ok ? `- 线上确认：${r.via}` : `- 线上没有确认是刚部署的这一版`, ...r.notes.map((n) => `  - ${n}`)]);
  process.exit(r.ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
