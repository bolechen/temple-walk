// The first script on the page: the page as written is Chinese, and here, before the title has been painted, it is
// put into the visitor's language (src/i18n.js), so a Japanese or English visitor never sees it change under them.
// The loading bar (loading.js), a plain script, finds `t` on the window.
import { t, localize } from "./src/i18n.js";

localize(document);
window.templeT = t;
