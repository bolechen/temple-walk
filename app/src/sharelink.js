// The address a shared picture carries (#344): the page itself, with where it was shared from and which scene it
// shows, so that a friend who opens it is brought to that scene once the opening has shown the mountain. Only the
// names below are honoured; anything else in `?from=` is no scene at all.
/** The scenes a link may name: the seven observances, the book of seals, a photograph. */
export const FROM = ["bell", "tea", "incense", "sutra", "well", "lamp", "sit", "goshuin", "photo"];
/** The scene an address names, or null. @param {string} search */
export function fromOf(search) {
  try { const v = new URLSearchParams(search).get("from"); return v && FROM.includes(v) ? v : null; } catch { return null; }
}
/** The address to share for a scene. `content` says what was shared (the book, a photograph), for the campaign's records.
 *  @param {string} page the page's own address @param {string} from @param {string} content */
export function shareURL(page, from, content) {
  const u = new URL(page); u.search = ""; u.hash = "";
  if (FROM.includes(from)) u.searchParams.set("from", from);
  u.searchParams.set("utm_source", "share"); u.searchParams.set("utm_medium", "game"); u.searchParams.set("utm_content", content);
  return u.href;
}
