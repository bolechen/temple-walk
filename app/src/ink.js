// The ink curtain a crossing from one temple to another is made behind (行脚图, #449). Two leaves of ink, one from the
// top and one from the bottom, close over the whole page; the page is then opened again as the other temple's, and the
// curtain it opens on is already shut at the first paint: `html.crossing` is put there by the first script in index.html,
// before anything is built, so that no frame of the title or the half-built place is ever seen. The leaves are the
// pseudo-elements of <html> itself (src/ui.css), so there is nothing to be built before they can be drawn.
//
// closing: `crossing-close` on <html>, the leaves coming together (.7 s; a quick fade with reduced motion);
// shut:    `crossing`, the leaves met, from the first paint of the page that opens;
// opening: `crossing crossing-open`, the leaves drawn back (.9 s) once the temple can be drawn, then all three go.
// This is phase one's plain version; phase two (#450) replaces it with the long scroll of the landscape.
const root = typeof document !== "undefined" ? document.documentElement : null;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** How long each movement takes, in milliseconds: the stylesheet's own durations (src/ui.css), and a margin for a slow frame. */
export const INK = { close: 700, open: 900, quick: 250, margin: 120 };

/** @type {{ closedAt: number | null, openedAt: number | null, arrival: { from: string | null, to: string, ms: number, walkMs: number | null } | null }} */
const seen = { closedAt: null, openedAt: null, arrival: null };

/** Whether the curtain is over the page now: shut, or still being drawn closed. */
export const inkCovered = () => !!root && (root.classList.contains("crossing") && !root.classList.contains("crossing-open") || root.classList.contains("crossing-close"));
/** What the curtain is doing, for the test hooks. */
export const inkState = () => ({
  covered: inkCovered(), closing: !!root?.classList.contains("crossing-close"), shut: !!root?.classList.contains("crossing") && !root.classList.contains("crossing-open"),
  opening: !!root?.classList.contains("crossing-open"), closedAt: seen.closedAt, openedAt: seen.openedAt, arrival: seen.arrival,
});

const after = (ms) => new Promise((r) => setTimeout(r, ms));
/** Close the curtain over the page; resolves when the leaves have met. */
export async function inkClose() {
  if (!root) return;
  root.classList.add("crossing-close");
  await after((reduced() ? INK.quick : INK.close) + INK.margin);
  seen.closedAt = Date.now();
}
/** Draw the curtain back from a page that opened behind it; resolves when it is gone. Does nothing if it was never shut. */
export async function inkOpen() {
  if (!root || !root.classList.contains("crossing")) return false;
  root.classList.add("crossing-open");
  await after((reduced() ? INK.quick : INK.open) + INK.margin);
  root.classList.remove("crossing", "crossing-open", "crossing-close");
  seen.openedAt = Date.now();
  return true;
}
/** Lift the curtain at once: a page that cannot open behind it (a load that failed, a handover that came to nothing). */
export function inkLift() { root?.classList.remove("crossing", "crossing-open", "crossing-close"); }

/**
 * The temple can be drawn: draw the curtain back, and keep how long the crossing took, from the press that began it (the
 * moment the handover was written) to the temple drawn (`ms`) and to the curtain gone and the walk his (`walkMs`), which is
 * what a visitor waits (the measure phase two's scroll is timed from). Resolves with it.
 * @param {{ from: string | null, to: string, at: number }} c
 */
export async function inkArrive(c) {
  const ms = Math.max(0, Date.now() - c.at);
  seen.arrival = { from: c.from, to: c.to, ms, walkMs: null };
  await inkOpen();
  seen.arrival.walkMs = Math.max(0, Date.now() - c.at);
  return seen.arrival;
}
