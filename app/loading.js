// The loading bar on the title, and the way to try again. It is the first module on the page, so Vite puts it at the
// head of the one bundle and it runs before the temple begins to be built; its listeners then catch anything that
// fails while the place is made. (It cannot speak if the bundle itself never arrives.) It is still written as a plain
// script, so the unit test can run it on its own. Percentages count completed work, not elapsed time or downloaded
// bytes: scene stages 70%, surfaces 20%, frames 10%.
(() => {
  const panel = document.getElementById("loading"), bar = document.getElementById("loadProgress");
  const label = document.getElementById("loadLabel"), percent = document.getElementById("loadPercent");
  const retry = document.getElementById("loadRetry"), button = document.getElementById("enterBtn");
  let stages = 0, surfaces = 0, frames = 0, value = 0, done = false, failed = false, stage = "", lastAsset = null;
  // A file is named by what follows its last slash, without query or hash; a message keeps its words, and any address
  // in it shrinks to its file, so a failed fetch says which file without carrying the whole URL out.
  const fileOf = (url) => String(url || "").split(/[?#]/)[0].split("/").filter(Boolean).pop() || "";
  const URLS = /\b(?:https?|blob|file):\/\/[^\s"'()<>]+/g;
  const tidy = (message) => String(message || "").replace(URLS, (u) => fileOf(u)).replace(/\s+/g, " ").trim();
  const sourceOf = (el) => (el && typeof el === "object" ? String(el.currentSrc || el.src || el.href || "") : String(el || ""));
  // The page's language (lang.js puts it on the window first); on its own, as in its unit test, the words as written.
  const t = (s) => (typeof window.templeT === "function" ? window.templeT(s) : s);
  const render = () => {
    if (done || failed) return;
    value = Math.max(value, Math.min(99, Math.floor(70 * stages / 10 + 20 * surfaces + 10 * frames / 3)));
    bar.value = value; percent.textContent = value + "%";
  };
  window.templeLoading = {
    async step(name) {
      if (done || failed) return;
      stages = Math.min(10, stages + 1); stage = String(name || "").slice(0, 50); label.textContent = t("山路正在铺开") + " · " + name; render();
      // Give the title and progress a chance to paint before the next synchronous build.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
    textures(state) { surfaces = state.total ? Math.min(1, (state.loaded + state.failed.length) / state.total) : 0; render(); },
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
      // with no retry, since it would fail the same way. The count keeps the two apart. What broke is named (#326):
      // `asset`, the file — the one handed in, else the first address in the error's own words, else the last resource
      // that failed to load on the page; `stage`, the last `step()`; `where`, the script and line that threw, or the
      // first words of a rejected promise's error.
      const o = opts || {};
      const reason = o.reason === "webgl" ? "webgl" : "error", webgl = reason === "webgl";
      const where = tidy(o.where).slice(0, 50);
      const said = (String(o.where || "").match(URLS) || [])[0];
      const asset = (fileOf(sourceOf(o.asset)) || fileOf(said) || fileOf(sourceOf(lastAsset))).slice(0, 50);
      const at = String(o.stage || stage || "").slice(0, 50);
      label.textContent = webgl ? t("浏览器不支持 WebGL 或未开启硬件加速") : t("山路 · 请再来一次"); retry.hidden = webgl; button.disabled = true;
      try { if (location.hostname === "temple.rushiwowen.co") window.umami?.track?.("demo.load_error", { reason, asset, stage: at, where }); } catch {}
    },
  };
  retry.addEventListener("click", () => location.reload());
  // A picture, script or stylesheet in the page that fails to load does not bubble to the window; only the capture phase
  // hears it. That only remembers the file: one picture missing is not the temple failing to load, so it does not fail.
  // (A texture three fetches through an image never put in the page is heard by neither; textures.js counts those.)
  addEventListener("error", (event) => {
    const el = event && event.target;
    if (el && el !== window && typeof el === "object" && sourceOf(el)) lastAsset = el;
  }, true);
  // What does fail the load: a script that throws (named by its file and line) or a promise left rejected.
  addEventListener("error", (event) => {
    if (event && event.target && event.target !== window && sourceOf(event.target)) return;
    const file = fileOf(event && event.filename), line = event && event.lineno;
    window.templeLoading.fail({ reason: "error", where: file ? file + (line ? ":" + line : "") : "" });
  });
  addEventListener("unhandledrejection", (event) => {
    const r = event && event.reason;
    window.templeLoading.fail({ reason: "error", where: r instanceof Error || (r && typeof r.message === "string") ? r.message : typeof r === "string" ? r : "" });
  });
})();
