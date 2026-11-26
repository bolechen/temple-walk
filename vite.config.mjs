// The page is built by Vite: `pnpm dev` serves app/ with three.js resolved from node_modules, `pnpm build` writes
// the site to dist/, which is what the tests open and what is published.
import { defineConfig } from "vite";
import { channelOf } from "./app/src/channel.js";
import { deployOf } from "./app/src/deploy.js";
import { BENCH_LEVELS, WORKBENCH_LEVELS, levelShipped, workbenchBuild } from "./app/src/bench.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, "app"), dist = path.join(here, "dist");
// What the page fetches by name rather than imports (app/src/assets.js) goes into the site as it lies in app/.
const KEPT = ["shared", "levels", "vendor", "favicon.svg"];
// What the published site must hold for its libraries' licences (docs/t00/LICENSING-AUDIT.md §三.3): the build fails without them.
const NOTICES = "shared/licenses/THIRD-PARTY-NOTICES.txt", LIBRARIES = ["three.js", "meshoptimizer", "qrcode-generator", "lil-gui", "stats.js", "Basis Universal"];
const keep = () => {
  let out = dist;
  return {
    name: "temple-walk:keep-fetched-files", apply: "build",
    configResolved(config) { out = path.resolve(config.root, config.build.outDir); },
    // A level's scripts are bundled into the page, not shipped as files beside it.
    // A level only the testers' builds list (app/src/bench.js, #409) leaves its floor and its doorway pictures out of a
    // production build, as the bundler leaves out its code.
    closeBundle() {
      const away = new Set();
      for (const id of [...BENCH_LEVELS, ...WORKBENCH_LEVELS]) if (!levelShipped(id, deploy)) {
        away.add(path.join(app, "shared", "walk", `${id}.bin`)); const list = path.join(app, "shared", "doorways", `${id}.json`); away.add(list);
        if (fs.existsSync(list)) for (const e of Object.values(JSON.parse(fs.readFileSync(list, "utf8")).halls || {})) for (const f of [e.day, e.night, e.dist, e.in?.day, e.in?.night, e.in?.dist]) if (f) away.add(path.join(app, "shared", "doorways", f));
      }
      // T05's seven figures (#701, 20 MB, fetched by tools/setup.mjs into app/shared/models/t05/) are for the workbench's open doors alone (`?hall=open`, read only on a preview's host name):
      // the canary and production builds do not carry the files, whether or not the machine that builds them has fetched them.
      if (deploy !== "preview") away.add(path.join(app, "shared", "models", "t05"));
      for (const f of KEPT) fs.cpSync(path.join(app, f), path.join(out, f), { recursive: true, filter: (p) => !away.has(p) && !/\.(py|md)$/.test(p) && !(p.includes(`${path.sep}levels${path.sep}`) && (p.endsWith(".js") || p.endsWith(`${path.sep}locales`))) });
      const file = path.join(out, NOTICES), text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      const lacking = LIBRARIES.filter((l) => !text.includes(l));
      if (lacking.length) throw new Error(`${NOTICES} is missing from the build or does not name ${lacking.join(", ")} (run node tools/notices.mjs)`);
      if (!/Apache License/.test(fs.readFileSync(path.join(out, "vendor/basis/LICENSE"), "utf8")) || !fs.existsSync(path.join(out, "vendor/basis/NOTICE"))) throw new Error("vendor/basis must carry Basis Universal's Apache-2.0 LICENSE and its NOTICE (run node tools/setup.mjs --force)");
    },
  };
};

// The build's channel (app/src/channel.js): VITE_CHANNEL=web|steam|platform, web when unset; anything else fails the build.
const channel = channelOf(process.env.VITE_CHANNEL);
// Outside the web build the sponsor page's module is replaced by an empty one, so that neither its code nor the address
// is in the package (the bundler would otherwise still emit the chunk the dead branch used to import).
const channelStub = () => ({
  name: "temple-walk:channel", enforce: /** @type {const} */ ("pre"),
  resolveId(id) { if (channel !== "web" && /(^|\/)donate\.js$/.test(id)) return "\0temple-walk:no-donate"; },
  load(id) { if (id === "\0temple-walk:no-donate") return "export const donateURL = () => \"\"; export const mountOffering = () => {};"; },
});

// Where the build is served (app/src/deploy.js): VITE_DEPLOY=production|canary|preview, preview when unset. Only a
// production page carries the visitor counter; any other says it is not to be indexed, in the page and, for the Worker
// that serves it, as a header.
const deploy = deployOf(process.env.VITE_DEPLOY);
// The headers every Worker that serves this build sends, in one file Cloudflare's static assets read (`_headers`), the same
// for production, canary and preview (#308). What the bundler names by its content (assets/*-<hash>.*) and what is named
// by a fingerprint (the doorways' <hall>.<fp>.*) never changes under its name: a year, immutable. The page and the file that
// says which version it is (version.json) are asked every time. Everything else, fetched by a plain name (shared/'s
// textures, models and baked floor, the fonts, the gallery), keeps the platform's own revalidation with an ETag.
const HEADERS = [
  ["/assets/*", ["Cache-Control: public, max-age=31536000, immutable"]],
  ["/shared/doorways/*.webp", ["Cache-Control: public, max-age=31536000, immutable"]],
  ["/shared/doorways/*.png", ["Cache-Control: public, max-age=31536000, immutable"]],
  ["/", ["Cache-Control: no-cache"]],
  ["/index.html", ["Cache-Control: no-cache"]],
  ["/version.json", ["Cache-Control: no-cache"]],
];
const headersFile = (/** @type {import("./app/src/deploy.js").Deploy} */ target) =>
  [...HEADERS, ...(target === "production" ? [] : [["/*", ["X-Robots-Tag: noindex, nofollow"]]])].map(([p, h]) => `${p}\n${h.map((x) => `  ${x}\n`).join("")}`).join("");
// The page's first script (index.html's `<script data-first>`, the ink curtain's, #449) has to run before the page's stylesheet:
// a script waits for every stylesheet before it, and so would hold back the body of the page (a test reads document.body the
// moment the page commits, and a visitor's first paint waits for the sheet either way). Vite puts the stylesheet and the entry
// script at the head of the page whatever the order of the source, so after it has done so this puts that script ahead of them.
const scriptFirst = () => ({
  name: "temple-walk:script-first",
  transformIndexHtml: { order: /** @type {const} */ ("post"), handler(/** @type {string} */ html) {
    const m = html.match(/<script data-first>[\s\S]*?<\/script>\n?/);
    return m ? html.replace(m[0], "").replace(/(<html[^>]*>\n?)/, `$1${m[0]}`) : html;
  } },
});

const deployPage = () => ({
  name: "temple-walk:deploy",
  transformIndexHtml(/** @type {string} */ html) {
    if (deploy === "production") return html.replace(/<!-- production-only -->|<!-- \/production-only -->/g, "");
    return html.replace(/<!-- production-only -->[\s\S]*?<!-- \/production-only -->\n?/g, "").replace(/(<html[^>]*>\n?)/, '$1<meta name="robots" content="noindex, nofollow">\n');
  },
  writeBundle(/** @type {{ dir?: string }} */ o) { fs.writeFileSync(path.join(o.dir || dist, "_headers"), headersFile(deploy)); },
});

// Which build this is (app/src/version.js, #310): package.json's version; the commit named by VITE_COMMIT (a pull
// request's head, which GITHUB_SHA is not there), else GITHUB_SHA, else what git says here, else none; VITE_PR is the
// pull request a preview is for.
const version = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8")).version;
const commitOf = () => {
  for (const v of [process.env.VITE_COMMIT, process.env.GITHUB_SHA]) if (v && /^[0-9a-f]{7,40}$/.test(v)) return v;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
};
const commit = commitOf(), pr = /^\d+$/.test(process.env.VITE_PR || "") ? process.env.VITE_PR : "";
// The same three, written beside the page as version.json: an open page asks it, now and then, whether a newer build
// has been put up since it was loaded (app/src/version.js, #310).
const versionFile = () => ({
  name: "temple-walk:version", apply: /** @type {const} */ ("build"),
  generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version, commit, deploy }) + "\n" }); },
});

export default defineConfig({
  define: { __CHANNEL__: JSON.stringify(channel), __DEPLOY__: JSON.stringify(deploy), __WORKBENCH__: JSON.stringify(workbenchBuild(deploy) && process.env.VITE_NO_WORKBENCH !== "1"), __VERSION__: JSON.stringify(version), __COMMIT__: JSON.stringify(commit), __PR__: JSON.stringify(pr) },
  root: app, base: "./", publicDir: false, cacheDir: path.join(here, "node_modules/.vite"), plugins: [channelStub(), deployPage(), scriptFirst(), versionFile(), keep()],
  server: { host: "127.0.0.1", port: 8000 }, preview: { host: "127.0.0.1", port: 8000 },
  build: { outDir: dist, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 2000 },
});
