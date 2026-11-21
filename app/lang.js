// The first script on the page: the page as written is Chinese, and here, before the title has been painted, it is
// put into the visitor's language (src/i18n.js), so a Japanese or English visitor never sees it change under them.
// The loading bar (loading.js), a plain script, finds `t` on the window.
import { t, localize, lang, setLang } from "./src/i18n.js";
import { peekRelang, withoutPose } from "./src/relang.js";

localize(document);
// Opened by a change of language in the pause menu (#140): the title is covered by a sheet that says, in the new
// language, that the words are being changed, and the walk comes back as it was once the page is ready (yard.js).
try { if (peekRelang(sessionStorage, { lang })) document.documentElement.classList.add("relang"); } catch {}
window.templeT = t;
// The language buttons on the title and in the menu are bound here, before the walk is built, so that a visitor whose
// browser cannot draw the temple (no WebGL) can still choose the language the message about it is written in. Each
// choice is written in its own language; the one in use is circled in the menu and left off the title. Choosing another
// opens the page again in it (setLang, src/i18n.js, which also notes where the visitor came from for the analytics).
const bindLang = () => document.querySelectorAll("[data-lang]").forEach((b) => {
  const el = /** @type {HTMLElement} */ (b);
  el.setAttribute("aria-pressed", String(el.dataset.lang === lang));
  if (el.closest(".langs")) el.hidden = el.dataset.lang === lang;
  // Chosen in the pause menu, the walk is handed across the reload (yard.js keeps it, src/relang.js); on the title it is not.
  el.addEventListener("click", () => {
    // Where the walk has gone since a link brought him in is the visitor's own; once it is kept, the link's place leaves the
    // address (the language reload would otherwise be read as the link opened afresh, #402). Not kept: the address stays.
    if (el.dataset.lang !== lang && el.closest("#menu") && window.templeRelang?.(el.dataset.lang)) { try { history.replaceState(history.state, "", withoutPose(location.href)); } catch {} }
    setLang(el.dataset.lang);
  });
});
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindLang); else bindLang();
