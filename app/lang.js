// The first script on the page: the page as written is Chinese, and here, before the title has been painted, it is
// put into the visitor's language (src/i18n.js), so a Japanese or English visitor never sees it change under them.
// The loading bar (loading.js), a plain script, finds `t` on the window.
import { t, localize, lang, setLang } from "./src/i18n.js";

localize(document);
window.templeT = t;
const bindLang = () => document.querySelectorAll("[data-lang]").forEach((b) => { const el = /** @type {HTMLElement} */ (b); el.setAttribute("aria-pressed", String(el.dataset.lang === lang)); if (el.closest(".langs")) el.hidden = el.dataset.lang === lang; el.addEventListener("click", () => { setLang(el.dataset.lang); location.reload(); }); }); if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindLang); else bindLang();
