// The four-post, three-bay archway (app/src/paifang.js, issue #433, docs/t05/PLAN.md item 10): that nothing it is built of
// hangs in the air, that every post stands in its clamp stones, that a walker goes through every bay, and what it costs.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildPaifang, loose, PAIFANG } = await import("../../app/src/paifang.js");
const { createPlanWalker } = await import("../../app/src/plan-walker.js");
const { BODY } = await import("../../app/src/geo.js");
// A stand-in for the materials: the archway asks for these by name, whatever they look like.
const M = new Proxy({}, { get: (t, k) => (t[k] ||= new THREE.MeshBasicMaterial()) });
const pf = buildPaifang(M), byId = new Map(pf.parts.map((p) => [p.id, p]));
const A = PAIFANG, r = A.colR;
const copy = (parts, edit) => parts.map((p) => edit({ ...p, on: [...p.on], box: p.box.clone() }));

test("it is a four-post, three-bay, three-tier archway: the middle bay and its roof stand higher than the side ones", () => {
  assert.equal(pf.cols.length, 4);
  const xs = pf.cols.map(([x]) => x);
  assert.ok(Math.abs(xs[1] - xs[0] - A.end) < 1e-9 && Math.abs(xs[2] - xs[1] - A.mid) < 1e-9 && Math.abs(xs[3] - xs[2] - A.end) < 1e-9, "bays of 3.6, 4.8 and 3.6 m between post axes");
  assert.ok(A.mid > A.end, "the middle bay is the wide one");
  assert.deepEqual(pf.tiers.map((t) => t.id).sort(), ["mid", "side-e", "side-w"], "three roofs");
  const ridge = Object.fromEntries(pf.tiers.map((t) => [t.id, t.ridgeY]));
  assert.ok(ridge.mid > ridge["side-e"] + 0.8 && ridge.mid > ridge["side-w"] + 0.8 && ridge.mid < ridge["side-e"] + 1.4, `the middle roof's ridge ${ridge.mid.toFixed(2)} is over the side roofs' ${ridge["side-e"].toFixed(2)}`);
  assert.ok(byId.get("post-1").box.max.y > byId.get("post-0").box.max.y + 1.0 && byId.get("post-2").box.max.y > byId.get("post-3").box.max.y + 1.0, "the middle posts run up to the middle roof, the outer ones stop under the side roofs");
  // two bands of beams in the middle bay, one at the sides; the sets under every roof; a hip roof's ridge and hip ridges
  for (const id of ["xiao-lower", "dian-lower", "da-lower", "xiao-upper", "dian-upper", "da-upper", "sets-e", "sets-w", "sets-mid", "ridge-mid", "ridge-side-e", "ridge-side-w"]) assert.ok(byId.has(id), `${id} is missing`);
  assert.ok(byId.get("xiao-upper").box.min.y >= byId.get("da-lower").box.max.y, "the upper band stands over the lower");
  for (const t of pf.tiers) assert.ok(t.ends.length >= 1, `${t.id} has a hipped end with its ornament`);
  assert.equal(pf.tiers.find((t) => t.id === "mid").ends.length, 2, "the middle roof is hipped at both ends");
  // each side roof is tucked into the middle post (its tiles and ridge run to the post's axis), and the middle roof stands clear above it
  const roofE = byId.get("roof-side-e").box, mid = byId.get("roof-mid").box, post2 = byId.get("post-2").box;
  assert.ok(roofE.min.x >= post2.min.x && roofE.min.x <= post2.max.x, "the side roof runs into the middle post: its inner end stops inside the post, not beside it");
  // (the ridge's own tile wall stands a third of a metre over it; the curled ends are out at the corners, not under the middle roof)
  const sideRidge = pf.tiers.find((t) => t.id === "side-e").ridgeY;
  // the art review (#438): the middle roof's eave edge stands a hand or two over the side roofs' ridge, the three roofs close together
  const gap = byId.get("roof-mid").box.min.y - sideRidge;
  assert.ok(gap > 0.1 && gap <= 0.35, `the middle roof's eave edge is ${gap.toFixed(2)} m over the side roofs' ridge`);
  assert.ok(mid.max.x > post2.max.x && mid.min.x < byId.get("post-1").box.min.x, "and it spreads over both middle posts");
});

test("nothing hangs in the air: every part meets what holds it up, and that is held, down to the ground", () => {
  assert.ok(pf.parts.length > 30);
  for (const p of pf.parts) {
    assert.ok(p.on.length > 0, `${p.id} says nothing holds it up`);
    assert.ok(Number.isFinite(p.box.min.x + p.box.max.x + p.box.min.y + p.box.max.y + p.box.min.z + p.box.max.z) && !p.box.isEmpty(), `${p.id} has no box`);
    for (const id of p.on) assert.ok(id === "ground" || byId.has(id), `${p.id} rests on ${id}, which is not a part`);
  }
  assert.deepEqual(loose(pf.parts), [], "loose parts");
  // the test would catch one: a post lifted off its stone, and a stone taken away
  const lifted = copy(pf.parts, (p) => { if (p.id === "post-2") { p.box.min.y += 0.5; p.box.max.y += 0.5; } return p; });
  assert.ok(loose(lifted).includes("post-2"), "a post lifted off its plinth must be reported");
  const gone = loose(pf.parts.filter((p) => p.id !== "post-1" && p.id !== "post-2"));
  assert.ok(gone.includes("xiao-upper") && gone.includes("da-upper") && gone.includes("plate-mid") && gone.includes("roof-mid"), `with both middle posts taken away the whole upper tier hangs: ${gone}`);
  const both = loose(copy(pf.parts, (p) => { if (p.id === "post-1" || p.id === "post-2") { p.box.min.y += 0.5; p.box.max.y += 0.5; } return p; }));
  assert.ok(both.includes("xiao-upper") && both.includes("roof-mid"), `with both middle posts off the ground the upper band and the middle roof hang: ${both}`);
  const noStone = pf.parts.filter((p) => p.id !== "plinth-1");
  const dangling = loose(noStone);
  assert.ok(dangling.includes("post-1") && dangling.includes("slabs-1") && dangling.includes("caps-1"), `a stone taken away leaves its post and slabs hanging: ${dangling}`);
  assert.ok(loose(copy(pf.parts, (p) => (p.id === "roof-mid" && (p.box.min.y += 2, p.box.max.y += 2), p))).includes("roof-mid"), "a roof lifted off its purlin must be reported");
});

test("every post stands in its clamp stones: its foot is in them, they close round it, and they stand on the ground", () => {
  const S = A.stone;
  pf.cols.forEach(([x, z], i) => {
    const post = byId.get(`post-${i}`).box, plinth = byId.get(`plinth-${i}`).box, slabs = byId.get(`slabs-${i}`).box, caps = byId.get(`caps-${i}`).box, st = pf.stones[i];
    assert.ok(plinth.min.y <= 1e-6, `plinth ${i} stands on the ground`);
    assert.ok(post.min.y < st.top && post.min.y >= plinth.max.y - 1e-9, `post ${i}'s foot (${post.min.y}) is in its stone (top ${st.top}), on the plinth`);
    assert.ok(Math.abs(st.top - S.top) < 1e-9 && Math.abs(caps.max.y - S.top) < 1e-5, "the stones are as tall as the table says");
    for (const b of [plinth, slabs]) assert.ok(b.min.x <= x - r && b.max.x >= x + r && b.min.z <= z - r && b.max.z >= z + r, `stone ${i} holds post ${i}'s whole round`);
    assert.ok(slabs.min.z < -r && slabs.max.z > r && slabs.min.x < x - r && slabs.max.x > x + r, `the collar holds post ${i} front, back and both sides`);
    assert.ok(slabs.max.y > 1.0 && Math.abs(S.top / byId.get("xiao-lower").box.min.y - 0.25) < 0.03, "the stones reach a quarter of the way to the beams: a block, not a stake");
    assert.ok(slabs.max.x - slabs.min.x > 1.0 && slabs.max.z - slabs.min.z > 1.0, "and close round the post on all four sides");
    assert.ok(Math.abs(st.x - x) < 1e-9 && st.x0 <= x - r && st.x1 >= x + r && st.z0 <= -r && st.z1 >= r, "the footprint the walker reads covers the post");
  });
  assert.equal(pf.stones.length, 4);
});

test("a walker goes through every bay: clear width, headroom, and the plan walker over a floor with the archway on it", () => {
  const need = 2 * BODY + 0.5;
  assert.equal(pf.passage.bays.length, 3);
  for (const b of pf.passage.bays) {
    assert.ok(b.clear >= need, `${b.id} bay is ${b.clear.toFixed(2)} m clear between its stones; he needs ${need.toFixed(2)}`);
    assert.ok(b.head >= 3.5, `${b.id} bay has ${b.head.toFixed(2)} m of headroom: 3.5 for the eye behind him`);
  }
  const mid = pf.passage.bays.find((b) => b.id === "mid"); assert.ok(mid.clear > pf.passage.bays.find((b) => b.id === "end-e").clear, "the middle bay is the widest");
  // by the drawn parts: nothing is within his width of the line down a bay's middle, between 5 cm and 3.5 m up, over the whole depth of the archway
  for (const b of pf.passage.bays) {
    const xc = (b.x0 + b.x1) / 2, lo = xc - BODY - 0.1, hi = xc + BODY + 0.1;
    for (const p of pf.parts) if (p.box.max.y > 0.05 && p.box.min.y < 3.5) assert.ok(p.box.max.x < lo || p.box.min.x > hi, `${p.id} is in the way down the ${b.id} bay (x ${p.box.min.x.toFixed(2)}…${p.box.max.x.toFixed(2)})`);
  }
  // by the plan walker, on a floor with the archway set down at (10, 100): a walk along each bay from the south of it to the north
  const dx = 10, dz = 100, moved = pf.walk.posts.map((q) => ({ x0: q.x0 + dx, x1: q.x1 + dx, z0: q.z0 + dz, z1: q.z1 + dz, h: q.h }));
  const walker = createPlanWalker({ walk: { decks: [{ x0: -50, x1: 50, z0: 50, z1: 150, h: 0, floor: "paving" }], posts: moved, solids: [], ramps: [], rails: [] } });
  for (const [x, z] of pf.cols) assert.ok(walker.wall(x + dx, z + dz), `a post at ${x} stops him`);
  for (const b of pf.passage.bays) {
    const xc = (b.x0 + b.x1) / 2;
    for (let z = -6; z <= 6.0001; z += 0.1) assert.ok(!walker.wall(xc + dx, z + dz), `the ${b.id} bay is open at z = ${z.toFixed(1)}`);
  }
  // and beyond the outer posts, and between a bay's stones and its neighbour's, the way is open too, but through the stones there is none
  assert.ok(walker.wall(pf.stones[1].x + dx, dz + 0.6), "a stone stops him"); assert.ok(!walker.wall(0 + dx, dz));
});

test("the walkers' data covers every stone and every roof", () => {
  assert.equal(pf.walk.posts.length, 4, "one post rectangle for each pair of stones");
  pf.stones.forEach((s, i) => {
    const q = pf.walk.posts[i];
    assert.ok(q.x0 <= s.x0 - BODY && q.x1 >= s.x1 + BODY && q.z0 <= s.z0 - BODY && q.z1 >= s.z1 + BODY, `stone ${i}'s rectangle is drawn BODY larger`);
    assert.equal(q.h, s.top);
  });
  assert.equal(pf.walk.roofs.length, 3, "one for each tier");
  for (const t of pf.tiers) {
    const roof = byId.get(`roof-${t.id}`).box, w = pf.walk.roofs[pf.tiers.indexOf(t)];
    assert.ok(w.x0 <= roof.min.x && w.x1 >= roof.max.x && w.z0 <= roof.min.z && w.z1 >= roof.max.z && w.top > t.ridgeY && w.bottom > 3.5, `${t.id}: the roof footprint covers the drawn roof`);
    assert.ok(w.inner >= 3.5 && w.inner <= w.bottom, "the eye may be under the beams but not in the roof");
  }
  for (const k of ["solids", "decks", "ramps", "drops", "rails"]) assert.deepEqual(pf.walk[k], [], `${k}: the archway has no floor of its own`);
  assert.ok(pf.board.w > 3 && pf.board.h > 0.25 && Math.abs(pf.board.x) < 1e-9, "a place for the name board in the middle bay");
});

test("what it costs: triangles and meshes held to a budget", () => {
  const c = pf.census();
  assert.equal(c.triangles, pf.parts.reduce((n, p) => n + p.tris, 0));
  assert.ok(c.triangles <= 20000, `${c.triangles} triangles: over the 20,000 held here (a hall's roof alone is more than that)`);
  assert.ok(c.meshes === pf.group.children.length && c.meshes <= 64, `${c.meshes} meshes before mergeStatic batches them`);
  // every mesh carries the baked occlusion the procedural materials read, and has indices or a plain position list
  pf.group.traverse((o) => { if (o.isMesh) assert.ok(o.geometry.attributes.ao && o.geometry.attributes.uv && o.geometry.attributes.normal, "ao, uv and normal on every mesh"); });
  // no part leaves the box the doc says: about 15 m wide, under 10.5 m tall, 3.5 m deep
  assert.ok(pf.size.w < 16 && pf.size.h < 10.5 && pf.size.d < 3.7, JSON.stringify(pf.size));
});
