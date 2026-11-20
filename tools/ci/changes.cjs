// Which files make the site, and so whether a push needs a build, a browser and a preview (issue #187). The one list of
// paths is here; pages.yml asks this file, and tests/unit/ci-changes.test.mjs holds e2e.yml's own `paths:` to it.
//
//   node tools/ci/changes.cjs        (in a workflow: reads the event from the environment, writes `site=`, `walk=` and `unit=` to $GITHUB_OUTPUT)
//
// What a change to papers means: nothing the unit tests walk is in them, so a push of papers alone skips the plan, the
// walker and the building generator and runs only DOC_TESTS (each under a second), the tests that read the papers.
const PAPER = [/^docs\//, /^skills\//, /\.md$/];
const DOC_TESTS = ["asset-register", "credits", "evidence", "evidence-mirror", "evidence-refs", "preview-comment", "site-status", "structure", "wechat-qr", "ci-changes"].map((n) => `tests/unit/${n}.test.mjs`);
//
// A build is wanted unless the files that differ are known and none of them is the site's. "Known" means: a list that is
// not empty and shorter than LIMIT (the compare API stops listing at 300 files, so a longer one is taken as "everything").
const SITE = [/^app\//, /^tests\/e2e\//, /^package\.json$/, /^pnpm-lock\.yaml$/, /^vite\.config\.mjs$/, /^wrangler\.(production|canary)\.jsonc$/, /^tools\/(setup\.mjs|site\.cjs|bake-doorways\.mjs)$/, /^\.github\/workflows\/pages\.yml$/, /^\.github\/actions\//, /^tools\/ci\//];
// What changes the floor he may stand on besides the site itself: the bake and its outline, and the diff against the base.
const WALK = [/^tools\/walk\//, /^tools\/bake-walk\.mjs$/, /^tools\/walk-diff\.mjs$/];
const LIMIT = 300;

const known = (files) => Array.isArray(files) && files.length > 0 && files.length < LIMIT;
/** Whether the site must be built for these changed files (null or unknown: yes). @param {string[] | null} files */
const siteChanged = (files) => !known(files) || files.some((f) => SITE.some((r) => r.test(f)));
/** Whether the baked floor and its diff against the base must be run. @param {string[] | null} files */
const walkChanged = (files) => siteChanged(files) || files.some((f) => WALK.some((r) => r.test(f)));
/** Whether the plan, walker and generator tests must run: anything that is not a paper (null or unknown: yes). @param {string[] | null} files */
const codeChanged = (files) => siteChanged(files) || files.some((f) => !PAPER.some((r) => r.test(f)));
// The commit a push is compared with is the last one whose deploy succeeded, never the commit before (tools/ci/deployed.cjs, which
// the status board asks too). The commit before may be one whose run was cancelled by the next push (a queued run is replaced,
// GitHub's concurrency rule), and a papers-only commit that replaced it would then compare against a commit with nothing
// published and skip the site change before it (7c86432 → 39692ee, 2026-11-19). None found: a build.
const { lastDeployed, findLastDeploy } = require("./deployed.cjs");
module.exports = { SITE, WALK, PAPER, DOC_TESTS, LIMIT, siteChanged, walkChanged, codeChanged, lastDeployed, findLastDeploy };

if (require.main === module) (async () => {
  const { execFileSync } = require("child_process"), fs = require("fs");
  const E = process.env, gh = (path, jq) => execFileSync("gh", ["api", "--paginate", path, "--jq", jq], { encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter(Boolean);
  // What is compared with what: on a push to main (or a run asked for by hand there), the last commit whose deploy succeeded
  // (lastDeployed: asked of the Actions history, since a cancelled or papers-only run leaves no mark of its own); on a pull
  // request from this repository, the commit whose build the preview is showing now (the sha the preview comment says it
  // deployed). No such commit, or one that cannot be compared (a force-push dropped it), means build. Not the previous push
  // and not the base: the previous push may be a build that failed or was cancelled by the next one, and the base says
  // nothing of what the preview is showing.
  let files = null, why = "no comparison";
  try {
    const repo = E.REPO;
    if (E.EVENT === "push" || E.EVENT === "workflow_dispatch") {
      const get = async (p) => JSON.parse(execFileSync("gh", ["api", `repos/${repo}/${p}`], { encoding: "utf8", maxBuffer: 1 << 26 }));
      const last = await findLastDeploy(get, Number(E.GITHUB_RUN_ID)), base = last && last.head_sha;
      if (base) { files = gh(`repos/${repo}/compare/${base}...${E.SHA}`, ".files[].filename"); why = `${E.EVENT}, against the last deploy ${base.slice(0, 7)}`; }
      else why = `${E.EVENT} with no successful deploy in the last 40 runs`;
    }
    else if (E.EVENT === "pull_request" && E.HEAD_REPO === repo) {
      const { markers } = require("../preview/comment.cjs");
      const mine = gh(`repos/${repo}/issues/${E.PR}/comments`, '.[] | select(.user.type == "Bot") | select(.body | contains("<!-- temple-walk-preview -->")) | .body | @json').map((s) => JSON.parse(s)).pop();
      const m = mine && markers(mine);
      if (m && m.deployed && m.fixed && m.latest) { files = gh(`repos/${repo}/compare/${m.deployed}...${E.SHA}`, ".files[].filename"); why = `pull request, against the deployed ${m.deployed.slice(0, 7)}`; }
      else why = "pull request with no preview to compare with";
    }
  } catch (e) { files = null; why = `comparison failed (${String(e.message).split("\n")[0]})`; }
  const site = siteChanged(files), walk = walkChanged(files), unit = codeChanged(files);
  console.log(`${why}: ${files ? files.length + " files" : "files unknown"}, site changed: ${site}, floor to be baked: ${walk}, unit tests in full: ${unit}`);
  if (E.GITHUB_OUTPUT) fs.appendFileSync(E.GITHUB_OUTPUT, `site=${site}\nwalk=${walk}\nunit=${unit}\n`);
})();
