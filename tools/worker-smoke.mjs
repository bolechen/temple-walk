// 同修留痕 (#340): the Worker run for real, locally: `wrangler dev --local` (workerd, a Durable Object on SQLite in a scratch
// folder), never Cloudflare itself. It takes the canary's config (or the one named), points its assets at a scratch folder with
// one page, and asks the API what a visitor's page would, and a few things it must refuse. Exit 1 on any miss.
//   node tools/worker-smoke.mjs [wrangler.canary.jsonc]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname), cfgName = process.argv[2] || "wrangler.canary.jsonc";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "worker-smoke-")), port = 8700 + Math.floor(Math.random() * 200);
fs.mkdirSync(path.join(tmp, "site")); fs.writeFileSync(path.join(tmp, "site", "index.html"), "<!doctype html><title>asset</title>");
const cfg = JSON.parse(fs.readFileSync(path.join(root, cfgName), "utf8").replace(/^\s*\/\/.*$/gm, ""));
cfg.main = path.join(root, cfg.main); cfg.assets.directory = path.join(tmp, "site"); delete cfg.routes; cfg.workers_dev = true;
fs.writeFileSync(path.join(tmp, "wrangler.json"), JSON.stringify(cfg));
const child = spawn("npx", ["--yes", "wrangler@4.162.0", "dev", "-c", path.join(tmp, "wrangler.json"), "--local", "--port", String(port), "--persist-to", path.join(tmp, "state")], { cwd: tmp, env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1", NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; child.stdout.on("data", (d) => (log += d)); child.stderr.on("data", (d) => (log += d));
const stop = () => { try { process.kill(-child.pid); } catch {} try { child.kill(); } catch {} fs.rmSync(tmp, { recursive: true, force: true }); };
process.on("exit", stop);
const base = `http://127.0.0.1:${port}`;
let bad = 0; const check = (ok, what, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : " " + extra}`); if (!ok) bad++; };
try {
  for (let i = 0; ; i++) { try { if ((await fetch(base + "/api/traces")).status === 200) break; } catch {} if (i > 120) throw new Error("wrangler dev did not come up:\n" + log.slice(-1500)); await new Promise((r) => setTimeout(r, 1000)); }
  const j = async (path, init) => { const r = await fetch(base + path, init); return [r.status, await r.json().catch(() => null), r]; };
  const post = (body, type = "application/json") => j("/api/trace", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
  let [s, b] = await j("/api/traces?day=today"); check(s === 200 && b.traces && Object.keys(b.traces).length === 0, "an empty day to begin with", JSON.stringify([s, b]));
  [s, b] = await post({ place: "bell", kind: "rite" }); check(s === 200 && b.n === 1, "the first stroke is counted", JSON.stringify([s, b]));
  [s, b] = await post({ place: "bell", kind: "rite" }); check(s === 200 && b.n === 2, "and the second (atomically, in the Durable Object)", JSON.stringify([s, b]));
  [s, b] = await post({ place: "tea", kind: "seal" }, "text/plain;charset=UTF-8"); check(s === 200 && b.n === 1, "a text/plain beacon is taken");
  [s, b] = await post({ place: "nowhere", kind: "rite" }); check(s === 400, "an unknown place is 400", String(s));
  [s, b] = await post({ place: "bell", kind: "gift" }); check(s === 400, "an unknown kind is 400", String(s));
  // The page shows the count of the day: a fresh read may sit in the edge cache for 30 s, so read until it is there (it is not cached in `wrangler dev` today, but may be).
  // (the first read above sits in the edge cache for 30 s under "today"; the same day by its date is a key never read yet)
  const today = new Date().toISOString().slice(0, 10);
  let seen = null; for (let i = 0; i < 40 && !seen; i++) { [s, b] = await j("/api/traces?day=" + today); if (b?.traces?.bell?.rite === 2) seen = b; else await new Promise((r) => setTimeout(r, 1000)); }
  check(!!seen && seen.traces.tea.seal === 1, "the day reads back what was counted", JSON.stringify(b));
  const r = await fetch(base + "/"); check(r.status === 200 && (await r.text()).includes("asset"), "the page itself is still a static file");
  const t0 = Date.now(), flood = []; for (let i = 0; i < 300; i++) flood.push(post({ place: "well", kind: "rite" }));
  const codes = (await Promise.all(flood)).map((x) => x[0]), took = (Date.now() - t0) / 1000, passed = codes.filter((c) => c === 200).length;
  check(codes.includes(429) && passed <= 120 + 12 * (took + 1), "a flood is dropped past the bucket (the burst, and 12 a second while it lasts)", `${passed} passed in ${took.toFixed(1)} s`);
} catch (e) { console.error(String(e.message || e)); bad++; }
stop(); process.exit(bad ? 1 : 0);
