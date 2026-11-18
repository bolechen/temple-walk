// Which kind of build this is. `web` is the public page; `steam` and `platform` (other storefronts) carry no way out to
// a page that takes payment. The value is set once, by the build (vite.config.mjs reads VITE_CHANNEL through
// `channelOf` and defines `__CHANNEL__`), and read here and nowhere else: anything that differs by channel asks
// `WEB` (or `CHANNEL`) from this file. The bundler folds the comparison, so the branch it leaves out, and what only it
// imports, is not in the build at all (tests/unit/channel.test.mjs builds each channel and scans dist/).
export const CHANNELS = /** @type {const} */ (["web", "steam", "platform"]);
/** @typedef {(typeof CHANNELS)[number]} Channel */

/** The channel a VITE_CHANNEL value names; unset or empty is the public page. @param {string | undefined | null} raw @returns {Channel} */
export function channelOf(raw) {
  if (raw == null || raw === "") return "web";
  if (!(/** @type {readonly string[]} */ (CHANNELS)).includes(raw)) throw new Error(`VITE_CHANNEL must be one of ${CHANNELS.join(", ")}, not "${raw}"`);
  return /** @type {Channel} */ (raw);
}

/** @type {Channel} */
export const CHANNEL = typeof __CHANNEL__ === "undefined" ? "web" : __CHANNEL__;
/** Whether this is the public web page: the only build with a way to the sponsor page. Written out in full, so that the bundler can fold it. */
export const WEB = typeof __CHANNEL__ === "undefined" || __CHANNEL__ === "web";
