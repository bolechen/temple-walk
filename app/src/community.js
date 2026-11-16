// The beta feedback group's invitation. The QR code is never committed: it and a small JSON that points at it live in
// R2 (bucket buddhist-say, served from static.rushiwowen.co), so a new code is one upload, not a release. The JSON is
// read when the card is opened; it may close the invitation, and the code is hidden from its expiry onwards.
export const COMMUNITY_CONFIG_URL = "https://static.rushiwowen.co/temple-walk/community/current.json";

export function readCommunityConfig(data, base, now = Date.now()) {
  if (!data || typeof data !== "object") throw new Error("Invalid community configuration");
  if (data.enabled === false) return { state: "closed" };
  if (data.enabled !== true || typeof data.image !== "string" || !data.image.trim() || typeof data.expiresAt !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.expiresAt)) throw new Error("Invalid community configuration");
  const expiresAt = Date.parse(data.expiresAt);
  if (!Number.isFinite(expiresAt)) throw new Error("Invalid community expiry");
  if (expiresAt <= now) return { state: "expired" };
  const image = new URL(data.image, base);
  if (!["https:", "http:"].includes(image.protocol)) throw new Error("Invalid community image");
  return { state: "ready", image: image.href, expiresAt };
}

export function createCommunity(ui) {
  const source = new URL(import.meta.env.VITE_COMMUNITY_CONFIG_URL || COMMUNITY_CONFIG_URL, document.baseURI).href;
  const element = (id) => document.getElementById(id);
  const image = /** @type {HTMLImageElement} */ (element("communityImage"));
  const original = /** @type {HTMLAnchorElement} */ (element("communityOriginal"));
  const imageLink = /** @type {HTMLAnchorElement} */ (element("communityImageLink"));
  const status = element("communityStatus"), help = element("communityHelp"), retry = element("communityRetry");
  let request = null, expiryTimer = null, timeout = null;

  function clear() {
    request?.abort(); request = null;
    clearTimeout(expiryTimer); clearTimeout(timeout);
    image.onload = image.onerror = null;
    image.removeAttribute("src"); original.removeAttribute("href"); imageLink.removeAttribute("href");
    imageLink.hidden = original.hidden = help.hidden = true;
  }

  function message(text, canRetry = false) {
    status.textContent = text; status.hidden = false; retry.hidden = !canRetry;
    imageLink.hidden = original.hidden = help.hidden = true;
    original.removeAttribute("href"); imageLink.removeAttribute("href");
  }

  async function load() {
    clear(); message("群二维码正在加载");
    const pending = new AbortController(); request = pending;
    timeout = setTimeout(() => pending.abort(), 8000);
    try {
      const response = await fetch(source, { cache: "no-store", signal: pending.signal });
      if (!response.ok) throw new Error("Community configuration unavailable");
      const config = readCommunityConfig(await response.json(), response.url || source);
      if (request !== pending || !ui.isOpen("community")) return;
      if (config.state !== "ready") { clearTimeout(timeout); message("群二维码正在更新，请稍后再来", true); return; }
      image.onload = () => {
        if (request !== pending || !ui.isOpen("community")) return;
        clearTimeout(timeout);
        if (Date.now() >= config.expiresAt) { clear(); message("群二维码正在更新，请稍后再来", true); return; }
        imageLink.href = original.href = config.image;
        imageLink.hidden = original.hidden = help.hidden = false; status.hidden = true; retry.hidden = true;
        element("communityExpiry").textContent = `请在 ${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric" }).format(config.expiresAt)}前加入`;
      };
      image.onerror = () => { if (request === pending) { clear(); message("二维码暂时无法加载，请重试", true); } };
      image.src = config.image;
      const remaining = config.expiresAt - Date.now();
      expiryTimer = setTimeout(() => { if (request === pending) { clear(); message("群二维码正在更新，请稍后再来", true); } }, Math.min(Math.max(0, remaining), 2147483647));
    } catch {
      if (request === pending && ui.isOpen("community")) { clear(); message("二维码暂时无法加载，请重试", true); }
    }
  }

  ui.layer("community", { kind: "modal" });
  element("community").addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || ui.top() !== "community") return;
    event.preventDefault(); event.stopPropagation(); ui.close("community");
  });
  const open = () => { if (ui.open("community", { onClose: clear })) load(); };
  element("titleCommunity").hidden = element("menuCommunityInvite").hidden = false;
  element("titleCommunity").addEventListener("click", open);
  element("menuCommunity").addEventListener("click", open);
  element("communityClose").addEventListener("click", () => ui.close("community"));
  retry.addEventListener("click", load);
}
