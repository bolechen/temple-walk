// How a hall's room is drawn onto the cubes its doorway shows (#218). This is not loaded by a visitor's page: the rooms
// are drawn once, when the site is built (tools/bake-doorways.mjs), into small pictures that the page fetches as he
// comes near a hall (doorway.js). A tool that wants a doorway now (`__doorways(true)`) loads this module and draws it
// in the page the same way, so what it shows is what the baked pictures hold.
//
// Each room is drawn from just inside its door at a grown eye's height, with only the rooms drawn, its own lamps lit,
// the sun out and the sky's light low, as on going in (yard.js's `dress`): twice in colour, once in the light of a day
// and once of a night (the doorway mixes the two by the hour's lamp light), each already scaled by the brightness the
// doorway gives it, and once for how far each thing stands from the eye.
import * as THREE from "three";
import { DataUtils } from "three";
import { EYE, INSET, DIST, GAIN, ATLAS } from "./doorway-shape.js";

export function createCapture({ renderer, scene, U, size = 256 }) {
  let sun = null, hemi = null;
  scene.traverse((o) => { if (o.isDirectionalLight && !sun) sun = o; if (o.isHemisphereLight && !hemi) hemi = o; });
  const dm = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Vector3() } }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uC; varying vec3 vWP; void main(){ gl_FragColor=vec4(length(vWP-uC)/${DIST.toFixed(1)},0.,0.,1.); }`,
  });
  // Each face is drawn by its own camera of a cube camera (whose six cameras look the ways a cube's faces do) into a plain
  // target of its own, and read back from there.
  const col = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType }), dist = new THREE.WebGLRenderTarget(size / 2, size / 2, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.05, 80, new THREE.WebGLCubeRenderTarget(1));
  if (cam.coordinateSystem !== renderer.coordinateSystem) { cam.coordinateSystem = renderer.coordinateSystem; cam.updateCoordinateSystem(); }
  const lightly = new Set(scene.children.filter((c) => { let l = false; c.traverse((x) => { if (x.isLight) l = true; }); return l; }));
  // Only the rooms drawn and this room's lamps lit, the sun out and the sky's light low; everything put back after.
  const dress = (r) => {
    const seen = scene.children.map((c) => c.visible);
    for (const c of scene.children) c.visible = c.userData.part === "interior" || (lightly.has(c) && c.visible);
    const lit = r.lights.map((l) => l.visible); r.lights.forEach((l) => { l.visible = true; });
    const was = { sun: sun?.intensity, hemi: hemi?.intensity, lamp: U.uLamp.value, snow: U.uSnow.value, layer: U.uFogLayer?.value.x, fog: scene.fog };
    if (sun) sun.intensity = 0; if (hemi) hemi.intensity *= 0.3; U.uLamp.value = 1; U.uSnow.value = 0; if (U.uFogLayer) U.uFogLayer.value.x = 0;
    return () => {
      if (sun) sun.intensity = was.sun; if (hemi) hemi.intensity = was.hemi; U.uLamp.value = was.lamp; U.uSnow.value = was.snow; if (U.uFogLayer) U.uFogLayer.value.x = was.layer;
      r.lights.forEach((l, j) => { l.visible = lit[j]; }); scene.fog = was.fog;
      scene.children.forEach((c, j) => { c.visible = seen[j]; });
    };
  };
  // One face drawn (0–5, in the order a cube keeps them: +x, -x, +y, -y, +z, -z), colour or distances.
  const draw = (r, C, deep, f) => {
    const undress = dress(r), target = renderer.getRenderTarget(), xr = renderer.xr.enabled; renderer.xr.enabled = false;
    try {
      cam.position.copy(C); cam.updateMatrixWorld();
      if (deep) { scene.fog = null; dm.uniforms.uC.value.copy(C); scene.overrideMaterial = dm; }
      renderer.setRenderTarget(deep ? dist : col); renderer.render(scene, cam.children[f]);
    } finally { scene.overrideMaterial = null; renderer.xr.enabled = xr; renderer.setRenderTarget(target); undress(); }
  };
  // The six faces of a cube laid out three across and two down, one byte a channel: colour as sRGB scaled by `gain`,
  // distance as sixteen bits split over red (high) and green (low). Rows are kept as the card holds them, so that the
  // page puts them back face for face without turning anything.
  const read = (r, C, kind, gain) => {
    const rt = kind === "dist" ? dist : col, n = rt.width, [ax, ay] = ATLAS, canvas = document.createElement("canvas"); canvas.width = n * ax; canvas.height = n * ay;
    const g = canvas.getContext("2d"), half = new Uint16Array(n * n * 4), img = g.createImageData(n, n);
    const srgb = (v) => { v = Math.max(0, v * gain); v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.min(255, Math.round(v * 255)); };
    for (let f = 0; f < 6; f++) {
      draw(r, C, kind === "dist", f); renderer.readRenderTargetPixels(rt, 0, 0, n, n, half);
      for (let i = 0; i < n * n; i++) {
        const o = i * 4;
        if (kind === "dist") { const d = Math.round(Math.min(1, Math.max(0, DataUtils.fromHalfFloat(half[o]))) * 65535); img.data[o] = d >> 8; img.data[o + 1] = d & 255; img.data[o + 2] = 0; }
        else { img.data[o] = srgb(DataUtils.fromHalfFloat(half[o])); img.data[o + 1] = srgb(DataUtils.fromHalfFloat(half[o + 1])); img.data[o + 2] = srgb(DataUtils.fromHalfFloat(half[o + 2])); }
        img.data[o + 3] = 255;
      }
      g.putImageData(img, (f % ax) * n, Math.floor(f / ax) * n);
    }
    return canvas;
  };
  // One hall: its figures fetched first (else the door shows an empty dais), then a day, a night and the distances.
  // `mood(season, time)` sets the page's hour; it is put back after. Returns three canvases.
  const bake = async (hall, room, mood, back) => {
    await room.stand();
    const R = room.room, C = new THREE.Vector3(R.cx, R.y + EYE, R.z1 + 0.3 - INSET);
    mood("summer", "day"); const day = read(room, C, "col", GAIN[0]);
    mood("summer", "night"); const night = read(room, C, "col", GAIN[1]);
    const far = read(room, C, "dist", 1);
    back();
    return { day, night, dist: far };
  };
  return { bake };
}
