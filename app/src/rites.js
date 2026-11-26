// How the observances are done, by his hands: the rope of the bell's log drawn back and let go, the bowl of tea lifted
// in both hands and drunk in three sips, three sticks of incense raised to the brow, bowed with and set in the ash,
// and the breath of sitting on the summit. game.js says when; this says how.
//
// Each is a short run of timed passages. A passage writes what it wants of him into `act`, which the walk hands to
// the novice with his pose (monk.js: where each hand should be, how far he bows, how he breathes), and moves the
// thing he holds. Time is the clock's, not the frames': software rendering may draw one frame a second.
import * as THREE from "three";
import { carry, over, fallen, FINGERS, PALM } from "./coin.js";
import { mesh, merge } from "./geo.js";
import { INCENSE_HALLS, SEALED_HALL, incenseId, burnt } from "./incense.js";
import { createWriting } from "./writing.js";
import { brushSound } from "./audio.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
const ease = (u) => u * u * (3 - 2 * u), mix = (a, b, u) => a + (b - a) * u;
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// Where the bell's log hangs along its swing, in metres from rest (toward the bell is negative). `s.t0` is the moment
// it meets the bell and `s.lead` how long it was drawn back for beforehand (none when the bell is only tapped): it is
// drawn away, let go, touches the bronze at `-s.gap` and no further, and swings itself out.
export function logSwing(s, now) {
  if (!s.t0) return 0;
  const g = s.gap ?? 0.18, u = (now - s.t0) / 1000;
  // `s.from` is where it hung when it was taken: a stroke may be begun while the last one still swings.
  if (u < 0) { const L = (s.lead || 0) / 1000; if (!L || u < -L) return s.from || 0; const k = (u + L) / L; return k < 0.5 ? mix(s.from || 0, LOG_DRAW, ease(k / 0.5)) : k < 0.68 ? LOG_DRAW : LOG_DRAW - (LOG_DRAW + g) * ((k - 0.68) / 0.32) ** 2; }   // drawn back, held a moment, let go
  if (u > 9) return 0;
  const after = (v) => Math.max(-g, -g * Math.exp(-3 * v) + 0.3 * Math.exp(-0.9 * v) * Math.sin(3 * v));
  return s.lead ? after(u) : u < TAP ? -g * (u / TAP) : after(u - TAP);   // a tap sends it straight in
}
const LOG_DRAW = 0.24, TAP = 0.08;
// The clock the observances keep. A test or a picture tool may hold it still and step it (`__riteClock(ms)` moves it
// on by so much and holds it there; `__riteClock(null)` lets it run again), so that a moment can be looked at.
// While a photograph holds the picture still (`pauseRites`), the clock stops too, and when it runs again it takes up
// where it stopped: an observance half done is not found finished behind the print. A page hidden behind a phone's dark
// screen is the same: no time is kept, and the passage is found where it was (a pause and a hidden page count once).
let held = null, offset = 0, pausedAt = null, hiddenAt = null;
// Where the eye must aim so that a point (the top of the pavilion at the close) stays a margin of the picture's height
// under its upper edge: the aim it was given, raised only as far as that needs. The picture is taller or wider on
// different screens, and the pavilion taller than it was.
const _frame = new THREE.PerspectiveCamera();
// Given several points (the ornaments at both ends of the ridge), the one highest in the picture is the one kept clear.
/** @param {THREE.Vector3} cam @param {THREE.Vector3} aim @param {THREE.Vector3 | THREE.Vector3[]} top @param {number} fov @param {number} aspect */
export function aimToFrame(cam, aim, top, fov, aspect, margin = 0.08) {
  _frame.fov = fov; _frame.aspect = aspect; _frame.updateProjectionMatrix(); _frame.position.copy(cam);
  const tops = Array.isArray(top) ? top : [top];
  const at = (y) => { _frame.lookAt(aim.x, y, aim.z); _frame.updateMatrixWorld(); return Math.max(...tops.map((t) => _v.copy(t).project(_frame).y)); }, want = 1 - 2 * margin;
  if (at(aim.y) <= want) return aim.clone();
  let lo = aim.y, hi = aim.y + 60; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (at(mid) <= want) hi = mid; else lo = mid; }
  return new THREE.Vector3(aim.x, hi, aim.z);
}
const _v = new THREE.Vector3();
export const riteNow = (now = performance.now()) => held ?? ((hiddenAt ?? now) - offset);
/** The page was hidden (a phone's screen off, another tab) or is seen again: the clock keeps no time while it is away.
 *  `@param {boolean} hidden @param {number} [now]` */
export function setHidden(hidden, now = performance.now()) {
  if (hidden) { if (hiddenAt === null) hiddenAt = now; return; }
  if (hiddenAt === null) return;
  if (pausedAt === null && held === null) offset += now - hiddenAt;   // a pause already holds this time: count it once
  hiddenAt = null;
}
export function pauseRites(on, now = performance.now()) {
  if (on && pausedAt === null && held === null) { pausedAt = now; held = pausedAt - offset; }
  else if (!on && pausedAt !== null) { offset += now - pausedAt; pausedAt = null; held = null; }
}
/** Only for a test: the clock starts again at zero, with nothing holding it. */
export function resetClock() { held = null; offset = 0; pausedAt = null; hiddenAt = null; }
if (typeof document !== "undefined" && typeof document.addEventListener === "function") document.addEventListener("visibilitychange", () => setHidden(document.hidden));
if (typeof window !== "undefined") window.__riteClock = (ms) => { held = ms == null ? null : (held ?? riteNow()) + ms; return held; };

function softDot() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.45, "rgba(255,255,255,0.32)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// `burn`: how many seconds three sticks take to burn down to the ash (five minutes unless a test asks for less);
// `onPlant(at)`: told the moment, on the wall clock, that they are set in the ash, so the page can keep it.
// The ring the breath lays on the ground, for a breath `k` full (0 empty, 1 full): its radius in metres, measured to the
// brush's centre line, and how firmly it is drawn. It starts outside his folded knees (about 0.4 m from the seat) and
// opens to a little under a metre. With reduced motion it keeps its size and only fades.
export const RING_PLANE = 1 / 0.766;   // the enso texture's centre line lies at 196 of 256 px from its middle: a plane of this side makes a ring of radius 1
export function breathRing(k, reduced = false) {
  const u = Math.min(1, Math.max(0, k));
  return { radius: reduced ? 0.9 : 0.55 + 0.4 * ease(u), opacity: u === 0 ? 0 : 0.78 * Math.min(1, 0.25 + 0.75 * ease(u)) };
}
// His tea bowl: black glaze over a turned body, standing on its foot (the origin), with the tea in it. One closed
// surface turned about its axis: the hollow under the foot ring, the foot, the outer wall to the rim, the rim's top,
// the inner wall and the well inside, so that seen from any side, from below as he tilts it at his lips too, it is
// solid (#163: the stage's open cylinder, not this, was what showed an empty bottom). The tea is a disc just under the
// inner wall at 4.7 cm, a little below the rim; it is carried with the bowl, so it never comes out over the rim
// (tests/unit/tea-bowl.test.mjs).
export const BOWL = [[0, 0.012], [0.03, 0], [0.036, 0.012], [0.07, 0.048], [0.078, 0.06], [0.072, 0.06], [0.028, 0.02], [0, 0.02]];
export const TEA = { r: 0.0575, y: 0.047 };
/** @param {{ glaze: THREE.Material, tea: THREE.Material }} M */
export function teaBowl(M) {
  const cup = new THREE.Group();
  cup.add(mesh(lathe(BOWL, 24), M.glaze), mesh(new THREE.CircleGeometry(TEA.r, 20).rotateX(-Math.PI / 2).translate(0, TEA.y, 0), M.tea));
  cup.traverse((o) => { o.userData.keep = o.userData.soft = true; o.userData.part = "bowl"; });
  return cup;
}

export function createRites(y, fast = 1, { burn = 300, onPlant = (/** @type {number} */ at, /** @type {string} */ hall) => {}, enso = null } = {}) {
  const { monk, scene, site, M } = y, B = monk.bones, G = monk.group, places = site.places;
  const hand = () => ({ at: V(), fingers: V(0, 1, 0), palm: V(1, 0, 0), w: 0 });
  const act = { bow: 0, twist: 0, nod: 0, look: 0, breath: null, hands: { left: hand(), right: hand() } };
  /** @type {[string, number][]} */
  const HANDS = [["left", 1], ["right", -1]];
  // A point and a direction of his own (x to his left, z the way he faces) in the world.
  const at = (x, yy, z, out = V()) => G.localToWorld(out.set(x, yy, z)), dir = (x, yy, z, out = V()) => out.set(x, yy, z).applyQuaternion(G.quaternion).normalize();
  const between = (out = V()) => B.leftHand.getWorldPosition(out).add(B.rightHand.getWorldPosition(tA)).multiplyScalar(0.5);
  const tA = V(), tB = V(), tC = V(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion();

  // ---- Passages: each runs for so many seconds and is dropped the moment the observance is broken off ----
  const jobs = [], always = [];
  const play = (secs, fn, on) => new Promise((done) => {
    const t0 = riteNow(), T = Math.max(1, secs * 1000 * fast);
    jobs.push((now) => { if (!on()) { done(false); return true; } const u = Math.min(1, (now - t0) / T); fn(u); if (u >= 1) { done(true); return true; } return false; });
  });
  // The eye goes back to him that long before his hands are done (src/director.js: the way back takes `directOut()`
  // seconds), so that it arrives as the observance ends rather than starting out after it. `secs` is the passage under
  // way, `u` how far into it, `after` how much more of the observance follows it.
  // (Only once the eye has arrived: a swing that takes longer than the observance, from behind him round to a shot
  // before him, is not turned back half way; the observance's end brings it home instead.)
  const homeward = (u, secs, after = 0) => { if (y.directed?.() && y.directArrived?.() && ((1 - u) * secs + after) * fast <= (y.directOut?.() ?? 1)) y.direct(null); };
  y.onTick(() => { const now = riteNow(); for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i](now)) jobs.splice(i, 1); for (const f of always) f(now); });

  // ---- Smoke and steam: a few soft puffs that rise from a point, spread and thin ----
  const dot = softDot();
  function wisp(n, { size, rise, spread, life, opacity, color = 0xffffff }) {
    const g = new THREE.Group(), src = V(); g.visible = false; g.userData.part = "wisp";
    const puffs = Array.from({ length: n }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, depthWrite: false, opacity: 0 })); g.add(s); return s; });
    scene.add(g);
    always.push((now) => {
      if (!g.visible) return;
      const t = now / 1000 / life;
      puffs.forEach((p, i) => {
        const u = (((t + i / n) % 1) + 1) % 1, a = i * 2.4 + Math.floor(t + i / n) * 1.7;
        p.position.set(src.x + Math.sin(a + u * 3.1) * spread * u * u, src.y + rise * u, src.z + Math.cos(a * 1.3 + u * 2.3) * spread * u * u);
        p.scale.setScalar(size * (0.35 + 1.5 * u)); p.material.opacity = opacity * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - 0.5 * u);
      });
    });
    return { group: g, src, show(v) { g.visible = !!v; } };
  }

  // ================= The bell =================
  // A rope hangs from the end of the log, out past the platform's edge. He takes it in both hands, draws the log
  // back toward himself, and lets it go.
  const bellS = site.strikers.find((k) => k.kind === "bell");
  const rope = mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 6).translate(0, 0.5, 0), M.straw), knot = mesh(new THREE.SphereGeometry(0.024, 8, 6).scale(1, 1.5, 1), M.straw);
  for (const o of [rope, knot]) { o.userData.soft = o.userData.keep = true; o.userData.part = "rope"; scene.add(o); }
  const bell = { grip: 0, top0: null, axis: V(), top: V(), end: V(), held: false };
  always.push(() => {
    if (!bellS || !bellS.rope) { rope.visible = knot.visible = false; return; }
    if (!bell.top0) { const z = bellS.swing.position.z; bellS.swing.position.z = 0; bellS.swing.updateWorldMatrix(true, false); bell.top0 = bellS.swing.localToWorld(V().fromArray(bellS.rope)); bell.axis.set(0, 0, 1).transformDirection(bellS.swing.matrixWorld); bellS.swing.position.z = z; }
    const d = bellS.swing.position.z;
    bell.top.copy(bell.top0).addScaledVector(bell.axis, d);
    bell.end.copy(bell.top); bell.end.y -= 1.14;
    if (bell.grip > 0) bell.end.lerp(between(tB).addScaledVector(dir(0, 0.2, 1, tC), 0.03), bell.grip);
    rope.position.copy(bell.top); tB.subVectors(bell.end, bell.top); const len = tB.length();
    rope.scale.set(1, len, 1); rope.quaternion.setFromUnitVectors(UP, tB.divideScalar(len || 1)); knot.position.copy(bell.end).addScaledVector(tB, 0.03);
    if (!bell.held) return;
    // His hands go with the rope: down and in as the log comes back to him, up and out as it goes to the bell; and
    // he leans with it.
    act.bow = -0.55 * d;
    HANDS.forEach(([n, s]) => { const h = act.hands[n]; at(s * 0.012, 0.8 - 0.75 * d + s * 0.034, 0.3 - 0.3 * d, h.at); dir(0, 0.25, 1, h.fingers); dir(-s, 0.1, 0, h.palm); });
  });
  // He takes the rope once; after that every stroke is the visitor's: one press, one pull. The log is drawn back
  // from wherever it hangs, so a stroke may follow the last while it still swings, but not until it has come off
  // the bronze and started back (`ready`), and the pull lands on the bell `PULL` seconds after the press.
  const PULL = 1.3, RESWING = 1.3, peal = { pulls: 0, last: -Infinity, busy: false, drawn: 0 };
  const ready = () => bell.held && bell.grip >= 1 && !peal.busy && (riteNow() - peal.last) / 1000 >= RESWING * fast;
  async function takeRope(on) {
    if (!bellS) return false;
    bell.held = true; peal.drawn = 0;
    return play(0.7, (u) => { bell.grip = act.hands.left.w = act.hands.right.w = ease(u); }, on);
  }
  async function pull(on) {
    if (!bellS || !ready()) return false;
    peal.busy = true;
    const lead = PULL * 1000 * fast; bellS.from = bellS.swing.position.z; bellS.lead = lead; bellS.t0 = riteNow() + lead;
    // Once drawn back the log is going to the bell: if he lets go of the rope halfway, it still swings in and sounds.
    await play(PULL, () => {}, () => true);
    // How far the log went back on its way (logSwing, unit-tested), kept for the tests: a slow renderer may not draw that moment.
    peal.busy = false; bellS.from = 0; peal.last = riteNow(); peal.pulls++; peal.drawn = Math.max(peal.drawn, LOG_DRAW);
    y.strike("bell", true); return on();
  }
  async function letGo(on) {
    await play(0.6, (u) => { bell.grip = act.hands.left.w = act.hands.right.w = 1 - ease(u); }, on);
    bell.held = false; return on();
  }

  // ================= Tea =================
  // His bowl stands before him on its lacquer stand. He leans to it, lifts it in both hands, drinks three times
  // and sets it back.
  const T = places.tea, cup = teaBowl(M), home = T && T.bowl ? V().fromArray(T.bowl) : null, tea = { held: 0, tilt: 0, sips: 0 };
  const steam = wisp(5, { size: 0.09, rise: 0.34, spread: 0.07, life: 3.4, opacity: 0.2 }), ewer = wisp(5, { size: 0.1, rise: 0.4, spread: 0.08, life: 3.8, opacity: 0.2 });
  if (home) { cup.position.copy(home); cup.rotation.y = T.face; scene.add(cup); steam.src.copy(home).y += 0.06; steam.show(true); if (T.steam) { ewer.src.fromArray(T.steam); ewer.show(true); } }
  const rim = V(0, 0.06, -0.07), chestAt = (out) => B.chest.localToWorld(out.set(0, 0.0, 0.17)), mouthAt = (out) => B.head.localToWorld(out.set(0, 0.052, 0.128));
  // Wherever the bowl is, his hands are on either side of it, low, cradling it from beneath and a little toward him.
  // They turn with the bowl as he tilts it to drink; held at its sides above the foot (0.034 up, 0.012 out, as they were
  // until #286), they went round with it at the full tilt and came up over his eyes, 4.5 cm above their lower edge.
  // Held here they stay 2.3 cm below it the whole drink (tests/unit/rites-tea.test.mjs).
  const hold = () => { const [hx, hy, hz] = y.monk.dressed ? [0.068, -0.025, -0.025] : [0.054, 0.02, -0.008]; HANDS.forEach(([n, s]) => { const h = act.hands[n]; h.at.set(s * hx, hy, hz).applyQuaternion(cup.quaternion).add(cup.position); dir(-s * 0.45, 0.15, 1, h.fingers); dir(-s, 0.25, 0, h.palm); }); };
  const cupAt = (p, tilt) => { tea.tilt = tilt; cup.quaternion.copy(G.quaternion).multiply(qA.setFromAxisAngle(V(1, 0, 0), -tilt)); cup.position.copy(p); };
  const toLips = (out) => mouthAt(out).sub(tB.copy(rim).applyQuaternion(cup.quaternion));
  /** @param {() => boolean} on @param {(what: string) => void} [cue] */
  async function drinkTea(on, cue = () => {}) {
    if (!home) return false;
    const w = (v) => { act.hands.left.w = act.hands.right.w = v; };
    cupAt(home, 0); steam.show(false);
    if (!(await play(1.1, (u) => { act.bow = 0.62 * ease(u); hold(); w(ease(u)); }, on))) return false;
    tea.held = 1;
    if (!(await play(1.0, (u) => { const k = ease(u); act.bow = mix(0.62, 0.06, k); cupAt(tA.copy(home).lerp(chestAt(tC), k), 0); cup.position.y += 0.05 * Math.sin(Math.PI * k); hold(); }, on))) return false;
    for (let i = 0; i < 3; i++) {
      if (!(await play(0.75, (u) => { const k = ease(u); act.nod = -0.17 * k; cupAt(chestAt(tA), 0.5 * k); cup.position.lerp(toLips(tC), k); hold(); }, on))) return false;
      if (!(await play(0.75, (u) => { act.nod = -0.17 - 0.07 * ease(u); cupAt(tA, 0.5 + 0.28 * ease(u)); cup.position.copy(toLips(tC)); hold(); }, on))) return false;
      tea.sips = i + 1; if (i === 0) cue("first");
      if (!(await play(0.75, (u) => { const k = 1 - ease(u); act.nod = -0.24 * k; cupAt(chestAt(tA), 0.78 * k); cup.position.lerp(toLips(tC), k); hold(); }, on))) return false;
      if (!(await play(0.6, () => { cupAt(chestAt(tA), 0); hold(); }, on))) return false;
    }
    if (!(await play(1.1, (u) => { const k = ease(u); act.bow = mix(0.06, 0.62, k); cupAt(chestAt(tA).lerp(home, k), 0); cup.position.y += 0.05 * Math.sin(Math.PI * k); hold(); }, on))) return false;
    tea.held = 0; cupAt(home, 0); cup.rotation.set(0, T.face, 0);
    return play(0.9, (u) => { act.bow = 0.62 * (1 - ease(u)); w(1 - ease(u)); }, on);
  }

  // ---- After the tea: he stays on his stool as long as the visitor lets him ----
  // The bowl is back on its stand, steaming a little less. His hands come to rest, he breathes slowly, and now and
  // then he turns to look out over the court and back. Nothing is counted and nothing ends it but the visitor.
  /** @param {() => boolean} on */
  async function linger(on) {
    const t0 = riteNow(), look = { from: 0, to: 0, at: 0 };
    act.hands.left.w = act.hands.right.w = 0;
    let next = 6 + Math.random() * 4;
    while (on()) {
      if (!(await play(1, () => {
        const t = (riteNow() - t0) / 1000 / fast, ph = (t % 8) / 8, inn = ph < 0.42;   // a breath every eight seconds, longer out than in
        act.breath = inn ? -1 + 1.6 * ease(ph / 0.42) : 0.6 - 1.6 * ease((ph - 0.42) / 0.58);
        if (t > next) { look.from = look.to; look.to = look.to ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.25); look.at = t; next = t + (look.to ? 5 + Math.random() * 3 : 9 + Math.random() * 8); }
        const k = ease(Math.min(1, (t - look.at) / 2.4)), v = mix(look.from, look.to, k);
        act.twist = v * 0.55; act.look = v; act.nod = 0.03 + 0.02 * Math.abs(v);
      }, on))) break;
    }
    act.breath = null; act.twist = act.nod = act.look = 0;
    return false;
  }

  // ================= Incense =================
  // Three sticks between his palms: raised to the brow, three bows, a step up to the stand, and set in the ash.
  // Each hall that keeps a Buddha has its own sticks, its own smoke and its own clock (#146): what was set in one hall's ash
  // burns on from the time it was set, whatever is done in another.
  const LEFT = 0.16;   // the stub left standing, of the stick's length
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b2d1c, roughness: 0.9 }), ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 1.5, 0.45), fog: false });
  const makeSticks = () => { const g = new THREE.Group();
    for (const [rz, rx] of [[-0.085, 0.03], [0, -0.045], [0.085, 0.03]]) { const s = new THREE.Group(); s.rotation.set(rx, 0, rz);
      s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.3, 5).translate(0, 0.15, 0), wood), new THREE.Mesh(new THREE.SphereGeometry(0.0042, 6, 5).translate(0, 0.302, 0), ember)); g.add(s); }
    g.traverse((o) => { o.userData.part = "incense"; }); g.visible = false; scene.add(g); return g; };
  /** @type {Record<string, ReturnType<typeof makeStand>>} */ const stands = {};
  function makeStand(/** @type {string} */ hall) {
    const I = places[incenseId(hall)], sticks = makeSticks(), smoke = wisp(7, { size: 0.07, rise: 0.75, spread: 0.1, life: 5.5, opacity: 0.2, color: 0xdfe6ee }), inc = { planted: false, shown: false, at: 0, burnt: false };
    const plantAt = I && I.bowl ? V(I.bowl[0], I.bowl[1] - 0.035, I.bowl[2]) : null;
    // Each stick burns from its tip: what is left of it shortens, the glowing tip comes down with it, and the smoke
    // rises from lower and lower. At the end the stubs stand in the ash a finger high, cold, and incense may be offered again.
    const burnTo = (k) => { const h = 1 - (1 - LEFT) * Math.min(1, Math.max(0, k)); sticks.children.forEach((g) => { const [wood, tip] = /** @type {any[]} */ (g.children); wood.scale.y = h; tip.position.y = -0.302 * (1 - h); tip.visible = k < 1; }); if (plantAt) smoke.src.copy(plantAt).y += 0.3 * h; };
    const stand = () => { sticks.visible = true; sticks.scale.setScalar(1); sticks.position.copy(plantAt); sticks.quaternion.identity(); };
    const plant = (at = Date.now()) => { if (!plantAt) return; inc.planted = inc.shown = true; inc.burnt = false; inc.at = at; stand(); burnTo(burnt(at, Date.now(), burn)); smoke.show(true); };
    const burntOut = () => { if (!plantAt) return; inc.planted = false; inc.burnt = inc.shown = true; stand(); burnTo(1); smoke.show(false); };
    always.push(() => { if (!inc.planted) return; const k = burnt(inc.at, Date.now(), burn); if (k >= 1) burntOut(); else burnTo(k); });
    return { hall, I, sticks, smoke, inc, plantAt, burnTo, stand, plant, burntOut };
  }
  for (const h of INCENSE_HALLS) if (places[incenseId(h)]) stands[h] = makeStand(h);
  const S = (hall = SEALED_HALL) => stands[hall];
  // Between his palms: the sticks stand up out of his joined hands and lean as he leans.
  let sticks = stands[SEALED_HALL]?.sticks ?? new THREE.Group();   // the sticks he holds are those of the hall he is in
  const inHands = () => { between(sticks.position); B.chest.getWorldQuaternion(sticks.quaternion).multiply(qA.setFromAxisAngle(V(1, 0, 0), 0.12)); sticks.position.addScaledVector(tB.set(0, -0.02, 0.012).applyQuaternion(sticks.quaternion), 1); };
  const brow = (k) => HANDS.forEach(([n, s]) => { const h = act.hands[n]; B.head.localToWorld(h.at.set(s * 0.0125, 0.15, 0.15)); dir(0, 1, 0.25, h.fingers); dir(-s, 0, 0, h.palm); h.w = k; });
  /** @param {() => boolean} on @param {any} st @param {(what: string) => void} [cue] */
  async function offerIncense(on, st, cue = () => {}, hall = SEALED_HALL) {
    const hs = S(hall); if (!hs || !hs.I || !hs.plantAt || hs.inc.planted) return false;
    const { I, inc, plantAt, burnTo, smoke, plant } = hs; sticks = hs.sticks;
    inc.burnt = false; burnTo(0); smoke.show(false); sticks.visible = inc.shown = true;   // three new sticks, whole; what was in the ash is cleared
    if (!(await play(0.7, (u) => { sticks.scale.setScalar(Math.max(0.001, ease(u))); inHands(); }, on))) return false;
    if (!(await play(0.9, (u) => { brow(ease(u)); inHands(); }, on))) return false;
    for (let i = 0; i < 3; i++) if (!(await play(1.5, (u) => { act.bow = 0.5 * Math.sin(Math.PI * ease(u)); brow(1); inHands(); }, on))) return false;
    cue("bowed");
    if (!(await play(0.8, (u) => { brow(1 - ease(u)); inHands(); }, on))) return false;
    // A step or two up to the stand, the sticks still between his palms.
    const from = [I.at[0], I.at[1]], dist = Math.hypot(I.front[0] - from[0], I.front[1] - from[1]), stepSecs = 1.3, stepDur = Math.max(1e-3, stepSecs * fast);
    if (!(await play(stepSecs, (u) => { const k = ease(u); st.speed = (dist / stepDur) * 6 * u * (1 - u); st.seat = [mix(from[0], I.front[0], k), mix(from[1], I.front[1], k)]; inHands(); }, on))) { st.speed = null; return false; }
    st.speed = null; st.seat = I.front.slice(); y.put(I.front[0], I.front[1]);
    // He leans over the bowl and his right hand sets them in the ash.
    const h = act.hands.right; inHands(); const p0 = sticks.position.clone(), q0 = sticks.quaternion.clone();
    if (!(await play(1.2, (u) => { const k = ease(u); act.bow = 0.5 * k; sticks.position.copy(p0).lerp(plantAt, k); sticks.position.y += 0.07 * Math.sin(Math.PI * k); sticks.quaternion.copy(q0).slerp(qB.identity(), k);
      h.at.copy(sticks.position); h.at.y += 0.09; h.at.addScaledVector(dir(-1, 0, 0, tC), 0.02); dir(0, -0.5, 1, h.fingers); dir(1, 0, 0.2, h.palm); h.w = Math.min(1, u * 4); }, on))) return false;
    plant(); onPlant(inc.at, hall);
    if (!(await play(0.9, (u) => { act.bow = 0.5 * (1 - ease(u)); h.w = 1 - ease(u); }, on))) return false;
    return play(1.6, (u) => { act.bow = 0.5 * Math.sin(Math.PI * ease(u)); homeward(u, 1.6); }, on);   // and once more, hands together
  }

  // ================= Sitting =================
  // A breath in fills his chest, and a ring of brush on the ground round his seat fills with it: it opens and firms as he
  // breathes in and closes and fades as he breathes out. It lies on the mat's floor and not on the screen, where the
  // sitting's own shot, from before him and low, had it over his face (#156). One ring does what the ring that went
  // out with each breath out did too; it is the mark the ground carries for a place (game.js's enso), made to breathe.
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: enso, transparent: true, opacity: 0, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  ring.visible = false; ring.renderOrder = 2; ring.userData.part = "breath"; scene.add(ring);
  const sit = { breaths: 0, fill: 0 };
  // Lays the ring for a breath `k` full (0 out, 1 in) under him.
  function breathe_ring(k) {
    const s = breathRing(k, y.reduced?.() ?? false);
    ring.visible = s.opacity > 0.001; sit.fill = k;
    if (!ring.visible) return;
    ring.position.copy(G.position).y += 0.04; ring.rotation.y = 0.6;
    ring.scale.setScalar(s.radius * RING_PLANE); ring.material.opacity = s.opacity;
    ring.material.color.set(y.night() ? 0xffd9a0 : 0xf3eddc);   // pale, as the marks the ground carries for a place are: ink would be lost on dark stone
  }
  // `to` is 1 for a breath in and -1 for a breath out, taken over `secs`; `last`: the eye goes back to him as it ends
  // (not when the chapter closes after it: then the close takes the eye from the shot).
  async function breathe(to, secs, on, last = false) {
    const from = act.breath ?? -1;
    const ok = await play(secs, (u) => { const k = ease(u); act.breath = mix(from, to, k); act.nod = to < 0 ? 0.05 * k : 0.05 * (1 - k);
      breathe_ring(to > 0 ? k : 1 - k);
      if (last) homeward(u, secs); }, on);
    if (to < 0) { breathe_ring(0); if (ok) sit.breaths++; }
    return ok;
  }

  // ================= The well and the lamp =================
  // At the dragon well he only watches: a drop falls from the rock every second and a half, three times, each ringing
  // out across the pool (`drip`), and he watches the last ring go. At the lamp he stands a moment before it, then lights
  // it (`light`), and stands a moment more in its light. (The timing is what game.js gave them before; it is here so that
  // the eye can be sent home before they end, as with the others.)
  /** @param {() => boolean} on @param {() => void} drip */
  async function watchWell(on, drip) {
    for (let i = 0; i < 3; i++) { if (!(await play(1.5, () => {}, on))) return false; drip(); }
    return play(2.0, (u) => homeward(u, 2.0), on);
  }
  /** @param {() => boolean} on @param {() => void} light */
  async function lightLamp(on, light) {
    if (!(await play(1.8, () => {}, on))) return false;
    light();
    return play(2.0, (u) => homeward(u, 2.0), on);
  }

  // ================= The close of the chapter =================
  // When the seventh seal is earned he is sitting on the summit. The eye leaves his shoulder: it comes round before
  // him, draws back down the steps and rises until the pavilion stands whole on its mountain, while he goes on
  // breathing and the closing words are said (game.js says them, on `cue`). `secs` is the whole of it.
  const END = { secs: 30, on: false, u: 0, aim: 0, route: /** @type {null | ((t: number) => number[])} */ (null), frame: /** @type {null | { o: number[], f: number[], l: number[] }} */ (null) };
  /** @param {() => boolean} on @param {(seconds: number) => void} [cue] */
  async function close(on, cue = () => {}) {
    const eye = { p: V(), q: new THREE.Quaternion(), fov: 50 };   // where the eye stood on the last frame: the far view is made of it
    const cam0 = V(), look0 = V(), look = V(), o = G.position.clone(), f = dir(0, 0, 1).clone(), l = dir(1, 0, 0).clone();
    const P = (a, b, c) => o.clone().addScaledVector(l, a).addScaledVector(f, c).setY(o.y + b);
    END.frame = { o: o.toArray(), f: f.toArray(), l: l.toArray() };
    let path = null, aim = null, off = null;
    // The eye's place `u` of the way through the close (0 to 1), and where it looks. The route itself is laid from where he sits, not from where
    // the eye happened to be when the close began (the eye behind him may be anywhere, drawn in by whatever stands there): it goes from a
    // point just before him up and out over the court, kept 1 m clear of everything drawn there, the porch's balusters and the ginkgoes'
    // crowns included (#498; the clear corridor was found in the eye's own hierarchy, `tests/e2e` `ending-eye` holds it); the eye's own
    // starting place is carried along as an offset that is gone by the fifth second, so that the picture still starts where it was.
    const at = (u, eyeOut, lookOut) => {
      const k = ease(Math.min(1, u * 1.04)), fade = 1 - ease(Math.min(1, u / 0.15));
      path.getPoint(k, eyeOut).addScaledVector(off, fade); aim.getPoint(k, lookOut);
    };
    END.on = true; END.u = 0; END.route = null;
    y.cine((camera) => {
      if (!path) { y.undirect?.(); cam0.copy(camera.position);   // from wherever the eye was, the sitting's own shot included
        camera.getWorldDirection(look0).multiplyScalar(6).add(cam0);
        // The last look is raised, if need be, until the pavilion's ridge ornaments stand clear of the picture's top.
        const far = P(9, 17, 34), roofs = site.walk.roofs.filter((r) => Math.hypot((r.x0 + r.x1) / 2 - o.x, (r.z0 + r.z1) / 2 - o.z) < 16), tall = roofs.sort((p, q) => q.top - p.top)[0];
        path = new THREE.CatmullRomCurve3([cam0.clone(), P(1.5, 0.75, 3.1), P(3.6, 2.6, 8.5), P(7, 9, 19), far], false, "centripetal");
        off = V();
        const tops = [new THREE.Vector3((tall?.x0 + tall?.x1) / 2, tall?.top + 1.6, (tall?.z0 + tall?.z1) / 2), ...(tall?.crest || []).map(([x, cy, z]) => new THREE.Vector3(x, cy, z))];
        const last = tall ? aimToFrame(far, P(0, 5, -6), tops, camera.fov, camera.aspect) : P(0, 5, -6);
        aim = new THREE.CatmullRomCurve3([look0.clone(), P(0, 0.45, 0), P(0, 0.9, -1), P(0, 3.2, -4), last], false, "centripetal"); END.aim = +last.y.toFixed(2);
        END.route = (t, eyeOut = V(), lookOut = V()) => { at(Math.min(1, t / END.secs), eyeOut, lookOut); return [...eyeOut.toArray(), ...lookOut.toArray()]; }; }
      at(END.u, camera.position, look); camera.lookAt(look);
      eye.p.copy(camera.position); eye.q.copy(camera.quaternion); eye.fov = camera.fov;
    });
    const ok = await play(END.secs, (u) => {
      END.u = u; const t = u * END.secs, ph = (t % 9) / 9, inn = ph < 0.45;   // a breath every nine seconds: in, then longer out
      act.breath = inn ? -1 + 2 * ease(ph / 0.45) : 1 - 2 * ease((ph - 0.45) / 0.55); act.nod = 0.03;
      cue(t);
    }, on);
    ring.visible = false; act.breath = null; act.nod = 0; END.on = false; y.cine(null);
    if (path) y.holdEye?.(eye);   // the eye stays where the close left it (the far view); game.js says whether it comes home
    return ok;
  }

  // ---- A coin for the 功德箱 ----
  // He bows with his palms together; a coin shows between the fingertips of his right hand, which takes it from the
  // prayer to just over the slot (src/coin.js: his arm reaches it from where he stands, a bow leaning him in) while the
  // left hand goes to rest at his sash; the fingers open, and the coin falls the few centimetres into the slot, where it
  // is gone and where the sound is made (`cue("in")`, in the same frame); the hand comes back to the prayer, and he bows
  // once more. The coin is never anywhere but between his fingers until it is let go.
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.0024, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 0.8, roughness: 0.35 }));
  coin.visible = false; coin.userData.keep = true; coin.userData.part = "coin"; scene.add(coin);
  const coinState = { passedAt: null, y: null, released: false, began: null };
  const local = (w) => G.worldToLocal(V().copy(w)), world = (l) => at(l.x, l.y, l.z), along = (l) => dir(l.x, l.y, l.z);
  /** @param {() => boolean} on @param {number[]} slot the middle of the slot on the lid's top, in the world @param {(what: string) => void} [cue] */
  async function dropCoin(on, slot, cue = () => {}) {
    const R = act.hands.right, Lh = act.hands.left, S = V().fromArray(slot);
    const gone = () => { coin.visible = false; return false; };
    coinState.passedAt = null; coinState.released = false; coinState.y = null; coinState.began = riteNow();
    // First the bow, palms together.
    if (!(await play(0.9, (u) => { act.bow = 0.28 * Math.sin(Math.PI * ease(u)); }, on))) return false;
    // The coin shows between the fingertips of the right hand, where the palms meet.
    const H0 = local(B.rightHand.getWorldPosition(V())), SL = local(S), tip = V();
    const hold = (c) => { R.at.copy(world(c.at)); R.fingers.copy(along(c.fingers)); R.palm.copy(along(PALM)); coin.position.copy(world(c.coin)); coin.quaternion.copy(G.quaternion); coinState.y = coin.position.y; };
    if (!(await play(0.45, (u) => { hold(carry(0, H0, SL)); R.w = 1; coin.visible = true; coin.scale.setScalar(Math.max(0.01, ease(u))); }, on))) return gone();
    // The right hand takes it over the slot; the left goes to rest; he leans in.
    if (!(await play(1.3, (u) => {
      const k = ease(u); hold(carry(u, H0, SL)); R.w = 1;
      Lh.at.copy(world(tip.set(0.07, 0.5, 0.11))); Lh.fingers.copy(along(tip.set(0, -0.3, 1))); Lh.palm.copy(along(tip.set(0, 1, 0))); Lh.w = Math.min(1, k * 1.6);
      act.bow = mix(0.28, 0.55, k);
    }, on))) return gone();
    // It is held there a moment.
    if (!(await play(0.4, () => { hold(carry(1, H0, SL)); act.bow = 0.55; }, on))) return gone();
    // The fingers open. The hand eases back a little; the coin falls straight down, gone as it passes the lid's top.
    const rise = over(SL).wrist, T = 0.45;
    coinState.released = true;
    if (!(await play(T, (u) => {
      const k = ease(Math.min(1, u * 2)); hold(carry(1, H0, SL)); R.at.copy(world(tip.copy(rise).add(V(0, 0.03 * k, -0.025 * k)))); R.fingers.copy(along(FINGERS.over));
      if (!coin.visible) return;
      const h = fallen(u * T);
      if (h > 0) { coin.position.copy(S); coin.position.y = S.y + h; coinState.y = coin.position.y; }
      else { coin.visible = false; coinState.passedAt = performance.now(); coinState.y = S.y; cue("in"); }
    }, on))) return gone();
    if (coin.visible) { coin.visible = false; coinState.passedAt = performance.now(); cue("in"); }
    // The hand comes back to the prayer (the first third), and the second bow (the middle), while the eye is still on its
    // shot; the eye starts home a second before the end (`homeward`), as at the other observances.
    return play(2.6, (u) => {
      const kh = ease(Math.min(1, u / 0.35)), kb = Math.min(1, Math.max(0, (u - 0.3) / 0.4));
      R.w = Lh.w = 1 - kh; act.bow = 0.55 * (1 - kh) + 0.32 * Math.sin(Math.PI * kb);
      homeward(u, 2.6);
    }, on);
  }

  // The moment the coin is held over the slot, at once (`?show=shot-main-box`: a picture of the eye's own shot).
  function poseCoin(slot, from, face, floor) {   // `from`: [x, z] where he stands, `face`: his heading, `floor`: its height (he is not yet there)
    const dx = slot[0] - from[0], dz = slot[2] - from[1], R = act.hands.right, Lh = act.hands.left, tip = V();
    const SL = V(dx * Math.cos(face) - dz * Math.sin(face), slot[1] - floor, dx * Math.sin(face) + dz * Math.cos(face)), c = carry(1, V(), SL);   // in his frame, as coin.js has it
    const yaw = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), face), to = (l) => V(l.x, l.y, l.z).applyQuaternion(yaw).add(V(from[0], floor, from[1])), way = (l) => V(l.x, l.y, l.z).applyQuaternion(yaw);
    R.at.copy(to(c.at)); R.fingers.copy(way(c.fingers)); R.palm.copy(way(PALM)); R.w = 1; coin.position.copy(to(c.coin)); coin.quaternion.copy(yaw); coin.scale.setScalar(1); coin.visible = true;
    Lh.at.copy(to(tip.set(0.07, 0.5, 0.11))); Lh.fingers.copy(way(tip.set(0, -0.3, 1))); Lh.palm.copy(way(tip.set(0, 1, 0))); Lh.w = 1; act.bow = 0.55;
  }

  // ================= Writing on a temple's own page =================
  // T05's observation and the copy of the stele (src/writing.js): the leaf and the brush, on this same clock and into this same `act`.
  const copyPlace = Object.values(places).find((p) => p.stele);
  const writing = createWriting({ act, play, homeward, at, dir, scene, G, head: B.head, each: (f) => always.push(f), sound: (s) => { if (typeof window !== "undefined") brushSound(s); },
    stele: copyPlace?.stele, handR: () => B.rightHand.getWorldPosition(tC), handL: () => B.leftHand.getWorldPosition(V()) });

  // ---- Between observances: his hands are his own again, and what was in them goes back where it belongs ----
  function rest() {
    act.bow = act.twist = act.nod = act.look = 0; act.breath = null; act.hands.left.w = act.hands.right.w = 0;
    bell.held = false; bell.grip = 0; peal.busy = false; coin.visible = false;
    if (home) { tea.held = 0; cup.position.copy(home); cup.rotation.set(0, T.face, 0); steam.show(true); }
    for (const h of Object.values(stands)) { if (h.inc.planted) { h.stand(); h.smoke.show(true); } else if (h.inc.burnt) h.burntOut(); else { h.sticks.visible = h.inc.shown = false; } }
    ring.visible = false; writing.rest();
  }
  const incenseState = (hall) => { const h = stands[hall]; if (!h) return null; const { inc, smoke, sticks } = h; return { shown: inc.shown, planted: inc.planted, burnt: inc.burnt, left: inc.planted ? Math.max(0, Math.round(burn - (Date.now() - inc.at) / 1000)) : 0, burn, smoke: smoke.group.visible, at: sticks.position.toArray().map((v) => +v.toFixed(3)) }; };
  return {
    act, rest, dropCoin, poseCoin, takeRope, pull, letGo, ready, linger, drinkTea, offerIncense, breathe, watchWell, lightLamp, close, writing,
    // What was done on an earlier visit stays done for as long as it would have lasted: sticks set in the ash at `at` are still
    // burning if less than `burn` seconds have passed, and are cold stubs after.
    // `has.incense`: `{ hall: when its sticks were set }` (incense.js); each hall's are as far burnt as its own time says.
    restore(has) { for (const [hall, at] of Object.entries(has.incense || {})) { const h = stands[hall]; if (!h || !at) continue; if (Date.now() - at < burn * 1000) h.plant(at); else h.burntOut(); } },
    /** where the eye stands along the close, every `step` seconds (null before the close has begun): a test asks the eye's hierarchy of each */
    /** where he sits and which way is ahead and to his left, as the close lays its route from them (a test lays its own points the same way) */
    closeFrame: () => END.frame,
    closeRoute: (step = 0.1) => (END.route ? Array.from({ length: Math.round(END.secs / step) + 1 }, (_, i) => END.route(i * step)) : null),
    incenseLit: (hall = SEALED_HALL) => !!stands[hall]?.inc.planted,
    state: () => ({
      passages: jobs.length, bow: +act.bow.toFixed(3), nod: +act.nod.toFixed(3), breath: act.breath === null ? null : +act.breath.toFixed(3), hands: +Math.max(act.hands.left.w, act.hands.right.w).toFixed(3),
      bell: { log: bellS ? +bellS.swing.position.z.toFixed(3) : null, grip: +bell.grip.toFixed(3), rope: rope.visible ? +rope.scale.y.toFixed(3) : null, pulls: peal.pulls, ready: ready(), drawn: +peal.drawn.toFixed(3) },
      look: +act.look.toFixed(3),
      tea: { held: tea.held, sips: tea.sips, lift: home ? +(cup.position.y - home.y).toFixed(3) : null, tilt: +tea.tilt.toFixed(3) },
      incense: { ...incenseState(SEALED_HALL), halls: Object.fromEntries(Object.keys(stands).map((k) => [k, incenseState(k)])) },
      sit: { breaths: sit.breaths, ring: ring.visible, fill: +sit.fill.toFixed(3), radius: +ring.scale.x / RING_PLANE },
      coin: { visible: coin.visible, y: coinState.y === null ? null : +coinState.y.toFixed(3), released: coinState.released, passedAt: coinState.passedAt, began: coinState.began },
      close: { on: END.on, u: +END.u.toFixed(3), aim: END.aim },
      writing: writing.state(),
    }),
  };
}
