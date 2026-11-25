// A temple's own page (T05: docs/t05/CHECKPOINTS.md §2.2, PRD.md §1.3 (a)): a sheet of paper with what he has put on it,
// one stroke of ink for the whole of the hall seen from the court and under its eaves, and the line he copied from the
// stele. Drawn on a canvas, the same way in the small leaf he holds while he writes (revealed stroke by stroke as his
// brush goes) and on the sheet the visitor is shown afterwards. Not the prologue's book and not a seal: no vermilion here
// (CHECKPOINTS.md §4.2: the red seal is T00's grammar), only ink on paper.
//
// What is written is said in the visitor's language where it is a note of his own (the observation's sentence), and as cut
// where it is copied from the stone (the stele's line is calligraphy: as `glyphs` leaves a name board, it is not translated).

/** The leaf's shape (width : height), as he holds it and as it is shown. */
export const LEAF = Object.freeze({ w: 0.15, h: 0.21 });

/**
 * Draws the page onto a 2D context of `W`×`H` pixels.
 * @param {CanvasRenderingContext2D} g
 * @param {number} W @param {number} H
 * @param {{ stroke?: number, note?: string, noteK?: number, copy?: string, copyK?: number, from?: string, face?: string, hand?: string }} p
 *   `stroke` 0..1 how much of the stroke of ink is drawn; `note` the observation's sentence and `noteK` how much of it (0..1);
 *   `copy` the copied line and `copyK` how much of it; `from` the small line naming where the copy is from; `face`, `hand` the
 *   faces (CSS font families) for the copy and for the note.
 */
export function drawPage(g, W, H, p) {
  const face = p.face || '"Yunjing Kai", serif', hand = p.hand || '"Yunjing Xing", "Yunjing Kai", serif';
  // The paper: warm, a little uneven, with a soft darker edge.
  g.fillStyle = "#efe6d2"; g.fillRect(0, 0, W, H);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? "120,100,70" : "255,252,240"},${(0.03 + 0.05 * rnd()).toFixed(3)})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2); }
  const edge = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  edge.addColorStop(0, "rgba(0,0,0,0)"); edge.addColorStop(1, "rgba(90,70,40,0.18)"); g.fillStyle = edge; g.fillRect(0, 0, W, H);
  const ink = "rgba(24,20,17,0.9)";
  // The stroke of ink across the top (drawStroke).
  const sk = Math.max(0, Math.min(1, p.stroke ?? 0));
  if (sk > 0) drawStroke(g, W * 0.14, W * 0.86, H * 0.13, H * 0.03, sk, rnd);
  // The copied line, down the right of the page as the stone has it, from top to bottom; where it is from, small, beside it.
  const copy = [...(p.copy || "")].filter((c) => c !== "，" && c !== "、"), ck = Math.max(0, Math.min(1, p.copyK ?? 1));
  if (copy.length) {
    const cell = Math.min(W * 0.16, (H * 0.74) / copy.length), x = W * 0.8;
    g.font = `${cell * 0.86}px ${face}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = ink;
    const shown = Math.floor(copy.length * ck + 1e-6);
    copy.slice(0, shown).forEach((c, i) => g.fillText(c, x, H * 0.22 + cell * (i + 0.5)));
    if (shown >= copy.length && p.from) {
      g.font = `${cell * 0.42}px ${face}`; g.fillStyle = "rgba(24,20,17,0.6)";
      [...p.from].forEach((c, i) => g.fillText(c, x - cell * 0.95, H * 0.24 + cell * 0.5 * (i + 0.5)));
    }
  }
  // The observation's sentence, under the stroke, written smaller and across (it is his note, in the visitor's language).
  const note = p.note || "", nk = Math.max(0, Math.min(1, p.noteK ?? 1));
  if (note) {
    const fs = Math.max(8, Math.min(W * 0.075, H * 0.05)), right = copy.length ? W * 0.62 : W * 0.88, left = W * 0.12;
    g.font = `${fs}px ${hand}`; g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = ink;
    const shown = note.slice(0, Math.floor([...note].length * nk + 1e-6));
    // Laid line by line within the margins: by character for the CJK languages, by word otherwise.
    const words = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(note) ? [...shown] : shown.split(/(?<=\s)/);
    let line = "", y = H * 0.2;
    for (const w of words) { if (g.measureText(line + w).width > right - left && line) { g.fillText(line, left, y); y += fs * 1.45; line = w.trimStart(); } else line += w; }
    if (line) g.fillText(line, left, y);
  }
}

/**
 * One stroke of ink from x0 to x1 along y, `th` thick at its start: pressed down where the brush lands, drawn out thinner, and
 * breaking into dry streaks over its last part as the ink runs out. `k` how much of it is drawn (0..1); `rnd` the
 * page's own seeded numbers, so that the same page draws the same stroke. The leaf in his hands and the slip shown after
 * both draw it with this.
 * @param {CanvasRenderingContext2D} g @param {number} x0 @param {number} x1 @param {number} y @param {number} th @param {number} k
 * @param {() => number} rnd
 */
export function drawStroke(g, x0, x1, y, th, k, rnd) {
  // The brush is a bundle of hairs (`B` bands across the stroke). Each hair is laid as one continuous ribbon along the stroke,
  // opaque and a little wider than its share so that neighbours overlap: where the ink is full they close into solid ink with
  // no seam; where it runs short a hair lifts off the paper for a stretch (a slow wave at its own pace and phase), so the bare
  // paper runs along the stroke in streaks. The head is rounded where the brush turned in as it landed (藏锋).
  const n = 160, B = 10, end = Math.max(1, Math.round(n * k)), ink = "rgb(24,20,17)";
  const hair = Array.from({ length: B }, (_, j) => ({ phase: rnd() * 6.283, pace: 6 + j * 2.3 + rnd() * 3, jit: (rnd() - 0.5) * 0.25 }));
  const at = (i) => { const u = i / n, x = x0 + (x1 - x0) * u, land = Math.min(1, 0.55 + 0.45 * Math.sin(Math.min(1, u / 0.06) * Math.PI / 2));
    return { u, x, w: th * (1.25 - 0.6 * u) * (0.85 + 0.3 * Math.sin(u * 17)) * land, c: y + Math.sin(u * 5) * th * 0.3, dry: u > 0.55 ? (u - 0.55) * 1.6 : 0 }; };
  const pts = Array.from({ length: end + 1 }, (_, i) => at(i));
  g.fillStyle = ink;
  // The landing: a round head where the brush came down.
  const h = pts[0]; g.beginPath(); g.ellipse(h.x, h.c, h.w * 0.42, h.w * 0.5, 0, 0, Math.PI * 2); g.fill();
  for (let j = 0; j < B; j++) {
    const hr = hair[j], off = (j + 0.5) / B - 0.5;
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        g.beginPath();
        run.forEach((p, i) => { const cy = p.c + (off + hr.jit / B) * p.w, hw = (p.w / B) * 0.75; i ? g.lineTo(p.x, cy - hw) : g.moveTo(p.x, cy - hw); });
        for (let i = run.length - 1; i >= 0; i--) { const p = run[i], cy = p.c + (off + hr.jit / B) * p.w, hw = (p.w / B) * 0.75; g.lineTo(p.x, cy + hw); }
        g.closePath(); g.fill();
      }
      run = [];
    };
    for (const p of pts) {
      const bare = (0.5 + 0.5 * Math.sin(p.u * hr.pace + hr.phase)) * 0.85 + rnd() * 0.15;
      if (bare < p.dry) flush(); else run.push(p);
    }
    flush();
  }
}

/** A seeded run of numbers for a page's drawing (the same Park–Miller run the leaf uses). @param {number} seed */
export const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
