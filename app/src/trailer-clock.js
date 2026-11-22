// The fixed clock of the trailer mode (#610). A film is drawn frame by frame, so the game's time must be the film's: every
// frame is a sixtieth of a second after the one before, whatever the machine took to draw it, and nothing reads the real
// clock. The page's time is `performance.now()` and its frames are `requestAnimationFrame`; both are replaced by a clock
// that moves only when a tool steps it. The wind, the leaves, the bell's swing, his steps, the doorways' fades and the eye's
// springs all take their time from those two, so they follow it without knowing.

/** @param {{ fps?: number, start?: number }} [o] */
export function createFixedClock({ fps = 60, start = 0 } = {}) {
  let now = start, frame = 0, next = 1;
  /** @type {Map<number, (t: number) => void>} */ let queue = new Map();
  const dt = 1000 / fps;
  return {
    fps, dt,
    now: () => now,
    frame: () => frame,
    pending: () => queue.size,
    request(fn) { const id = next++; queue.set(id, fn); return id; },
    cancel(id) { queue.delete(id); },
    /** Moves the time on by one frame and gives every callback that was waiting for a frame that time. */
    step() {
      now += dt; frame++;
      const run = queue; queue = new Map();
      for (const fn of run.values()) fn(now);
      return now;
    },
    /** Jumps the time forward to `ms` (never back: a frame would then be drawn a negative time after the last). */
    jump(ms) { if (ms < now) throw new Error(`the clock only goes on: it is at ${now} ms, not ${ms}`); now = ms; },
  };
}

/** Puts a fixed clock in place of a window's own time and frames. @param {any} win @param {ReturnType<typeof createFixedClock>} clock */
export function installClock(win, clock) {
  const real = { now: win.performance.now.bind(win.performance), raf: win.requestAnimationFrame?.bind(win), caf: win.cancelAnimationFrame?.bind(win) };
  win.performance.now = () => clock.now();
  win.requestAnimationFrame = (fn) => clock.request(fn);
  win.cancelAnimationFrame = (id) => clock.cancel(id);
  return () => { win.performance.now = real.now; win.requestAnimationFrame = real.raf; win.cancelAnimationFrame = real.caf; };
}
