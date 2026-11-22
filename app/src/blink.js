// The novice's eyelids (#607). The Tripo body's eyes are open in its texture (the drawing's fifth version), so he blinks:
// a lid value from 0 (open) to 1 (shut) that the skin's material lays over the painted eyes (`lidShader`), no new mesh and no
// new draw. Every 3 to 6 seconds he blinks, shut about 0.12 s, and one time in five blinks twice. Sitting cross-legged on a
// cushion he keeps his eyes shut, and opens them within 0.3 s of getting up. The times come from a seeded generator, so the
// same seed gives the same blinks (tests, and a picture taken twice).

/** A small seeded generator: at least 0 and under 1. */
export function mulberry32(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const BLINK = { gapMin: 3, gapMax: 6, shut: 0.12, close: 0.04, twice: 0.2, again: 0.3, sitClose: 0.15, sitOpen: 0.25 };

/** How shut one blink that began `age` seconds ago is: quick down, a little slower up. */
export function blinkShape(age, B = BLINK) {
  if (age <= 0 || age >= B.shut) return 0;
  return age < B.close ? age / B.close : 1 - (age - B.close) / (B.shut - B.close);
}

/** The moments blinks begin, in seconds from the start, up to `until`: gaps of 3 to 6 s, one in five followed by a second 0.3 s on. */
export function blinkTimes(seed, until, B = BLINK) {
  const r = mulberry32(seed), out = []; let t = 0, again = false;
  for (;;) {
    if (again) { t += B.again; again = false; } else { t += B.gapMin + (B.gapMax - B.gapMin) * r(); again = r() < B.twice; }
    if (t > until) return out; out.push(t);
  }
}

/**
 * The eyelids over time. `step(dt, sit, on)` moves the clock on and returns the lid: `sit` keeps the eyes shut (cushion),
 * `on` false stops the blinking (a held picture) but not the sitting.
 */
export function createBlink(seed = 607, B = BLINK) {
  const r = mulberry32(seed); let clock = 0, next = 0, hold = 0, last = -1, again = false;
  const gap = () => B.gapMin + (B.gapMax - B.gapMin) * r();
  next = gap(); again = r() < B.twice;
  return {
    get clock() { return clock; },
    step(dt, sit, on = true) {
      if (on) clock += dt;
      hold += Math.max(-dt / B.sitOpen, Math.min(dt / B.sitClose, (sit ? 1 : 0) - hold));
      if (on && clock >= next) { last = next; if (again) { again = false; next = last + B.again; } else { next = last + gap(); again = r() < B.twice; } }
      return Math.max(hold, on && hold < 0.001 ? blinkShape(clock - last, B) : 0);
    },
  };
}

// Where the eyes are in the body's bind pose (the head of novice-tripo.glb, metres, he faces +z) and the colour of the lid
// (linear): an ellipse about each eye. The lid is drawn over the painted eye with a lash line along its lower edge.
export const EYES = { y: 0.985, x: 0.067, rx: 0.054, ry: 0.036, zMin: 0.04, lid: [0.62, 0.40, 0.29], lash: [0.07, 0.035, 0.03] };

/** Patches a MeshStandardMaterial so its eyes close by `lid.value` (an object with a `value`, shared with the figure). Idempotent. */
export function lidShader(material, lid) {
  const f = (n) => n.toFixed(4), v3 = (a) => `vec3(${a.map(f).join(",")})`;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, renderer) => {
    prev?.call(material, sh, renderer);
    sh.uniforms.uLid = lid;
    sh.vertexShader = "varying vec3 vBind;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vBind = position;");
    sh.fragmentShader = "uniform float uLid;\nvarying vec3 vBind;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
  float lidOver = 0.0;
  if (uLid > 0.001 && vBind.z > ${f(EYES.zMin)}) {
    vec2 e = vec2(abs(vBind.x) - ${f(EYES.x)}, vBind.y - ${f(EYES.y)});
    float d = length(e / vec2(${f(EYES.rx)}, ${f(EYES.ry)}));
    float over = smoothstep(1.0, 0.88, d) * uLid; lidOver = over;
    float curve = -0.012 - 0.006 * (1.0 - clamp(e.x / ${f(EYES.rx)}, -1.0, 1.0) * clamp(e.x / ${f(EYES.rx)}, -1.0, 1.0));
    float lash = smoothstep(0.0065, 0.002, abs(e.y - curve)) * smoothstep(1.0, 0.8, abs(e.x) / ${f(EYES.rx)}) * uLid;
    diffuseColor.rgb = mix(diffuseColor.rgb, ${v3(EYES.lid)}, over);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${v3(EYES.lash)}, lash * over);
  }`).replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, lidOver);").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 - lidOver;").replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n  normal = normalize(mix(normal, nonPerturbedNormal, lidOver));");
  };
  material.customProgramCacheKey = () => "lid";
  material.needsUpdate = true;
  return material;
}
