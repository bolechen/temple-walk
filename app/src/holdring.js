// The ring that is drawn while something is held down (#473; the owner's art review of 2026-11-21). One mark for every
// place that asks the visitor to hold: the close of the chapter, where holding passes it over, and the line that opens
// the walking map. It is the interface's own one-breath ring (`--enso-light`, paper.js) laid over a conic gradient that
// uncovers it clockwise from twelve; what is not yet drawn stays at a fifth of the ink. At rest there is no ring at all:
// it floats up in a tenth of a second when the press begins and fades in a fifth when it ends. With reduced motion
// nothing sweeps: the whole ring comes up from a fifth to full over the time of the hold.
//
// The host gives an element holding `.mark` (made when missing) and, if it likes, a word beside it; the host decides
// what the press and the time are, and says `press()`, `progress(k)` and `release()`. A host that wants no ring (a
// tap is enough) simply never calls `press()`.
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** @param {HTMLElement} host */
export function createHoldRing(host) {
  let mark = /** @type {HTMLElement | null} */ (host.querySelector(".mark"));
  if (!mark) { mark = document.createElement("span"); mark.className = "mark"; mark.setAttribute("aria-hidden", "true"); host.append(mark); }
  host.classList.add("holdring");
  host.setAttribute("role", "progressbar"); host.setAttribute("aria-valuemin", "0"); host.setAttribute("aria-valuemax", "100"); host.setAttribute("aria-valuenow", "0");
  let calm = false, said = -1;
  const draw = (k) => {
    k = Math.min(1, Math.max(0, k));
    mark.style.setProperty("--k", calm ? "1" : String(k));
    mark.style.opacity = host.classList.contains("held") ? (calm ? String(0.2 + 0.8 * k) : "") : "";
    const v = Math.round(k * 10) * 10; if (v !== said) { said = v; host.setAttribute("aria-valuenow", String(v)); }
  };
  return {
    // A press has begun.
    press() { calm = reduced(); host.classList.toggle("calm", calm); host.classList.add("held"); draw(0); },
    // How much of the hold is done, from 0 to 1.
    progress: draw,
    // The press has ended, or the hold is complete: the ring goes.
    release() { host.classList.remove("held"); draw(0); },
    get held() { return host.classList.contains("held"); },
    get value() { return said; },
  };
}
