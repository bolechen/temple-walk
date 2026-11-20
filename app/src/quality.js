// One tier per class of device: render scale, a pixel budget, MSAA samples, the size of the planar
// reflection relative to the frame, and the shadow map. A governor steps down when frames run long,
// because no two phones are alike and none can be tested ahead of time.
// The film's finish (docs/t00/art-goal.md, first stage) is the desktop's: only the high tier keeps the scene's depth
// (`depth`), lays ambient occlusion from it (`gtao`), softens the sun's shadows by how far they fall (`softShadow`,
// shadows.js), draws them from a larger map (`shadow` across, `shadowLong` up the mountain: half again as fine as the other tiers)
// and gives a photograph (when 虚化 is on) a shallow depth of field (`dof`). Leaves cast their dappled shadows
// (`leafShadow`) from the middle tier up. The colour table, the halation and the layered mist cost next to nothing
// and are everyone's.
const TIERS = {
  low:    { name: "low",    scale: 0.75, budget: 1.0e6, msaa: 0, planar: 0,    shadow: 1024, shadowLong: 4096, bloom: true, depth: false, gtao: false, softShadow: false, dof: false, leafShadow: false },   // no mirror: drawing the temple twice is what a phone cannot afford
  medium: { name: "medium", scale: 0.9,  budget: 1.6e6, msaa: 2, planar: 0.5,  shadow: 1024, shadowLong: 4096, bloom: true, depth: false, gtao: false, softShadow: false, dof: false, leafShadow: true },
  high:   { name: "high",   scale: 1,    budget: 2.4e6, msaa: 4, planar: 0.5,  shadow: 3072, shadowLong: 6144, bloom: true, depth: true,  gtao: true,  softShadow: true,  dof: true,  leafShadow: true },
};
export const tiers = () => JSON.parse(JSON.stringify(TIERS));

export function pickQuality(forced) {
  if (TIERS[forced]) return { ...TIERS[forced], fixed: true };
  if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900)) return { ...TIERS.low };
  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl2"), ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    gpu = String(gl ? gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : "");
  } catch {}
  return { ...TIERS[tierFor(gpu)] };
}
// Which tier a graphics card starts on, from the name the browser gives for it. Software renderers, phone chips,
// integrated Intel and the base Apple chips start on medium: the high tier draws the temple twice (the mirror) under
// 4x MSAA, which they do not hold at sixty frames a second. A browser that hides the name ("Apple GPU") is treated
// as the base chip. The governor still steps down from wherever this starts.
export function tierFor(gpu) {
  gpu = String(gpu || "");
  if (/SwiftShader|llvmpipe|Software|Mali|Adreno|PowerVR/i.test(gpu) || (/Intel/i.test(gpu) && !/Arc/i.test(gpu))) return "medium";
  if (/Apple/i.test(gpu) && !/\b(Pro|Max|Ultra)\b/i.test(gpu)) return "medium";
  return "high";
}

// Whether the planar mirror is worth drawing for a visitor standing at this height: it lies in the forecourt and the
// first court (y = 0) and is seen from the platforms that stand in them; not from the approach below, where the eye is
// under it, nor from the terraces above, whose paving has no mirror.
export const mirrorAt = (footY) => footY > -0.6 && footY < 2.0;

// What the governor gives up, in order, on a tier: the film's finish first (the occlusion, then the soft shadows, which
// a visitor misses least of all), then the mirror, then resolution, then the bloom.
/** @returns {[string, () => void][]} */
export function governorSteps(quality) {
  return /** @type {[string, () => void][]} */ ([
    ...(quality.gtao ? [["gtao", () => { quality.gtao = false; }]] : []),
    ...(quality.softShadow ? [["softShadow", () => { quality.softShadow = false; }]] : []),
    ["planar", () => { quality.planar = 0; }],                      // the mirror: it draws the temple a second time
    ["scale", () => { quality.scale *= 0.8; quality.budget *= 0.7; }],
    ["bloom", () => { quality.bloom = false; quality.scale *= 0.85; quality.budget *= 0.8; }],
  ]);
}

export function createGovernor(quality, apply) {
  // Things are given up in order of how little they will be missed.
  const steps = governorSteps(quality).map(([, fn]) => fn);
  let n = 0, sum = 0, level = 0, frames = 0;
  return {
    get level() { return level; },
    tick(dt) {
      if (quality.fixed || level >= steps.length || ++frames < 30) return;
      sum += Math.min(dt, 0.1); n++;                                  // a tab left and come back to is not a slow machine
      if (n < 45) return;
      const avg = sum / n; n = 0; sum = 0;
      if (avg > 0.022) { steps[level++](); apply(); }                 // under about 45 frames a second, give something up
    },
  };
}
