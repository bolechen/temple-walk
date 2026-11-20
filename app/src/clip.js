// A short film of the view held in the raised camera (#342): the framed part of the picture, drawn each frame onto a
// canvas of its own, the sound of the place taken off the output, and a quiet signature over the last moment. This file
// is the part that does not need the page's renderer: which container the browser can write, how large the film is, how
// long it runs, what is said when it cannot be handed over, how the signature is laid. `createClip` wires them to a
// MediaRecorder; yard.js feeds it one frame at a time.
import { FONT } from "./i18n.js";

export const CLIP = Object.freeze({
  secs: 12,        // what is filmed by default; the visitor may stop at any moment
  max: 15,         // the longest a film may be, signature included
  tail: 1.6,       // the signature fades in over this much more (it is part of the film, and of `max`)
  fps: 30,
  short: 1080,     // the short side (1080×1440 for the 3:4 frame); the low tier films 720
  shortLow: 720,
  bits: 6_000_000, // video bits a second at 1080 (scaled by area for the smaller film)
  utm: "utm_source=clip",
});

// Containers in the order they are wished for: MP4 where the browser writes it (Safari, Chrome 126+), else WebM.
export const MIMES = Object.freeze([
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4",
  "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm",
]);
/** @param {(type: string) => boolean} supported `MediaRecorder.isTypeSupported` @returns {{ mime: string, type: string, ext: string } | null} */
export function pickMime(supported) {
  for (const m of MIMES) { let ok = false; try { ok = !!supported(m); } catch {} if (ok) { const type = m.split(";")[0]; return { mime: m, type, ext: type === "video/mp4" ? "mp4" : "webm" }; } }
  return null;
}

/** The film's size: the short side fixed by the tier, the long side by the frame's shape, both even (encoders want that). */
export function clipSize(aw, ah, tierName, force = 0) {
  const short = force || (tierName === "low" ? CLIP.shortLow : CLIP.short), even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return aw >= ah ? { w: even((short * aw) / ah), h: short } : { w: short, h: even((short * ah) / aw) };
}
export const clipBits = (w, h) => Math.round(CLIP.bits * Math.min(1, (w * h) / (1080 * 1440)) ** 0.85);

/** How long the scene is filmed: the default, never more than leaves room for the signature inside `max`. */
export const sceneSecs = (mark, secs = /** @type {number} */ (CLIP.secs)) => Math.max(1, Math.min(secs, CLIP.max - (mark ? CLIP.tail : 0)));
/** How much of the signature shows `t` seconds into the film: 0 until the tail begins, then a smooth rise to 1. */
export function markAlpha(t, sceneEnd, tail = CLIP.tail) { const k = Math.min(1, Math.max(0, (t - sceneEnd) / tail)); return k * k * (3 - 2 * k); }

/**
 * What to tell a visitor whose browser will not hand the film to the system's share sheet. One place for it, so that the
 * hint under a saved photograph can say the same (#344): a touch screen is told to press and hold, the rest to use the
 * save button; null when sharing works and nothing needs saying. @returns {"hold" | "save" | null}
 */
export function saveHint({ canShare, coarse }) { return canShare ? null : coarse ? "hold" : "save"; }

export const clipName = (ext, words) => `yunjing-clip-${words}.${ext}`.replace(/[^\p{L}\p{N}.\-]+/gu, "-");

/** The signature laid on a film frame at strength `a`: a faint scrim, the temple's name and the hour, the address, a seal. */
export function drawMark(x, w, h, a, { temple, label, url, seal }) {
  if (a <= 0) return;
  const u = Math.min(w, h) / 100, m = u * 5;
  x.save(); x.globalAlpha = a;
  const g = x.createLinearGradient(0, h * 0.78, 0, h); g.addColorStop(0, "rgba(20,16,12,0)"); g.addColorStop(1, "rgba(20,16,12,.55)");
  x.fillStyle = g; x.fillRect(0, h * 0.78, w, h * 0.22);
  x.textBaseline = "middle"; x.textAlign = "left"; x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = u * 0.8;
  x.fillStyle = "#f3efe5"; x.font = `${Math.round(u * 4.4)}px ${FONT.serif}`; try { x.letterSpacing = `${u * 0.6}px`; } catch {}
  x.fillText(`${temple} · ${label}`, m, h - m - u * 5.4);
  x.fillStyle = "rgba(243,239,229,.72)"; x.font = `${Math.round(u * 2.3)}px ${FONT.serif}`; try { x.letterSpacing = `${u * 0.15}px`; } catch {}
  x.fillText(url, m, h - m - u * 1.2);
  // The seal, small and red, as on the card.
  const z = u * 9, sx = w - m - z, sy = h - m - z * 0.95;
  x.shadowColor = "transparent"; x.translate(sx + z / 2, sy + z / 2); x.rotate(-0.025); x.fillStyle = "#b02a1f";
  x.beginPath(); x.roundRect(-z / 2, -z / 2, z, z, z * 0.12); x.fill();
  x.fillStyle = "#f6efe2"; x.textAlign = "center"; try { x.letterSpacing = "0px"; } catch {} x.font = `${Math.round(z * 0.46)}px ${FONT.brush}`;
  [...seal].slice(0, 2).forEach((ch, i) => x.fillText(ch, 0, (i - 0.5) * z * 0.46 + z * 0.02));
  x.restore();
}

/**
 * A recording in progress. `source` is the page's drawing canvas, `crop()` the framed part of it in that canvas's own
 * pixels; `audio` (optional) is a MediaStream with the place's sound. `frame(t)` is called straight after each frame is
 * drawn (the drawing buffer is not kept past that task) and copies the crop onto the film's canvas.
 * @param {{ source: HTMLCanvasElement, crop: () => { x: number, y: number, w: number, h: number }, size: { w: number, h: number }, audio?: MediaStream | null, pick: { mime: string, type: string, ext: string }, mark?: any, secs?: number, dry?: boolean, now?: () => number, onEnd: (r: { blob: Blob, type: string, ext: string, secs: number, early: boolean, frames: number }) => void, onFail?: (e: any) => void }} o
 */
export function createClip(o) {
  const now = o.now || (() => performance.now() / 1000), scene = sceneSecs(!!o.mark, o.secs), total = scene + (o.mark ? CLIP.tail : 0);
  const film = document.createElement("canvas"); film.width = o.size.w; film.height = o.size.h;
  const x = film.getContext("2d", { alpha: false });
  const dry = !!o.dry, stream = dry ? new MediaStream() : film.captureStream(CLIP.fps);   // `dry`: draw the frames, record nothing (to tell the copy's cost from the encoder's) o.audio?.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const chunks = [];
  const rec = dry ? /** @type {any} */ ({ start() {}, requestData() {}, stop() { setTimeout(() => rec.onstop?.(), 0); }, state: "inactive" }) : new MediaRecorder(stream, { mimeType: o.pick.mime, videoBitsPerSecond: clipBits(o.size.w, o.size.h), audioBitsPerSecond: 128000 });
  let t0 = 0, endAt = Infinity, early = false, state = "rec", sceneEnd = scene, drawn = 0;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onerror = (e) => { state = "failed"; o.onFail?.(e.error || e); };
  rec.onstop = () => {
    stream.getTracks().forEach((tr) => tr.stop());
    if (state === "failed" || state === "cancelled") return;
    state = "done"; const blob = new Blob(chunks, { type: o.pick.type });
    o.onEnd({ blob, type: o.pick.type, ext: o.pick.ext, secs: +(Math.min(total, now() - t0)).toFixed(2), early, frames: drawn });
  };
  const paint = (t) => {
    const c = o.crop(); x.drawImage(o.source, c.x, c.y, c.w, c.h, 0, 0, film.width, film.height); drawn++;
    if (o.mark) drawMark(x, film.width, film.height, markAlpha(t, sceneEnd), o.mark);
  };
  return {
    film, get state() { return state; }, get drawn() { return drawn; }, total, scene,
    start() { t0 = now(); endAt = t0 + total; rec.start(250); return this; },   // (nothing is drawn here: the first frame comes with the next one the page draws, whose buffer is still whole)
    /** Seconds into the film, and how far along its scene is (0..1), for the progress line. */
    progress() { const t = Math.max(0, now() - t0); return { t, k: Math.min(1, t / scene) }; },
    /** The visitor stops: the scene ends here, and the signature, if there is one, takes its tail. */
    stop() { if (state !== "rec") return; early = now() - t0 < scene - 0.05; if (early) { sceneEnd = Math.max(0.5, now() - t0); endAt = t0 + sceneEnd + (o.mark ? CLIP.tail : 0); } },   // the film ends on a frame the page draws: the next one, or after the tail
    frame() {
      if (state !== "rec") return; const t = now() - t0; paint(t);
      if (now() >= endAt) this.finish();
    },
    finish() { if (state !== "rec") return; state = "ending"; try { rec.requestData(); rec.stop(); } catch (e) { state = "failed"; o.onFail?.(e); } },
    cancel() { if (state === "done" || state === "cancelled") return; state = "cancelled"; try { rec.state !== "inactive" && rec.stop(); } catch {} stream.getTracks().forEach((tr) => tr.stop()); },
  };
}
