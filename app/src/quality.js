// One tier per class of device: render scale, a pixel budget, MSAA samples, the size of the planar
// reflection relative to the frame, and the shadow map. A governor steps down when frames run long,
// because no two phones are alike and none can be tested ahead of time.
const TIERS = {
  low:    { name: "low",    scale: 0.75, budget: 1.0e6, msaa: 0, planar: 0,    shadow: 2048, bloom: true },   // no mirror: drawing the temple twice is what a phone cannot afford
  medium: { name: "medium", scale: 0.9,  budget: 1.6e6, msaa: 2, planar: 0.5,  shadow: 2048, bloom: true },
  high:   { name: "high",   scale: 1,    budget: 2.4e6, msaa: 4, planar: 0.5,  shadow: 4096, bloom: true },
};

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

export function createGovernor(quality, apply) {
  // Things are given up in order of how little they will be missed.
  const steps = [
    () => { quality.planar = 0; },                                  // the mirror first: it draws the temple a second time
    () => { quality.scale *= 0.8; quality.budget *= 0.7; },
    () => { quality.bloom = false; quality.scale *= 0.85; quality.budget *= 0.8; },
  ];
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
