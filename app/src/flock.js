// Birds flushed from the old cryptomerias by the bell. When the third stroke has sounded the first time on a walk,
// a dozen small birds go up from the crowns of the tall trees nearest the bell tower, beyond the wall, and fly off
// toward the hills, rising and spreading, and are gone in a few seconds. They are drawn as ink: a small dark shape with
// two wings that beat (in the vertex shader, one draw for all of them), softened by the mist like everything far off.
//
// No book records a temple bell startling birds (we looked: docs/t00/SOURCES.md); birds do rise at a sudden loud sound,
// so it is done as one would expect, rarely, and never at night, when nothing would be seen of them.
import * as THREE from "three";

export const FLOCK = { count: 12, life: 7, near: 40 };   // how many; how long until all are gone (s); how far a roost may be from the bell (m)

// `trees`: [x, y, z, kind, height] (site.cedars); `bell`: [x, z] of the bell tower.
export function createFlock(scene, trees, bell, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // A bird: a body of two thin triangles and two wings that beat about it (their tips furthest from the body move most).
  const g = new THREE.BufferGeometry();
  const P = [
    0, 0, 0.12, -0.03, 0, -0.1, 0.03, 0, -0.1,            // body
    0, 0, 0.04, -0.34, 0.02, -0.04, 0, 0, -0.06,          // left wing
    0, 0, 0.04, 0, 0, -0.06, 0.34, 0.02, -0.04,           // right wing
  ];
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  const phase = new Float32Array(FLOCK.count);
  for (let i = 0; i < FLOCK.count; i++) phase[i] = rnd() * 6.283;
  g.setAttribute("phase", new THREE.InstancedBufferAttribute(phase, 1));
  const uT = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ color: 0x1d1915, side: THREE.DoubleSide, fog: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uT; attribute float phase;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y += abs(position.x) * 1.6 * sin(uT * 15.0 + phase);");
  };
  mat.customProgramCacheKey = () => "flock";
  const mesh = new THREE.InstancedMesh(g, mat, FLOCK.count);
  mesh.frustumCulled = false; mesh.visible = false; mesh.userData.keep = true; mesh.userData.part = "flock";
  scene.add(mesh);

  // The roosts: the tall trees within reach of the bell, the nearest first.
  const roosts = trees.filter((t) => t[3] === "cedar" && Math.hypot(t[0] - bell[0], t[2] - bell[1]) < FLOCK.near)
    .sort((a, b) => Math.hypot(a[0] - bell[0], a[2] - bell[1]) - Math.hypot(b[0] - bell[0], b[2] - bell[1])).slice(0, 3);
  const birds = [], m4 = new THREE.Matrix4(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  let age = -1, flights = 0;

  function flush() {
    if (!roosts.length) return false;
    birds.length = 0;
    for (let i = 0; i < FLOCK.count; i++) {
      const r = roosts[i % roosts.length], a = rnd() * 6.283, crown = r[1] + r[4] * (0.72 + 0.2 * rnd());
      const at = new THREE.Vector3(r[0] + Math.cos(a) * 1.5, crown, r[2] + Math.sin(a) * 1.5);
      // Away from the bell, toward the hills, each a little its own way; up steeply at first, then on.
      const away = new THREE.Vector3(r[0] - bell[0], 0, r[2] - bell[1]).normalize().applyAxisAngle(up, (rnd() - 0.5) * 1.1);
      const vel = away.multiplyScalar(6 + 3 * rnd()).setY(4 + 3 * rnd());
      birds.push({ at, vel, wait: rnd() * 0.6, size: 0.8 + 0.4 * rnd(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(vel.x, 0, vel.z).normalize()) });
    }
    age = 0; flights++; mesh.visible = true;
    return true;
  }
  function update(dt, t) {
    uT.value = t;
    if (age < 0) return;
    age += dt;
    if (age > FLOCK.life) { age = -1; mesh.visible = false; return; }
    birds.forEach((b, i) => {
      const k = Math.max(0, age - b.wait);
      // They climb hard at first and then level out, drifting on and a little up.
      v.set(b.at.x + b.vel.x * k, b.at.y + b.vel.y * 1.5 * (1 - Math.exp(-k / 1.5)) + 0.6 * k, b.at.z + b.vel.z * k);
      const fade = age < b.wait ? 0 : Math.min(1, (FLOCK.life - age) / 1.2);
      m4.compose(v, b.q, one.setScalar(b.size * Math.max(0.001, fade))); mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    mesh, flush, update,
    state: () => ({ flights, flying: age >= 0, roosts: roosts.length, birds: age >= 0 ? birds.length : 0,
      climbed: age >= 0 && birds.length ? +Math.min(...birds.map((b) => b.vel.y * 1.5 * (1 - Math.exp(-Math.max(0, age - b.wait) / 1.5)) + 0.6 * Math.max(0, age - b.wait))).toFixed(2) : null }),
  };
}
