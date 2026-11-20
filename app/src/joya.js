// The year-end bell (#341): on the last night of the year the bell tower's bell is rung by everyone who comes, and every
// stroke is added to one count for the whole mountain, as temples in Japan ring joya no kane (除夜钟) a hundred and eight times, Seoul's
// Bosingak rings in the year, and Chinese temples strike the new year's bell at midnight (docs/t00/SOURCES.md).
// This file is the book-keeping only, with nothing of the page in it, so that Node runs it in the unit tests and the
// Worker that keeps the count (#340) can ask the same question of the same code: is it that night where the visitor is?
// game.js puts it on the page; joya-card.js draws the card a visitor takes away.

/** Everything the night is made of, in one place. The window is the visitor's own clock: 20:00 on 31 December to 02:00
 * on 1 January (#341). Opened at eight so that a family that rings early, as many Japanese temples begin joya no kane (除夜钟) before
 * midnight, finds it open; shut at two, after the temples have finished. */
export const JOYA = {
  from: { month: 11, day: 31, hour: 20 },   // months as Date counts them: 11 is December
  to: { month: 0, day: 1, hour: 2 },
  round: 108,           // the strokes of joya no kane (除夜钟): a round, after which the far hills answer
  perMin: 6,            // strokes one visitor may add to the count in any minute (more still sound; they are not counted)
  batch: 6,             // the most one report may carry: perMin, so a report every 15 s can always carry what was counted
  flushSecs: 15,        // strokes are gathered and sent at most this often, and when the page is left
  pollSecs: 20,         // the count is asked for this often while the night is open (#341: every 10–30 s)
  farGap: 90,           // the far bell answers a round at most this often: with thousands ringing a round comes every second
  clear: 3,             // and only this long after the visitor's own last stroke, so it is not lost under his bell
  answerWait: 60,       // an answer that finds no such gap within this long is let go
  api: "api/joya",      // relative to the page, as the counter's other address (#340) is
  minTz: -840, maxTz: 720,   // Date.getTimezoneOffset() runs from -840 (UTC+14) to +720 (UTC-12)
};

/** The year being rung in by a night that falls on `d` (local fields): the evening of 31 December rings in the next year.
 * @param {{ month: number, year: number }} d */
const yearOf = (d) => (d.month === 11 ? d.year + 1 : d.year);

/** Whether a moment, given as calendar fields, falls in the night's window, and which year it rings in.
 * @param {{ year: number, month: number, day: number, hour: number }} d
 * @returns {{ open: boolean, year: number }} */
export function windowAt(d) {
  const { from, to } = JOYA;
  const open = (d.month === from.month && d.day === from.day && d.hour >= from.hour) || (d.month === to.month && d.day === to.day && d.hour < to.hour);
  return { open, year: yearOf(d) };
}

/** The window by the visitor's own clock. @param {Date} [now] */
export const windowOf = (now = new Date()) => windowAt({ year: now.getFullYear(), month: now.getMonth(), day: now.getDate(), hour: now.getHours() });

/** For the counter's Worker, which has only UTC: the window at `ms` for a visitor whose clock is `tz` minutes behind UTC
 * (Date.getTimezoneOffset()), and whether that night is open anywhere on earth now (from 06:00 UTC on 31 December, when
 * it is 20:00 at UTC+14, to 14:00 UTC on 1 January, when it is 02:00 at UTC-12). A report whose clock says the window is
 * open but which no time zone could have sent is refused.
 * @param {number} ms @param {number} tz
 * @returns {{ open: boolean, year: number, anywhere: boolean, tzOk: boolean }} */
export function serverWindow(ms, tz) {
  const tzOk = Number.isInteger(tz) && tz >= JOYA.minTz && tz <= JOYA.maxTz;
  const u = new Date(ms), at = (off) => { const l = new Date(ms - off * 60000); return { year: l.getUTCFullYear(), month: l.getUTCMonth(), day: l.getUTCDate(), hour: l.getUTCHours() }; };
  // The union of every zone's window: it opens where the clock is furthest ahead and closes where it is furthest behind.
  const y = u.getUTCMonth() === 11 ? u.getUTCFullYear() : u.getUTCFullYear() - 1, { from, to } = JOYA;
  const anywhere = ms >= Date.UTC(y, from.month, from.day, from.hour) + JOYA.minTz * 60000 && ms < Date.UTC(y + 1, to.month, to.day, to.hour) + JOYA.maxTz * 60000;
  const here = tzOk ? windowAt(at(tz)) : { open: false, year: yearOf({ month: u.getUTCMonth(), year: u.getUTCFullYear() }) };
  return { open: here.open && anywhere, year: here.year, anywhere, tzOk };
}

/** The year a count is asked for when no year is given: the night nearest `ms` (December rings in the next year).
 * @param {number} ms */
export const yearNear = (ms) => { const u = new Date(ms); return yearOf({ month: u.getUTCMonth(), year: u.getUTCFullYear() }); };

/** Whether the night is open for this page: by the visitor's clock, or, on the workbench only (the dev server and a pull
 * request's preview), by `?event=joya` at any hour. `?event=none` on the workbench keeps it shut on the night itself.
 * @param {{ query: URLSearchParams, bench: boolean, now?: Date }} o
 * @returns {{ open: boolean, year: number, forced: boolean }} */
export function eventFor({ query, bench, now = new Date() }) {
  const w = windowOf(now), ask = bench ? query.get("event") : null;
  if (ask === "joya") return { open: true, year: w.open ? w.year : yearOf({ month: 11, year: now.getFullYear() }), forced: !w.open };
  if (ask === "none") return { open: false, year: w.year, forced: true };
  return { open: w.open, year: w.year, forced: false };
}

/** How many strokes one visitor may count: no more than `perMin` in any sixty seconds. Nothing is kept but the times of
 * the strokes counted in the last minute, in this page. @param {number} [perMin] */
export function createLimiter(perMin = JOYA.perMin) {
  /** @type {number[]} */ let times = [];
  return {
    /** Counts a stroke at `ms` if the minute before it holds fewer than `perMin`. @param {number} ms */
    take(ms) { times = times.filter((t) => ms - t < 60000); if (times.length >= perMin) return false; times.push(ms); return true; },
    get used() { return times.length; },
  };
}

/** How many times the count passed a round of 108 going from `a` to `b` (none when `a` is not yet known).
 * @param {number | null} a @param {number} b */
export const roundsPassed = (a, b) => (a == null || !(b > a) ? 0 : Math.floor(b / JOYA.round) - Math.floor(a / JOYA.round));

/** A reply from the counter, as the page will believe it: `{ year, total, rounds, at }` with whole numbers, or null.
 * @param {any} r @returns {{ year: number, total: number, rounds: number, at: number } | null} */
export function readReply(r) {
  if (!r || typeof r !== "object" || !Number.isInteger(r.total) || r.total < 0 || !Number.isInteger(r.year)) return null;
  return { year: r.year, total: r.total, rounds: Math.floor(r.total / JOYA.round), at: Number.isFinite(r.at) ? r.at : Date.now() };
}

/** The count as this page keeps it: the last total the counter gave, the strokes this visitor has counted and not yet sent,
 * and how many this visitor has counted tonight. `send(n, tz)` and `ask(year)` reach the counter (fetch, or a fake) and
 * resolve to its reply or null; a failure is silent: the count is simply not shown, and strokes not sent are tried again.
 * `onTotal(total, prev)` is told whenever the shown number changes; `onRound(n, total)` when the mountain's count passes
 * a round of 108 between two replies (never on the first).
 * @param {{ year: number, send: (n: number, tz: number) => Promise<any>, ask: (year: number) => Promise<any>, now?: () => number, tz?: number, onTotal?: (total: number, prev: number | null) => void, onRound?: (rounds: number, total: number) => void, perMin?: number }} o */
export function createTally(o) {
  const now = o.now || Date.now, tz = o.tz ?? new Date().getTimezoneOffset(), limit = createLimiter(o.perMin);
  const s = { year: o.year, total: /** @type {number | null} */ (null), pending: 0, mine: 0, sent: 0, failed: 0, lastFlush: -Infinity, busy: false, rounds: 0 };
  const shown = () => (s.total == null ? null : s.total + s.pending);
  function take(reply) {
    const r = readReply(reply); if (!r || r.year !== s.year) return false;
    const before = shown(), prev = s.total;
    if (prev != null && r.total < prev) return true;   // an older reply from a cache: the count only goes up
    s.total = r.total;
    const k = roundsPassed(prev, r.total); if (k > 0) { s.rounds += k; o.onRound?.(k, r.total); }
    if (shown() !== before) o.onTotal?.(/** @type {number} */ (shown()), before);
    return true;
  }
  return {
    /** A stroke of the bell. Returns whether it was counted (the visitor's minute not yet full). */
    strike() {
      if (!limit.take(now())) return false;
      const before = shown(); s.pending++; s.mine++;
      if (s.total != null) o.onTotal?.(/** @type {number} */ (shown()), before);
      return true;
    },
    /** Sends what was counted, if there is any and the last report was `flushSecs` ago (or `force`, when the page is left). */
    async flush(force = false) {
      if (!s.pending || s.busy || (!force && now() - s.lastFlush < JOYA.flushSecs * 1000)) return false;
      const n = Math.min(s.pending, JOYA.batch); s.busy = true; s.lastFlush = now();
      let r = null; try { r = await o.send(n, tz); } catch { r = null; }
      s.busy = false;
      if (r === null) { s.failed++; return false; }
      // The reply's total may be a cached sum a few seconds old; what was sent is in it all the same, so the count
      // shown never goes back below what it was with these strokes added.
      const floor = s.total != null ? s.total + n : null;
      s.pending -= n; s.sent += n;
      take(r);
      if (floor != null && s.total != null && s.total < floor) s.total = floor;
      if (s.total != null) o.onTotal?.(/** @type {number} */ (shown()), shown());
      return true;
    },
    /** Asks for the mountain's count. */
    async poll() { let r = null; try { r = await o.ask(s.year); } catch { r = null; } if (r === null) { s.failed++; return false; } return take(r); },
    get shown() { return shown(); },
    snapshot() { return { year: s.year, total: s.total, shown: shown(), pending: s.pending, mine: s.mine, sent: s.sent, failed: s.failed, rounds: s.rounds, used: limit.used }; },
  };
}

/** The counter as the Worker keeps it (#340), done in memory: for the workbench's `?joya=fake[:start]` and the unit tests.
 * It answers what the Worker answers, refuses what the Worker refuses (a bad `n`, a clock outside the window unless
 * `anyHour`), and may be given a crowd that rings `crowd` strokes a second of its own.
 * @param {{ start?: number, anyHour?: boolean, now?: () => number, crowd?: number }} [o] */
export function fakeCounter(o = {}) {
  const now = o.now || Date.now, t0 = now(); let total = o.start || 0;
  const crowd = () => Math.floor(((now() - t0) / 1000) * (o.crowd || 0));
  const year = (ms) => yearNear(ms);
  return {
    async send(n, tz) {
      if (!Number.isInteger(n) || n < 1 || n > JOYA.batch) return null;
      const w = serverWindow(now(), tz); if (!o.anyHour && !w.open) return null;
      total += n; return { year: o.anyHour && !w.open ? year(now()) : w.year, total: total + crowd(), rounds: Math.floor((total + crowd()) / JOYA.round), at: now() };
    },
    async ask(y) { return { year: y, total: total + crowd(), rounds: Math.floor((total + crowd()) / JOYA.round), at: now() }; },
    get total() { return total + crowd(); },
  };
}

/** The counter over the network: `POST api/joya { n, tz }` and `GET api/joya?year=`, each answered with
 * `{ year, total, rounds, at }`; anything else (an error, no network, a page served without the counter) is null.
 * @param {string} base the page's own address @param {typeof fetch} [f] */
export function httpCounter(base, f = globalThis.fetch) {
  const url = new URL(JOYA.api, base).href;
  const json = async (/** @type {Response} */ r) => (r.ok ? r.json() : null);
  return {
    send: (n, tz) => f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n, tz }), keepalive: true }).then(json, () => null),
    ask: (y) => f(`${url}?year=${y}`, { headers: { accept: "application/json" } }).then(json, () => null),
    /** What is left, sent as the page goes: a beacon cannot read the reply, and need not. */
    beacon(n, tz) { try { return navigator.sendBeacon?.(url, new Blob([JSON.stringify({ n, tz })], { type: "application/json" })) || false; } catch { return false; } },
  };
}

/** A number as the line on the picture writes it, in the visitor's language's own grouping. @param {number} n @param {string} l */
export const countText = (n, l) => { try { return n.toLocaleString({ zh: "zh-CN", ja: "ja-JP", en: "en-US", ko: "ko-KR" }[l] || "en-US"); } catch { return String(n); } };
