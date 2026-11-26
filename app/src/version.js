// The line that says which build the visitor is walking in: at the foot of the pause menu and at the end of the
// thanks (#310), small and quiet, never over the walk. On the public page it is the version; on the internal address
// and a pull request's preview, the commit, so that a report can say exactly what was played.
import { t } from "./i18n.js";
import { saidNow } from "./temple.js";
import { asset } from "./assets.js";
import { DEPLOY } from "./deploy.js";

// What the build was made from (vite.config.mjs defines them; absent when the sources are run in Node): package.json's
// version, the full commit (VITE_COMMIT, else GITHUB_SHA, else git, else none) and the pull request a preview is for.
export const VERSION = typeof __VERSION__ === "undefined" ? "" : __VERSION__;
export const COMMIT = typeof __COMMIT__ === "undefined" ? "" : __COMMIT__;
export const PR = typeof __PR__ === "undefined" ? "" : __PR__;

/** The line for a build. The public page says only its version, which is the tag a visitor can name; the commit is for
 *  the canary and a preview (the lead's choice, 2026-11-20, #310). @param {{ deploy?: string, version?: string, commit?: string, pr?: string, to?: string }} [o] */
export function versionLine({ deploy = DEPLOY, version = VERSION, commit = COMMIT, pr = PR, to } = {}) {
  const c = commit.slice(0, 7) || "?";
  if (deploy === "canary") return t("内测版 · {c}", { c }, to);
  if (deploy === "preview") return pr ? t("预览 · PR #{pr} · {c}", { pr, c }, to) : t("预览 · {c}", { c }, to);
  return saidNow("云径禅寺 v{v}", { v: version }, to);
}

/** Writes the line into the page's places for it, and lays the hook. @param {Document} doc */
export function mountVersion(doc) {
  const line = versionLine();
  for (const id of ["menuVersion", "creditsVersion"]) { const el = doc.getElementById(id); if (el) el.textContent = line; }
  window.__version = () => ({ version: VERSION, commit: COMMIT, deploy: DEPLOY, pr: PR, line });
}

/** Whether what version.json says is a build other than this page's: a commit on both sides, and not the same one. */
export const newBuild = (remote, own = COMMIT) => !!(remote && typeof remote.commit === "string" && remote.commit && own && remote.commit !== own);

/** A page left open does not know that a newer build has been put up since (the published files are revalidated on
 *  every load, so a reload always brings it). When the page comes back to the front, and every ten minutes, version.json
 *  is asked for past every cache; once it names another commit, the line at the foot says so, once, when nothing is
 *  being made or watched (`busy`). Nothing reloads by itself. A failed ask is no news.
 *  @param {{ own?: string, url?: string, get?: (url: string) => Promise<any>, say: () => boolean, busy?: () => boolean, every?: number, doc?: any, win?: any }} o */
export function watchVersion({ own = COMMIT, url = asset("version.json"), get = (u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)), say, busy = () => false, every = 600000, doc = document, win = window }) {
  let found = "", told = false, asking = false, asked = 0;
  const tell = () => { if (found && !told && !busy() && say()) told = true; };
  const ask = async () => {
    if (found || asking || !own) return;
    asking = true; asked++;
    try { const r = await get(url); if (newBuild(r, own)) found = r.commit; } catch { /* no news */ } finally { asking = false; }
    tell();
  };
  const seen = () => { if (doc.visibilityState === "visible") ask(); };
  doc.addEventListener("visibilitychange", seen);
  const a = win.setInterval(ask, every), b = win.setInterval(tell, 2000);
  return { ask, tell, state: () => ({ found, told, asked }), stop() { doc.removeEventListener("visibilitychange", seen); win.clearInterval(a); win.clearInterval(b); } };
}
