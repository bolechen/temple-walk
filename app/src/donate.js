// The way from the 功德箱 to the sponsor page, in the web build only (src/channel.js: game.js imports this file
// only when `WEB`, so the other builds hold neither this code nor the address). The game takes no money and holds no
// payment code: the page it points to is 如是我闻's own 护持 page, which says what the money is for. The address, its
// language path and its campaign tags are written here and nowhere else (tests/unit/offering.test.mjs holds the shape).
import { t } from "./i18n.js";

export const DONATE_ORIGIN = "https://rushiwowen.co";
// The sponsor page has pages in Chinese (no prefix), English and Japanese; a Korean reader is sent to the English one.
const PATH = { zh: "/donate", en: "/en/donate", ja: "/ja/donate", ko: "/en/donate" };
const UTM = { utm_source: "temple-walk", utm_medium: "game", utm_campaign: "offering-box" };

/** The address of the sponsor page for a language, with the standard campaign tags and (by default) the language as content. @param {string} lang @param {string} [content] */
export function donateURL(lang, content = lang) {
  const u = new URL(PATH[/** @type {keyof typeof PATH} */ (lang)] || PATH.en, DONATE_ORIGIN);
  for (const [k, v] of Object.entries({ ...UTM, utm_content: content })) u.searchParams.set(k, v);
  return u.href;
}

// The owner's WeChat payment code, as the sponsor page shows it (docs/t00/asset-register.csv: its source, its hash, and that it
// must change when the sponsor page's does). It lies outside the folders the build copies whole, and is named only here, so that
// only a build that holds this file (the web build) holds the picture. WeChat pays only inside China: the Chinese interface shows
// it and the others do not.
const QR = new URL("../web/wechat-support-2026-08-28.jpg", import.meta.url).href;
/** Whether the code is on the sheet when it opens (the owner's call, 2026-11-18); false folds it under 微信赞赏 until pressed. */
export const QR_OPEN = true;
/** Whether the sheet carries the payment code in this language. @param {string} lang */
export const qrFor = (lang) => lang === "zh";

/**
 * The sheet of paper that follows a coin: what the coin was, what the link is for, and in Chinese the code to scan, one
 * button to put it away. Built here, not in index.html, so that the other builds have no such element. `onOpen` runs when
 * a link to the sponsor page is pressed (the visit's place is kept first: a browser that will not open a new tab goes to the
 * page in this one, and he is still standing here when it comes back). `onQr` runs once, when the code is on the sheet and seen.
 * @param {{ ui: any, lang: string, onOpen: () => void, onQr?: () => void }} o
 * @returns {{ qr: boolean, opened: () => void }} `opened` is called when the sheet has been opened
 */
export function mountOffering({ ui, lang, onOpen, onQr = () => {} }) {
  const qr = qrFor(lang), coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const d = document.createElement("dialog");
  d.className = "layer"; d.id = "offering"; d.hidden = true; d.setAttribute("aria-labelledby", "offeringTitle");
  const code = qr ? `<section class="offering-qr" id="offeringQr"><figure><img id="offeringQrImg" width="240" height="240" decoding="async"></figure>
    <p id="offeringScan"></p><p id="offeringHow" class="offering-how"></p><p><a class="tap" id="offeringReg" target="_blank" rel="noopener"></a></p></section>` : "";
  d.innerHTML = `<div class="offering-card paper scrolls"><h2 id="offeringTitle"></h2><p id="offeringCoin"></p><p id="offeringAsk"></p>
    <div class="offering-go"><a class="stamp" id="offeringGo" target="_blank" rel="noopener"></a></div>${QR_OPEN || !qr ? code : `<details id="offeringFold"><summary id="offeringFoldWord"></summary>${code}</details>`}
    <footer><button class="chip" id="offeringClose" type="button"></button></footer></div>`;
  document.body.appendChild(d);
  const $ = (/** @type {string} */ id) => /** @type {any} */ (d.querySelector("#" + id));
  $("offeringTitle").textContent = t("功德箱");
  $("offeringCoin").textContent = t("一枚钱落进箱里，到这里就够了。游戏里的这一枚不是真钱，不记在朱印帐上，也没有任何回报。");
  $("offeringAsk").textContent = t("若你愿意，也可以去如是我闻的护持页，那里说明了款项的用处。");
  $("offeringGo").textContent = t("支持如是我闻与本游戏的制作");
  $("offeringGo").href = donateURL(lang);
  $("offeringClose").textContent = t("合上");
  $("offeringGo").addEventListener("click", () => onOpen());
  $("offeringClose").addEventListener("click", () => ui.close("offering"));
  if (qr) {
    $("offeringQrImg").src = QR; $("offeringQrImg").alt = t("微信赞赏码");
    $("offeringScan").textContent = t("微信扫码，支持如是我闻与本游戏的制作");
    $("offeringHow").textContent = coarse ? t("长按识别，或保存后在微信里从相册扫") : t("用微信扫一扫");
    $("offeringReg").textContent = t("付款后可在护持页登记"); $("offeringReg").href = donateURL(lang, `${lang}-qr`);
    $("offeringReg").addEventListener("click", () => onOpen());
  }
  let counted = false; const count = () => { if (!counted) { counted = true; onQr(); } };
  if (qr && !QR_OPEN) { $("offeringFoldWord").textContent = t("微信赞赏"); $("offeringFold").addEventListener("toggle", () => $("offeringFold").open && count()); }
  ui.layer("offering", { kind: "modal", confirm: "offeringClose" });
  return { qr, opened: () => { if (qr && QR_OPEN) count(); } };
}
