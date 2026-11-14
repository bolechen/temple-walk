// Deletes only a merged, same-repository PR head, using an atomic expected-SHA lease.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');

async function cleanup({ event, repo, token, prNumber, apiBase = 'https://api.github.com', server = 'https://github.com', fetchImpl = fetch, runGit = (args, opts) => execFileSync('git', args, opts), env = process.env, log = console.log }) {
  if (!repo || !token || !event.repository?.default_branch) throw new Error('Missing repository, authentication or default branch metadata');
  const request = async (route, allowMissing = false) => {
    const response = await fetchImpl(apiBase + route, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    return response.json();
  };
  let pr = event.pull_request;
  if (!pr) {
    if (!/^[1-9][0-9]*$/.test(String(prNumber || ''))) throw new Error('A pull request number is required');
    pr = await request(`/repos/${repo}/pulls/${prNumber}`);
  }
  const skip = reason => { log('Branch cleanup skipped: ' + reason); return { status: 'skipped', reason }; };
  if (pr.merged !== true) return skip('not-merged');
  if (pr.head?.repo?.full_name !== repo || pr.base?.repo?.full_name !== repo) return skip('different-repository');
  const head = pr.head.ref, sha = pr.head.sha;
  if (!head || head === event.repository.default_branch || head === pr.base.ref) return skip('default-or-base-branch');
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('Invalid expected head SHA');
  const branch = await request(`/repos/${repo}/branches/${encodeURIComponent(head)}`, true);
  if (!branch) return skip('already-deleted');
  if (branch.protected) return skip('protected-branch');
  if (branch.commit?.sha !== sha) return skip('new-commits');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-branch-cleanup-'));
  try {
    runGit(['init', '--bare', temp], { stdio: 'pipe' });
    // Keep authentication in the child environment, never in URLs, arguments or files.
    const gitEnv = { ...env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `http.${server}/.extraheader`, GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic ' + Buffer.from('x-access-token:' + token).toString('base64') };
    // An explicit lease also rejects commits pushed AFTER the API check above.
    try {
      runGit(['-C', temp, 'push', `--force-with-lease=refs/heads/${head}:${sha}`, `${server}/${repo}.git`, `:refs/heads/${head}`], { env: gitEnv, stdio: 'pipe' });
    } catch { throw new Error('Branch deletion rejected; do not retry blindly. Check for new commits or branch protection.'); }
    log('Deleted merged branch: ' + head);
    return { status: 'deleted', branch: head, sha };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

module.exports = { cleanup };
if (require.main === module) {
  cleanup({ event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), repo: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN, prNumber: process.env.PR_NUMBER, apiBase: process.env.GITHUB_API_URL, server: process.env.GITHUB_SERVER_URL })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
