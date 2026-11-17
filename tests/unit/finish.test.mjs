// The film's finish (docs/t00/art-goal.md, first stage): the colour table, the soft shadows' shader and the mist's
// layers, checked in Node against three's own shader chunks.
import test from "node:test"; import assert from "node:assert/strict";
import * as THREE from "three";
import { bakeLut, grade, isIdentity, IDENTITY, LUT_SIZE } from "../../app/src/lut.js";
import { softShadowChunk } from "../../app/src/shadows.js";
import { moodOf, SEASONS, TIMES } from "../../app/src/mood.js";
import { layerFog } from "../../app/src/fog.js";
import { U } from "../../app/src/glsl.js";

test("the identity table leaves every colour where it was", () => {
  const d = bakeLut(IDENTITY), n = LUT_SIZE;
  for (const [r, g, b] of [[0, 0, 0], [n - 1, n - 1, n - 1], [5, 17, 30], [31, 0, 12]]) {
    const k = ((b * n + g) * n + r) * 4;
    assert.deepEqual([d[k], d[k + 1], d[k + 2]], [r, g, b].map((v) => Math.round((v / (n - 1)) * 255)));
  }
  assert.ok(isIdentity(IDENTITY) && isIdentity(undefined) && !isIdentity({ ...IDENTITY, sat: 1.1 }));
});
test("every mood's table keeps grey in order: darker stays darker, nothing turns over", () => {
  for (const s of SEASONS) for (const t of TIMES) {
    const p = moodOf(s, t).lut; let last = -1;
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const c = grade([v, v, v], p), l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      assert.ok(l >= last - 1e-6, `${s}/${t}: grey ${v.toFixed(2)} came out darker than the one below it`); last = l;
      assert.ok(Math.max(...c) - Math.min(...c) < 0.08, `${s}/${t}: grey ${v.toFixed(2)} is tinted too far: ${c.map((x) => x.toFixed(3))}`);
    }
  }
});
test("the soft shadow replaces three's PCF function and keeps it beside, and refuses a chunk it does not know", () => {
  const box = { width: 124, height: 256, depth: 410 }, out = softShadowChunk(THREE.ShaderChunk.shadowmap_pars_fragment, box);
  assert.equal((out.match(/float getShadow\( sampler2DShadow/g) || []).length, 1, "one soft getShadow");
  assert.ok(out.includes("float getShadowPCF( sampler2DShadow"), "three's own kept under another name");
  assert.ok(out.includes((1 / 124).toFixed(6)) && out.includes((1 / 410).toFixed(6)), "the shadow camera's size reaches the shader");
  assert.ok(out.indexOf("getShadow( sampler2DShadow") < out.indexOf("SHADOWMAP_TYPE_VSM"), "inside the PCF branch");
  assert.ok(/if \( shadowRadius < 0\.0 \) return getShadowPCF/.test(out), "a negative radius falls back to plain PCF (the governor's switch)");
  assert.ok(out.indexOf("float getShadowPCF( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord );") < out.indexOf("return getShadowPCF"), "declared before it is called");
  assert.throws(() => softShadowChunk("void main(){}", box));
});
// The shader's mean density along a line of sight, worked out exactly, against the same density summed in small steps.
const layer = (yc, yp, [k, y0, invH, cap]) => {
  if (k <= 0) return 1;
  const cl = (v) => Math.min(24, Math.max(-cap, v)), a = cl((yc - y0) * invH), b = cl((yp - y0) * invH), d = b - a;
  return 1 - k + k * (Math.abs(d) < 1e-3 ? Math.exp(-a) : (Math.exp(-a) - Math.exp(-b)) / d);
};
test("the layered mist is the mean of its density along the line, and plain air with no layer", () => {
  const L = [0.75, -12, 1 / 12, 2.2];
  for (const [yc, yp] of [[22.6, -15], [0, 0], [0, 30], [-10, 40], [5, 5.0004]]) {
    let sum = 0; const N = 4000;
    for (let i = 0; i < N; i++) { const y = yc + (yp - yc) * (i + 0.5) / N; sum += 1 - L[0] + L[0] * Math.exp(-Math.min(24, Math.max(-L[3], (y - L[1]) * L[2]))); }
    assert.ok(Math.abs(layer(yc, yp, L) - sum / N) < 2e-3, `${yc}→${yp}: ${layer(yc, yp, L)} vs ${sum / N}`);
  }
  assert.equal(layer(20, -30, [0, 0, 0.05, 2]), 1);
  assert.ok(layer(22.6, 22.6, L) < 0.35 && layer(-12, -12, L) > 0.99, "thin on the summit, as thick as the plain mist down in the valley");
});
test("every material is handed the mist's layers as it is compiled, and keeps telling its programs apart", () => {
  layerFog();
  const C = THREE.ShaderChunk;
  assert.ok(C.fog_fragment.includes("fogLayer(") && C.fog_pars_fragment.includes("uniform vec4 uFogLayer") && C.fog_vertex.includes("vFogY"));
  const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial(), own = (sh) => { sh.mine = true; };
  b.onBeforeCompile = own;
  const sa = { uniforms: {} }, sb = { uniforms: {} };
  a.onBeforeCompile(sa); b.onBeforeCompile(sb);
  assert.equal(sa.uniforms.uFogLayer, U.uFogLayer); assert.equal(sb.uniforms.uFogLayer, U.uFogLayer); assert.ok(sb.mine, "its own hook still runs");
  assert.equal(b.customProgramCacheKey(), own.toString(), "the cache key is the material's own hook");
  assert.notEqual(a.customProgramCacheKey(), b.customProgramCacheKey());
});
