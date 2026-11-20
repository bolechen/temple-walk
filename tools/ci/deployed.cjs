// What main last deployed: the one answer that tools/ci/changes.cjs (what to build, compared with what is out there) and
// tools/status (what the research site's board says is deployed) both ask (#296, #299). The answer is the newest run of
// pages.yml on main whose `deploy` job succeeded; not the newest successful run, because a run that changed only papers
// succeeds without deploying anything, and a run that was cancelled or replaced in the queue leaves nothing out there.
// Since #308 `deploy` publishes to the canary Worker (main's place); production is a version tag's (deploy-tag.yml).
const WORKFLOW = "pages.yml", JOB = "deploy", LIMIT = 40;

/** Whether a run's jobs include a successful deploy. @param {{ name: string, conclusion: string | null }[]} jobs */
const deployedBy = (jobs) => jobs.some((j) => j.name === JOB && j.conclusion === "success");

/**
 * The newest of these runs whose deploy succeeded, or null (a build then, never a guess).
 * @template {{ id: number }} R
 * @param {R[]} runs successful runs of the workflow on main, newest first
 * @param {(id: number) => Promise<boolean>} deployed whether that run's deploy job succeeded
 * @param {number} [self] the run asking, never its own answer
 * @returns {Promise<R | null>}
 */
async function lastDeployRun(runs, deployed, self) {
  for (const r of runs) if (r.id !== self && (await deployed(r.id))) return r;
  return null;
}

/**
 * Ask the Actions history. `get` takes a path under the repository's API (`actions/runs/1/jobs`) and gives the parsed JSON, so
 * that a workflow step (the gh CLI) and the status tool (fetch) each bring their own way of asking and share the rest.
 * @param {(path: string) => Promise<any>} get
 * @param {number} [self] the run asking, if it is itself a run of the workflow
 * @returns {Promise<{ id: number, head_sha: string, html_url: string } | null>}
 */
async function findLastDeploy(get, self) {
  const { workflow_runs } = await get(`actions/workflows/${WORKFLOW}/runs?branch=main&status=success&per_page=${LIMIT}`);
  return lastDeployRun(workflow_runs, async (id) => deployedBy((await get(`actions/runs/${id}/jobs?per_page=100`)).jobs), self);
}

/** The commit it deployed, or null. */
const lastDeployed = async (runs, deployed, self) => (await lastDeployRun(runs, deployed, self))?.head_sha ?? null;

module.exports = { WORKFLOW, JOB, LIMIT, deployedBy, lastDeployRun, lastDeployed, findLastDeploy };
