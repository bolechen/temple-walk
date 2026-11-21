// 同修留痕 (#340): the Worker run for real, locally: `wrangler dev --local` (workerd, a Durable Object on SQLite in a scratch
// folder), never Cloudflare itself. It takes the canary's config (or the one named), points its assets at a scratch folder with
// one page, and asks the API what a visitor's page would, and a few things it must refuse. Exit 1 on any miss.
//   node tools/worker-smoke.mjs [wrangler.canary.jsonc]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname), cfgName = process.argv[2] || "wrangler.canary.jsonc";
// A port the system hands out, not one picked at random from a hundred: two instances on one port made the second night's check talk to the
// first instance (still running: `wrangler dev` is a tree of processes, and killing its `npx` leaves the rest), which answered it as that night.
const freePort = () => new Promise((res, rej) => { const srv = net.createServer(); srv.once("error", rej); srv.listen(0, "127.0.0.1", () => { const { port } = /** @type {import("node:net").AddressInfo} */ (srv.address()); srv.close(() => res(port)); }); });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "worker-smoke-")), port = await freePort();
fs.mkdirSync(path.join(tmp, "site")); fs.writeFileSync(path.join(tmp, "site", "index.html"), "<!doctype html><title>asset</title>");
const cfg = JSON.parse(fs.readFileSync(path.join(root, cfgName), "utf8").replace(/^\s*\/\/.*$/gm, ""));
cfg.main = path.join(root, cfg.main); cfg.assets.directory = path.join(tmp, "site"); delete cfg.routes; cfg.workers_dev = true;
fs.writeFileSync(path.join(tmp, "wrangler.json"), JSON.stringify(cfg));
const child = spawn("npx", ["--yes", "wrangler@4.162.0", "dev", "-c", path.join(tmp, "wrangler.json"), "--local", "--port", String(port), "--persist-to", path.join(tmp, "state")], { cwd: tmp, env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1", NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
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
  // 除夕撞钟 (#341): the year-end bell's count, on its sixteen shards. Off the night a report is refused (403), whatever it
  // carries; a bad one is 400 first; the count reads as this year's, from nothing.
  const jy = (body, type = "application/json") => j("/api/joya", { method: "POST", headers: { "content-type": type }, body: JSON.stringify(body) });
  [s, b] = await j("/api/joya"); check(s === 200 && Number.isInteger(b?.year) && b.total === 0 && b.rounds === 0, "the year-end bell's count reads, from nothing", JSON.stringify([s, b]));
  [s, b] = await jy({ n: 9, tz: 0 }); check(s === 400, "a report of nine strokes is 400", String(s));
  [s, b] = await jy({ n: 1, tz: 0, who: "x" }); check(s === 400, "a report with anything else in it is 400", String(s));
  const open = (() => { const d = new Date(); return (d.getUTCMonth() === 11 && d.getUTCDate() === 31) || (d.getUTCMonth() === 0 && d.getUTCDate() === 1); })();
  if (!open) { [s, b] = await jy({ n: 1, tz: 0 }); check(s === 403, "off the night a stroke is not counted (403)", String(s)); }
  [s, b] = await j("/api/joya?year=1999"); check(s === 400, "a year long gone is 400", String(s));
} catch (e) { console.error(String(e.message || e)); bad++; }
stop();
// 除夕撞钟 (#341): the night itself, by setting the Worker's clock (JOYA_TEST_NOW, given only here, on the command line). At
// 12:00 UTC on 31 December it is 20:00 at UTC+8: a stroke from there counts and the count reads it back. At 15:00 UTC on
// 1 January the night is over in every zone: refused.
async function night(ms, what) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "worker-smoke-night-")), p = await freePort(), at = `http://127.0.0.1:${p}`;
  fs.mkdirSync(path.join(dir, "site")); fs.writeFileSync(path.join(dir, "site", "index.html"), "<!doctype html><title>asset</title>");
  fs.writeFileSync(path.join(dir, "wrangler.json"), JSON.stringify({ ...cfg, assets: { ...cfg.assets, directory: path.join(dir, "site") } }));
  const c = spawn("npx", ["--yes", "wrangler@4.162.0", "dev", "-c", path.join(dir, "wrangler.json"), "--local", "--port", String(p), "--persist-to", path.join(dir, "state"), "--var", `JOYA_TEST_NOW:${ms}`], { cwd: dir, env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1", NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
  try {
    for (let i = 0; ; i++) { try { if ((await fetch(at + "/api/joya?year=2027")).status === 200) break; } catch {} if (i > 120) throw new Error("wrangler dev did not come up:\n" + out.slice(-1500)); await new Promise((r) => setTimeout(r, 1000)); }
    const r = await fetch(at + "/api/joya", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n: 3, tz: -480 }) }), b = await r.json().catch(() => null);
    await what(r.status, b, at);
  } catch (e) { console.error(String(e.message || e)); bad++; }
  finally { try { process.kill(-c.pid); } catch {} try { c.kill(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); }   // (the whole group: the Worker itself, not only the `npx` that started it)
}
await night(Date.UTC(2026, 11, 31, 12), async (s, b, at) => {
  check(s === 200 && b?.year === 2027, "on the night (12-31 12:00Z, 20:00 at UTC+8) three strokes are taken", JSON.stringify([s, b]));
  // The reply's total is the shards' sum as cached for 10 s (the readiness probe above read 0 into it): read until it holds them.
  let g = null; for (let i = 0; i < 20 && !(g && g.total === 3); i++) { g = await (await fetch(at + "/api/joya?year=2027&t=" + i)).json(); if (g.total !== 3) await new Promise((r) => setTimeout(r, 1000)); }
  check(g?.total === 3, "and the mountain's count reads them back", JSON.stringify(g));
});
await night(Date.UTC(2027, 0, 1, 15), async (s, b) => check(s === 403, "after the night (01-01 15:00Z, over in every zone) a stroke is refused", JSON.stringify([s, b])));
process.exit(bad ? 1 : 0);
