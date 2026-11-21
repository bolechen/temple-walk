// The line at the foot of the title page (#445): where this temple is and what kind of road leads up to it, as the
// level gives it (Level.how: { place, line }, in Chinese, passed through t() where it is shown). A level that gives
// nothing has nothing, so a later temple never wears the prologue's words.
/** @param {{ how?: { place?: string, line?: string } } | null | undefined} level @returns {{ place: string, line: string } | null} */
export function titleHow(level) {
  const h = level?.how;
  if (!h || (!h.place && !h.line)) return null;
  return { place: h.place || "", line: h.line || "" };
}
