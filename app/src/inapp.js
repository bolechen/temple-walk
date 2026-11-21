// Which app's own browser the page is open in, if any (#344). A third of the public page's first visitors came through
// one (2026-11-19 to 20: WeChat and Xiaohongshu most), and there the system's share sheet usually cannot take a file,
// so the share button had nothing to do. Read from the user agent, which each of these apps marks with its name; the
// table is the one place that knows them, and tests/unit/inapp.test.mjs holds it against real agents.
/** @type {{ id: string, test: RegExp }[]} the more particular first (QQ's browser app is a browser, QQ's chat is not) */
export const IN_APP = [
  { id: "wecom", test: /wxwork\//i },   // (WeChat for work names MicroMessenger too)
  { id: "wechat", test: /MicroMessenger\//i },
  { id: "qq", test: /\sQQ\/[\d.]+/ },
  { id: "xhs", test: /xhsdiscover|XiaoHongShu/i },
  { id: "douyin", test: /aweme|BytedanceWebview|musical_ly/i },
  { id: "weibo", test: /Weibo(?:\s|\()|__weibo__/i },
  { id: "line", test: /\sLine\/[\d.]+/ },
  { id: "kakao", test: /KAKAOTALK/i },
  { id: "facebook", test: /FBAN|FBAV|FB_IAB/ },
  { id: "instagram", test: /Instagram/ },
];
/** The in-app browser a user agent names, or null for an ordinary browser. @param {string} ua */
export function inAppOf(ua) {
  if (typeof ua !== "string" || !ua) return null;
  if (/MQQBrowser/.test(ua) && !/\sQQ\/[\d.]+/.test(ua)) return null;   // QQ's own browser is a browser
  for (const a of IN_APP) if (a.test.test(ua)) return a.id;
  return null;
}
/** Whether this browser can hand a file to the system's share sheet. @param {File} file */
export const canShareFile = (file) => { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch { return false; } };
