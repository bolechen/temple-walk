// Tripo tasks for the T05 statue spike (issue #280): submit one, wait for it, fetch what it made, and keep a line in
// <dir>/ledger.json (task id, type, credits it cost, the files and their SHA-256), so the spend against the issue's
// 60-credit cap is written down as it happens.
//
//   NODE_USE_ENV_PROXY=1 node tools/t05-tripo.mjs submit <request.json> <name> [dir]    POST it, wait, download, record
//   node tools/t05-tripo.mjs wait <task id> <name> [dir]           for a task already submitted
//   node tools/t05-tripo.mjs balance
//
// The request is Tripo's v2 task body ({"type":"text_to_model", …}); api.tripo3d.ai is reached through the sandbox's
// proxy, which adds the key (Node reaches it only with NODE_USE_ENV_PROXY=1), so the Authorization header here is a placeholder and no real key is ever read or written.
// Default dir: tools/out/t05/tripo (git-ignored; the models go to the evidence store, not to git).
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { execFileSync } from "node:child_process";
const API = "https://api.tripo3d.ai/v2/openapi", AUTH = { Authorization: "Bearer tsk_placeholder", "Content-Type": "application/json" };
const [cmd, a, b, dirArg] = process.argv.slice(2);
const dir = path.resolve(dirArg || "tools/out/t05/tripo"); fs.mkdirSync(dir, { recursive: true });
const get = async (u) => (await fetch(`${API}${u}`, { headers: AUTH })).json();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function wait(id, name) {
  for (let i = 0; ; i++) {
    const r = await get(`/task/${id}`).catch((e) => ({ error: String(e) })); const d = r.data || {}; if (!r.data) console.log("poll:", JSON.stringify(r).slice(0, 200));
    if (i % 6 === 0) console.log(`${name}: ${d.status} ${d.progress ?? ""}%`);
    if (["success", "failed", "cancelled", "banned", "expired"].includes(d.status)) {
      const files = {};
      for (const [k, url] of Object.entries({ ...(d.output || {}) })) {
        if (typeof url !== "string" || !/^https?:/.test(url)) continue;
        const ext = (new URL(url).pathname.match(/\.[a-z0-9]+$/i) || [".bin"])[0], f = path.join(dir, `${name}.${k}${ext}`);
        execFileSync("curl", ["-sSL", "--retry", "4", "-o", f, url]); const buf = fs.readFileSync(f);   // curl: the CDN resets Node's proxied fetch
        files[k] = { file: path.basename(f), bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
      }
      const ledgerF = path.join(dir, "ledger.json"), ledger = fs.existsSync(ledgerF) ? JSON.parse(fs.readFileSync(ledgerF, "utf8")) : [];
      const entry = { name, task_id: id, type: d.type, status: d.status, credits: d.consumed_credit ?? d.credits_consumed ?? null, created: d.create_time ?? d.created_at, input: d.input, files };
      ledger.push(entry); fs.writeFileSync(ledgerF, JSON.stringify(ledger, null, 2));
      console.log(JSON.stringify(entry, null, 1)); console.log("spent so far:", ledger.reduce((s, e) => s + (e.credits || 0), 0));
      return entry;
    }
    await pause(10000);
  }
}
if (cmd === "balance") console.log(JSON.stringify(await get("/user/balance")));
else if (cmd === "submit") {
  const body = fs.readFileSync(a, "utf8"); const r = await (await fetch(`${API}/task`, { method: "POST", headers: AUTH, body })).json();
  if (r.code !== 0) { console.error(JSON.stringify(r)); process.exit(1); }
  console.log("task", r.data.task_id); await wait(r.data.task_id, b);
} else if (cmd === "wait") await wait(a, b);
else { console.error("usage: submit <request.json> <name> | wait <task id> <name> | balance"); process.exit(2); }
