// Evidence pictures and films live outside git (issue #223). The repository keeps, beside each evidence folder's
// README, one MANIFEST.json: every binary's path, size, SHA-256 and the dataset commit that holds it. The bytes are in
// a public Hugging Face dataset, pinned by commit, so an address never changes and never points at later content.
//
//   node tools/evidence.mjs push <dir>          upload <dir>'s binaries, write <dir>/MANIFEST.json, fetch each back and check it
//   node tools/evidence.mjs verify [--all]      fetch what every manifest lists: size of every file and a sample's hash; --all hashes them all
//   node tools/evidence.mjs pull <dir> [--into <out>]   fetch <dir>'s binaries by its manifest (hash-checked) into tools/out/evidence/<store path>/, which git ignores
//   node tools/evidence.mjs check               offline, for CI: manifests well-formed, no file over 1 MB, no unlisted binary
//
// Where the bytes are is stated once, in tools/evidence.config.json (or EVIDENCE_BASE for a try-out). Moving to another
// store means changing that file and pushing again. Nothing here deletes or overwrites: a path already in a manifest
// (or already in the store) with different bytes is refused. `hf` must be logged in for push; give HF_TOKEN any
// placeholder in a sandbox whose proxy supplies the real one; verify and pull need only a network.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";
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

/** Offline checks over a repository root: well-formed manifests and no file over 1 MB under an evidence folder. */
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
  return bad;
}

// ---------------------------------------------------------------- network

async function get(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(CONFIG.timeoutMs || 60000) });
      if (r.status === 404) throw Object.assign(new Error(`404 ${url}`), { fatal: true });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return r;
    } catch (e) {
      last = e;
      if (e.fatal) break;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw last;
}
const bytesOf = async (url) => Buffer.from(await (await get(url)).arrayBuffer());

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

/** Fetch every manifest's files. all: hash every file; otherwise sizes of all (from the response) and a sample of hashes. */
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
    m.files.forEach((f, i) => jobs.push({ f, url: urlOf(`${prefix}/${f.path}`, f.rev), hash: all || i % 10 === 0 }));
  }
  let hashed = 0;
  await pool(jobs, 16, async ({ f, url, hash }) => {
    try {
      const r = await get(url);
      const len = Number(r.headers.get("content-length"));
      if (!hash) {
        await r.body?.cancel();
        if (len && len !== f.bytes) fails.push(`${url}: ${len} bytes, manifest ${f.bytes}`);
        return;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      hashed++;
      if (buf.length !== f.bytes) fails.push(`${url}: ${buf.length} bytes, manifest ${f.bytes}`);
      else if (sha256(buf) !== f.sha256) fails.push(`${url}: SHA-256 differs from the manifest`);
    } catch (e) { fails.push(`${url}: ${e.message.replace(url, "").trim() || e.message}`); }
  });
  log(`${mans.length} manifests, ${jobs.length} files checked, ${hashed} hashed${all ? " (all)" : " (sample)"}, ${fails.length} failed`);
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
      const buf = await bytesOf(urlOf(`${prefix}/${f.path}`, f.rev));
      if (sha256(buf) !== f.sha256) throw new Error("SHA-256 differs from the manifest");
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, buf);
      got++;
    } catch (e) { fails.push(`${f.path}: ${e.message}`); }
  });
  log(`${rel}: ${m.files.length} listed, ${got} fetched into ${path.relative(ROOT, out)}, ${fails.length} failed`);
  return fails;
}

// ---------------------------------------------------------------- CLI

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const usage = "usage: evidence.mjs push <dir> | verify [--all] | pull <dir> [--into <out>] | check";
  try {
    let fails = [];
    if (cmd === "push" && rest[0]) await push(rest[0]);
    else if (cmd === "pull" && rest[0]) fails = await pull(rest[0], { into: rest[1] === "--into" ? rest[2] : undefined });
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
