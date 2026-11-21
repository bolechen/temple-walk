// A panel for working on the place (open by itself on the dev server and on a pull request's preview; `?debug=0` keeps it shut): where he stands and what the frame costs,
// the season and the hour, the named views and the rooms' views to jump to, and a switch for each part of the scene.
// It reads and acts only through the page's own hooks (window.__yard, __show, __pose, __inside, __mood, __view,
// __part, __cost, __census), the same the tests use, so it never reaches into the walk. ` (the key left of 1) shows
// or hides it. The panel is lil-gui and the frame graph stats.js, both of which come with three.js.
import { poseQuery } from "./link.js";

export const KEY = "Backquote", STORE = "yunjing.debug.v1", EVERY = 250;
export const SEASONS = ["spring", "summer", "autumn", "winter"], TIMES = ["dawn", "day", "dusk", "night"], TIERS = ["auto", "low", "medium", "high"];
// What each switch is called on the panel: every part __part() offers, and the passes.
export const LABELS = {
  site: "建筑", sky: "天", ground: "铺地", backdrop: "远山与竹屏", bamboo: "竹林", props: "香炉与雾", trees: "树", drift: "飘落",
  reflect: "倒影", bloom: "泛光", shadow: "阴影", gtao: "环境光遮蔽", halation: "光晕", lut: "调色表", dof: "景深", layers: "分层雾",
};

// Frames a second over the last stretch, from the walk's own frame counter.
export function rate(f0, f1, ms) { return ms > 0 && f1 >= f0 ? ((f1 - f0) * 1000) / ms : 0; }

// What the panel shows of __yard(), written to be read at a glance.
export function readout(y, fps) {
  return {
    where: `${y.x.toFixed(2)}, ${y.z.toFixed(2)}${y.room ? " · " + y.room : ""}`,
    look: `${y.yaw.toFixed(2)} / ${y.pitch.toFixed(2)}`,
    height: y.h.toFixed(2),
    frame: `${Math.round(fps)} fps · ${Math.round(y.tris / 1000)} k 面 · ${y.calls} 次`,
    tier: `${y.tier} ×${y.scale}${y.governed ? " · 降 " + y.governed : ""}${y.planar ? "" : " · 无倒影"}`,
  };
}

// The address that loads the page again on another tier, keeping everything else: MSAA and the shadow map are set
// only when the page loads, so a tier cannot honestly be changed in place.
export function tierSearch(search, tier) {
  const q = new URLSearchParams(search);
  if (tier === "auto") q.delete("q"); else q.set("q", tier);
  const s = q.toString().replace(/%2C/g, ",").replace(/=(&|$)/g, "$1");
  return s ? "?" + s : "";
}

// Where a room's registered view stands: its table gives x from the room's centre line, and the room's centre is
// the door he is put at on entering.
export function roomPose(view, cx) { return [cx + view.abs[0], view.abs[1], view.abs[2], view.abs[3]]; }

// Which level's room views to offer: the walked level's own table, or none when it has none (#434: T05 has no rooms
// of its own yet, and borrowing the prologue's named the panel after the wrong temple).
export function levelOf(id, have) {
  return have.includes(id) ? id : null;
}

// How far the level has been carried: the seals of the pilgrimage, the next observance, and the visit so far. A level
// that keeps nothing of the prologue's (#426: its book is an empty one in memory, its metres are not counted) has none
// of these to show.
const NONE = "不适用";
export function levelState(j, visit = {}, ours = true) {
  if (!ours) return { state: NONE, progress: NONE, next: NONE, seals: NONE, visit: NONE };
  const total = Number(j.total) > 0 ? Number(j.total) : Object.keys(j.seals || {}).length;
  const got = j.earned || Object.keys(j.seals || {});   // the seals by their names, in the order they are met
  return {
    state: j.done ? "已完成" : "未完成",
    progress: `${Number(j.count) || 0} / ${total} 枚朱印`,
    next: j.done ? "—" : j.nextPlace ? `${j.nextPlace} · ${j.nextSeal}` : j.next || "—",
    seals: got.length ? got.join(" · ") : "—",
    visit: `${Math.round(Number(visit.metres) || 0)} 步 · ${Math.max(1, Math.round((Number(visit.seconds) || 0) / 60))} 分钟`,
  };
}

// Builds the panel. `link()` gives devpose's address of this view when ?devpose is on, or null.
export async function mountDebug({ link }) {
  const W = /** @type {any} */ (window);
  const [{ default: GUI }, { default: Stats }] = await Promise.all([import("three/addons/libs/lil-gui.module.min.js"), import("three/addons/libs/stats.module.js")]);
  const tables = import.meta.glob("../levels/*/hall-views.js");
  const walked = W.__level(), ours = walked.keepsPlace !== false;   // the level the page walks (src/level.js), not the one with room views
  const have = Object.keys(tables).map((p) => p.split("/")[2]).sort(), level = levelOf(walked.id, have);
  const rooms = level ? /** @type {any} */ (await tables[`../levels/${level}/hall-views.js`]()).HALL_VIEWS : [];
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(STORE) || "{}") || {}; } catch { return {}; } })();

  const gui = new GUI({ title: `调试 · ${walked.id}` });
  gui.domElement.id = "debug"; gui.domElement.style.zIndex = "60";
  const stats = new Stats(); stats.dom.id = "debugStats"; Object.assign(stats.dom.style, { left: "auto", right: "252px", zIndex: "60" }); document.body.appendChild(stats.dom);
  (function tick() { stats.update(); requestAnimationFrame(tick); })();

  const y0 = W.__yard();
  const s = { where: "", look: "", height: "", frame: "", tier: "", cost: "—", heaviest: "—",
    view: "—", room: "—", season: y0.season, time: y0.time, eye: y0.view, q: new URLSearchParams(location.search).get("q") || "auto" };

  const at = gui.addFolder("位置");
  at.add(s, "where").name("x, z").listen().disable(); at.add(s, "look").name("朝向 / 俯仰").listen().disable(); at.add(s, "height").name("地面高").listen().disable();
  at.add(s, "view", ["—", ...W.__views]).name("命名机位").onChange((v) => { if (v !== "—") W.__show(v); });
  at.add(s, "room", ["—", ...rooms.map((r) => r.name)]).name("殿内机位").onChange(async (v) => {
    const r = rooms.find((x) => x.name === v); if (!r) return;
    await W.__inside(r.hall); W.__pose(...roomPose(r, W.__yard().x));
  });
  at.add({ copy() {
    const y = W.__yard(), url = link() || location.origin + location.pathname + poseQuery(location.search, { x: y.x, z: y.z, yaw: y.yaw, pitch: y.pitch, view: y.view, season: y.season, time: y.time, room: y.room, up: y.up });
    console.info("[debug]", url); navigator.clipboard?.writeText(url).catch(() => {});
  } }, "copy").name("复制此处链接");

  const hour = gui.addFolder("时节");
  hour.add(s, "season", SEASONS).name("季节").listen().onChange((v) => W.__mood(v, s.time));
  hour.add(s, "time", TIMES).name("时辰").listen().onChange((v) => W.__mood(s.season, v));
  hour.add(s, "eye", ["first", "third"]).name("视角").listen().onChange((v) => W.__view(v));

  const perf = gui.addFolder("性能");
  perf.add(s, "frame").name("帧").listen().disable(); perf.add(s, "tier").name("画质").listen().disable();
  perf.add(s, "q", TIERS).name("锁定画质（重新载入）").onChange((v) => { location.search = tierSearch(location.search, v); });
  perf.add({ cost() { s.cost = `${W.__cost()} ms`; } }, "cost").name("量一帧 __cost()"); perf.add(s, "cost").name("一帧").listen().disable();
  perf.add({ census() {
    const c = W.__census(); console.table(c);
    s.heaviest = Object.entries(c).sort((a, b) => b[1].tris - a[1].tris).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v.tris / 1000)}k`).join(" · ");
  } }, "census").name("各部分面数 __census()"); perf.add(s, "heaviest").name("最重").listen().disable();

  const lv = levelState(W.__journey(), W.__visit(), ours);
  const levelFolder = gui.addFolder("关卡");
  const ls = { level: walked.id, state: lv.state, progress: lv.progress, next: lv.next, seals: lv.seals, visit: lv.visit };
  levelFolder.add(ls, "level").name("关卡").disable();
  levelFolder.add(ls, "state").name("完成状态").listen().disable();
  levelFolder.add(ls, "progress").name("朱印").listen().disable();
  levelFolder.add(ls, "next").name("下一处").listen().disable();
  levelFolder.add(ls, "seals").name("已得").listen().disable();
  levelFolder.add(ls, "visit").name("这一趟").listen().disable();

  // The map of temples walked (#449): a temple closed by hand, so that a tester on the canary need not play a close to see the map
  // and cross to the other temple. The record is the visitor's own and nothing a visitor does empties it; only this does.
  const pg = gui.addFolder("行脚图"), ps = { record: "—" };
  const pgRead = () => { const r = W.__pilgrimage(); ps.record = Object.entries(r.record).map(([id, e]) => `${id} ${e.season || "?"}`).join(" · ") || "（空）"; return r; };
  pg.add(ps, "record").name("已打卡").listen().disable();
  for (const id of pgRead().listed) pg.add({ mark() { W.__pilgrimage({ mark: id, season: W.__probe().season }); pgRead(); } }, "mark").name(`打卡 ${id}`);
  pg.add({ open() { W.__pilgrimage({ open: true }); } }, "open").name("打开行脚图（打卡后才有）");
  pg.add({ wipe() { W.__pilgrimage({ wipe: true }); pgRead(); } }, "wipe").name("清空打卡记录");

  // What stops him, drawn (src/walkviz.js): the floor's cells round him, his outline, the ball round his own eye.
  const hit = gui.addFolder("碰撞");
  const hs = { viz: false, cells: "—", walker: W.__walker().mode };
  hit.add(hs, "walker").name("walker").disable();
  hit.add(hs, "viz").name("画出格子、外廓、眼球").onChange(async (v) => { const r = await W.__walkviz(v); hs.cells = r.on ? `${r.grid || "无格子"} · 开 ${r.open} · 挡 ${r.shut}` : "—"; });
  hit.add(hs, "cells").name("他周围 5 米").listen().disable();

  const parts = gui.addFolder("开关");
  const on = W.__part();
  for (const name of Object.keys(on)) parts.add(on, name).name(LABELS[name] || name).onChange((v) => { on[name] = W.__part(name, v); });

  // The readings, a few times a second: often enough to watch, not so often that the panel costs frames.
  let f0 = y0.frames, t0 = performance.now();
  setInterval(() => {
    const y = W.__yard(), t = performance.now();
    Object.assign(s, readout(y, rate(f0, y.frames, t - t0))); f0 = y.frames; t0 = t;
    if (document.activeElement?.closest?.("#debug")) return;   // not while a control is being used
    s.season = y.season; s.time = y.time; s.eye = y.view;
    Object.assign(ls, levelState(W.__journey(), W.__visit(), ours));
    if (hs.viz) W.__walkviz().then((/** @type {any} */ r) => { if (r.on) hs.cells = `${r.grid || "无格子"} · 开 ${r.open} · 挡 ${r.shut}`; });
  }, EVERY);

  const show = (v) => { gui.show(v); stats.dom.style.display = v ? "" : "none"; try { sessionStorage.setItem(STORE, JSON.stringify({ hidden: !v })); } catch {} };
  show(!saved.hidden);
  // Capture phase: the key works with focus on any control of the panel, which may stop its own key events.
  addEventListener("keydown", (e) => { if (e.code === KEY && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) show(gui._hidden); }, true);
  W.__debug = () => ({ level, rooms: rooms.length, hidden: gui._hidden, parts: Object.keys(on), viz: hs.viz });
  return gui;
}
