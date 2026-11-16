// What a visitor may set for themselves and find again next time: how finely the place is drawn, how fast the mouse
// turns the head and which way up, whether the mouse is held as in a first-person game (`lock`), how wide the view is, how loud it is (all of it, and the music, the place and the effects each apart). Kept in the browser under one key; anything unreadable or out of
// range falls back to the default, so an old or damaged save can never stop the walk. (After the settings store of
// wok-ing-dead, the reference for what a finished game's shell carries.)
export const SETTINGS_KEY = "yunjing.settings.v1";
export const QUALITIES = ["auto", "low", "medium", "high"];
export const LEVELS = ["volume", "music", "ambience", "effects"];
/** @typedef {{ quality: string, sens: number, invertY: boolean, lock: boolean, fov: number, volume: number, music: number, ambience: number, effects: number }} Settings */
/** @type {Readonly<Settings>} */
export const DEFAULTS = Object.freeze({ quality: "auto", sens: 1, invertY: false, lock: false, fov: 0, volume: 0.8, music: 0.7, ambience: 0.8, effects: 1 });
export const FOV_RANGE = [-6, 16];   // degrees taken from or added to the angle of view, which differs by view and screen
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function sanitize(saved) {
  /** @type {Settings} */
  const s = { ...DEFAULTS };
  if (saved && typeof saved === "object") {
    if (QUALITIES.includes(saved.quality)) s.quality = saved.quality;
    if (Number.isFinite(saved.sens)) s.sens = clamp(saved.sens, 0.3, 2.5);
    if (typeof saved.invertY === "boolean") s.invertY = saved.invertY;
    if (typeof saved.lock === "boolean") s.lock = saved.lock;
    if (Number.isFinite(saved.fov)) s.fov = clamp(Math.round(saved.fov), FOV_RANGE[0], FOV_RANGE[1]);
    for (const k of LEVELS) if (Number.isFinite(saved[k])) s[k] = clamp(saved[k], 0, 1);
  }
  return s;
}
// `store`: { get(), set(text) }. In the page that is localStorage; in a test, anything.
export function createSettings(store) {
  let now; try { now = sanitize(JSON.parse(store.get() || "null")); } catch { now = { ...DEFAULTS }; }
  const heard = new Set();
  return {
    get: () => ({ ...now }),
    set(key, value) {
      if (!(key in DEFAULTS)) return now[key];
      now = sanitize({ ...now, [key]: value });
      try { store.set(JSON.stringify(now)); } catch {}   // storage may be full or forbidden; the walk goes on without it
      for (const fn of heard) fn({ ...now }, key);
      return now[key];
    },
    reset() { for (const k in DEFAULTS) this.set(k, DEFAULTS[k]); return this.get(); },
    onChange(fn) { heard.add(fn); },
  };
}
export const browserSettingsStore = () => ({ get: () => { try { return localStorage.getItem(SETTINGS_KEY); } catch { return null; } }, set: (t) => localStorage.setItem(SETTINGS_KEY, t) });
