// The page is built by Vite: `pnpm dev` serves app/ with three.js resolved from node_modules, `pnpm build` writes
// the site to dist/, which is what the tests open and what is published.
import { defineConfig } from "vite";
import { channelOf } from "./app/src/channel.js";
import { deployOf } from "./app/src/deploy.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, "app"), dist = path.join(here, "dist");
// What the page fetches by name rather than imports (app/src/assets.js) goes into the site as it lies in app/.
const KEPT = ["shared", "levels", "vendor", "favicon.svg"];
// What the published site must hold for its libraries' licences (docs/t00/LICENSING-AUDIT.md §三.3): the build fails without them.
const NOTICES = "shared/licenses/THIRD-PARTY-NOTICES.txt", LIBRARIES = ["three.js", "meshoptimizer", "lil-gui", "stats.js", "Basis Universal"];
const keep = () => {
  let out = dist;
  return {
    name: "temple-walk:keep-fetched-files", apply: "build",
    configResolved(config) { out = path.resolve(config.root, config.build.outDir); },
    // A level's scripts are bundled into the page, not shipped as files beside it.
    closeBundle() {
      for (const f of KEPT) fs.cpSync(path.join(app, f), path.join(out, f), { recursive: true, filter: (p) => !/\.(py|md)$/.test(p) && !(p.includes(`${path.sep}levels${path.sep}`) && (p.endsWith(".js") || p.endsWith(`${path.sep}locales`))) });
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

// Where the build is served (app/src/deploy.js): VITE_DEPLOY=production|canary|preview, preview when unset.
const deploy = deployOf(process.env.VITE_DEPLOY);
// Which build this is (app/src/version.js, #310): package.json's version; the commit named by VITE_COMMIT (a pull
// request's head, which GITHUB_SHA is not there), else GITHUB_SHA, else what git says here, else none; VITE_PR is the
// pull request a preview is for.
const version = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8")).version;
const commitOf = () => {
  for (const v of [process.env.VITE_COMMIT, process.env.GITHUB_SHA]) if (v && /^[0-9a-f]{7,40}$/.test(v)) return v;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
};
const commit = commitOf(), pr = /^\d+$/.test(process.env.VITE_PR || "") ? process.env.VITE_PR : "";

export default defineConfig({
  define: { __CHANNEL__: JSON.stringify(channel), __DEPLOY__: JSON.stringify(deploy), __VERSION__: JSON.stringify(version), __COMMIT__: JSON.stringify(commit), __PR__: JSON.stringify(pr) },
  root: app, base: "./", publicDir: false, cacheDir: path.join(here, "node_modules/.vite"), plugins: [channelStub(), keep()],
  server: { host: "127.0.0.1", port: 8000 }, preview: { host: "127.0.0.1", port: 8000 },
  build: { outDir: dist, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 2000 },
});
