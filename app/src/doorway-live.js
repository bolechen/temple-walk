// The room seen through a hall's door drawn live, not from baked pictures (#320's trial, `?doorway=live`). The real room
// stands sixty metres under the courts (interior.js). When the visitor is near a door that he can see, on the middle and
// high tiers, that room is drawn once more each frame from where his eye would be if the room stood behind the wall:
// his eye carried through the same placement that takes the court's door onto the room's (doorway.js's `uW2R`), with the
// same lens, into a picture the size of the frame. The dark box behind the leaves then takes, pixel for pixel, what that
// picture holds at the same place on the screen, so the door frame, the leaves and anyone in front of them cover it as
// they would cover the room itself, and nothing is resampled. Everything on the court's side of the door's plane is cut
// away by the lens itself (an oblique near plane, Eric Lengyel 2005, as three's Reflector does for a mirror), so no
// material has to change and no shader is built for the cut. Farther off the baked pictures take over again, faded.
//
// This is the "render to texture" form of a portal. three's own example is a stencil one (webgl_clipping_stencil) and the
// community's portals mask with the stencil (efyang/portal-0.5, the forum's "Portal rendering with stencil buffer") or draw
// the far side into a texture laid on the portal's mesh (three's Reflector, whose oblique near plane this copies; Jono
// Santell's "Portals with Asymmetric Projection"). The texture keeps the frame's post-processing chain as it is: the
// court is drawn into the composer's own multisampled target, whose stencil a second scene cannot share (docs in #320's PR).
//
// The room's shaders are those used inside it (the same lights shown, the same fog), so the first time a hall is
// approached, once he is within `LIVE.warm`, they are built ahead one material a frame, and the room is then drawn once
// to a tiny picture from its middle, one way a frame, so that its geometry and textures are on the card before the door
// is in sight (`?warm=0` leaves this out, to measure what it saves).
import * as THREE from "three";
import { GAIN } from "./doorway-shape.js";

export const LIVE = { full: 12, none: 16, warm: 30 };

const M = new THREE.Matrix4(), plane = new THREE.Plane(), v4 = new THREE.Vector4(), q4 = new THREE.Vector4(), p3 = new THREE.Vector3(), n3 = new THREE.Vector3(0, 0, -1);
// The eye carried into a hall's room (`o`, one of doorway.js's halls) from the court's `camera`, into `cam`: the world taken
// into the room as it stands under the courts (doorway.js's placement into the room's own frame, then that frame back
// onto where the room was built), the same lens, and its near plane laid on the door's plane (the front wall's outer face),
// keeping the room's side (Lengyel's oblique near plane, as three's Reflector has it).
export function roomEye(o, camera, cam) {
  const R = o.r.room, zs = o.mat.uniforms.uMax.value.z;
  M.makeTranslation(R.cx, R.y, 0).multiply(o.mat.uniforms.uW2R.value);
  cam.matrixWorld.multiplyMatrices(M, camera.matrixWorld); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  cam.projectionMatrix.copy(camera.projectionMatrix);
  // The oblique plane tilts the far plane in toward the eye as well, the more the farther the door: the far plane is
  // first put out of all reach (the lens's own near kept), so the back of the deepest room is still drawn.
  { const e = cam.projectionMatrix.elements, n = e[14] / (e[10] - 1), f = 1e5; e[10] = -(f + n) / (f - n); e[14] = (-2 * f * n) / (f - n); }
  p3.setFromMatrixPosition(cam.matrixWorld);
  if (p3.z > zs + 0.02) {
    plane.setFromNormalAndCoplanarPoint(n3, p3.set(R.cx, R.y, zs)).applyMatrix4(cam.matrixWorldInverse);
    v4.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = cam.projectionMatrix.elements;
    q4.set((Math.sign(v4.x) + e[8]) / e[0], (Math.sign(v4.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    v4.multiplyScalar(2 / v4.dot(q4));
    e[2] = v4.x; e[6] = v4.y; e[10] = v4.z + 1; e[14] = v4.w;
  }
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  return cam;
}

export function createLive({ renderer, scene, U, rooms, halls, msaa = 0, warm = true, scale = 1 }) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: msaa });
  const cam = new THREE.PerspectiveCamera(); cam.matrixAutoUpdate = false; cam.matrixWorldAutoUpdate = false;
  const look = new THREE.PerspectiveCamera(90, 1, 0.05, 80);
  const c3 = new THREE.Vector3(), clear = new THREE.Color(), frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), sphere = new THREE.Sphere();
  let sun = null, hemi = null;
  scene.traverse((o) => { if (o.isDirectionalLight && !sun) sun = o; if (o.isHemisphereLight && !hemi) hemi = o; });
  const stats = { drawn: 0, hall: null, weight: 0, warmed: [], compileMs: {}, worstWarmFrame: 0, liveMs: 0, share: 1, warm }   // compileMs: from first near to warmed, wall clock;

  // The scene as it is inside that hall: only the rooms, that hall's own lamps (the rest are out), the sun put out and the
  // sky's light low, as the bake draws it (doorway-capture.js), with no mist layer and no snow (the room is under ground).
  const dress = (o) => {
    const seen = scene.children.map((c) => c.visible), shadow = renderer.shadowMap.needsUpdate;
    for (const c of scene.children) c.visible = c === rooms.group || (c.isLight && c.visible);
    rooms.group.visible = true;
    const outs = Object.values(rooms.rooms).map((x) => x.outlook).filter(Boolean), out = outs.map((x) => x.visible); outs.forEach((x) => { x.visible = false; });   // every room's view out of its door (44 m wide, they overlap their neighbours) is on the court's side
    const lit = o.r.lights.map((l) => l.visible); o.r.lights.forEach((l) => { l.visible = true; });
    const others = Object.values(rooms.rooms).filter((x) => x !== o.r), shown = others.map((x) => x.group.visible); others.forEach((x) => { x.group.visible = false; });   // only this hall's room
    const was = { sun: sun?.intensity, hemi: hemi?.intensity, lamp: U.uLamp.value, snow: U.uSnow.value, layer: U.uFogLayer?.value.x };
    if (sun) sun.intensity = 0; if (hemi) hemi.intensity *= 0.3; U.uLamp.value = 1; U.uSnow.value = 0; if (U.uFogLayer) U.uFogLayer.value.x = 0;
    renderer.shadowMap.needsUpdate = false;   // the sun's shadow map is drawn only by the court's own frame
    // Where a line of sight finds nothing (the 3 cm either side between the court's door and the room's narrower jambs,
    // whose boxes the door's plane cuts open) it is the dark of timber in shadow, not the sky's colour.
    const bg = scene.background, cc = renderer.getClearColor(clear), ca = renderer.getClearAlpha(); scene.background = null; renderer.setClearColor(0x000000, 1);
    return () => {
      scene.background = bg; renderer.setClearColor(cc, ca);
      if (sun) sun.intensity = was.sun; if (hemi) hemi.intensity = was.hemi; U.uLamp.value = was.lamp; U.uSnow.value = was.snow; if (U.uFogLayer) U.uFogLayer.value.x = was.layer;
      o.r.lights.forEach((l, j) => { l.visible = lit[j]; }); others.forEach((x, j) => { x.group.visible = shown[j]; }); outs.forEach((x, j) => { x.visible = out[j]; });
      scene.children.forEach((c, j) => { c.visible = seen[j]; });
      renderer.shadowMap.needsUpdate = shadow;
    };
  };

  // Warming a hall: its figures stood; then its shaders built one material a frame (the T4's ANGLE has no
  // KHR_parallel_shader_compile, so a build is paid where it is made: spread out, no frame pays for the whole room); a
  // pause while the card finishes them; then one look a frame from the middle of the room, which sends its geometry and
  // textures to the card. `compile` is handed a root of our own whose traverse yields only the meshes chosen, so the
  // lights are gathered once, from the scene as dressed, exactly as when the room is drawn.
  const begin = (o) => {
    if (o.live) return; o.live = { stage: "stand", up: 0, t0: performance.now(), todo: null, wait: 0 };
    o.r.stand().then(() => {
      if (!warm) { o.live.stage = "ready"; return; }
      const seen = new Map();
      o.r.group.traverse((m) => { if (!(m.isMesh || m.isPoints || m.isLine || m.isSprite) || !m.material) return; for (const mat of [].concat(m.material)) if (!seen.has(mat)) seen.set(mat, m); });
      o.live.todo = [...seen.values()]; o.live.n = o.live.todo.length; o.live.stage = "compile";
    });
  };
  const compileOne = (o) => {
    const t0 = performance.now(), m = o.live.todo.shift(), undress = dress(o), target = renderer.getRenderTarget();
    const R = o.r.room; look.position.set(R.cx, R.y + 1.6, 0); look.rotation.set(0, 0, 0); look.updateMatrixWorld();
    const root = /** @type {any} */ ({ traverse: (fn) => fn(m), traverseVisible: () => {} });
    try { renderer.setRenderTarget(rt); renderer.compile(root, look, scene); }
    finally { renderer.setRenderTarget(target); undress(); }
    stats.worstWarmFrame = Math.max(stats.worstWarmFrame, performance.now() - t0);
    if (!o.live.todo.length) { o.live.stage = "settle"; o.live.wait = 0; }
  };
  const DIRS = [[0, 0], [Math.PI / 2, 0], [Math.PI, 0], [-Math.PI / 2, 0], [0, Math.PI / 2], [0, -Math.PI / 2]];
  const upload = (o) => {
    const t0 = performance.now(), undress = dress(o), target = renderer.getRenderTarget(), R = o.r.room, [yaw, pitch] = DIRS[o.live.up];
    // Into the live picture itself, through a corner of it: ANGLE on Vulkan builds a pipeline at the first draw for each
    // kind of target (its format, its samples), so a look into any other target warms nothing (T4, #320's first run).
    try { look.position.set(R.cx, R.y + 1.6, (R.z0 + R.z1) / 2); look.rotation.set(pitch, yaw, 0, "YXZ"); look.updateMatrixWorld(); rt.viewport.set(0, 0, 64, 64); renderer.setRenderTarget(rt); renderer.render(scene, look); }
    finally { rt.viewport.set(0, 0, rt.width, rt.height); renderer.setRenderTarget(target); undress(); }
    stats.worstWarmFrame = Math.max(stats.worstWarmFrame, performance.now() - t0);
    if (++o.live.up === DIRS.length) { o.live.stage = "ready"; stats.warmed.push(o.hall.id); stats.compileMs[o.hall.id] = +(performance.now() - o.live.t0).toFixed(0); }
  };
  // One step of warming a frame, for the one hall that needs it.
  const warmStep = (o) => {
    if (o.live.stage === "compile") compileOne(o);
    else if (o.live.stage === "settle") { if (++o.live.wait >= 20) o.live.stage = "upload"; }
    else if (o.live.stage === "upload") upload(o);
    else return false;
    return true;
  };

  // Each frame, before the court is drawn: warm what is near, and draw the nearest seen room into the frame-sized picture.
  // `size`: the composer's own target, [w, h] in pixels.
  const frame = (camera, eye, size) => {
    { const W = Math.max(1, Math.round(size[0] * scale)), H = Math.max(1, Math.round(size[1] * scale)); if (rt.width !== W || rt.height !== H) rt.setSize(W, H); }
    camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let best = null, bestD = Infinity, uploaded = false;
    // Nearest first: the hall he is walking up to is warmed before the ones he only passes.
    for (const o of Object.values(halls).sort((x, y) => eye.distanceToSquared(x.door) - eye.distanceToSquared(y.door))) {
      const d = eye.distanceTo(o.door), seen = frustum.intersectsSphere(sphere.copy(o.d.mesh.geometry.boundingSphere).applyMatrix4(o.d.mesh.matrixWorld));
      if (d < LIVE.full || (d < LIVE.warm && seen)) begin(o);   // a hall he walks toward, not one he passes with his back to it
      if (o.live && !uploaded && warmStep(o)) uploaded = true;
      o.mat.uniforms.uLive.value = 0;
      if (o.live?.stage !== "ready" || d >= LIVE.none || d >= bestD) continue;
      if (!seen) continue;
      best = o; bestD = d;
    }
    stats.hall = best ? best.hall.id : null; stats.weight = 0;
    if (!best) return;
    const t0 = performance.now(), o = best, w = 1 - THREE.MathUtils.smoothstep(bestD, LIVE.full, LIVE.none);
    roomEye(o, camera, cam);
    const W = Math.max(1, Math.round(size[0] * scale)), H = Math.max(1, Math.round(size[1] * scale));
    if (rt.width !== W || rt.height !== H) rt.setSize(W, H);
    // Only the door's own rectangle on the screen is drawn (the rest of the picture is never shown): the opening's four
    // corners, from doorway.js's `uDoor`, carried out of the building into the world and onto the screen, a few pixels larger.
    const D = o.mat.uniforms.uDoor.value, g = o.d.group.matrixWorld, ph = o.d.platH, Z = o.d.Z;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
    for (const [x, y] of [[D.x, D.z], [D.y, D.z], [D.x, D.w], [D.y, D.w]]) {
      c3.set(x, ph + y, Z).applyMatrix4(g).applyMatrix4(camera.matrixWorldInverse); if (c3.z > -camera.near) { behind = true; break; }
      c3.applyMatrix4(camera.projectionMatrix); x0 = Math.min(x0, c3.x); x1 = Math.max(x1, c3.x); y0 = Math.min(y0, c3.y); y1 = Math.max(y1, c3.y);
    }
    const px = (v, n) => THREE.MathUtils.clamp(Math.round((v * 0.5 + 0.5) * n), 0, n);
    if (behind) rt.scissor.set(0, 0, rt.width, rt.height);
    else { const a = px(x0, rt.width) - 3, b = px(y0, rt.height) - 3; rt.scissor.set(Math.max(0, a), Math.max(0, b), Math.min(rt.width, px(x1, rt.width) + 3) - Math.max(0, a), Math.min(rt.height, px(y1, rt.height) + 3) - Math.max(0, b)); }
    rt.scissorTest = true;
    stats.share = +((rt.scissor.z * rt.scissor.w) / (rt.width * rt.height)).toFixed(3);   // how much of the picture is drawn
    const lamp = U.uLamp.value, undress = dress(o), target = renderer.getRenderTarget();
    try { renderer.setRenderTarget(rt); if (rt.scissor.z > 0 && rt.scissor.w > 0) renderer.render(scene, cam); }
    finally { rt.scissorTest = false; renderer.setRenderTarget(target); undress(); }
    const u = o.mat.uniforms;
    u.tLive.value = rt.texture; u.uLive.value = w; u.uRes.value.set(size[0], size[1]);
    u.uGain.value = THREE.MathUtils.lerp(GAIN[0], GAIN[1], THREE.MathUtils.clamp(lamp, 0, 1));
    stats.drawn++; stats.weight = +w.toFixed(2); stats.liveMs = +(performance.now() - t0).toFixed(2);
  };
  // The dark box takes the live picture only in the court's own frame, not in the mirror of the paving, which is drawn
  // from another eye (ground.js); the main camera is named once by yard.js.
  let main = null;
  for (const o of Object.values(halls)) {
    const mesh = o.d.mesh, before = mesh.onBeforeRender;
    mesh.onBeforeRender = function (r, s, c, ...rest) { const on = c === main ? 1 : 0; if (o.mat.uniforms.uLiveOn.value !== on) { o.mat.uniforms.uLiveOn.value = on; o.mat.uniformsNeedUpdate = true; } return before.call(this, r, s, c, ...rest); };
  }
  return {
    frame, stats,
    camera: (c) => { main = c; },
    report: () => ({ ...stats, halls: Object.fromEntries(Object.values(halls).map((o) => [o.hall.id, o.live ? o.live.stage + (o.live.stage === "upload" ? o.live.up : "") : null])) }),
  };
}
