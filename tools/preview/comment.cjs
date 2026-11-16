// Writes the one pull-request comment that says where the preview of that pull request is (docs/PREVIEWS.md).
// Called from actions/github-script in pages.yml and preview-cleanup.yml. The comment is found again by MARK and edited
// in place, so a pull request carries a single, current notice instead of one per push.
const fs = require("fs");
const MARK = "<!-- temple-walk-preview -->";

// The last `wrangler preview` record in Wrangler's output file (one JSON object per line).
function previewRecord(file) {
  if (!file || !fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } });
  return lines.filter((r) => r && r.type === "preview").pop() || null;
}

function cameraLinks(base, manifest) {
  if (!fs.existsSync(manifest)) return "";
  const { cameras = [] } = JSON.parse(fs.readFileSync(manifest, "utf8"));
  return cameras.map((c) => `[${c.id} ${c.label}](${base.replace(/\/$/, "")}/${c.url})`).join(" · ");
}

function body({ state, sha, run, record, previous, manifest }) {
  const short = sha.slice(0, 7);
  if (state === "success") {
    const latest = record.preview_urls[0], fixed = record.deployment_urls[0];
    return [MARK, `<!-- deployed:${sha} -->`, "### PR 预览", "",
      "| | |", "|---|---|",
      `| 提交 | \`${sha}\` |`,
      `| 最新地址（随推送更新） | ${latest} |`,
      `| 本提交固定地址 | ${fixed} |`, "",
      `六个验收机位（本提交，J01 夏·昼）：${cameraLinks(fixed, manifest)}`, "",
      `由[这次运行](${run})部署：与检查、单测、构建和 \`boot\` 场景同一次运行，部署的是同一份 \`dist/\`。预览只用来看效果，不是验收结论；反馈问题时请附上固定地址或提交号。`].join("\n");
  }
  if (state === "failure") {
    const old = previous ? `「最新地址」仍是上一次成功部署的提交 \`${previous.slice(0, 7)}\`，不是 \`${short}\`。` : "这个 PR 还没有成功部署过预览。";
    return [MARK, previous ? `<!-- deployed:${previous} -->` : "", `### PR 预览：提交 \`${short}\` 没有部署`, "",
      `检查或部署没有通过，见[运行记录](${run})。${old}`].join("\n");
  }
  return [MARK, "### PR 预览已删除", "", "PR 已关闭，它的预览和各提交的固定地址都已从 Cloudflare 删除。"].join("\n");
}

module.exports = async ({ github, context, core }) => {
  const { STATE: state, SHA: sha = "", OUTPUT_FILE, MANIFEST = "docs/t00/camera-manifest.json" } = process.env;
  const { owner, repo } = context.repo, issue_number = context.payload.pull_request.number;
  const run = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number, per_page: 100 });
  const mine = comments.find((c) => c.user.type === "Bot" && c.body.includes(MARK));
  if (state === "removed" && !mine) return;
  const previous = mine && (mine.body.match(/<!-- deployed:([0-9a-f]{40}) -->/) || [])[1];
  const record = state === "success" ? previewRecord(OUTPUT_FILE) : null;
  if (state === "success" && !record) return core.setFailed("wrangler preview wrote no preview record");
  const text = body({ state, sha, run, record, previous, manifest: MANIFEST });
  if (mine) await github.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body: text });
  else await github.rest.issues.createComment({ owner, repo, issue_number, body: text });
  if (record) await core.summary.addHeading("PR 预览", 3).addRaw(`最新：${record.preview_urls[0]}\n\n本提交（${sha}）：${record.deployment_urls[0]}\n`).write();
};
module.exports.body = body;
