import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const { cleanup } = createRequire(import.meta.url)('../../tools/cleanup-merged-branch.cjs');
const repo = 'owner/repo', sha = 'a'.repeat(40);
const event = () => ({ repository: { default_branch: 'main' }, pull_request: { merged: true, head: { repo: { full_name: repo }, ref: 'feature/camera', sha }, base: { repo: { full_name: repo }, ref: 'main' } } });
const run = (e, branch, options = {}) => cleanup({ event: e, repo, token: 'fixture-token', env: {}, log() {}, fetchImpl: async () => ({ ok: branch !== null, status: branch ? 200 : 404, json: async () => branch }), runGit() { throw new Error('must not invoke git'); }, ...options });
for (const [name, mutate, branch, reason] of [
  ['closed without merge', e => e.pull_request.merged = false, {}, 'not-merged'],
  ['fork PR', e => e.pull_request.head.repo.full_name = 'fork/repo', {}, 'different-repository'],
  ['default branch', e => e.pull_request.head.ref = 'main', {}, 'default-or-base-branch'],
  ['protected branch', () => {}, { protected: true, commit: { sha } }, 'protected-branch'],
  ['new work after merge', () => {}, { protected: false, commit: { sha: 'b'.repeat(40) } }, 'new-commits'],
  ['idempotent cleanup', () => {}, null, 'already-deleted'],
]) test(name + ' is never deleted', async () => { const e = event(); mutate(e); assert.equal((await run(e, branch)).reason, reason); });

test('manual cleanup fetches the merged PR before inspecting its branch', async () => {
  const e = event(), pr = e.pull_request; delete e.pull_request;
  const urls = [];
  const result = await run(e, null, { prNumber: 7, fetchImpl: async url => { urls.push(url); return { ok: urls.length === 1, status: urls.length === 1 ? 200 : 404, json: async () => pr }; } });
  assert.equal(result.reason, 'already-deleted'); assert.ok(urls[0].endsWith('/pulls/7')); assert.ok(urls[1].endsWith('/branches/feature%2Fcamera'));
});

for (const race of [false, true]) test(race ? 'atomic lease preserves a commit pushed after API inspection' : 'unchanged merged head is deleted with an atomic lease', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-lease-test-')), remote = path.join(root, 'remote.git'), work = path.join(root, 'work');
  const git = args => execFileSync('git', args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_COUNT: '0' } }).toString().trim();
  try {
    git(['init', '--bare', '--initial-branch=main', remote]); git(['init', '--initial-branch=main', work]);
    fs.writeFileSync(path.join(work, 'file'), 'first'); git(['-C', work, 'add', '.']);
    git(['-C', work, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'chore: fixture']);
    const expected = git(['-C', work, 'rev-parse', 'HEAD']); git(['-C', work, 'push', remote, 'HEAD:refs/heads/feature/camera']);
    const e = event(); e.pull_request.head.sha = expected;
    const attempt = run(e, { protected: false, commit: { sha: expected } }, { runGit(args, opts) {
      if (args.includes('push')) {
        assert.ok(args.includes(`--force-with-lease=refs/heads/feature/camera:${expected}`));
        assert.ok(!args.some(arg => arg.includes('fixture-token')));
        if (race) {
          fs.writeFileSync(path.join(work, 'file'), 'new work'); git(['-C', work, 'add', '.']);
          git(['-C', work, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'feat: new work']);
          git(['-C', work, 'push', remote, 'HEAD:refs/heads/feature/camera']);
        }
        args = args.map(arg => arg === 'https://github.com/owner/repo.git' ? remote : arg);
      }
      return execFileSync('git', args, opts);
    } });
    if (race) await assert.rejects(attempt, /deletion rejected/); else assert.equal((await attempt).status, 'deleted');
    const refs = git(['--git-dir', remote, 'for-each-ref', '--format=%(refname)']);
    assert.equal(refs.includes('refs/heads/feature/camera'), race);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
