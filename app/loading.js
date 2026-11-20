// The loading bar on the title, and the way to try again. It is the first module on the page, so Vite puts it at the
// head of the one bundle and it runs before the temple begins to be built; its listeners then catch anything that
// fails while the place is made. (It cannot speak if the bundle itself never arrives.) It is still written as a plain
// script, so the unit test can run it on its own. Percentages count completed work, not elapsed time or downloaded
// bytes: scene stages 70%, surfaces 20%, frames 10%.
(() => {
  const panel = document.getElementById("loading"), bar = document.getElementById("loadProgress");
  const label = document.getElementById("loadLabel"), percent = document.getElementById("loadPercent");
  const retry = document.getElementById("loadRetry"), button = document.getElementById("enterBtn");
  let stages = 0, surfaces = 0, frames = 0, value = 0, done = false, failed = false, reported = false, stage = "boot", seenFailed = 0;
  // The page's language (lang.js puts it on the window first); on its own, as in its unit test, the words as written.
  const t = (s) => (typeof window.templeT === "function" ? window.templeT(s) : s);
  const render = () => {
    if (done || failed) return;
    value = Math.max(value, Math.min(99, Math.floor(70 * stages / 10 + 20 * surfaces + 10 * frames / 3)));
    bar.value = value; percent.textContent = value + "%";
  };
  // What a failure says about itself, with nothing of the visitor in it (#328): a path on this site, or only the host of one
  // elsewhere, never a query string or a full address. Plain string work: the unit test runs this file without a URL class.
  const own = String(location.hostname || "").toLowerCase();
  const pathOf = (u) => {
    const s = String(u == null ? "" : u).split(/[?#]/)[0], m = s.match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/]*)(\/.*)?$/i);
    if (!m) return s.replace(/^[a-z][a-z0-9+.-]*:/i, "");
    const host = m[1].replace(/^.*@/, "").replace(/:\d+$/, "").toLowerCase();
    return host === own ? (m[2] || "/") : host;
  };
  const clip = (s) => String(s == null ? "" : s).slice(0, 120);
  const scrub = (msg) => clip(String(msg == null ? "" : msg).replace(/(?:https?|wss?|file):\/\/[^\s"'<>)\]]*/gi, pathOf).replace(/\?[^\s]*/g, "").replace(/\s+/g, " ").trim());
  const fileOf = (name, line) => { const f = String(name || "").split(/[?#]/)[0].split("/").pop(); return f ? clip(f + (line ? ":" + line : "")) : ""; };
  // The one report of a page: the first failure only, whatever follows it. The event is also kept in `__events` as analytics.js
  // keeps its own (the tests read it); it is sent only from the public page.
  const report = (reason, info) => {
    if (reported) return; reported = true;
    const data = { reason, stage, percent: value, kind: reason === "webgl" ? "webgl" : "script-error", ...info };
    try {
      const lang = String((document.documentElement && document.documentElement.lang) || "zh").slice(0, 2);
      const log = (window.__events = window.__events || []); log.push({ name: "demo.load_error", data: { lang, ...data } }); if (log.length > 100) log.shift();
      if (location.hostname !== "temple.rushiwowen.co") return;
      const out = { lang }; for (const k of Object.keys(data)) if (data[k] !== "" && data[k] != null) out[k] = String(data[k]).slice(0, k === "stage" ? 50 : 120);
      window.umami?.track?.("demo.load_error", out);
    } catch {}
  };
  const failure = (e, kind) => {
    if (kind === "rejection") { const r = e && e.reason; return { kind, message: scrub(r && r.message != null ? r.message : r) }; }
    return { kind, message: scrub(e && e.message), where: fileOf(e && e.filename, e && e.lineno) };
  };
  window.templeLoading = {
    async step(name) {
      if (done || failed) return;
      stage = String(name);
      stages = Math.min(10, stages + 1); label.textContent = t("山路正在铺开") + " · " + name; render();
      // Give the title and progress a chance to paint before the next synchronous build.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
    textures(state) {
      // A surface that did not arrive is not the end of the walk (its mean colour stands in), so it is counted, not shown.
      const lost = (state.failedUrls || state.failed || []);
      if (!done && lost.length > seenFailed) { seenFailed = lost.length; report("error", { kind: "resource", resource: clip(pathOf(lost[0])) }); }
      surfaces = state.total ? Math.min(1, (state.loaded + state.failed.length) / state.total) : 0; render(); },
    frame(count) { frames = Math.min(3, count); render(); },
    finish() {
      if (done || failed) return;
      done = true; bar.value = 100; percent.textContent = "100%";
      panel.hidden = true;
    },
    fail(opts = {}) {
      if (done || failed) return;
      failed = true; bar.hidden = true; percent.hidden = true;
      // A load that broke may be tried again; a browser that cannot draw at all (`reason: "webgl"`) is told why instead,
      // with no retry, since it would fail the same way. The count keeps the two apart.
      const reason = (opts && opts.reason) === "webgl" ? "webgl" : "error", webgl = reason === "webgl";
      label.textContent = webgl ? t("浏览器不支持 WebGL 或未开启硬件加速") : t("山路 · 请再来一次"); retry.hidden = webgl; button.disabled = true;
      report(reason, webgl ? { kind: "webgl" } : opts && opts.kind ? { kind: opts.kind, resource: opts.resource, message: opts.message, where: opts.where } : {});
    },
  };
  retry.addEventListener("click", () => location.reload());
  // A resource that fails to load fires `error` on its own element and the event does not bubble, so it is heard only in the
  // capture phase. A script that does not arrive ends the load; a picture or a stylesheet is reported and the page goes on.
  addEventListener("error", (e) => {
    const el = e && e.target, tag = el && el !== window && el.tagName ? String(el.tagName).toUpperCase() : "";
    if (!tag) return window.templeLoading.fail(failure(e, "script-error"));
    if (tag !== "IMG" && tag !== "SCRIPT" && tag !== "LINK") return;
    const info = { kind: "resource", resource: clip(pathOf(el.currentSrc || el.src || el.href)) };
    if (tag === "SCRIPT") window.templeLoading.fail(info); else if (!done) report("error", info);
  }, true);
  addEventListener("unhandledrejection", (e) => window.templeLoading.fail(failure(e, "rejection")));
})();
