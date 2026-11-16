// The loading bar on the title, and the way to try again. It is the first module on the page, so Vite puts it at the
// head of the one bundle and it runs before the temple begins to be built; its listeners then catch anything that
// fails while the place is made. (It cannot speak if the bundle itself never arrives.) It is still written as a plain
// script, so the unit test can run it on its own. Percentages count completed work, not elapsed time or downloaded
// bytes: scene stages 70%, surfaces 20%, frames 10%.
(() => {
  const panel = document.getElementById("loading"), bar = document.getElementById("loadProgress");
  const label = document.getElementById("loadLabel"), percent = document.getElementById("loadPercent");
  const retry = document.getElementById("loadRetry"), button = document.getElementById("enterBtn");
  let stages = 0, surfaces = 0, frames = 0, value = 0, done = false, failed = false;
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
      stages = Math.min(10, stages + 1); label.textContent = t("山路正在铺开") + " · " + name; render();
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
    fail() {
      if (done || failed) return;
      failed = true; bar.hidden = true; percent.hidden = true;
      label.textContent = t("山路 · 请再来一次"); retry.hidden = false; button.disabled = true;
      try { if (location.hostname === "temple.rushiwowen.co") window.umami?.track?.("demo.load_error"); } catch {}
    },
  };
  retry.addEventListener("click", () => location.reload());
  addEventListener("error", () => window.templeLoading.fail());
  addEventListener("unhandledrejection", () => window.templeLoading.fail());
})();
