// J01's dry ground and evergreen crowns (app/levels/t05/dry.js; #573 step 7): T05's own copies of the shared earth and cedar materials, tinted by
// the mood's leaf colour only on a dry day without snow. The prologue's materials are never touched, and no mood but J01 changes a pixel of them.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { createMaterials } = await import("../../app/src/materials.js");
const { moodOf, SEASONS, TIMES } = await import("../../app/src/mood.js");
const { dryMaterials } = await import("../../app/levels/t05/dry.js");
const { floraMaterials } = await import("../../app/levels/t05/flora.js");
const t05 = (await import("../../app/levels/t05/level.js")).default, { buildSite } = await import("../../app/levels/t05/site.js");

test("T05 has its own earth and crown materials, made once, named with letters only, leaving the shared ones alone", () => {
  const M = createMaterials(), d = dryMaterials(M);
  assert.notEqual(d.earth, M.earth); assert.notEqual(d.cedar, M.cedar); assert.strictEqual(dryMaterials(M), d, "made once for a set of materials");
  for (const m of [d.earth, d.cedar]) assert.ok(/^[a-zA-Z]+$/.test(m.customProgramCacheKey()), `${m.customProgramCacheKey()}: letters only, so that __pick names it`);
  assert.notEqual(d.earth.customProgramCacheKey(), M.earth.customProgramCacheKey());
  // the shader: the shared one's own hook runs, then the copy multiplies by the leaf colour only where wetness and snow are both nought
  const sh = { uniforms: {}, vertexShader: "", fragmentShader: "#include <common>\nvoid main(){ diffuseColor.rgb=col;\n#include <lights_fragment_end>\n}" };
  d.earth.onBeforeCompile(sh, {});
  assert.ok(sh.uniforms.uLeafD && sh.uniforms.uWetD && sh.uniforms.uSnowD, "it reads three uniforms the page already holds");
  assert.ok(/smoothstep\(0\., \.05, uWetD \+ uSnowD\)/.test(sh.fragmentShader) && /pow\(max\(uLeafD/.test(sh.fragmentShader), "and gates the tint on a dry day without snow");
  // the sun's own light on it is drawn toward grey, by the same gate, and the lit colour still reaches the page
  assert.equal(sh.fragmentShader.match(/smoothstep\(0\., \.05, uWetD \+ uSnowD\)/g).length, 2, "the pale of the low sun has the same gate");
  assert.ok(/reflectedLight\.directDiffuse = mix\(s_, .*0\.400 \* g_\)/.test(sh.fragmentShader) && /#include <lights_fragment_end>/.test(sh.fragmentShader));
  // the crowns take a fixed olive, not the leaf colour
  const sc = { uniforms: {}, vertexShader: "", fragmentShader: "#include <common>\nvoid main(){ diffuseColor.rgb=col;\n#include <lights_fragment_end>\n}" };
  d.cedar.onBeforeCompile(sc, {});
  assert.ok(/vec3 t_ = vec3\(1\.200, 1\.000, 0\.640\)/.test(sc.fragmentShader) && !/pow\(max\(uLeafD/.test(sc.fragmentShader), "the crowns' olive is their own");
});

test("T05's site draws its ground and crowns with those copies, so no draw is added", () => {
  const M = createMaterials(), site = buildSite(M), used = new Set();
  site.root.traverse((o) => { if (o.isMesh) used.add(o.material); });
  assert.ok(!used.has(M.earth) && !used.has(M.cedar), "none of T05's meshes keeps the shared earth or cedar");
  const d = dryMaterials(M), needles = floraMaterials(M).needles; assert.ok(used.has(d.earth) && (used.has(d.cedar) || used.has(needles)), "they use the dry-day copies instead");
  // the grown trees' needles (./flora.js) are the dry cedar itself with a breeze in it: same colour code, same cache family
  const sc = { uniforms: {}, vertexShader: "#include <common>\n#include <begin_vertex>", fragmentShader: "#include <common>\ndiffuseColor.rgb=col;\n#include <lights_fragment_end>" };
  needles.onBeforeCompile(sc, {}); assert.ok(/vec3 t_ = vec3\(1\.200, 1\.000, 0\.640\)/.test(sc.fragmentShader) && /uWindN/.test(sc.vertexShader), "the needles keep the dry cedar's olive and stir in the wind");
});

test("only J01 says what the leaf colour is; every other season and hour keeps the leaf it had", () => {
  for (const s of SEASONS) for (const t of TIMES) {
    const own = moodOf(s, t, t05.moodFor).leaf, was = moodOf(s, t).leaf;
    if (s === "winter" && t === "day") assert.deepEqual(own, [1.75, 0.95, 0.5], "J01's leaf");
    else assert.deepEqual(own, was, `${s} ${t}`);
  }
  // and the tint is off wherever the day is wet or snow lies: summer, spring, autumn (wet 1, .6, .3) and every winter hour but the day (snow 1)
  for (const s of SEASONS) for (const t of TIMES) {
    const m = moodOf(s, t, t05.moodFor), dry = m.wet + m.snow === 0;
    assert.equal(dry, s === "winter" && t === "day", `${s} ${t}: wet ${m.wet}, snow ${m.snow}`);
  }
});
