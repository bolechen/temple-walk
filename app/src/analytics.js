// Milestone events for the public demo. The page view is the Umami script in index.html;
// this only names what a visitor does after that. Nothing is sent from a preview, a test,
// or this machine: the tracker itself also refuses every host but the public one.
import { lang } from "./i18n.js";
const HOST = "temple.rushiwowen.co";

/** What every event carries besides its own: the language the visitor reads the page in. @param {Record<string, string | number | boolean | null | undefined>=} data @param {string=} to */
export const withLang = (data, to = lang) => ({ lang: to, ...(data || {}) });

/** @param {string} name @param {Record<string, string | number | boolean | null | undefined>=} data */
export function track(name, data) {
  try {
    // What was asked is kept (the last hundred), sent or not, so that a test can see which events a page makes.
    const log = (globalThis.__events ||= []); log.push({ name, data: withLang(data) }); if (log.length > 100) log.shift();
    if (globalThis.location?.hostname !== HOST) return false;
    const send = globalThis.window?.umami?.track;
    if (typeof send !== "function") return false;
    /** @type {Record<string, string>} */
    const payload = {};
    for (const [key, value] of Object.entries(withLang(data))) {
      if (value == null || value === "") continue;
      payload[key] = String(typeof value === "boolean" ? Number(value) : value).slice(0, 50);
    }
    send(name, payload);
    return true;
  } catch {
    return false;
  }
}
