// The dragon well. The chronicles say the dragons gave the mountain up to the founder and kept only this one well, the
// old pool dried away to a single hole of water (docs/JINGSHAN.md): so nothing runs here. Water seeps down the rock
// and, every so often, one drop falls into the dark pool. It is heard only close by, ringing a little in the stone
// niche, and each drop sends a ring or two across the water.
import * as THREE from "three";

export const HEAR = 9;   // metres from the pool beyond which the drop is no longer heard
// How loud a drop is to someone standing `d` metres from the pool: full at the lip, nothing at HEAR.
export const wellLevel = (d) => (d >= HEAR ? 0 : Math.pow(1 - Math.max(0, d - 1) / (HEAR - 1), 2));
// The rings stay inside the part of the pool seen between the jambs of the niche.
export const RING = { max: 0.38, life: 2.4, lag: 0.4 };

// `at`: the pool's middle [x, y, z]; `sound(level)`: plays one drop at that loudness.
/** @param {THREE.Object3D | { add: (m: THREE.Object3D) => void }} scene @param {number[]} at @param {(level: number) => void} [sound] */
export function createWell(scene, at, sound = (level) => {}) {
  const [px, py, pz] = at, rings = [];
  let s = 23, drops = 0, heard = 0, next = 3, level = 0;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const mat = () => new THREE.MeshBasicMaterial({ color: 0x8f9b97, transparent: true, opacity: 0, depthWrite: false, fog: true });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48).rotateX(-Math.PI / 2), mat());
    m.visible = false; m.userData.keep = true; m.renderOrder = 2; m.position.set(px, py + 0.004, pz); scene.add(m); rings.push({ m, age: -1 });
  }
  // One drop: two rings from the same point, the second a moment behind the first.
  const ripple = () => {
    const ox = (rnd() - 0.5) * 0.4, oz = (rnd() - 0.5) * 0.3, free = rings.filter((r) => !r.started);
    const use = (free.length >= 2 ? free : rings).slice(0, 2);
    use.forEach((r, k) => { r.age = -k * RING.lag - 1e-6; r.fade = k ? 0.55 : 1; r.m.position.set(px + ox, py + 0.004, pz + oz); r.started = true; });
    drops++;
  };
  return {
    ripple,
    // `x, z`: where he stands; `away`: he is indoors, where nothing of the well is heard or drawn.
    update(dt, x, z, away = false) {
      level = away ? 0 : wellLevel(Math.hypot(x - px, z - pz));
      if ((next -= dt) <= 0) { next = 7 + rnd() * 8; ripple(); if (level > 0.001) { sound(level); heard++; } }
      for (const r of rings) {
        if (!r.started) continue;
        r.age += dt; const k = r.age / RING.life;
        if (r.age < 0 || k >= 1 || away) { r.m.visible = false; if (k >= 1) r.started = false; continue; }
        const rad = 0.03 + RING.max * Math.sqrt(k); r.m.scale.setScalar(rad); r.m.visible = true; r.m.material.opacity = 0.17 * r.fade * Math.pow(1 - k, 1.6);   // faint: light on dark water, the second ring fainter still
      }
    },
    state: () => ({ drops, heard, level: +level.toFixed(3), rings: rings.filter((r) => r.m.visible).length, maxRing: Math.max(0, ...rings.filter((r) => r.m.visible).map((r) => r.m.scale.x)) }),
  };
}
