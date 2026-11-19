// Where a build is going to be served: `production` (the public page, built from a version tag), `canary` (what main
// last deployed, an internal address nobody is sent to) or `preview` (one pull request's). The value is set once, by the
// build (vite.config.mjs reads VITE_DEPLOY through `deployOf` and defines `__DEPLOY__`), and read here and nowhere else.
// Only production carries the visitor counter, and only production is let into a search engine; canary opens the debug
// panel by itself, as a preview does. Unset is `preview`: a build nobody named a target for counts nobody and is
// kept out of search, so that forgetting to name production costs a number and never the other way round
// (tests/unit/deploy.test.mjs builds each target and scans dist/; the workflows that publish name theirs).
export const DEPLOYS = /** @type {const} */ (["production", "canary", "preview"]);
/** @typedef {(typeof DEPLOYS)[number]} Deploy */

/** The target a VITE_DEPLOY value names; unset or empty is `preview`. @param {string | undefined | null} raw @returns {Deploy} */
export function deployOf(raw) {
  if (raw == null || raw === "") return "preview";
  if (!(/** @type {readonly string[]} */ (DEPLOYS)).includes(raw)) throw new Error(`VITE_DEPLOY must be one of ${DEPLOYS.join(", ")}, not "${raw}"`);
  return /** @type {Deploy} */ (raw);
}

/** @type {Deploy} */
export const DEPLOY = typeof __DEPLOY__ === "undefined" ? "preview" : __DEPLOY__;
/** The canary Worker's own address (wrangler.canary.jsonc): the debug panel opens there, and only there, never on a test's 127.0.0.1. */
export const CANARY_HOST = /^temple-walk-canary\./;
