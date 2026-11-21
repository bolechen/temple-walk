// What lies over the picture, and in what order. Everything that opens over the walk is a layer on one stack: a sheet
// that asks for the whole of the visitor's attention (the pause menu, the book, a photograph just taken, a work read
// closely, a slip of paper) is a "modal"; a small card or panel at the edge that the walk carries on under (the keys,
// the season and hour, the photograph's settings) is a "panel"; a way of looking that changes what the controls mean
// (the raised camera) is a "mode". Esc always puts away the one on top, and only when nothing is open does it bring
// the pause menu. While a modal is open nothing behind it answers: the walk stands still, the pointer is let go, keys
// other than its own are not heard, and the page behind is made inert, so a click or the wheel lands on the sheet.
//
// A modal is a <dialog> opened with showModal(), which gives the top of the page, the inert page behind and keyboard
// focus kept inside without anything of ours. Its `hidden` attribute is kept in step with whether it is open, because
// the tests and the rest of the page read that; where showModal is missing the sheet still shows as a plain overlay.
const $ = (id) => document.getElementById(id);
const KINDS = new Set(["modal", "panel", "mode"]);

export function createUI() {
  const layers = new Map(), stack = [];

  // `opts`: kind; `show(entry)` / `hide(entry)` to open and close it (by default the element's `hidden`, and for a
  // modal showModal() and close()); `confirm`, the id of the button that E or Enter presses while it is on top;
  // `keys`, other keys it answers ({ b: "bookClose" }); `release`, whether the pointer is let go when it opens
  // (always for a modal); `returnFocus`, the id that is given the focus when it closes, instead of what had it.
  function layer(id, opts = {}) {
    const kind = opts.kind || "modal"; if (!KINDS.has(kind)) throw new Error(`ui: unknown kind of layer "${kind}"`);
    const el = opts.el === null ? null : $(id), L = { id, el, kind, ...opts };
    if (el && kind === "modal" && el.tagName === "DIALOG") {
      if (!el.hasAttribute("tabindex")) el.tabIndex = -1;   // the sheet itself takes the focus, so no button is ringed on opening
      el.addEventListener("cancel", (e) => e.preventDefault());   // Esc is ours: it is heard on keydown and closes the top layer only
      // shut by the browser some other way. A dialog tells of its shutting a task after close(), so Esc and an opening a few milliseconds later
      // (B after Esc) would find the event arriving at the new opening: only a sheet that is shut now is put away.
      el.addEventListener("close", () => { if (!(/** @type {HTMLDialogElement} */ (el)).open && stack.some((s) => s.layer === L)) close(id); });
    }
    layers.set(id, L); return api;
  }
  const entry = (id) => stack.find((s) => s.layer.id === id);
  const isOpen = (id) => !!entry(id);

  function open(id, per = {}) {
    const L = layers.get(id); if (!L) throw new Error(`ui: no layer "${id}"`);
    const was = entry(id); if (was) { Object.assign(was, per); return false; }   // already open: only what this opening asked for is taken up
    const e = { layer: L, opener: document.activeElement, ...per };
    if (L.kind === "modal" || L.release) document.exitPointerLock?.();
    stack.push(e);
    if (L.show) L.show(e);
    else if (L.el) {
      L.el.hidden = false;
      if (L.kind === "modal" && typeof L.el.showModal === "function" && !L.el.open) {
        try { L.el.showModal(); L.el.focus({ preventScroll: true }); } catch {}   // not in the document, or already open some other way: it still shows
      }
    }
    return true;
  }
  // Closes `id` and whatever was opened over it, the topmost first. Without an id, the top layer. Each closing runs
  // the layer's own `hide`, then the `onClose` handed to that opening (so a slip that is put away by Esc is still
  // "taken"), then gives the focus back.
  function close(id) {
    const i = id ? stack.findIndex((s) => s.layer.id === id) : stack.length - 1; if (i < 0) return false;
    while (stack.length > i) {
      const e = stack.pop(), L = e.layer;
      if (L.hide) L.hide(e);
      else if (L.el) { if (L.el.open) { try { L.el.close(); } catch {} } L.el.hidden = true; }
      try { e.onClose?.(e); } catch (err) { console.error(err); }
      const back = (L.returnFocus && $(L.returnFocus)) || e.opener;
      if (L.kind !== "mode" && back && back !== document.body && back.isConnected && back.offsetParent !== null) back.focus?.({ preventScroll: true });
      else if (document.activeElement && L.el?.contains(document.activeElement)) /** @type {HTMLElement} */ (document.activeElement).blur();
    }
    return true;
  }
  const toggle = (id, per) => (isOpen(id) ? (close(id), false) : open(id, per));
  const top = () => stack[stack.length - 1]?.layer.id || null;
  const topModal = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].layer.kind === "modal") return stack[i].layer; return null; };

  // Heard first on every keydown. Returns true when the key was a layer's, and then the walk must not hear it.
  function key(ev) {
    const k = ev.key.toLowerCase();
    if (k === "escape") { if (!stack.length) return false; ev.preventDefault(); close(); return true; }
    const L = topModal(); if (!L) return false;
    if (k === "tab") return true;   // the browser moves the focus among the sheet's own buttons
    const t = ev.target, own = t && t !== L.el && L.el?.contains(t) && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    if ((k === "enter" || k === " ") && own) return true;   // a focused button presses itself
    const press = (bid) => { const b = /** @type {HTMLButtonElement | null} */ (bid && $(bid)); if (b && !b.disabled && b.offsetParent !== null) { b.click(); return true; } return false; };
    if ((k === "e" || k === "enter" || k === " ") && press(L.confirm)) { ev.preventDefault(); return true; }
    if (L.keys && L.keys[k]) { press(L.keys[k]); ev.preventDefault(); }
    return true;   // nothing behind an open sheet answers a key
  }

  const api = {
    layer, open, close, toggle, isOpen, key, top,
    modal: () => !!topModal(),                                             // the walk stands still
    covered: () => stack.some((s) => s.layer.kind !== "mode"),            // nothing new starts: no jump, no hop down
    state: () => stack.map((s) => s.layer.id),
  };
  return api;
}
