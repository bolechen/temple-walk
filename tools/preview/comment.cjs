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

// Straight to a moment, for review (app/src/game.js's workbench: ?seals=, ?at=, ?play=), on this commit's preview.
const BENCH = [["缺印结尾", "seals=bell,tea&play=ending"], ["七印圆满结尾", "seals=all&play=ending"], ["冬天结尾", "seals=all&play=ending&season=winter"],
  ["撞钟", "play=bell"], ["上香", "play=incense"], ["吃茶", "play=tea"], ["得句", "play=sutra"], ["观水", "play=well"], ["燃灯", "play=lamp"], ["静坐", "seals=none&play=sit"]];
function benchLinks(base) {
  return BENCH.map(([name, q]) => `[${name}](${base.replace(/\/$/, "")}/?${q}&debug=0)`).join(" · ");
}

function cameraLinks(base, manifest) {
  if (!fs.existsSync(manifest)) return "";
  const { cameras = [] } = JSON.parse(fs.readFileSync(manifest, "utf8"));
  // The preview opens with the debug panel showing; the acceptance views are looked at without it.
  return cameras.map((c) => `[${c.id} ${c.label}](${base.replace(/\/$/, "")}/${c.url}${c.url.includes("?") ? "&" : "?"}debug=0)`).join(" · ");
}

// What the owner asked for is kept in docs/handoff/LATEST-GOALS.md, which the research Site and the independent review
// read as the goal of record. A pull request that changes a goal file, a recorded decision or a written owner's request
// without touching it is told so on its preview comment (a reminder, not a gate: a goal file's wording may change and
// the goal not).
const GOALS = "docs/handoff/LATEST-GOALS.md";
const GOAL_FILES = [/^docs\/t00\/[^/]*-goal\.md$/, /^docs\/t00\/decisions\.md$/, /^docs\/PHOTO-MODE\.md$/];
function goalsNote(files) {
  if (!files || files.includes(GOALS)) return "";
  const hit = files.filter((f) => GOAL_FILES.some((r) => r.test(f)));
  return hit.length ? `目标同步：这个 PR 改了 ${hit.map((f) => `\`${f}\``).join("、")}，没有改 \`${GOALS}\`。若用户需求或所有者的决定变了，请主创同步那份文件（AGENTS.md「目标记录」）；只是措辞的改动可以不管。` : "";
}

function body({ state, sha, run, record, previous, manifest, files }) {
  const note = goalsNote(files);
  const short = sha.slice(0, 7);
  if (state === "success") {
    const latest = record.preview_urls[0], fixed = record.deployment_urls[0];
    return [MARK, `<!-- deployed:${sha} -->`, "### PR 预览", "",
      "| | |", "|---|---|",
      `| 提交 | \`${sha}\` |`,
      `| 最新地址（随推送更新） | ${latest} |`,
      `| 本提交固定地址 | ${fixed} |`, "",
      `六个验收机位（本提交，J01 夏·昼）：${cameraLinks(fixed, manifest)}`, "",
      `评审直达（本提交，不读不写本机朱印帐，属诊断证据）：${benchLinks(fixed)}`, "",
      `由[这次运行](${run})部署：与检查、单测、构建和 \`boot\` 场景同一次运行，部署的是同一份 \`dist/\`。预览只用来看效果，不是验收结论；反馈问题时请附上固定地址或提交号。`,
      ...(note ? ["", note] : [])].join("\n");
  }
  if (state === "failure") {
    const old = previous ? `「最新地址」仍是上一次成功部署的提交 \`${previous.slice(0, 7)}\`，不是 \`${short}\`。` : "这个 PR 还没有成功部署过预览。";
    return [MARK, previous ? `<!-- deployed:${previous} -->` : "", `### PR 预览：提交 \`${short}\` 没有部署`, "",
      `检查或部署没有通过，见[运行记录](${run})。${old}`, ...(note ? ["", note] : [])].join("\n");
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
  const files = state === "removed" ? null : (await github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: issue_number, per_page: 100 })).map((f) => f.filename);
  const text = body({ state, sha, run, record, previous, manifest: MANIFEST, files });
  if (mine) await github.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body: text });
  else await github.rest.issues.createComment({ owner, repo, issue_number, body: text });
  if (record) await core.summary.addHeading("PR 预览", 3).addRaw(`最新：${record.preview_urls[0]}\n\n本提交（${sha}）：${record.deployment_urls[0]}\n`).write();
};
module.exports.body = body;
module.exports.goalsNote = goalsNote;
