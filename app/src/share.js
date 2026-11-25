// Sharing a picture (the book's page, a photograph), wherever the page is open (#344). Where the system's share sheet
// can take the file it is used, with the page's address carrying the scene (src/sharelink.js). Where it cannot (most
// apps' own browsers: WeChat, QQ, Xiaohongshu, Douyin, LINE, KakaoTalk...), a sheet shows the picture as an <img> to
// be pressed and held and saved, says so, and in WeChat adds that the page can be opened in the browser from the
// corner; where a download works it is offered as well. demo.share says which way it went (share, save, download).
import { t } from "./i18n.js";
import { track } from "./analytics.js";
import { inAppOf, canShareFile } from "./inapp.js";
import { shareURL } from "./sharelink.js";

const $ = (id) => /** @type {any} */ (document.getElementById(id));
let ui = null;
/** Lays the sheet on the page's stack. @param {ReturnType<typeof import("./ui.js").createUI>} theUI */
export function createShare(theUI) {
  ui = theUI;
  ui.layer("saveSheet", { kind: "modal", confirm: "saveClose" });
  $("saveClose")?.addEventListener("click", () => ui.close("saveSheet"));
  window.__saveSheet = () => ({ open: ui.isOpen("saveSheet"), img: $("saveImg")?.tagName, src: !!$("saveImg")?.src, wechat: !$("saveWechat")?.hidden, download: !$("saveDownload")?.hidden, app: inAppOf(navigator.userAgent) });
}
/** Share a picture, or show it to be saved. @param {{ blob: Blob, url: string, name: string, title: string, from: string, content: string, link?: boolean }} o (`link` false: the picture goes alone, with no address of the public page) */
export async function shareOrSave({ blob, url, name, title, from, content, link = true }) {
  const file = new File([blob], name, { type: blob.type || "image/jpeg" }), app = inAppOf(navigator.userAgent);
  if (!app && canShareFile(file)) {
    try { await navigator.share(link ? { files: [file], title, url: shareURL(from, content) } : { files: [file], title }); track("demo.share", { from: content, method: "share", scene: from }); } catch {}
    return "share";
  }
  $("saveImg").src = url; $("saveImg").alt = title;
  $("saveWechat").hidden = app !== "wechat";
  const dl = $("saveDownload"); dl.hidden = !!app; dl.href = url; dl.download = name;
  dl.onclick = () => track("demo.share", { from: content, method: "download", scene: from });
  ui?.open("saveSheet");
  track("demo.share", { from: content, method: "save", scene: from });
  return "save";
}
/** A download made from the sheet's own link beside a picture (the book's 保存, the print's 保存). @param {string} content @param {string} from */
export const countDownload = (content, from) => track("demo.share", { from: content, method: "download", scene: from });

