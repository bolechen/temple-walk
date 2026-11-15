// Inside the halls: every column carries something and everything carried rests on something, the room has the bays
// its building shows outside, and nothing that stands in it cuts a visitor off from a frame or the altar.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { BODY } = await import("../../app/src/geo.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), built = buildInteriors(M, site.halls), near = (a, b, e = 1e-3) => Math.abs(a - b) < e;

test("every column carries a beam on its cap block, and every beam rests on a column or in a wall", () => {
  for (const h of site.halls) {
    const { frame: f } = built.rooms[h.id].room;
    assert.ok(f.beams.length, `${h.name}: no beams`);
    for (const c of f.cols) {
      const over = f.beams.filter((b) => near(b.x, c.x) && c.z <= Math.max(b.z0, b.z1) + 1e-6 && c.z >= Math.min(b.z0, b.z1) - 1e-6);
      assert.ok(over.length, `${h.name}: the column at ${c.x}, ${c.z} carries nothing`);
      for (const b of over) assert.ok(near(b.bottom, f.colTop + 0.3), `${h.name}: the beam over ${c.x}, ${c.z} does not sit on its cap (${b.bottom} against ${f.colTop + 0.3})`);
    }
    for (const b of f.beams) [b.z0, b.z1].forEach((z, i) => {
      if (b.ends[i] === "wall") assert.ok(near(Math.abs(z), f.wz), `${h.name}: a beam end at ${z} is called a wall end but is not at a wall`);
      else assert.ok(f.cols.some((c) => near(c.x, b.x) && near(c.z, z)), `${h.name}: the beam at x ${b.x} ends at ${z} on no column`);
    });
    for (const t of f.ties) for (const x of [t.x0, t.x1]) assert.ok(near(Math.abs(x - f.ox), f.wx) || f.cols.some((c) => near(c.x, x) && near(c.z, t.z)), `${h.name}: an architrave ends at ${x} in the air`);
    assert.ok(f.ceiling > f.colTop + 0.3, `${h.name}: the ceiling is below the column heads`);
  }
});

test("each room has as many bays across as its building shows outside, and the ceiling its rank calls for", () => {
  const want = { main: "coffer", library: "plain", chan: "open", tea: "open", yaoshi: "coffer", guanyin: "coffer", dahui: "open", lingxiao: "coffer" };
  for (const h of site.halls) {
    const f = built.rooms[h.id].room.frame;
    assert.equal(f.spans.length, h.xs.length - 2, `${h.name}: ${f.spans.length} beam lines inside, ${h.xs.length - 2} inner column lines outside`);
    assert.equal(f.kind, want[h.id] || f.kind, `${h.name}: ceiling ${f.kind}`);
  }
  const main = built.rooms.main.room.frame;
  assert.ok(main.cols.length >= 6, `the great hall stands on ${main.cols.length} free columns`);
  assert.ok(!main.cols.some((c) => Math.abs(c.x - main.ox) < 6 && c.z < -2), "a column stands on the great hall's dais");
});

test("no column stands in furniture, and every frame and the altar can be walked to from the door", () => {
  for (const h of site.halls) {
    const r = built.rooms[h.id], room = r.room, f = room.frame;
    const colBlock = (s) => f.cols.some((c) => near((s.x0 + s.x1) / 2, c.x) && near((s.z0 + s.z1) / 2, c.z));
    for (const c of f.cols) for (const s of room.solids) if (!colBlock(s)) assert.ok(!(c.x > s.x0 - 0.5 && c.x < s.x1 + 0.5 && c.z > s.z0 - 0.5 && c.z < s.z1 + 0.5), `${h.name}: the column at ${c.x - f.ox}, ${c.z} stands in something`);
    for (const c of f.cols) for (const s of room.solids) if (colBlock(s) && near((s.x0 + s.x1) / 2, c.x) && near((s.z0 + s.z1) / 2, c.z)) assert.ok(s.x1 - c.x >= 0.29 + BODY - 1e-6, `${h.name}: a column's block does not keep his body off its shaft`);
    // A flood over the floor at ten centimetres, as the walker sees it.
    const step = 0.1, shut = (x, z) => x < room.x0 || x > room.x1 || z < room.z0 || z > room.z1 || room.solids.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
    const key = (i, j) => i * 100000 + j, seen = new Set(), q = [[Math.round(room.door[0] / step), Math.round(room.door[1] / step)]];
    assert.ok(!shut(room.door[0], room.door[1]), `${h.name}: the door is shut`);
    seen.add(key(...q[0]));
    while (q.length) { const [i, j] = q.pop(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(i + a, j + b); if (!seen.has(k) && !shut((i + a) * step, (j + b) * step)) { seen.add(k); q.push([i + a, j + b]); } } }
    const reach = (x, z, rad) => { for (let i = Math.round((x - rad) / step); i <= Math.round((x + rad) / step); i++) for (let j = Math.round((z - rad) / step); j <= Math.round((z + rad) / step); j++) if (Math.hypot(i * step - x, j * step - z) <= rad && seen.has(key(i, j))) return true; return false; };
    for (const s of Object.values(built.spots).filter((s) => s.room === h.id)) assert.ok(reach(s.at[0], s.at[1], s.r), `${h.name}: the frame ${s.item.id} cannot be walked to`);
    for (const p of Object.values(built.places).filter((p) => p.room === h.id)) assert.ok(reach(p.at[0], p.at[1], p.r), `${h.name}: the altar cannot be walked to`);
  }
});

test("under an open roof the gable walls rise with the boards, from the eaves to the ridge, and close the join", () => {
  for (const h of site.halls) {
    const f = built.rooms[h.id].room.frame; if (f.kind !== "open") continue;
    const at = (line, z) => { for (let i = 1; i < line.length; i++) { const [z0, y0] = line[i - 1], [z1, y1] = line[i]; if (z >= Math.min(z0, z1) - 1e-6 && z <= Math.max(z0, z1) + 1e-6) return z1 === z0 ? Math.max(y0, y1) : y0 + ((y1 - y0) * (z - z0)) / (z1 - z0); } return null; };
    const top = f.gable.slice(1, -1);
    for (const [z, y] of f.boards) { const g = at(top, z); assert.ok(g !== null && g >= y && g <= y + 0.4, `${h.name}: at z ${z.toFixed(2)} the gable stands at ${g?.toFixed(2)} and the boards at ${y.toFixed(2)}`); }
    const ridge = Math.max(...f.boards.map(([, y]) => y)), eave = f.boards[0][1]; assert.ok(ridge > eave + 1, `${h.name}: the roof does not rise to a ridge`);
  }
});

test("no vertex in any room is NaN or infinite (one bad vertex blacks out the whole picture through the bloom)", () => {
  for (const h of site.halls) built.rooms[h.id].group.traverse((m) => {
    if (!m.isMesh) return;
    for (const [n, a] of Object.entries(m.geometry.attributes)) assert.ok(a.array.every(Number.isFinite), `${h.name}: a mesh has a ${n} that is not a number`);
  });
});
