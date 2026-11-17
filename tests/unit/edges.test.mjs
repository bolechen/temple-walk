// The novice is wider than the point the walker moves. These hold the plan to his real width: what stands in his way
// keeps his whole body off it, and the ways that were open stay open. (The whole plan is gone over by
// `pnpm run edges`, which takes half a minute; these are the quick ones.)
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker, BODY, LEVELS, APPROACH } = await import("../../app/src/site.js");
const { createMonk } = await import("../../app/src/monk.js");
const { dressed } = await import("./novice-glb.mjs");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site);

for (const [which, make] of [["built in code", createMonk], ["sculpted", () => dressed(createMonk)]]) test(`the width the plan allows him is the width of the model, in every pose it takes (${which})`, () => {
  let reach = 0; const v = new THREE.Vector3();
  // Standing, walking, hurrying, hands together, and in the air. (Seated, his knees spread wider than this; but he
  // sits only where a seat has been set for him, and is put on it, not walked into it.)
  for (const [speed, pose] of [[0, false], [2.1, false], [4.2, false], [0, true], [0, "hop"], [2.1, "hop"]]) {
    const monk = make();
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
  for (const [what, x, z] of [["a sutra pillar", 5, 1.2], ["a sutra pillar", -5, 1.2], ["the base of a sutra pillar", 5.62, 1.2], ["the lamp stand", -6.2, T2.zS - 3.4], ["the parapet over the dragon well", 13.2, T2.zS - 0.3]])
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

test("every tree in the courts is in the way, by its trunk and his width, and none grows through a platform", () => {
  const near = site.trees.filter((t) => !t[5]); assert.ok(near.length >= 18, "the plan lists the seasonal trees as well as the cryptomerias");
  for (const [x, , z, kind, h] of near) {
    const post = site.walk.posts.find((p) => p.r !== undefined && Math.hypot(p.x - x, p.z - z) < 1e-6); assert.ok(post, `the ${kind} at (${x}, ${z}) has nothing to stop him`);
    const trunk = kind === "cedar" ? 0.2 + h * 0.012 : 0.09 + h * 0.019; assert.ok(post.r >= trunk * 1.2, `the ${kind} at (${x}, ${z}) is closed to ${post.r.toFixed(2)} m but its trunk is ${trunk.toFixed(2)} m before its roots spread`);
    for (let a = 0; a < 6.283; a += 0.5) assert.ok(walker.blocked(x + Math.cos(a) * (post.r + BODY - 0.02), z + Math.sin(a) * (post.r + BODY - 0.02)), `he can lean into the ${kind} at (${x}, ${z})`);
    for (const b of site.buildings) assert.ok(!(x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3), `the ${kind} at (${x}, ${z}) grows through the platform of ${b.name || "a building"}`);
  }
});

test("a jump at either tea table, from any side, walking or hurrying, neither lands in it nor passes through it", async () => {
  const { stride, leapStep, JUMP } = await import("../../app/src/stride.js");
  const tables = site.walk.posts.filter((p) => p.r === undefined && p.x0 > -14.4 && p.x1 < -12.5 && p.z0 > 6 && p.z1 < 22); assert.equal(tables.length, 2);
  let runs = 0;
  for (const t of tables) {
    const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
    for (let a = 0; a < 24; a++) for (const speed of [2.1, 4.2]) {   // every way round it the porch allows, at a walk and at a hurry (which way he faces does not matter to where he may be)
      const dir = [Math.sin((a / 24) * 6.283), Math.cos((a / 24) * 6.283)];
      let pos = null; for (let r = 1.0; r < 2.6 && !pos; r += 0.05) { const x = cx - dir[0] * r, z = cz - dir[1] * r; if (!walker.blocked(x, z) && Math.abs(walker.heightAt(x, z) - 0.45) < 0.01) pos = { x, z }; }
      if (!pos) continue; runs++;
      let leap = { y: 0.45, v: JUMP.speed }, landings = 0;
      for (let f = 0; f < 90; f++) {   // three seconds of holding the key toward the table's middle and pressing Space each time he lands
        const vx = cx - pos.x, vz = cz - pos.z, l = Math.hypot(vx, vz) || 1;
        stride(walker, pos, (vx / l) * speed / 30, (vz / l) * speed / 30);
        assert.ok(!walker.blocked(pos.x, pos.z), `in the air he came to (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}), inside the table at z=${cz.toFixed(1)}`);
        assert.ok(!(pos.x > t.x0 && pos.x < t.x1 && pos.z > t.z0 && pos.z < t.z1));
        const ground = walker.heightAt(pos.x, pos.z), step = leapStep(leap, ground, 1 / 30);
        assert.ok(step.y >= ground - 1e-9, "he went below the floor");
        if (step.landed) { landings++; assert.ok(Math.abs(step.y - 0.45) < 1e-6, `he landed at ${step.y.toFixed(2)}, not on the porch's floor`); leap = { y: step.y, v: JUMP.speed }; }
      }
      assert.ok(landings >= 3, "he did not come down again");
    }
  }
  assert.ok(runs >= 24, `only ${runs} ways up to the tables could be tried`);
});

test("below the knee: the tea house's cushions are walked round, and the gate's sill and the summit mat are floors his shoes come down on", () => {
  const cushions = site.walk.posts.filter((p) => p.r === 0.292 && p.x < -12 && p.x > -15); assert.equal(cushions.length, 4, "a cushion at either end of each tea table");
  for (const c of cushions) assert.ok(walker.blocked(c.x, c.z) && walker.blocked(c.x + c.r + BODY - 0.02, c.z), `the cushion at (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) can be walked into`);
  const gate = site.buildings.find((b) => b.name === "万年正续"), sill = [];   // the gate house, platform and all
  for (let zz = gate.z0; zz < gate.z1; zz += 0.01) sill.push(walker.heightAt(0, zz));
  const floor = Math.min(...sill.filter((h) => h > 0.1)); assert.ok(Math.max(...sill) - floor > 0.04 && Math.max(...sill) - floor < 0.06, `crossing the gate the floor rises ${(Math.max(...sill) - floor).toFixed(3)} m over the sill, not its 5 cm`);
  const mat = site.seats.find((s) => s.room === null && s.top > 15); assert.ok(Math.abs(walker.heightAt(mat.at[0], mat.at[1]) - (mat.top - 0.004)) < 0.01, "the summit mat is not a floor to stand on");
  assert.ok(!walker.blocked(mat.at[0], mat.at[1]), "he can no longer stand on the summit mat, where he comes out of the pavilion and sits");
});
