// Keeps the screen awake while a passage is played that the visitor only watches (the close of the chapter): a phone
// whose screen turns off in the middle of it puts the page away, and coming back would find the passage over. The wake
// lock is the browser's own (Screen Wake Lock API): it is offered only in a secure context and to a visible page, and
// the system may refuse it (a low battery) or drop it when the page is hidden, asking again each time it is seen. So
// the passage does not depend on it: its clock keeps no time behind a dark screen (rites.js), and the tap that brings
// the page back does not pass over it (game.js).
export function createAwake({ nav = typeof navigator === "undefined" ? null : navigator, doc = typeof document === "undefined" ? null : document } = {}) {
  let wanted = false, asking = false, sentinel = null;
  const ask = async () => {
    if (!wanted || asking || sentinel || !nav?.wakeLock || doc?.hidden) return;
    asking = true;
    let lock = null;
    try { lock = await nav.wakeLock.request("screen"); } catch { lock = null; }   // not offered here, refused by a policy, or the battery says no
    asking = false;
    if (!lock) return;
    if (!wanted) { try { await lock.release?.(); } catch {} return; }              // let go while it was being asked for
    sentinel = lock;
    lock.addEventListener?.("release", () => { sentinel = null; });               // the system took it (the page went away, the battery): the next sight of the page asks again
  };
  doc?.addEventListener?.("visibilitychange", () => { if (!doc.hidden) ask(); });
  return {
    // The passage is running: the screen is needed until it ends.
    hold() { wanted = true; ask(); },
    // The passage is over, or the page is leaving it: the screen keeps its own time again.
    free() { wanted = false; const lock = sentinel; sentinel = null; try { lock?.release?.()?.catch?.(() => {}); } catch {} },
  };
}
