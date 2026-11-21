// Whether every hall the page wants to show through its door has its pictures in place, faded in, or has given up on
// them (no pictures baked, or the fetch failed): what a picture tool waits for before it takes the picture (#373).
// `r` is what the page's __doorways() reports (app/src/doorway.js, report()); null when the page has no doorways.
// Self-contained, so that a tool can hand its source to the page: page.waitForFunction(`(${doorwaysReady})(window.__doorways?.())`).
function doorwaysReady(r) {
  if (!r || !r.halls) return true;
  return Object.values(r.halls).every((h) => !h.want || (h.source === "baked" && h.fade === 1) || h.source === "none" || h.source === "failed");
}
module.exports = { doorwaysReady };
