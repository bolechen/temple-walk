// The measured walk (`?tour=120x3`): from the bamboo at the foot of the path up the stair, round the screen wall,
// through the gate into the first court, and back the same way, at a walking pace, seen from his own eyes. After
// ten seconds of warming up it is walked for a fixed time, several times over, and every frame's length is written
// down. At the end the page shows, for each time round, the mean frame rate and the 95th-percentile frame, and
// offers the raw numbers to save. This is how the place is measured on the machine it is meant for, which no
// rented graphics card can stand in for.
export const ROUTE = [[21.3, 81.5], [21.3, 77.5], [11, 77.5], [0, 77.5], [0, 62.5], [8.5, 60], [8.5, 49], [0, 46.5], [0, 29]];

export function createTour(spec, y) {
  const [secs = 120, runs = 3] = String(spec || "").split("x").map(Number).map((v) => (v > 0 ? v : undefined));
  const there = ROUTE.slice(1), back = ROUTE.slice(0, -1).reverse(), WARM = 10000;
  const t0 = performance.now(), result = { route: ROUTE, seconds: secs, warmup_s: WARM / 1000, runs: [], done: false, started: new Date().toISOString() };
  let phase = "wait", began = 0, frames = [], last = 0, leg = 0, panel = null;
  const next = () => { y.walk((leg++ % 2 ? back : there).map((p) => [...p])); };
  const p95 = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };

  function finish() {
    phase = "done"; result.done = true; Object.assign(result, y.env(), { load_ms: Math.round(result.ready_ms) });
    panel = document.createElement("div"); panel.id = "tour";
    panel.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50;padding:22px 28px;background:rgba(11,10,9,.86);border:1px solid rgba(237,232,220,.3);border-radius:4px;font:400 15px/1.9 var(--kai);letter-spacing:.08em;color:#ede8dc;max-width:90vw";
    const rows = result.runs.map((r, i) => `<div>第 ${i + 1} 次　平均 ${r.fps_mean.toFixed(1)} 帧/秒　p95 ${r.p95_ms.toFixed(1)} 毫秒　最慢 ${r.max_ms.toFixed(0)} 毫秒　${r.frames} 帧</div>`).join("");
    const csv = "run,frame,ms\n" + result.runs.map((r, i) => r.frame_ms.map((ms, k) => `${i + 1},${k},${ms}`).join("\n")).join("\n");
    const link = (name, text, type) => `<a download="${name}" href="${URL.createObjectURL(new Blob([text], { type }))}" style="color:#e39a4c;margin-right:1.5em">${name}</a>`;
    panel.innerHTML = `<div style="font-size:19px;letter-spacing:.3em;margin-bottom:8px">行走测量</div><div style="opacity:.7">${result.size.join("×")}　DPR ${result.dpr}　画质 ${result.tier}　载入 ${(result.load_ms / 1000).toFixed(1)} 秒</div>${rows}<div style="margin-top:10px">${link("performance.json", JSON.stringify(result), "application/json")}${link("frame-times.csv", csv, "text/csv")}</div>`;
    document.body.appendChild(panel); document.exitPointerLock?.();
  }
  // Called once a frame with the clock. Nothing is measured until the place has drawn itself and he has been let in.
  function frame(now) {
    if (phase === "done") return;
    if (phase === "wait") { if (document.body.dataset.ready !== "1" || !document.body.classList.contains("entered")) return; result.ready_ms = now - t0; phase = "warm"; began = now; last = now; next(); return; }
    const dt = now - last; last = now;
    const s = y.state(); if (!s.target) next();                                    // at either end, turn round and go back
    y.face(s.heading);                                                             // he looks where he is going
    if (phase === "warm") { if (now - began >= WARM) { phase = "run"; began = now; frames = []; } return; }
    frames.push(+dt.toFixed(2));
    if (now - began >= secs * 1000) {
      const sum = frames.reduce((a, b) => a + b, 0);
      result.runs.push({ seconds: +(sum / 1000).toFixed(2), frames: frames.length, fps_mean: (frames.length * 1000) / sum, p95_ms: p95(frames), max_ms: Math.max(...frames), frame_ms: frames });
      if (result.runs.length >= runs) finish(); else { began = now; frames = []; }
    }
  }
  window.__tour = () => ({ phase, runs: result.runs.map(({ frame_ms, ...r }) => r), done: result.done, result: result.done ? result : null });
  return { frame };
}
