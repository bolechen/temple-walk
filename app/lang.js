// The first script on the page: the page as written is Chinese, and here, before the title has been painted, it is
// put into the visitor's language (src/i18n.js), so a Japanese or English visitor never sees it change under them.
// The loading bar (loading.js), a plain script, finds `t` on the window.
import { t, localize, lang, setLang } from "./src/i18n.js";

localize(document);
window.templeT = t;
// The language buttons on the title and in the menu are bound here, before the walk is built, so that a visitor whose
// browser cannot draw the temple (no WebGL) can still choose the language the message about it is written in. Each
// choice is written in its own language; the one in use is circled in the menu and left off the title. Choosing another
// opens the page again in it (setLang, src/i18n.js, which also notes where the visitor came from for the analytics).
const bindLang = () => document.querySelectorAll("[data-lang]").forEach((b) => {
  const el = /** @type {HTMLElement} */ (b);
  el.setAttribute("aria-pressed", String(el.dataset.lang === lang));
  if (el.closest(".langs")) el.hidden = el.dataset.lang === lang;
  el.addEventListener("click", () => setLang(el.dataset.lang));
});
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindLang); else bindLang();
