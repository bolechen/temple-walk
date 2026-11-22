// Evidence pictures and films live outside git (issue #223). The repository keeps, beside each evidence folder's
// README, one MANIFEST.json: every binary's path, size, SHA-256 and the dataset commit that holds it. The bytes are in
// a public Hugging Face dataset, pinned by commit, so an address never changes and never points at later content.
//
//   node tools/evidence.mjs push <dir>          upload <dir>'s binaries, write <dir>/MANIFEST.json, fetch each back and check it
//   node tools/evidence.mjs verify [--all]      fetch what every manifest lists: size of every file and a sample's hash; --all hashes them all
//   node tools/evidence.mjs pull <dir> [--into <out>]   fetch <dir>'s binaries by its manifest (hash-checked) into tools/out/evidence/<store path>/, which git ignores
//   node tools/evidence.mjs mirror [--dry-run]  copy what the manifests list from the original (CONFIG.fallback) to the R2 bucket; CI's job (#247)
//   node tools/evidence.mjs verify-store        every manifest entry read from the bucket over its S3 interface (the repository's four secrets), size and SHA-256
//   node tools/evidence.mjs check               offline, for CI: manifests well-formed, no file over 1 MB, at most one picture in a folder
//
// Where the bytes are read from is stated once, in tools/evidence.config.json's `base` (or EVIDENCE_BASE for a try-out);
// `fallback` is where they were first put (Hugging Face): the original, the copy `mirror` fills the `base` store from,
// and where a read goes when `base` answers a datacenter address with Cloudflare's verification page (cf-mitigated:
// challenge, an IP-reputation rule that no hostname rule can skip, #247). Moving to another
// store means changing that file and pushing again. Nothing here deletes or overwrites: a path already in a manifest
// (or already in the store) with different bytes is refused. `hf` must be logged in for push; give HF_TOKEN any
// placeholder in a sandbox whose proxy supplies the real one; verify and pull need only a network.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/evidence.config.json"), "utf8"));
/** Text beside the pictures stays in git; anything else in an evidence folder is evidence and goes to the store. */
export const TEXT = new Set(["json", "log", "md", "txt", "cjs", "mjs", "js", "csv", "tsv", "patch", "html", "yml", "yaml", "sh", "py", "svg"]);
export const LIMIT = 1 << 20;
export const MANIFEST = "MANIFEST.json";

export const isText = (f) => TEXT.has(path.extname(f).slice(1).toLowerCase());
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
/** The single place the address is made: base from the config (or EVIDENCE_BASE), then commit and the store's own path. */
export function urlOf(remote, rev, base = process.env.EVIDENCE_BASE || CONFIG.base) {
  return `${base}${rev}/${remote.split("/").map(encodeURIComponent).join("/")}`;
}
/** docs/<level>/evidence/<rest> is kept in the store as <level>/<rest>. */
export function remoteOf(relFromRoot) {
  const m = /^docs\/([^/]+)\/evidence\/(.+)$/.exec(relFromRoot.split(path.sep).join("/"));
  if (!m) throw new Error(`not under docs/<level>/evidence/: ${relFromRoot}`);
  return `${m[1]}/${m[2]}`;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
export const manifestsUnder = (root = ROOT) => {
  const out = [];
  const docs = path.join(root, "docs");
  if (!fs.existsSync(docs)) return out;
  for (const f of walk(docs)) if (path.basename(f) === MANIFEST && /\/evidence\//.test(f.split(path.sep).join("/"))) out.push(f);
  return out.sort();
};

/** Problems with a parsed manifest object (empty list: fine). */
export function manifestProblems(m) {
  const bad = [];
  if (!m || typeof m !== "object") return ["not an object"];
  if (m.version !== 1) bad.push("version must be 1");
  if (typeof m.dataset !== "string") bad.push("dataset must be a string");
  if (!Array.isArray(m.files)) return [...bad, "files must be an array"];
  const seen = new Set();
  m.files.forEach((f, i) => {
    const at = `files[${i}]`;
    if (typeof f.path !== "string" || !f.path || f.path.startsWith("/") || f.path.includes("..")) bad.push(`${at}.path`);
    else if (seen.has(f.path)) bad.push(`${at}.path repeats ${f.path}`);
    else seen.add(f.path);
    if (!Number.isInteger(f.bytes) || f.bytes < 0) bad.push(`${at}.bytes`);
    if (typeof f.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(f.sha256)) bad.push(`${at}.sha256`);
    if (typeof f.rev !== "string" || !/^[0-9a-f]{40}$/.test(f.rev)) bad.push(`${at}.rev must be a 40-hex commit`);
  });
  return bad;
}

/** Pictures that may stay in git: at most one (a collage) in each evidence folder; every other picture is pushed and listed in the manifest. */
const PICTURE = /\.(png|jpe?g|webp)$/i;

/** Offline checks over a repository root: well-formed manifests, no file over 1 MB and at most one picture under an evidence folder. */
export function checkTree(root = ROOT, files = null) {
  const bad = [];
  const all = files ?? walk(path.join(root, "docs")).map((f) => path.relative(root, f).split(path.sep).join("/"));
  const inEvidence = all.filter((f) => /\/evidence\//.test(f));
  for (const mf of manifestsUnder(root)) {
    const rel = path.relative(root, mf).split(path.sep).join("/");
    let m;
    try { m = JSON.parse(fs.readFileSync(mf, "utf8")); } catch (e) { bad.push(`${rel}: ${e.message}`); continue; }
    for (const p of manifestProblems(m)) bad.push(`${rel}: ${p}`);
  }
  for (const f of inEvidence) {
    const size = fs.statSync(path.join(root, f)).size;
    if (size > LIMIT) bad.push(`${f}: ${size} bytes, over 1 MB — push it with tools/evidence.mjs and keep the manifest`);
  }
  // A folder is docs/<level>/evidence/<dir>; a picture anywhere below it counts toward it.
  const pictures = new Map();
  for (const f of inEvidence.filter((x) => PICTURE.test(x))) {
    const m = /^(.*?\/evidence\/[^/]+)\//.exec(f);
    const folder = m ? m[1] : path.posix.dirname(f);
    pictures.set(folder, [...(pictures.get(folder) ?? []), f]);
  }
  for (const [folder, list] of pictures) {
    if (list.length > 1) bad.push(`${folder}: ${list.length} pictures in git (${list.map((f) => path.posix.basename(f)).join(", ")}) — keep one collage at most; push the rest with tools/evidence.mjs and keep the manifest`);
  }
  return bad;
}

// ---------------------------------------------------------------- network

// How long to wait before asking again. A store that says "too many" (429) or "busy" (503) is waited on as it asks
// (Retry-After, in seconds, at most a minute), or else for a few seconds that double each time; anything else gets the short
// pause it always had. The nightly run asks the original store for three thousand files, and Hugging Face turned 62 of them
// away with 429 on 2026-11-22 while every hash it did answer matched (run 45060329278): that is the store's breath, not the
// evidence, and is waited out rather than reported.
export function retryWait(status, retryAfter, i) {
  if (status === 429 || status === 503) {
    const s = retryAfter == null || retryAfter === "" ? NaN : Number(retryAfter);
    return Number.isFinite(s) && s >= 0 ? Math.min(s, 60) * 1000 : Math.min(60000, 4000 * 2 ** i);
  }
  return 300 * 2 ** i;
}
async function get(url, tries = 3) {
  let last;
  for (let i = 0, busy = 0; i < tries + busy; i++) {
    let wait = 300 * 2 ** i;
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(CONFIG.timeoutMs || 60000) });
      if (r.status === 404) throw Object.assign(new Error(`404 ${url}`), { fatal: true });
      if (!r.ok) {
        // A verification page is the zone's answer to who is asking, not to what is asked for: asking again changes nothing.
        const challenged = r.headers.get("cf-mitigated") === "challenge";
        wait = retryWait(r.status, r.headers.get("retry-after"), i);
        // A busy store gets up to five more tries than an ordinary failure, so a run that crowds it still finishes.
        if ((r.status === 429 || r.status === 503) && busy < 5) busy++;
        await r.body?.cancel();
        throw Object.assign(new Error(`HTTP ${r.status} ${url}`), { fatal: challenged, challenged });
      }
      return r;
    } catch (e) {
      last = e;
      if (e.fatal) break;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}
// A body cut off halfway ("terminated", a reset) is asked for again, whole: the headers had come, so `get` alone does not
// see it. A wrong size or hash is never asked again; that is the answer, not the road to it.
async function body(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    const r = await get(url);
    try { return { r, buf: Buffer.from(await r.arrayBuffer()) }; }
    catch (e) { last = e; await new Promise((ok) => setTimeout(ok, 300 * 2 ** i)); }
  }
  throw last;
}
const bytesOf = async (url) => (await body(url)).buf;

/** Run `fn` over items, `n` at a time; collect results in order. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const apiHead = async () => (await (await get(`https://huggingface.co/api/datasets/${CONFIG.dataset}`)).json()).sha;
const apiTree = async (prefix) => {
  const out = [];
  let url = `https://huggingface.co/api/datasets/${CONFIG.dataset}/tree/main/${prefix}?recursive=true&expand=false&limit=1000`;
  while (url) {
    const r = await get(url).catch((e) => (/404/.test(e.message) ? null : Promise.reject(e)));
    if (!r) break;
    out.push(...(await r.json()).filter((e) => e.type === "file"));
    const next = /<([^>]+)>;\s*rel="next"/.exec(r.headers.get("link") || "");
    url = next && next[1];
  }
  return out;
};

// ---------------------------------------------------------------- commands

function readManifest(dir) {
  const f = path.join(dir, MANIFEST);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : { version: 1, dataset: CONFIG.dataset, files: [] };
}

/** Binaries under dir, as paths relative to dir (the manifest itself and text stay in git). */
const binariesIn = (dir) => walk(dir).filter((f) => !isText(f)).map((f) => path.relative(dir, f).split(path.sep).join("/")).sort();

export async function push(dirArg, { log = console.log } = {}) {
  const dir = path.resolve(dirArg);
  const rel = path.relative(ROOT, dir).split(path.sep).join("/");
  const prefix = remoteOf(rel + "/x").replace(/\/x$/, "");
  const man = readManifest(dir);
  const have = new Map(man.files.map((f) => [f.path, f]));
  const local = binariesIn(dir).map((p) => { const buf = fs.readFileSync(path.join(dir, p)); return { path: p, bytes: buf.length, sha256: sha256(buf) }; });
  if (!local.length) throw new Error(`no binaries under ${rel}`);
  // Never overwrite: a name in the manifest with other bytes is refused before anything is sent.
  for (const f of local) {
    const o = have.get(f.path);
    if (o && o.sha256 !== f.sha256) throw new Error(`refusing to overwrite ${prefix}/${f.path}: the manifest has ${o.sha256.slice(0, 12)}, the file is ${f.sha256.slice(0, 12)} (give the new picture a new name)`);
  }
  // Nor what the store already holds under that name from somewhere else: compare by size, then by bytes.
  const remote = new Map((await apiTree(prefix)).map((e) => [e.path, e]));
  const head0 = await apiHead();
  const adopt = [];
  for (const f of local) {
    if (have.has(f.path)) continue;
    const r = remote.get(`${prefix}/${f.path}`);
    if (!r) continue;
    const got = sha256(await bytesOf(urlOf(`${prefix}/${f.path}`, head0)));
    if (got !== f.sha256) throw new Error(`refusing to overwrite ${prefix}/${f.path}: the store already holds other bytes under that name`);
    adopt.push(f.path);
  }
  const fresh = local.filter((f) => !have.has(f.path) && !adopt.includes(f.path));
  if (fresh.length) {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-"));
    try {
      for (const f of fresh) {
        const to = path.join(stage, f.path);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(dir, f.path), to);
      }
      log(`uploading ${fresh.length} files (${(fresh.reduce((a, f) => a + f.bytes, 0) / 1e6).toFixed(1)} MB) to ${CONFIG.dataset}/${prefix}`);
      execFileSync("hf", ["upload", CONFIG.dataset, stage, prefix, "--repo-type", "dataset", "--commit-message", `evidence: ${prefix} (${fresh.length} files)`], { stdio: ["ignore", "inherit", "inherit"], env: process.env });
    } finally { fs.rmSync(stage, { recursive: true, force: true }); }
  }
  const rev = await apiHead();
  // Everything fetched back and compared before the manifest is written.
  const fetched = await pool(local.filter((f) => !have.has(f.path)), 6, async (f) => {
    const got = sha256(await bytesOf(urlOf(`${prefix}/${f.path}`, rev)));
    return got === f.sha256 ? null : `${prefix}/${f.path}: fetched back ${got}, local ${f.sha256}`;
  });
  const wrong = fetched.filter(Boolean);
  if (wrong.length) throw new Error(`fetched back and different (manifest not written):\n${wrong.join("\n")}`);
  const files = [...man.files];
  for (const f of local) if (!have.has(f.path)) files.push({ ...f, rev });
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify({ version: 1, dataset: CONFIG.dataset, files }, null, 1) + "\n");
  log(`${rel}/${MANIFEST}: ${files.length} files, ${local.length - have.size} new, pinned at ${rev.slice(0, 12)}`);
  return files;
}

/** Fetch every manifest's files from `base`. all: hash every file; otherwise sizes of all (from the response) and a sample of
 *  hashes. A read that `base` answers with a verification page (cf-mitigated: challenge) is not a mismatch: it is counted as
 *  challenged (by extension) and the file is fetched from `fallback` and hashed there. Failing is: neither store gives the
 *  manifest's bytes. */
export async function verify({ all = false, root = ROOT, log = console.log } = {}) {
  const fails = [];
  const mans = manifestsUnder(root);
  const jobs = [];
  for (const mf of mans) {
    const m = JSON.parse(fs.readFileSync(mf, "utf8"));
    const rel = path.relative(root, path.dirname(mf)).split(path.sep).join("/");
    const prefix = remoteOf(rel + "/x").replace(/\/x$/, "");
    const bad = manifestProblems(m);
    if (bad.length) { fails.push(`${rel}: ${bad.join("; ")}`); continue; }
    m.files.forEach((f, i) => jobs.push({ f, remote: `${prefix}/${f.path}`, url: urlOf(`${prefix}/${f.path}`, f.rev), hash: all || i % 10 === 0 }));
  }
  const n = { hashed: 0, sized: 0, viaFallback: 0 };
  const challenged = {};
  const sameAsManifest = (buf, f) => buf.length === f.bytes && sha256(buf) === f.sha256;
  await pool(jobs, 16, async ({ f, remote, url, hash }) => {
    try {
      if (!hash) {
        const r = await get(url), len = Number(r.headers.get("content-length"));
        await r.body?.cancel();
        n.sized++;
        if (len && len !== f.bytes) fails.push(`${url}: ${len} bytes, manifest ${f.bytes}`);
        return;
      }
      const { buf } = await body(url);
      n.hashed++;
      if (buf.length !== f.bytes) fails.push(`${url}: ${buf.length} bytes, manifest ${f.bytes}`);
      else if (sha256(buf) !== f.sha256) fails.push(`${url}: SHA-256 differs from the manifest`);
    } catch (e) {
      if (!e.challenged) { fails.push(`${url}: ${e.message.replace(url, "").trim() || e.message}`); return; }
      const ext = path.extname(f.path).slice(1).toLowerCase() || "(none)";
      challenged[ext] = (challenged[ext] || 0) + 1;
      const back = urlOf(remote, f.rev, CONFIG.fallback);
      try {
        if (sameAsManifest(await bytesOf(back), f)) n.viaFallback++;
        else fails.push(`${url}: challenged, and the fallback's bytes differ from the manifest`);
      } catch (e2) { fails.push(`${url}: challenged, and the fallback failed: ${e2.message.replace(back, "").trim()}`); }
    }
  });
  const ch = Object.entries(challenged).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
  log(`${mans.length} manifests, ${jobs.length} files: ${n.hashed} hashed and ${n.sized} sized directly at the base, ${n.viaFallback} hashed via the fallback (challenged by extension: ${ch}), ${fails.length} failed${all ? " (all)" : " (sample)"}`);
  return fails;
}

/** Where verify-store puts one object while it reads it back: named by its key, not by its content, since two objects of the same bytes (two pictures that came out alike) are read at the same time and a shared name made one read the other's file after it had been removed (#288's gable-top pair, which turned every mirror run red). */
export const verifyTmp = (e) => path.join(os.tmpdir(), `verify-${process.pid}-${sha256(Buffer.from(e.key)).slice(0, 16)}`);

/** The bucket's own word: every manifest entry read over its S3 interface (never the public domain), size and SHA-256. */
export async function verifyStore({ log = console.log } = {}) {
  const missing = SECRETS.filter((n) => !process.env[n]);
  if (missing.length) throw new Error(`missing or empty: ${missing.join(", ")}`);
  const entries = mirrorEntries();
  const fails = [];
  let ok = 0;
  await pool(entries, 8, async (e) => {
    const tmp = verifyTmp(e);
    try {
      await aws("get-object", ["--key", e.key, tmp, "--output", "json"]);
      const buf = fs.readFileSync(tmp);
      if (buf.length !== e.bytes) fails.push(`${e.key}: ${buf.length} bytes in the bucket, manifest ${e.bytes}`);
      else if (sha256(buf) !== e.sha256) fails.push(`${e.key}: SHA-256 in the bucket differs from the manifest`);
      else ok++;
    } catch (err) { fails.push(`${e.key}: ${err.message}`); }
    finally { fs.rmSync(tmp, { force: true }); }
  });
  log(`bucket (S3): ${entries.length} listed, ${ok} read and matching, ${fails.length} failed`);
  return fails;
}

export async function pull(dirArg, { into, log = console.log } = {}) {
  const dir = path.resolve(dirArg);
  const rel = path.relative(ROOT, dir).split(path.sep).join("/");
  const prefix = remoteOf(rel + "/x").replace(/\/x$/, "");
  const m = readManifest(dir);
  const out = path.resolve(into || path.join(ROOT, "tools/out/evidence", prefix));
  const fails = [];
  let got = 0;
  await pool(m.files, 6, async (f) => {
    const to = path.join(out, f.path);
    if (fs.existsSync(to) && sha256(fs.readFileSync(to)) === f.sha256) return;
    try {
      let buf;
      try { buf = await bytesOf(urlOf(`${prefix}/${f.path}`, f.rev)); }
      catch (e) { if (!e.challenged) throw e; buf = await bytesOf(urlOf(`${prefix}/${f.path}`, f.rev, CONFIG.fallback)); }
      if (sha256(buf) !== f.sha256) throw new Error("SHA-256 differs from the manifest");
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, buf);
      got++;
    } catch (e) { fails.push(`${f.path}: ${e.message}`); }
  });
  log(`${rel}: ${m.files.length} listed, ${got} fetched into ${path.relative(ROOT, out)}, ${fails.length} failed`);
  return fails;
}

// ---------------------------------------------------------------- mirror (#247)

/** Every manifest entry with the key it has in the bucket: the part of its address after `resolve/`, i.e. <rev>/<level>/<dir>/<path>. */
export function mirrorEntries(root = ROOT) {
  const out = [];
  for (const mf of manifestsUnder(root)) {
    const m = JSON.parse(fs.readFileSync(mf, "utf8"));
    const rel = path.relative(root, path.dirname(mf)).split(path.sep).join("/");
    const prefix = remoteOf(rel + "/x").replace(/\/x$/, "");
    for (const f of m.files) out.push({ ...f, remote: `${prefix}/${f.path}`, key: `${f.rev}/${prefix}/${f.path}` });
  }
  return out;
}
const SECRETS = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET"];
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", webm: "video/webm", mp4: "video/mp4" };

/** The AWS CLI, with the bucket's credentials taken from the environment under the names the repository secrets have.
 *  Its arguments hold the endpoint (an account id), so a failure reports only the service's own error code. */
function aws(sub, args) {
  const env = { ...process.env, AWS_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION: "auto", AWS_PAGER: "" };
  return new Promise((resolve, reject) => {
    execFile("aws", ["s3api", sub, "--endpoint-url", process.env.R2_ENDPOINT, "--bucket", process.env.R2_BUCKET, ...args], { env, maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      const code = /An error occurred \(([A-Za-z0-9]+)\)/.exec(String(stderr))?.[1] || "no error code";
      reject(Object.assign(new Error(`aws ${sub}: ${code}`), { code }));
    });
  });
}
/** Size of the object under `key`, or null when there is none. */
async function sizeAt(key) {
  try { return JSON.parse(await aws("head-object", ["--key", key, "--output", "json"])).ContentLength; }
  catch (e) { if (e.code === "404" || e.code === "NoSuchKey" || e.code === "NotFound") return null; throw e; }
}

/** Put into the bucket what the manifests list and it lacks. An object already there with the manifest's size is left;
 *  one with another size is a conflict (exit 1), never replaced. Nothing is deleted. Bytes come from CONFIG.fallback and are
 *  hashed before they are sent. */
export async function mirror({ dryRun = false, log = console.log } = {}) {
  const missing = SECRETS.filter((n) => !process.env[n]);
  if (missing.length && !dryRun) throw new Error(`missing or empty: ${missing.join(", ")}`);
  const entries = mirrorEntries();
  const res = { listed: entries.length, present: 0, sent: 0, bytes: 0, conflicts: [], failed: [] };
  await pool(entries, 8, async (e) => {
    try {
      const have = dryRun && missing.length ? null : await sizeAt(e.key);
      if (have !== null) {
        if (have === e.bytes) { res.present++; return; }
        res.conflicts.push(`${e.key}: the bucket holds ${have} bytes, the manifest ${e.bytes}`);
        return;
      }
      if (dryRun) { res.sent++; res.bytes += e.bytes; return; }
      const buf = await bytesOf(urlOf(e.remote, e.rev, CONFIG.fallback));
      if (buf.length !== e.bytes || sha256(buf) !== e.sha256) throw new Error("the original's bytes differ from the manifest");
      const tmp = path.join(os.tmpdir(), `mirror-${process.pid}-${e.sha256.slice(0, 16)}`);
      fs.writeFileSync(tmp, buf);
      try {
        await aws("put-object", ["--key", e.key, "--body", tmp, "--content-type", TYPES[path.extname(e.path).slice(1).toLowerCase()] || "application/octet-stream",
          "--cache-control", "public, max-age=31536000, immutable", "--if-none-match", "*"]);
      } catch (err) {
        // Somebody else put it in between: fine if it is the same size, a conflict if not.
        if (err.code !== "PreconditionFailed") throw err;
        const now = await sizeAt(e.key);
        if (now !== e.bytes) { res.conflicts.push(`${e.key}: appeared meanwhile with ${now} bytes, the manifest ${e.bytes}`); return; }
        res.present++; return;
      } finally { fs.rmSync(tmp, { force: true }); }
      res.sent++; res.bytes += e.bytes;
    } catch (err) { res.failed.push(`${e.key}: ${err.message.replace(/https?:\/\/\S+/g, "<url>")}`); }
  });
  log(`${dryRun ? "would mirror" : "mirrored"}: ${res.listed} listed, ${res.present} already there, ${res.sent} ${dryRun ? "to send" : "sent"} (${(res.bytes / 1e6).toFixed(1)} MB), ${res.conflicts.length} conflicts, ${res.failed.length} failed`);
  const lines = [...res.conflicts.map((c) => `conflict ${c}`), ...res.failed.map((c) => `failed ${c}`)];
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Evidence mirror\n\n${res.listed} listed, ${res.present} already there, ${res.sent} sent (${(res.bytes / 1e6).toFixed(1)} MB), ${res.conflicts.length} conflicts, ${res.failed.length} failed\n\n` +
      (lines.length ? "Not in the bucket:\n\n```\n" + lines.slice(0, 100).join("\n") + "\n```\n" : "Everything the manifests list is in the bucket.\n"));
  }
  return lines;
}

// ---------------------------------------------------------------- CLI

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const usage = "usage: evidence.mjs push <dir> | verify [--all] | pull <dir> [--into <out>] | mirror [--dry-run] | verify-store | check";
  try {
    let fails = [];
    if (cmd === "push" && rest[0]) await push(rest[0]);
    else if (cmd === "pull" && rest[0]) fails = await pull(rest[0], { into: rest[1] === "--into" ? rest[2] : undefined });
    else if (cmd === "mirror") fails = await mirror({ dryRun: rest.includes("--dry-run") });
    else if (cmd === "verify-store") fails = await verifyStore();
    else if (cmd === "verify") {
      fails = await verify({ all: rest.includes("--all") });
      if (fails.length) console.error(`base: ${process.env.EVIDENCE_BASE || CONFIG.base}`);
    } else if (cmd === "check") {
      fails = checkTree();
      console.log(fails.length ? `${fails.length} problems` : "evidence folders: manifests well-formed, nothing over 1 MB");
    } else { console.error(usage); process.exit(2); }
    if (fails.length) { console.error(fails.slice(0, 40).join("\n") + (fails.length > 40 ? `\n… and ${fails.length - 40} more` : "")); process.exit(1); }
  } catch (e) { console.error(`evidence: ${e.message}`); process.exit(1); }
}
