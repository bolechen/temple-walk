// The novice's eyelids (#607). The Tripo body's eyes are open in its texture (the drawing's fifth version), so he blinks:
// a lid value from 0 (open) to 1 (shut) that the skin's material lays over the painted eyes (`lidShader`), no new mesh and no
// new draw. Every 3 to 6 seconds he blinks, shut about 0.12 s, and one time in five blinks twice. Sitting cross-legged on a
// cushion he keeps his eyes shut, and opens them within 0.3 s of getting up. The times come from a seeded generator, so the
// same seed gives the same blinks (tests, and a picture taken twice).

import { Vector4 } from "three";

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
export const EYES = { y: 0.985, x: 0.067, rx: 0.054, ry: 0.036, zMin: 0.04, plane: [0.23292, -0.08064, -0.58779], cheek: [0.075, 0.935], skin: 0.97, lash: [0.085, 0.045, 0.03], lashHalf: 0.0009 };

/**
 * Where on the skin's texture the lid takes its colour from, one point to each side of the face: the cheek under each eye
 * (the head's two sides lie on separate islands of the texture), found as the forward-most points of the geometry in
 * EYES.cheek. A vec4: x, y for the side where the bind pose's x is positive, z, w for the other.
 * @param {import("three").BufferGeometry} geometry
 */
export function eyeSkin(geometry) {
  const p = geometry.attributes.position, uv = geometry.attributes.uv, out = new Vector4();
  for (const side of [1, -1]) {
    const hits = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) * side, y = p.getY(i); if (Math.abs(x - EYES.cheek[0]) < 0.015 && Math.abs(y - EYES.cheek[1]) < 0.01 && p.getZ(i) > EYES.zMin) hits.push(i); }
    hits.sort((a, b) => p.getZ(b) - p.getZ(a)); const top = hits.slice(0, 4); if (!top.length) continue;
    const u = top.reduce((a, i) => a + uv.getX(i), 0) / top.length, v = top.reduce((a, i) => a + uv.getY(i), 0) / top.length;
    if (side > 0) { out.x = u; out.y = v; } else { out.z = u; out.w = v; }
  }
  return out;
}

/**
 * Patches a MeshStandardMaterial so its eyes close by `lid.value` (an object with a `value`, shared with the figure): the lid
 * takes the colour of the cheek (`skinUV`, from `eyeSkin`) and the face's own roughness, the eyeball's relief is pressed flat
 * to the plane of the face about the eye (in the vertex shader, only while the lid is down) and the normal turned to the
 * viewer, and a fine arc is drawn for the lid's edge. Idempotent.
 */
export function lidShader(material, lid, skinUV = new Vector4(0.6, 0.274, 0.788, 0.417)) {
  const f = (n) => n.toFixed(5), v3 = (a) => `vec3(${a.map(f).join(",")})`;
  const prev = material.onBeforeCompile, uv4 = { value: skinUV };
  material.onBeforeCompile = (sh, renderer) => {
    prev?.call(material, sh, renderer);
    sh.uniforms.uLid = lid; sh.uniforms.uSkinUV = uv4;
    const [pa, pb, pc] = EYES.plane;
    sh.vertexShader = "uniform float uLid;\nvarying vec3 vBind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  vBind = position;
  if (uLid > 0.001 && position.z > ${f(EYES.zMin)}) {
    vec2 ev = vec2(abs(position.x) - ${f(EYES.x)}, position.y - ${f(EYES.y)});
    float flat_ = smoothstep(1.2, 0.6, length(ev / vec2(${f(EYES.rx)}, ${f(EYES.ry)}))) * uLid;
    transformed.z = mix(transformed.z, ${f(pa)} + ${f(pb)} * position.y + ${f(pc)} * abs(position.x), 0.85 * flat_);
  }`);
    sh.fragmentShader = "uniform float uLid;\nuniform vec4 uSkinUV;\nvarying vec3 vBind;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
  float lidOver = 0.0;
  if (uLid > 0.001 && vBind.z > ${f(EYES.zMin)}) {
    vec2 e = vec2(abs(vBind.x) - ${f(EYES.x)}, vBind.y - ${f(EYES.y)});
    float d = length(e / vec2(${f(EYES.rx)}, ${f(EYES.ry)}));
    float over = smoothstep(1.0, 0.62, d) * uLid; lidOver = over;
    vec2 cuv = vBind.x > 0.0 ? uSkinUV.xy : uSkinUV.zw;
    vec3 skinTone = texture2D(map, cuv).rgb * ${f(EYES.skin)};
    float xn = clamp(e.x / ${f(EYES.rx)}, -1.0, 1.0);
    float curve = -0.004 - 0.009 * xn * xn;
    float half_ = ${f(EYES.lashHalf)} * (1.0 - 0.85 * xn * xn);
    float lash = smoothstep(half_, half_ * 0.35, abs(e.y - curve)) * smoothstep(1.0, 0.6, abs(xn)) * uLid;
    diffuseColor.rgb = mix(diffuseColor.rgb, skinTone, over);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${v3(EYES.lash)}, lash * over);
  }`).replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, roughness, lidOver);").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 - lidOver;").replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n  normal = normalize(mix(normal, normalize(vViewPosition + vec3(0.0, 0.1, 0.0)), 0.9 * lidOver));");
  };
  material.customProgramCacheKey = () => "lid";
  material.needsUpdate = true;
  return material;
}
