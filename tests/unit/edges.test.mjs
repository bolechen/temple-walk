// The novice is wider than the point the walker moves. These hold the plan to his real width: what stands in his way
// keeps his whole body off it, and the ways that were open stay open. (The whole plan is gone over by
// `pnpm run edges`, which takes half a minute; these are the quick ones.)
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "../../app/vendor/three/build/three.module.js";
const { buildSite, createWalker, BODY, LEVELS, APPROACH } = await import("../../app/src/site.js");
const { createMonk } = await import("../../app/src/monk.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site);

test("the width the plan allows him is the width of the model, in every pose it takes", () => {
  let reach = 0; const v = new THREE.Vector3();
  // Standing, walking, hurrying, hands together, and in the air. (Seated, his knees spread wider than this; but he
  // sits only where a seat has been set for him, and is put on it, not walked into it.)
  for (const [speed, pose] of [[0, false], [2.1, false], [4.2, false], [0, true], [0, "hop"], [2.1, "hop"]]) {
    const monk = createMonk();
    for (let k = 0; k < 90; k++) {
      monk.update(1 / 30, speed, pose, k / 30, () => 0, { heightAt: () => 0, stairs: false }); monk.group.updateMatrixWorld(true); monk.skeleton?.update?.();   // he is a skinned figure: his surface is where his bones put it, not where it was modelled
      monk.group.traverse((o) => { if (!o.isMesh || !o.visible || o.material?.transparent) return; const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { (o.isSkinnedMesh ? o.getVertexPosition(i, v) : v.fromBufferAttribute(a, i)).applyMatrix4(o.matrixWorld); if (v.y > 0.02) reach = Math.max(reach, Math.hypot(v.x, v.z)); } });
    }
  }
  assert.ok(reach <= BODY, `some part of him reaches ${reach.toFixed(3)} m from his centre, and the plan allows ${BODY}`);
  assert.ok(reach > BODY - 0.04, `the plan keeps him ${BODY} m off everything but he is only ${reach.toFixed(3)} m wide: passages are being closed for nothing`);
});

test("no column lets his sleeve in, and he can still pass between columns and along every porch", () => {
  const round = site.walk.posts.filter((p) => p.r !== undefined); assert.ok(round.length >= 100);
  for (const p of round) for (let a = 0; a < 6.283; a += 0.39) {
    const d = p.r + BODY - 0.012, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    assert.ok(walker.blocked(x, z), `standing ${d.toFixed(2)} m from the column at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) puts part of him inside it`);
  }
  // Along the front of each hall, at some depth of the porch, there is a way past every column from end to end.
  for (const h of site.halls) {
    const [ox, oz] = h.out, f = [Math.sin(h.outYaw), -Math.cos(h.outYaw)], side = [-f[1], f[0]]; let best = 0;
    for (let d = -0.2; d <= 1.6; d += 0.02) { let run = 0; for (let s = -3; s <= 3; s += 0.05) { if (walker.blocked(ox + f[0] * d + side[0] * s, oz + f[1] * d + side[1] * s)) { if (s < 0) run = 0; else break; } else run += 0.05; } best = Math.max(best, run); }
    assert.ok(best >= 2.9, `${h.name}: the porch cannot be walked along past its columns (longest clear run ${best.toFixed(2)} m)`);
  }
});

test("the tea house's two tables are in the way, and are walked round on the porch", () => {
  const tables = site.walk.posts.filter((p) => p.r === undefined && p.x0 > -14.4 && p.x1 < -12.5 && p.z0 > 6 && p.z1 < 22); assert.equal(tables.length, 2, "two tables under the tea house's eave");
  for (const t of tables) {
    const cz = (t.z0 + t.z1) / 2;
    for (let x = t.x0 + 0.02; x < t.x1; x += 0.05) for (let z = t.z0 + 0.02; z < t.z1; z += 0.05) assert.ok(walker.blocked(x, z), `he can stand in the table at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    // from the door side of the table to the far side, keeping to the porch (its floor is at 0.45)
    const seen = new Set(), todo = [[Math.round(-13.0 / 0.05), Math.round((cz + 1.6) / 0.05)]], goal = Math.round((cz - 1.6) / 0.05); let through = false;
    while (todo.length && !through) { const [i, j] = todo.pop(), k = i * 100000 + j; if (seen.has(k)) continue; seen.add(k); const x = i * 0.05, z = j * 0.05;
      if (walker.blocked(x, z) || Math.abs(walker.heightAt(x, z) - 0.45) > 0.01 || Math.abs(z - cz) > 1.7) continue; if (j <= goal) through = true; todo.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); }
    assert.ok(through, `no way past the table at z=${cz.toFixed(1)} without leaving the porch`);
  }
});

test("a hall is entered at its sill: his robe at the door, not through it", () => {
  for (const h of site.halls) {
    const f = [Math.sin(h.outYaw), -Math.cos(h.outYaw)]; let deepest = null;
    for (let d = 1.2; d >= -0.4; d -= 0.01) { const x = h.door[0] + f[0] * d, z = h.door[1] + f[1] * d; if (walker.blocked(x, z)) break; deepest = [x, z, d]; }
    assert.ok(deepest && h.inside(deepest[0], deepest[1]), `${h.name}: walking straight at the door he is stopped before he is inside`);
    assert.ok(deepest[2] > -0.05, `${h.name}: he can walk ${(-deepest[2]).toFixed(2)} m past the place where the door takes him in`);
  }
});

test("what stands on the ground is closed to him: the sutra pillars, the court's tea table and stools, the lamp stand, the well", () => {
  const [, T2] = LEVELS;
  for (const [what, x, z] of [["a sutra pillar", 5, 1.2], ["a sutra pillar", -5, 1.2], ["the base of a sutra pillar", 5.62, 1.2], ["the lamp stand", -6.2, T2.zS - 4.0], ["the crown of the dragon well's arch", 13.2, T2.zS - 0.3]])
    assert.ok(walker.blocked(x, z), `he can stand in ${what} at (${x}, ${z})`);
  const tea = site.places.tea; assert.ok(tea.seat && !walker.blocked(tea.at[0], tea.at[1]) && walker.blocked(tea.seat[0], tea.seat[1]), "he comes to stand behind his stool, which is itself in the way, and is seated on it");
  assert.ok(Math.hypot(tea.at[0] - tea.seat[0], tea.at[1] - tea.seat[1]) < 0.75, "the stool is within a step of where he stands");
});

test("stairs are walked between their cheek stones, and the stones are closed to him at their feet", () => {
  const A = APPROACH;
  for (const [what, x, z] of [["the first flight's east cheek", A.w / 2 + 0.2, (A.top + A.zA0) / 2], ["the first flight's west cheek", -A.w / 2 - 0.2, (A.top + A.zA0) / 2], ["the ground at the foot of the first terrace stair's cheek", LEVELS[0].stair / 2 + 0.2, LEVELS[0].zS + 4.6]])
    assert.ok(walker.blocked(x, z), `he can stand in ${what} at (${x.toFixed(2)}, ${z.toFixed(2)})`);
  for (const L of LEVELS) for (let z = L.zS - 0.5; z < L.zS + 3; z += 0.1) assert.ok(!walker.blocked(0, z), `the middle of the stair to a terrace is closed at z=${z.toFixed(1)}`);
});
