// How the observances are done, by his hands: the rope of the bell's log drawn back and let go, the bowl of tea lifted
// in both hands and drunk in three sips, three sticks of incense raised to the brow, bowed with and set in the ash,
// and the breath of sitting on the summit. game.js says when; this says how.
//
// Each is a short run of timed passages. A passage writes what it wants of him into `act`, which the walk hands to
// the novice with his pose (monk.js: where each hand should be, how far he bows, how he breathes), and moves the
// thing he holds. Time is the clock's, not the frames': software rendering may draw one frame a second.
import * as THREE from "three";
import { mesh, merge } from "./geo.js";

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
let held = null;
export const riteNow = () => held ?? performance.now();
if (typeof window !== "undefined") window.__riteClock = (ms) => { held = ms == null ? null : (held ?? performance.now()) + ms; return held; };

function softDot() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.45, "rgba(255,255,255,0.32)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

export function createRites(y, fast = 1) {
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
    peal.drawn = Math.max(peal.drawn, d);   // how far the log has been drawn back since he took the rope, for the tests
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
    peal.busy = false; bellS.from = 0; peal.last = riteNow(); peal.pulls++;
    y.strike("bell", true); return on();
  }
  async function letGo(on) {
    await play(0.6, (u) => { bell.grip = act.hands.left.w = act.hands.right.w = 1 - ease(u); }, on);
    bell.held = false; return on();
  }

  // ================= Tea =================
  // His bowl stands before him on its lacquer stand. He leans to it, lifts it in both hands, drinks three times
  // and sets it back.
  const T = places.tea, cup = new THREE.Group(), home = T && T.bowl ? V().fromArray(T.bowl) : null, tea = { held: 0, tilt: 0, sips: 0 };
  cup.add(mesh(lathe([[0, 0.012], [0.03, 0], [0.036, 0.012], [0.07, 0.048], [0.078, 0.06], [0.072, 0.06], [0.028, 0.02], [0, 0.02]], 24), M.glaze), mesh(new THREE.CircleGeometry(0.058, 20).rotateX(-Math.PI / 2).translate(0, 0.047, 0), M.tea));
  cup.traverse((o) => { o.userData.keep = o.userData.soft = true; o.userData.part = "bowl"; });
  const steam = wisp(5, { size: 0.09, rise: 0.34, spread: 0.07, life: 3.4, opacity: 0.2 }), ewer = wisp(5, { size: 0.1, rise: 0.4, spread: 0.08, life: 3.8, opacity: 0.2 });
  if (home) { cup.position.copy(home); cup.rotation.y = T.face; scene.add(cup); steam.src.copy(home).y += 0.06; steam.show(true); if (T.steam) { ewer.src.fromArray(T.steam); ewer.show(true); } }
  const rim = V(0, 0.06, -0.07), chestAt = (out) => B.chest.localToWorld(out.set(0, 0.0, 0.17)), mouthAt = (out) => B.head.localToWorld(out.set(0, 0.052, 0.128));
  // Wherever the bowl is, his hands are on either side of it.
  const hold = () => HANDS.forEach(([n, s]) => { const h = act.hands[n]; h.at.set(s * 0.068, 0.034, 0.012).applyQuaternion(cup.quaternion).add(cup.position); dir(-s * 0.45, 0.15, 1, h.fingers); dir(-s, 0.25, 0, h.palm); });
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
  // The bowl is back on its stand, steaming a little less. His hands lie in his lap, he breathes slowly, and now and
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
  const I = places.incense, sticks = new THREE.Group(), smoke = wisp(7, { size: 0.07, rise: 0.75, spread: 0.1, life: 5.5, opacity: 0.2, color: 0xdfe6ee }), inc = { planted: false, shown: false };
  { const wood = new THREE.MeshStandardMaterial({ color: 0x6b2d1c, roughness: 0.9 }), ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 1.5, 0.45), fog: false });
    for (const [rz, rx] of [[-0.085, 0.03], [0, -0.045], [0.085, 0.03]]) { const s = new THREE.Group(); s.rotation.set(rx, 0, rz);
      s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.3, 5).translate(0, 0.15, 0), wood), new THREE.Mesh(new THREE.SphereGeometry(0.0042, 6, 5).translate(0, 0.302, 0), ember)); sticks.add(s); }
    sticks.traverse((o) => { o.userData.part = "incense"; }); sticks.visible = false; scene.add(sticks); }
  const plantAt = I && I.bowl ? V(I.bowl[0], I.bowl[1] - 0.035, I.bowl[2]) : null;
  const plant = () => { if (!plantAt) return; inc.planted = inc.shown = true; sticks.visible = true; sticks.scale.setScalar(1); sticks.position.copy(plantAt); sticks.quaternion.identity(); smoke.src.copy(plantAt).y += 0.3; smoke.show(true); };
  // Between his palms: the sticks stand up out of his joined hands and lean as he leans.
  const inHands = () => { between(sticks.position); B.chest.getWorldQuaternion(sticks.quaternion).multiply(qA.setFromAxisAngle(V(1, 0, 0), 0.12)); sticks.position.addScaledVector(tB.set(0, -0.02, 0.012).applyQuaternion(sticks.quaternion), 1); };
  const brow = (k) => HANDS.forEach(([n, s]) => { const h = act.hands[n]; B.head.localToWorld(h.at.set(s * 0.0125, 0.15, 0.15)); dir(0, 1, 0.25, h.fingers); dir(-s, 0, 0, h.palm); h.w = k; });
  /** @param {() => boolean} on @param {any} st @param {(what: string) => void} [cue] */
  async function offerIncense(on, st, cue = () => {}) {
    if (!I || !plantAt || inc.planted) return false;
    sticks.visible = inc.shown = true;
    if (!(await play(0.7, (u) => { sticks.scale.setScalar(Math.max(0.001, ease(u))); inHands(); }, on))) return false;
    if (!(await play(0.9, (u) => { brow(ease(u)); inHands(); }, on))) return false;
    for (let i = 0; i < 3; i++) if (!(await play(1.5, (u) => { act.bow = 0.5 * Math.sin(Math.PI * ease(u)); brow(1); inHands(); }, on))) return false;
    cue("bowed");
    if (!(await play(0.8, (u) => { brow(1 - ease(u)); inHands(); }, on))) return false;
    // A step or two up to the stand, the sticks still between his palms.
    const from = [I.at[0], I.at[1]];
    st.speed = 0.5;
    if (!(await play(1.3, (u) => { const k = ease(u); st.seat = [mix(from[0], I.front[0], k), mix(from[1], I.front[1], k)]; inHands(); }, on))) { st.speed = null; return false; }
    st.speed = null; st.seat = I.front.slice(); y.put(I.front[0], I.front[1]);
    // He leans over the bowl and his right hand sets them in the ash.
    const h = act.hands.right; inHands(); const p0 = sticks.position.clone(), q0 = sticks.quaternion.clone();
    if (!(await play(1.2, (u) => { const k = ease(u); act.bow = 0.5 * k; sticks.position.copy(p0).lerp(plantAt, k); sticks.position.y += 0.07 * Math.sin(Math.PI * k); sticks.quaternion.copy(q0).slerp(qB.identity(), k);
      h.at.copy(sticks.position); h.at.y += 0.09; h.at.addScaledVector(dir(-1, 0, 0, tC), 0.02); dir(0, -0.5, 1, h.fingers); dir(1, 0, 0.2, h.palm); h.w = Math.min(1, u * 4); }, on))) return false;
    plant();
    if (!(await play(0.9, (u) => { act.bow = 0.5 * (1 - ease(u)); h.w = 1 - ease(u); }, on))) return false;
    return play(1.6, (u) => { act.bow = 0.5 * Math.sin(Math.PI * ease(u)); }, on);   // and once more, hands together
  }

  // ================= Sitting =================
  // A breath in fills his chest; with each breath out a ring goes out from where he sits.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false }));
  ring.visible = false; ring.renderOrder = 2; ring.userData.part = "breath"; scene.add(ring);
  const sit = { breaths: 0 };
  // `to` is 1 for a breath in and -1 for a breath out, taken over `secs`.
  async function breathe(to, secs, on) {
    const from = act.breath ?? -1;
    if (to < 0) { ring.visible = true; ring.position.copy(G.position).y += 0.05; ring.material.color.set(y.night() ? 0xffd9a0 : 0x14110e); }
    const ok = await play(secs, (u) => { const k = ease(u); act.breath = mix(from, to, k); act.nod = to < 0 ? 0.05 * k : 0.05 * (1 - k);
      if (to < 0) { ring.scale.setScalar(0.45 + 1.9 * u); ring.material.opacity = (y.night() ? 0.55 : 0.5) * Math.sin(Math.PI * Math.min(1, u * 1.2)) * (1 - 0.6 * u); } }, on);
    if (to < 0) { ring.visible = false; if (ok) sit.breaths++; }
    return ok;
  }

  // ================= The close of the chapter =================
  // When the seventh seal is earned he is sitting on the summit. The eye leaves his shoulder: it comes round before
  // him, draws back down the steps and rises until the pavilion stands whole on its mountain, while he goes on
  // breathing and the closing words are said (game.js says them, on `cue`). `secs` is the whole of it.
  const END = { secs: 30, on: false, u: 0 };
  /** @param {() => boolean} on @param {(seconds: number) => void} [cue] */
  async function close(on, cue = () => {}) {
    const cam0 = V(), look0 = V(), look = V(), o = G.position.clone(), f = dir(0, 0, 1).clone(), l = dir(1, 0, 0).clone();
    const P = (a, b, c) => o.clone().addScaledVector(l, a).addScaledVector(f, c).setY(o.y + b);
    let path = null, aim = null;
    END.on = true; END.u = 0;
    y.cine((camera) => {
      if (!path) { cam0.copy(camera.position); camera.getWorldDirection(look0).multiplyScalar(6).add(cam0);
        path = new THREE.CatmullRomCurve3([cam0.clone(), P(1.5, 0.75, 3.1), P(3.6, 2.6, 8.5), P(7, 9, 19), P(9, 17, 34)], false, "centripetal");
        aim = new THREE.CatmullRomCurve3([look0.clone(), P(0, 0.45, 0), P(0, 0.9, -1), P(0, 3.2, -4), P(0, 5, -6)], false, "centripetal"); }
      const k = ease(Math.min(1, END.u * 1.04)); path.getPoint(k, camera.position); aim.getPoint(k, look); camera.lookAt(look);
    });
    const ok = await play(END.secs, (u) => {
      END.u = u; const t = u * END.secs, ph = (t % 9) / 9, inn = ph < 0.45;   // a breath every nine seconds: in, then longer out
      act.breath = inn ? -1 + 2 * ease(ph / 0.45) : 1 - 2 * ease((ph - 0.45) / 0.55); act.nod = 0.03;
      ring.visible = !inn; if (!inn) { const v = (ph - 0.45) / 0.55; ring.position.copy(G.position).y += 0.05; ring.material.color.set(y.night() ? 0xffd9a0 : 0x14110e); ring.scale.setScalar(0.45 + 1.9 * v); ring.material.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, v * 1.2)) * (1 - 0.6 * v); }
      cue(t);
    }, on);
    ring.visible = false; act.breath = null; act.nod = 0; END.on = false; y.cine(null);
    return ok;
  }

  // ---- Between observances: his hands are his own again, and what was in them goes back where it belongs ----
  function rest() {
    act.bow = act.twist = act.nod = act.look = 0; act.breath = null; act.hands.left.w = act.hands.right.w = 0;
    bell.held = false; bell.grip = 0; peal.busy = false;
    if (home) { tea.held = 0; cup.position.copy(home); cup.rotation.set(0, T.face, 0); steam.show(true); }
    if (inc.planted) plant(); else { sticks.visible = inc.shown = false; }
    ring.visible = false;
  }
  return {
    act, rest, takeRope, pull, letGo, ready, linger, drinkTea, offerIncense, breathe, close,
    // What was done on an earlier visit stays done: the sticks stand in the ash.
    restore(has) { if (has.incense) plant(); },
    state: () => ({
      passages: jobs.length, bow: +act.bow.toFixed(3), nod: +act.nod.toFixed(3), breath: act.breath === null ? null : +act.breath.toFixed(3), hands: +Math.max(act.hands.left.w, act.hands.right.w).toFixed(3),
      bell: { log: bellS ? +bellS.swing.position.z.toFixed(3) : null, grip: +bell.grip.toFixed(3), rope: rope.visible ? +rope.scale.y.toFixed(3) : null, pulls: peal.pulls, ready: ready(), drawn: +peal.drawn.toFixed(3) },
      look: +act.look.toFixed(3),
      tea: { held: tea.held, sips: tea.sips, lift: home ? +(cup.position.y - home.y).toFixed(3) : null, tilt: +tea.tilt.toFixed(3) },
      incense: { shown: inc.shown, planted: inc.planted, smoke: smoke.group.visible, at: sticks.position.toArray().map((v) => +v.toFixed(3)) },
      sit: { breaths: sit.breaths, ring: ring.visible },
      close: { on: END.on, u: +END.u.toFixed(3) },
    }),
  };
}
