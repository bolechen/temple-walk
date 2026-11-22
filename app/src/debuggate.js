// Who may open the debug panel (src/debug.js). On the dev server and a pull request's preview it opens by itself, and
// ?debug=0 keeps it shut. On the canary (the internal address main is deployed to, the only build served from a
// *.workers.dev address that is not a preview) it opens only when the address asks for it with ?debug=1: testers
// reporting what they saw there need the place's own link and the floor's drawing (the owner, 2026-11-20). The public
// page, served only from its own domain, never opens it. The workbench addresses (?seals, ?at, ?play, ?devpose) stay a
// preview's. Read from the hostname, not the build's target, so that the canary's code stays production's byte for byte
// (tests/unit/deploy.test.mjs).
/** @param {{ dev: boolean, hostname: string, search: string }} o */
export function debugGate({ dev, hostname, search }) {
  const q = new URLSearchParams(search), preview = /-temple-walk-preview\./.test(hostname);
  if (dev || preview) return q.get("debug") !== "0";
  return /\.workers\.dev$/.test(hostname) && q.get("debug") === "1";
}

/** Whether this page is the workbench's: the dev server or a pull request's preview (never the canary nor the public
 *  page). The workbench addresses (?seals, ?at, ?play, ?terrain) are read only here. @param {{ dev: boolean, hostname: string }} o */
export const onBench = ({ dev, hostname }) => !!dev || /-temple-walk-preview\./.test(hostname);
