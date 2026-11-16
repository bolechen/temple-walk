// The page is built by Vite: `pnpm dev` serves app/ with three.js resolved from node_modules, `pnpm build` writes
// the site to dist/, which is what the tests open and what is published.
import { defineConfig } from "vite";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, "app"), dist = path.join(here, "dist");
// What the page fetches by name rather than imports (app/src/assets.js) goes into the site as it lies in app/.
const KEPT = ["shared", "levels", "vendor", "favicon.svg"];
const keep = () => ({
  name: "temple-walk:keep-fetched-files", apply: "build",
  // A level's scripts are bundled into the page, not shipped as files beside it.
  closeBundle() { for (const f of KEPT) fs.cpSync(path.join(app, f), path.join(dist, f), { recursive: true, filter: (p) => !/\.(py|md)$/.test(p) && !(p.includes(`${path.sep}levels${path.sep}`) && (p.endsWith(".js") || p.endsWith(`${path.sep}locales`))) }); },
});

export default defineConfig({
  root: app, base: "./", publicDir: false, cacheDir: path.join(here, "node_modules/.vite"), plugins: [keep()],
  server: { host: "127.0.0.1", port: 8000 }, preview: { host: "127.0.0.1", port: 8000 },
  build: { outDir: dist, emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 2000 },
});
