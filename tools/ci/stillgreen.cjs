// Whether a pull request's green still counts after main has moved on (#442). The lead merges a pull request only on a head that has the
// newest main in it and is green (LESSONS.md, 2026-11-21: #357 was green on an older main and broke main's unit job), and every merge makes the
// others update their branch and run all over again, one after another. GitHub's merge queue would do that, but it is for repositories owned by
// an organization, not for this one (docs/t00/ci-merge-queue.md has the page's words); so this says, before the merge, whether what main gained
// since the pull request left it can reach the pull request's checks at all.
//
//   node tools/ci/stillgreen.cjs <pull request number>     exit 0: the green counts · 1: run it again · 2: there is no green on this head to count
//
// The rule (the owner's, #442): the green counts when
//   · main has gained nothing, or
//   · what main gained is papers alone (docs/, skills/, *.md: PAPER in changes.cjs), or
//   · the files main gained and the files the pull request changed have none in common, and main changed nothing the checks are made of
//     (app/, tools/, tests/, package.json, pnpm-lock.yaml, vite.config.mjs, .github/, and what changes.cjs counts as the site: the Worker and its config).
// Anything else, or a list that cannot be known (none given, or as long as the compare API stops at: LIMIT), is run again.
const { PAPER, SITE, LIMIT } = require("./changes.cjs");

const RISKY = [/^app\//, /^tools\//, /^tests\//, /^package\.json$/, /^pnpm-lock\.yaml$/, /^vite\.config\.mjs$/, /^\.github\//];
const risky = (f) => RISKY.some((r) => r.test(f)) || SITE.some((r) => r.test(f));
const paper = (f) => PAPER.some((r) => r.test(f));
const known = (files) => Array.isArray(files) && files.length < LIMIT;

/**
 * @param {{ prFiles: string[] | null, mainFiles: string[] | null }} change what the pull request changed, and what main gained since they parted
 * @returns {{ counts: boolean, rule: "nothing new" | "papers" | "unrelated" | "overlap" | "main changed what checks are made of" | "unknown", why: string }}
 */
function judge({ prFiles, mainFiles }) {
  if (!known(mainFiles) || !known(prFiles)) return { counts: false, rule: "unknown", why: "a list of changed files is missing or as long as the compare API's limit: run it again" };
  if (!mainFiles.length) return { counts: true, rule: "nothing new", why: "main has gained nothing since this pull request left it" };
  if (mainFiles.every(paper)) return { counts: true, rule: "papers", why: `main gained papers alone (${mainFiles.length} files): no check reads them but the paper tests, and they ran on this head` };
  const mine = new Set(prFiles), both = mainFiles.filter((f) => mine.has(f));
  if (both.length) return { counts: false, rule: "overlap", why: `both changed ${both.slice(0, 3).join(", ")}${both.length > 3 ? ` and ${both.length - 3} more` : ""}: run it again` };
  const bad = mainFiles.find(risky);
  if (bad) return { counts: false, rule: "main changed what checks are made of", why: `main changed ${bad}, which the checks are made of or read: run it again` };
  return { counts: true, rule: "unrelated", why: `the ${mainFiles.length} files main gained are in none of the ${prFiles.length} this pull request changed, and none is code, a test, a workflow or a dependency` };
}
module.exports = { judge, risky, paper, RISKY };

if (require.main === module) {
  const { execFileSync } = require("child_process");
  const n = Number(process.argv[2]), repo = process.env.REPO || "bolechen/temple-walk";
  if (!Number.isInteger(n) || n <= 0) { console.error("usage: node tools/ci/stillgreen.cjs <pull request number>"); process.exit(2); }
  const api = (p) => JSON.parse(execFileSync("gh", ["api", "--paginate", "--slurp", `repos/${repo}/${p}`], { encoding: "utf8", maxBuffer: 1 << 26 }));
  const one = (p) => JSON.parse(execFileSync("gh", ["api", `repos/${repo}/${p}`], { encoding: "utf8", maxBuffer: 1 << 26 }));
  const pr = one(`pulls/${n}`), head = pr.head.sha, base = pr.base.ref;
  const runs = api(`commits/${head}/check-runs?per_page=100`).flatMap((pg) => pg.check_runs || []), verify = runs.filter((r) => r.name === "verify").sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
  if (!verify || verify.conclusion !== "success") { console.log(`#${n} at ${head.slice(0, 7)}: no green \`verify\` on this head (${verify ? verify.status + " " + (verify.conclusion || "") : "none yet"}): nothing to count`); process.exit(2); }
  const c1 = one(`compare/${base}...${head}`), prFiles = (c1.files || []).map((f) => f.filename);
  let mainFiles = [];
  if (c1.behind_by > 0) { const c2 = one(`compare/${c1.merge_base_commit.sha}...${base}`); mainFiles = c2.files ? (c2.files.length >= 300 ? null : c2.files.map((f) => f.filename)) : null; }
  const v = judge({ prFiles: c1.files && c1.files.length >= 300 ? null : prFiles, mainFiles });
  console.log(`#${n}: head ${head.slice(0, 7)} is green; main is ${c1.behind_by} commits ahead of it (they parted at ${c1.merge_base_commit.sha.slice(0, 7)}). ${v.counts ? "THE GREEN COUNTS" : "RUN IT AGAIN"} (${v.rule}): ${v.why}`);
  process.exit(v.counts ? 0 : 1);
}
