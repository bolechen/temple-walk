// A visit as a small pilgrimage: seven observances, each leaving a seal in the visitor's book.
// This file is only the book-keeping: what the seals are, which have been earned, and how that is remembered
// between visits. It knows nothing of the page or the scene. Where each observance is made is in the plan
// (site.places); how it looks is in rites.js; the page of seals is drawn by goshuin.js.

// In the order a visitor meets them going up the mountain. `need` is how many times the thing must be done.
export const SEALS = [
  { id: "bell",    seal: "闻钟", place: "钟楼",     act: "撞钟",   need: 3, line: "第三下的余音，过了很久才散。",       hint: "山门东侧的钟楼里悬着大钟。走到绳前，一下一下撞，撞满三下。" },
  { id: "incense", seal: "上香", place: "大雄宝殿", act: "上香",   need: 1, line: "三支香插进灰里，烟顺着殿梁往上走。",         hint: "穿过大院，登上台阶，进大雄宝殿上一炷香。" },
  { id: "tea",     seal: "吃茶", place: "茶寮",     act: "吃茶",   need: 1, line: "赵州和尚说：吃茶去。",               hint: "大院西侧的茶寮前摆着茶桌，坐下吃一盏茶。" },
  { id: "sutra",   seal: "得句", place: "藏经楼",   act: "请一句", need: 1, line: "纸签上一句话，收进袖子里。",           hint: "大殿后面的第一级台地上是藏经楼，在檐下请一句话。" },
  { id: "well",    seal: "观水", place: "龙井",     act: "观水",   need: 1, line: "相传龙让出了整座山，只留下这口井。",   hint: "藏经楼东边的石壁下有一口井，去看看井里的水。" },
  { id: "lamp",    seal: "燃灯", place: "观音殿",   act: "燃灯",   need: 1, line: "一灯能除千年暗。",                   hint: "第二级台地的观音殿前有一座灯台，点一盏灯。" },
  { id: "sit",     seal: "静坐", place: "凌霄阁",   act: "静坐",   need: 1, line: "钟楼、大殿、茶寮的屋顶，一层层都在脚下。", hint: "穿过茶园登上山顶。凌霄阁前有一只蒲团，坐下，跟着地上的圆圈呼吸三次。" },
];
export const SEAL = Object.fromEntries(SEALS.map((s) => [s.id, s]));

// What the library gives: one line, with where it is from. Only lines whose source is certain.
export const VERSES = [
  ["应无所住，而生其心。", "《金刚经》"],
  ["本来无一物，何处惹尘埃。", "《六祖坛经》"],
  ["不是风动，不是幡动，仁者心动。", "《六祖坛经》"],
  ["一花开五叶，结果自然成。", "菩提达摩传法偈"],
  ["平常心是道。", "马祖道一"],
  ["日日是好日。", "云门文偃"],
  ["饥来吃饭，困来即眠。", "大珠慧海"],
  ["看脚下。", "圆悟克勤"],
  ["春有百花秋有月，夏有凉风冬有雪。若无闲事挂心头，便是人间好时节。", "无门慧开《无门关》"],
  ["青青翠竹，尽是法身；郁郁黄花，无非般若。", "《景德传灯录》"],
  ["云在青天水在瓶。", "李翱《赠药山高僧惟俨》"],
  ["溪声便是广长舌，山色岂非清净身。", "苏轼《赠东林总长老》"],
  ["行到水穷处，坐看云起时。", "王维《终南别业》"],
  ["掬水月在手，弄花香满衣。", "于良史《春山夜月》"],
];
// The same visitor on the same day is given the same line; another day, perhaps another.
export function pickVerse(seed) { const n = VERSES.length, i = ((Math.floor(seed) % n) + n) % n; return { text: VERSES[i][0], from: VERSES[i][1] }; }

export const KEY = "yunjing.journey.v1";
// `opened`: when the four seasons were first opened to the visitor, which is the first time the book was filled. It
// outlives 重新朝山: a second walk up the mountain may be made in any season. `told`: whether that has been said once.
// `closed`: when the prologue's close was shown (or passed over) after sitting on the summit. It comes once a walk,
// whatever else is in the book; 重新朝山 begins a new walk and lets the summit close that one too.
const fresh = (now, keep = {}) => ({ v: 1, born: now, seals: {}, strikes: 0, verse: null, done: null, opened: keep.opened || null, told: !!keep.told, closed: null });

// `store` is anything with get() → string|null and set(string); the page passes one backed by localStorage.
// `closedBefore`: the page kept a separate flag that the close had been seen before this book remembered it itself.
export function createJourney(store, now = () => Date.now(), { closedBefore = false } = {}) {
  let s = load();
  function load() {
    try {
      const raw = JSON.parse(store.get() || "null");
      if (raw && raw.v === 1 && raw.seals && typeof raw.seals === "object") {
        const out = fresh(Number(raw.born) || now());
        for (const { id } of SEALS) if (Number(raw.seals[id]) > 0) out.seals[id] = Number(raw.seals[id]);   // seals this version does not know are dropped
        out.strikes = Math.min(SEAL.bell.need, Math.max(0, Number(raw.strikes) | 0));
        if (raw.verse && typeof raw.verse.text === "string") out.verse = { text: raw.verse.text, from: String(raw.verse.from || "") };
        out.done = Number(raw.done) > 0 ? Number(raw.done) : null;
        out.opened = Number(raw.opened) > 0 ? Number(raw.opened) : out.done;   // a book filled before this was kept counts
        out.told = raw.told === true;
        // Under the rule before this one the close came with the seventh seal, so a filled book has seen it.
        out.closed = Number(raw.closed) > 0 ? Number(raw.closed) : out.done;
        return out;
      }
    } catch {}
    return fresh(now());
  }
  const save = () => { try { store.set(JSON.stringify(s)); } catch {} };
  if (closedBefore && !s.closed) { s.closed = now(); save(); }
  const count = () => SEALS.reduce((n, { id }) => n + (s.seals[id] ? 1 : 0), 0);

  const api = {
    total: SEALS.length,
    has: (id) => !!s.seals[id],
    count,
    done: () => count() === SEALS.length,
    get strikes() { return s.strikes; },
    get verse() { return s.verse; },
    get born() { return s.born; },
    get finished() { return s.done; },
    get closed() { return s.closed; },
    // The prologue closed on the summit. Returns true only the first time in a walk.
    close() { if (s.closed) return false; s.closed = now(); save(); return true; },
    // The seals in order, each with the moment it was earned (or null).
    list: () => SEALS.map((d) => ({ ...d, got: s.seals[d.id] || null })),
    // The first observance not yet made, going up the mountain; null once the book is full.
    next: () => SEALS.find((d) => !s.seals[d.id]) || null,
    // Earn a seal. Returns true only the first time. `extra.verse` is kept with the library's seal.
    earn(id, extra) {
      if (!SEAL[id] || s.seals[id]) return false;
      s.seals[id] = now();
      if (id === "sutra" && extra && extra.verse) s.verse = { text: String(extra.verse.text), from: String(extra.verse.from || "") };
      if (api.done() && !s.done) s.done = now();
      if (s.done && !s.opened) s.opened = s.done;
      save(); return true;
    },
    // One stroke of the bell. The third earns its seal. Returns how many have sounded and whether this one earned it.
    strike() {
      if (s.seals.bell) return { strikes: s.strikes, earned: false };
      s.strikes = Math.min(SEAL.bell.need, s.strikes + 1);
      const earned = s.strikes >= SEAL.bell.need ? api.earn("bell") : false;
      if (!earned) save();
      return { strikes: s.strikes, earned };
    },
    // The seasons and hours are the visitor's to choose once the book has been filled.
    opened: () => !!s.opened,
    told: () => s.told,
    tell() { if (!s.told) { s.told = true; save(); } },
    // Start the book again. The seasons stay open.
    reset() { s = fresh(now(), { opened: s.opened, told: s.told }); save(); },
    snapshot: () => JSON.parse(JSON.stringify(s)),
  };
  return api;
}

// The visitor's own browser as the store. Private windows and blocked storage simply forget.
export function browserStore(key = KEY) {
  return {
    get() { try { return localStorage.getItem(key); } catch { return null; } },
    set(v) { try { localStorage.setItem(key, v); } catch {} },
  };
}

// Which place the visitor is standing at: `places` maps a seal's id to { at: [x, z], r }.
export function placeAt(places, x, z) {
  let best = null, bd = Infinity;
  for (const id in places) { const p = places[id], d = Math.hypot(x - p.at[0], z - p.at[1]); if (d < (p.r || 1.6) && d < bd) { best = id; bd = d; } }
  return best;
}
