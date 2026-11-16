// Milestone events for the public demo. The page view is the Umami script in index.html;
// this only names what a visitor does after that. Nothing is sent from a preview, a test,
// or this machine: the tracker itself also refuses every host but the public one.
const HOST = "temple.rushiwowen.co";

/** @param {string} name @param {Record<string, string | number | boolean | null | undefined>=} data */
export function track(name, data) {
  try {
    if (globalThis.location?.hostname !== HOST) return false;
    const send = globalThis.window?.umami?.track;
    if (typeof send !== "function") return false;
    /** @type {Record<string, string>} */
    const payload = {};
    for (const [key, value] of Object.entries(data || {})) {
      if (value == null || value === "") continue;
      payload[key] = String(typeof value === "boolean" ? Number(value) : value).slice(0, 50);
    }
    send(name, payload);
    return true;
  } catch {
    return false;
  }
}
