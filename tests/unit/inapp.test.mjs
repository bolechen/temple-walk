// Which app's own browser the page is open in (#344, src/inapp.js), against agents as those apps send them.
import test from "node:test"; import assert from "node:assert/strict";
import { inAppOf, IN_APP } from "../../app/src/inapp.js";

const AGENTS = {
  wechat: "Mozilla/5.0 (Linux; Android 14; Pixel 8a Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.188 Mobile Safari/537.36 XWEB/1260117 MMWEBSDK/20240501 MMWEBID/1234 MicroMessenger/8.0.50.2701(0x28003253) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64",
  wechatIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003137) NetType/WIFI Language/zh_CN",
  wecom: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 wxwork/4.1.26 MicroMessenger/7.0.1 Language/zh ColorScheme/Light",
  qq: "Mozilla/5.0 (Linux; Android 13; V2219A Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.86 MQQBrowser/6.2 TBS/047601 Mobile Safari/537.36 V1_AND_SQ_9.0.50_6040_YYB_D QQ/9.0.50.16545 NetType/WIFI WebP/0.3.0 AppId/537212498",
  xhs: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 xhsdiscover/8.33 (iPhone; iOS 17.4; zh_CN) Resolution/1170*2532 Version/8.33 Build/8330193 Device/(Apple Inc.;iPhone14,5) NetType/WiFi",
  douyin: "Mozilla/5.0 (Linux; Android 12; 22041211AC Build/SP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Mobile Safari/537.36 aweme_290000 JsSdk/1.0 NetType/WIFI Channel/xiaomi_1128_64 app_version/29.0.0 ByteLocale/zh-CN BytedanceWebview/d8a21c6",
  weibo: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Weibo (iPhone14,2__weibo__14.1.2__iphone__os17.2)",
  line: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
  kakao: "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36;KAKAOTALK 2410520",
  facebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.43.109;FBBV/612345;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,3; iOS 17_5; en_US; en; scale=3.00; 1290x2796; 612345)",
};
const BROWSERS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  "Mozilla/5.0 (Linux; U; Android 13; zh-cn; V2219A Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.0.0 MQQBrowser/14.8 Mobile Safari/537.36",   // QQ's browser app
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
];

test("each app's own browser is known by the name it puts in its agent", () => {
  for (const [name, ua] of Object.entries(AGENTS)) assert.equal(inAppOf(ua), name.replace(/Ios$/, ""), name);
});
test("an ordinary browser, QQ's own browser app among them, is no app's", () => {
  for (const ua of BROWSERS) assert.equal(inAppOf(ua), null, ua);
  assert.equal(inAppOf(""), null); assert.equal(inAppOf(undefined), null);
});
test("WeChat for work is told apart from WeChat, which it also names", () => {
  assert.equal(IN_APP.findIndex((a) => a.id === "wecom") < 0, false);
  assert.equal(inAppOf(AGENTS.wecom), "wecom");
});

// The address a shared picture carries (src/sharelink.js): the scene, from the list only, and where it was shared from.
import { fromOf, shareURL, FROM } from "../../app/src/sharelink.js";
test("a shared address is always the public page, naming its scene and where it came from; only the list's scenes are honoured", () => {
  // Shared from the canary, a pull request's preview or this machine, the link still leads to the public page (#319).
  for (const here of ["https://temple-walk-canary.bole-chen.workers.dev/?cam=1,2,3,4#save=x", "https://pr-361-temple-walk-preview.bole-chen.workers.dev/?debug", "http://127.0.0.1:8000/"]) {
    globalThis.location = new URL(here);
    const u = new URL(shareURL("bell", "book"));
    assert.equal(u.origin + u.pathname, "https://temple.rushiwowen.co/", here);
    assert.deepEqual([u.searchParams.get("from"), u.searchParams.get("utm_source"), u.searchParams.get("utm_medium"), u.searchParams.get("utm_content"), u.hash], ["bell", "share", "game", "book", ""], here);
  }
  delete globalThis.location;
  assert.equal(new URL(shareURL("nowhere", "print")).searchParams.get("from"), null, "a scene not on the list is left out");
  for (const f of FROM) assert.equal(fromOf(`?from=${f}`), f);
  for (const bad of ["?from=../../x", "?from=BELL", "?from=", "?x=bell", "?from=bell%20"]) assert.equal(fromOf(bad), null, bad);
});
