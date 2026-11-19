// What is seen of a hall from outside, through its open door (issue #218). The real room stands sixty metres under the
// courts (interior.js), so behind the leaves there is nothing but a dark box. Here each hall's own room is drawn once
// onto the faces of a cube from just inside its door, at a grown eye's height, together with how far away each thing
// stood; the box behind the leaves then paints that room. For every point of the box, the line from the eye is followed
// into the room, as if the room stood there behind the wall: first to the wall, floor or ceiling it would reach (the
// room's own box), then back along that line to the first thing that stands in it as seen from the door (the figure,
// the offering table, a column), found by a few steps against the cube of distances. So the figure keeps its own depth
// and moves against the door frame as the visitor walks past, and what is seen from outside is the room that is found
// on going in.
//
// The method is interior mapping (Joost van Dongen, 2008) with a box-projected cube taken from a real point, and a short
// march against a distance cube in place of a separate card for the figure. No library: the open ones read for this
// (three-fenestra, three-interior-mapping, Kristian Dixon's notes) map one photograph or a unit cube, not a room of its
// own size captured from inside (docs/t00/SOURCES.md).
import * as THREE from "three";

const EYE = 1.6, INSET = 0.25;   // where the cube is taken: a grown eye's height, a little inside the door
const DIST = 64;                  // distances are kept as a fraction of this many metres

// The material of one hall's dark box. `steps` is how many times the line is tried against the distances (0: only
// the room's own box, one sample of the cube).
function doorMaterial(U, steps) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: true,
    defines: { STEPS: steps },
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      tCol: { value: null }, tDist: { value: null }, uHas: { value: 0 },
      uW2R: { value: new THREE.Matrix4() }, uMin: { value: new THREE.Vector3() }, uMax: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uDoor: { value: new THREE.Vector4(-1, 1, 0, 3) },
      uGain: { value: new THREE.Vector2(0.18, 0.8) }, uLamp: U.uLamp,
    }),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWP;
      void main(){
        vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform samplerCube tCol, tDist; uniform float uHas, uLamp; uniform mat4 uW2R; uniform vec3 uMin, uMax, uC; uniform vec2 uGain; uniform vec4 uDoor;
      varying vec3 vWP;
      float gap(vec3 ro, vec3 rd, float t){ vec3 q=ro+rd*t-uC; return length(q)-texture(tDist,q).r*${DIST.toFixed(1)}; }
      void main(){
        vec3 ro=(uW2R*vec4(cameraPosition,1.)).xyz, wp=(uW2R*vec4(vWP,1.)).xyz, rd=(wp-ro)/max(length(wp-ro),1e-6), inv=1./rd;
        // Until the room is taken, the dark box as it always was: warmest low down round its lamps (materials.js's interior).
        float d0=length(vec2(wp.x,(wp.y-1.05)*1.3));
        vec3 c=mix(vec3(.052,.022,.0095),vec3(.0065,.0045,.003),smoothstep(.15,3.6,d0))*(.75+1.7*uLamp);
        vec3 a=(uMin-ro)*inv, b=(uMax-ro)*inv, lo=min(a,b), hi=max(a,b);
        float tin=max(max(max(lo.x,lo.y),lo.z),0.), tout=min(min(hi.x,hi.y),hi.z);
        // The room is seen only through the open door, not through the paper of the windows either side.
        vec3 dp=ro+rd*((uMax.z-ro.z)/rd.z);
        bool through=rd.z<0. && dp.x>uDoor.x && dp.x<uDoor.y && dp.y>uDoor.z && dp.y<uDoor.w;
        if(uHas>0. && tout>tin && through){
          float t=tout;
          #if STEPS > 0
            // Into the room from the door, a step at a time, until the line has passed behind what the door sees.
            float t0=tin, g0=gap(ro,rd,t0), dt=(tout-tin)/float(STEPS);
            for(int i=1;i<=STEPS;i++){
              float t1=tin+dt*float(i), g1=gap(ro,rd,t1);
              if(g1>=0.){ t=mix(t0,t1,clamp(g0/(g0-g1),0.,1.)); break; }
              t0=t1; g0=g1;
            }
          #endif
          c=mix(c,texture(tCol,ro+rd*t-uC).rgb*mix(uGain.x,uGain.y,clamp(uLamp,0.,1.)),uHas);
        }
        gl_FragColor=vec4(c,1.);
        #include <fog_fragment>
      }`,
  });
}

// What a distance cube is drawn with: how far each point stands from the cube's centre.
function distMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Vector3() } }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uC; varying vec3 vWP; void main(){ gl_FragColor=vec4(length(vWP-uC)/${DIST.toFixed(1)},0.,0.,1.); }`,
  });
}

// `site.doorways` (the dark box of each hall and how its building stands), `rooms` (buildInteriors), the scene and the
// renderer. `size`: the colour cube's face in pixels; `steps`: see doorMaterial.
//
// Nothing is taken when the page opens (a phone's first load is long enough already). A hall is taken when the visitor
// first comes within `NEAR` of its door, or sees it within `SEEN`: its figures are fetched (not the works on its walls),
// then its room is drawn one face of one cube a frame, twelve frames in all, and the room fades in over the dark box
// that stood there before. A change of season or hour takes again, the same way, only the halls already taken.
//
// At most `keep` rooms are held at a time: past that, the one farthest away (and not near) gives its cubes back and its
// door goes dark again, to be taken anew if he comes near it.
export const NEAR = 40, SEEN = 90, FADE = 0.8;
export function createDoorways({ renderer, scene, site, rooms, U, size = 256, steps = 12, keep = 4, sync = false, warmTarget = () => null }) {
  const halls = {}, dm = distMaterial(), queue = [], frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), sphere = new THREE.Sphere();
  let sun = null, hemi = null, ready = false, busy = null, worst = 0, dropped = 0, pinned = false, lastTick = 0, worstFrame = 0, quietFor = 1; const faces = [], spikes = []; let yielded = false, act = "", standing = 0;   // pinned: a tool took them all, and none is given back
  scene.traverse((o) => { if (o.isDirectionalLight && !sun) sun = o; if (o.isHemisphereLight && !hemi) hemi = o; });
  for (const h of site.halls) {
    const d = site.doorways[h.id], r = rooms.rooms[h.id]; if (!d || !r) continue;
    const R = r.room, wx = (R.x1 - R.x0) / 2 + 0.3, zs = R.z1 + 0.3, zn = R.z0 - 0.3;
    const mat = doorMaterial(U, steps), u = mat.uniforms;
    u.uMin.value.set(-wx, 0, zn); u.uMax.value.set(wx, R.h + 0.45, zs); u.uC.value.set(0, EYE, zs - INSET);
    // The opening between the two leaves of the middle bay (building.js: each leaf 1.05 m, a quarter metre in from the column).
    const xs = [...h.xs].sort((a, b) => a - b), mid = Math.floor((xs.length - 1) / 2);
    u.uDoor.value.set(xs[mid] + 1.3 - 0.02, xs[mid + 1] - 1.3 + 0.02, 0.1, 3.1);
    d.mesh.material = mat;
    const o = { hall: h, d, r, mat, C: new THREE.Vector3(R.cx, R.y + EYE, zs - INSET), zs, door: new THREE.Vector3(), want: false, taken: 0, fade: 0, col: null, dist: null, cam: null, dcam: null };
    place(o); d.mesh.geometry.computeBoundingSphere();
    const [x, z] = h.door; o.door.set(x, d.group.position.y + d.platH + 1.5, z);
    halls[h.id] = o;
  }
  rooms.ready.then(() => { ready = true; });
  // From the world into the room's own frame (x across, y up from its floor, z toward its door): through the building's
  // inverse placement into its own space, then its floor down to the room's and its front wall onto the room's.
  function place(o) {
    o.d.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(o.d.group.matrixWorld).invert();
    o.mat.uniforms.uW2R.value.makeTranslation(0, -o.d.platH, o.zs - o.d.Z).multiply(inv);
  }
  // The cubes are made only for a hall that is taken.
  const cubes = (o) => {
    if (o.col) return;
    o.col = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    o.dist = new THREE.WebGLCubeRenderTarget(Math.max(64, size / 2), { type: THREE.HalfFloatType, format: THREE.RedFormat });   // one number a texel
    o.cam = new THREE.CubeCamera(0.05, 80, o.col); o.dcam = new THREE.CubeCamera(0.05, 80, o.dist);
    o.cam.position.copy(o.C); o.dcam.position.copy(o.C); o.cam.updateMatrixWorld(); o.dcam.updateMatrixWorld();
    if (o.cam.coordinateSystem !== renderer.coordinateSystem) { o.cam.coordinateSystem = o.dcam.coordinateSystem = renderer.coordinateSystem; o.cam.updateCoordinateSystem(); o.dcam.updateCoordinateSystem(); }
    o.mat.uniforms.tCol.value = o.col.texture; o.mat.uniforms.tDist.value = o.dist.texture;
  };
  // One face of one cube (0–5 colour, 6–11 distance), with only the rooms drawn, this room's lamps lit, the sun out and
  // the sky's light low, as on going in (yard.js's `dress`); and everything put back as it was.
  // What holds the sky's lights stays as it is (the room is lit as on going in); everything else but the rooms is hidden.
  const lightly = new Set(scene.children.filter((c) => { let l = false; c.traverse((x) => { if (x.isLight) l = true; }); return l; }));
  const dress = (o) => {
    const seen = scene.children.map((c) => c.visible);
    for (const c of scene.children) c.visible = c.userData.part === "interior" || (lightly.has(c) && c.visible);
    const lit = o.r.lights.map((l) => l.visible); o.r.lights.forEach((l) => { l.visible = true; });
    const was = { sun: sun?.intensity, hemi: hemi?.intensity, lamp: U.uLamp.value, snow: U.uSnow.value, layer: U.uFogLayer?.value.x, fog: scene.fog };
    if (sun) sun.intensity = 0; if (hemi) hemi.intensity *= 0.3; U.uLamp.value = 1; U.uSnow.value = 0; if (U.uFogLayer) U.uFogLayer.value.x = 0;
    return () => {
      if (sun) sun.intensity = was.sun; if (hemi) hemi.intensity = was.hemi; U.uLamp.value = was.lamp; U.uSnow.value = was.snow; if (U.uFogLayer) U.uFogLayer.value.x = was.layer;
      o.r.lights.forEach((l, j) => { l.visible = lit[j]; });
      scene.children.forEach((c, j) => { c.visible = seen[j]; });
    };
  };
  // Before a room is first drawn, everything it is drawn with is compiled, so that no face waits on a shader: in the
  // room's own light (dress), as drawn into a render target (which has its own colour handling), and the distances'
  // material without fog, on a plain and on an instanced mesh. Where the browser compiles off the main thread
  // (KHR_parallel_shader_compile) the whole room is handed over at once (`parallel`); elsewhere one thing a frame is
  // compiled into the small unseen target the director warms its shots with (`frames`), and a frame that came after a
  // slow one (over `SLOW` ms) is left alone. Until it is all done the door keeps its dark box.
  const parallel = !!renderer?.extensions?.has("KHR_parallel_shader_compile"), SLOW = 40;
  const warmStats = { path: parallel ? "parallel" : "frames", programs: 0, longestMs: 0, skipped: 0 };
  const probe = (() => { const g = new THREE.BoxGeometry(); return [new THREE.Mesh(g, dm), new THREE.InstancedMesh(g, dm, 1)]; })();
  const warmList = (o) => {
    const seen = new Set(), list = [];
    o.r.group.traverse((m) => {
      if (!m.material) return;
      for (const mat of [].concat(m.material)) { const k = `${mat.uuid}|${!!m.isInstancedMesh}|${!!m.isSkinnedMesh}|${m.receiveShadow}`; if (!seen.has(k)) { seen.add(k); list.push({ obj: m }); } }
    });
    for (const obj of probe) list.push({ obj, deep: true });
    // And the pictures its materials wear (the figures' packed textures above all), sent to the card one a frame.
    const tex = new Set(); o.r.group.traverse((m) => { for (const mat of [].concat(m.material || [])) for (const v of Object.values(mat)) if (v && v.isTexture && !v.isRenderTargetTexture) tex.add(v); });
    for (const t of tex) list.push({ tex: t });
    return list;
  };
  const warmCam = new THREE.PerspectiveCamera(90, 1, 0.05, 80);
  const label = (o, it) => `${o.hall.id} ${it.tex ? "texture " + (it.tex.image?.width || "?") : it.deep ? "distance" : (it.obj.material?.type || "?") + " " + (it.obj.material?.name || it.obj.name || "")}`.trim();
  // Not only compiled but drawn once, alone, into a target of the cube's own kind (half floats; one channel for the
  // distances): a graphics driver may make the last of a shader's work only when it is first drawn into a target of a
  // given kind, and the first face of a room once waited 0.4–1.5 s on that (T4, 20261119-005112).
  const drawnKeys = new Set(), warmCol = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType }), warmDist = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType, format: THREE.RedFormat });
  const alone = (o, obj) => {   // only `obj` of all the rooms is drawn; what it changed is given back by the function it returns
    const rooms = o.r.group.parent ? o.r.group.parent.children : [o.r.group], was = rooms.map((g) => g.visible), meshes = [];
    rooms.forEach((g) => { g.visible = g === o.r.group; });
    o.r.group.traverse((m) => { if ((m.isMesh || m.isPoints || m.isLine) && m !== obj) { meshes.push([m, m.visible]); m.visible = false; } });
    const culled = obj.frustumCulled; obj.frustumCulled = false; obj.visible = true;
    return () => { obj.frustumCulled = culled; meshes.forEach(([m, v]) => { m.visible = v; }); rooms.forEach((g, i) => { g.visible = was[i]; }); };
  };
  const compileOne = (o, item) => {
    if (item.tex) { if (renderer.properties.get(item.tex).__webglTexture) return false; try { renderer.initTexture(item.tex); } catch { /* sent when first drawn */ } return true; }
    const undress = dress(o), target = renderer.getRenderTarget(), fog = scene.fog, before = renderer.info.programs?.length || 0, t0 = performance.now();
    let back = null, added = false;
    try {
      if (item.deep) { scene.fog = null; dm.uniforms.uC.value.copy(o.C); scene.overrideMaterial = dm; if (!item.obj.parent) { o.r.group.add(item.obj); added = true; } }
      back = alone(o, item.obj);
      warmCam.position.copy(o.C); warmCam.updateMatrixWorld();
      if (!item.deep && !renderer.properties.get(item.obj.material).currentProgram) renderer.compile(item.obj, warmCam, scene);
      renderer.setRenderTarget(item.deep ? warmDist : warmCol); renderer.render(scene, warmCam);
    } catch { /* made ready when first drawn */ } finally {
      back?.(); if (added) o.r.group.remove(item.obj);
      scene.overrideMaterial = null; scene.fog = fog; renderer.setRenderTarget(target); undress();
    }
    const made = (renderer.info.programs?.length || 0) - before; warmStats.programs += made; if (made) warmStats.longestMs = Math.max(warmStats.longestMs, performance.now() - t0);
    const key = `${item.deep ? "deep" : item.obj.material.uuid}|${o.r.lights.length}|${!!item.obj.isInstancedMesh}`, fresh = !drawnKeys.has(key); drawnKeys.add(key);
    return made > 0 || fresh;   // a frame's one piece of work: a new program, or a first drawing into a target of this kind
  };
  const prepareAll = (o) => {
    const undress = dress(o), target = renderer.getRenderTarget(), fog = scene.fog, jobs = [], before = renderer.info.programs?.length || 0;
    try {
      warmCam.position.copy(o.C); warmCam.updateMatrixWorld(); renderer.setRenderTarget(warmTarget()); jobs.push(renderer.compileAsync(o.r.group, warmCam, scene));
      scene.fog = null; const p2 = new THREE.Scene(); p2.add(...probe.map((m) => m.clone())); jobs.push(renderer.compileAsync(p2, warmCam, scene));
    } catch { /* compiled on first drawing instead */ } finally { scene.fog = fog; renderer.setRenderTarget(target); undress(); }
    return Promise.all(jobs).catch(() => {}).then(() => { warmStats.programs += (renderer.info.programs?.length || 0) - before; });
  };
  const face = (o, i) => {
    const undress = dress(o), fog = scene.fog;
    const target = renderer.getRenderTarget(), cf = renderer.getActiveCubeFace(), ml = renderer.getActiveMipmapLevel(), xr = renderer.xr.enabled; renderer.xr.enabled = false;
    try {
      const deep = i >= 6, k = i % 6, rt = deep ? o.dist : o.col, cam = (deep ? o.dcam : o.cam).children[k];
      if (deep) { scene.fog = null; dm.uniforms.uC.value.copy(o.C); scene.overrideMaterial = dm; }
      const mips = rt.texture.generateMipmaps; rt.texture.generateMipmaps = mips && k === 5;   // the mipmaps once all six faces are there
      renderer.setRenderTarget(rt, k); renderer.render(scene, cam);
      rt.texture.generateMipmaps = mips;
    } finally {
      scene.overrideMaterial = null; scene.fog = fog;
      renderer.setRenderTarget(target, cf, ml); renderer.xr.enabled = xr;
      undress();
    }
  };
  const want = (o) => {
    if (o.want) return; o.want = true;
    standing++; o.r.stand().catch(() => {}).then(() => { standing--; if (!queue.includes(o)) queue.push(o); });
  };
  // Every frame from outside: who is near or seen, the next face of the hall being taken, and the fading in.
  // `still`: false while the eye is being swung (an observance's shot, the opening, the close): no face is drawn then,
  // so that no frame of a swing is held up.
  // `idle`: the title is up, or he is standing still: then the shaders of the hall nearest are made ready before it is
  // wanted, so that coming near it later has nothing left to compile.
  const tick = (camera, dt, eye, still = true, idle = false) => {
    // The longest frame while a room is being taken (and for a second after), from one tick to the next.
    const now = performance.now(), interval = lastTick ? now - lastTick : 0; if (lastTick && quietFor < 1) worstFrame = Math.max(worstFrame, interval); lastTick = now;
    // A slow frame, and what the doorways did in the tick before it (and how many figures were still being fetched), for the report.
    if (interval > 100 && spikes.length < 24) spikes.push({ ms: +interval.toFixed(0), after: act, standing });
    act = "";
    quietFor = busy || queue.length ? 0 : quietFor + dt;
    if (camera) { camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    for (const o of Object.values(halls)) {
      if (!o.want) {
        const far = eye.distanceTo(o.door), held = Object.values(halls).filter((x) => x.want).length;
        if (far < NEAR || (camera && held < keep && far < SEEN && frustum.intersectsSphere(sphere.copy(o.d.mesh.geometry.boundingSphere).applyMatrix4(o.d.mesh.matrixWorld)))) want(o);
      }
      if (o.taken && o.fade < 1) {
        o.fade = Math.min(1, o.fade + dt / FADE); o.mat.uniforms.uHas.value = o.fade * o.fade * (3 - 2 * o.fade);
        for (const f of o.d.flames) f.visible = o.fade < 0.5;   // the two points of lamp the dark box had give way to the room's own lamps
      }
    }
    const held = Object.values(halls).filter((x) => x.col);
    if (held.length > keep && !pinned) {
      const out = held.filter((x) => busy?.o !== x && eye.distanceTo(x.door) > NEAR).sort((a, b) => eye.distanceTo(b.door) - eye.distanceTo(a.door))[0];
      if (out) drop(out);
    }
    if (!ready || !still) return;
    // A nearer hall that has come into the queue takes the place of one still being made ready (not of one being drawn).
    if (busy && !busy.wait && busy.i === 0 && queue.length) {
      const near = queue.reduce((a, c) => (eye.distanceTo(c.door) < eye.distanceTo(a.door) ? c : a));
      if (eye.distanceTo(near.door) < eye.distanceTo(busy.o.door) - 1) { queue.push(busy.o); busy = null; }
    }
    if (!busy && queue.length) {
      queue.sort((a, b) => eye.distanceTo(a.door) - eye.distanceTo(b.door)); busy = { o: queue.shift(), i: 0, wait: false }; cubes(busy.o);
      const o = busy.o;
      if (!o.todo?.length) {   // made again each time: what is compiled already is passed over at no cost, and the figures fetched since are added
        o.todo = warmList(o);
        if (parallel) { const b = busy; b.wait = true; o.todo = o.todo.filter((x) => x.tex); prepareAll(o).then(() => { b.wait = false; }); }
      }
    }
    if (!busy && idle && !parallel) {   // nothing wanted: get the nearest hall's shaders ready meanwhile
      const next = Object.values(halls).filter((o) => !o.warmed).sort((a, b) => eye.distanceTo(a.door) - eye.distanceTo(b.door))[0];
      if (next) {
        if (!next.todo) next.todo = warmList(next).filter((x) => !x.tex);
        if (interval > SLOW && !yielded) { yielded = true; warmStats.skipped++; return; }
        yielded = false;
        const t0 = performance.now(); while (next.todo.length && !compileOne(next, (act = label(next, next.todo[0]), next.todo.shift())) && performance.now() - t0 < 4);
        if (!next.todo.length) { next.warmed = true; next.todo = null; }
      }
      return;
    }
    if (!busy || busy.wait) return;
    if (interval > SLOW && !yielded) { yielded = true; warmStats.skipped++; return; }   // the last frame was slow: this one is left alone (one only, or a slow page would never be done)
    yielded = false;
    const todo = busy.o.todo;
    if (todo?.length) {   // what is already compiled or sent costs nothing: go on until one thing was really done, or 4 ms
      const t0 = performance.now(); while (todo.length && !compileOne(busy.o, (act = label(busy.o, todo[0]), todo.shift())) && performance.now() - t0 < 4);
      if (todo.length) return;
    }
    busy.o.compiled = true;
    act = `${busy.o.hall.id} face ${busy.i}`; const t0 = performance.now(); face(busy.o, busy.i++); if (sync) renderer.getContext().finish(); const ms = performance.now() - t0; worst = Math.max(worst, ms); faces.push(+ms.toFixed(1)); if (faces.length > 24) faces.shift();   // `sync`: with the card made to finish it (?doorsync)
    if (busy.i === 12) { busy.o.taken++; busy = null; }
  };
  // Give a room's cubes back: its door is the dark box again until it is taken anew.
  function drop(o) {
    const q = queue.indexOf(o); if (q >= 0) queue.splice(q, 1);
    o.col.dispose(); o.dist.dispose(); o.col = o.dist = o.cam = o.dcam = null;
    o.want = false; o.taken = 0; o.fade = 0; o.mat.uniforms.uHas.value = 0; o.mat.uniforms.tCol.value = o.mat.uniforms.tDist.value = null;
    for (const f of o.d.flames) f.visible = true;
    dropped++;
  }
  // The hour or the season changed: the halls already taken are taken again, the room staying as it was meanwhile.
  const retake = () => { for (const o of Object.values(halls)) if (o.taken && !queue.includes(o) && busy?.o !== o) queue.push(o); };
  // Everything at once (or the one hall named), for a tool that wants the doorways now, the room shown without fading.
  const takeAll = async (only = null) => {
    const some = Object.values(halls).filter((o) => !only || o.hall.id === only);
    await rooms.ready; await Promise.all(some.map((o) => o.r.stand().catch(() => {})));
    for (const o of some) { o.want = true; cubes(o); for (let i = 0; i < 12; i++) face(o, i); o.taken++; o.fade = 1; o.mat.uniforms.uHas.value = 1; for (const f of o.d.flames) f.visible = false; }
    queue.length = 0; busy = null; pinned = true;
  };
  const bytes = () => Object.values(halls).reduce((n, o) => n + (o.col ? (o.col.width ** 2 * 6 * 8 * 4) / 3 + o.dist.width ** 2 * 6 * 2 : 0), 0);   // half floats: four to a colour texel, its mipmaps a third more; one to a distance
  // Where a point of a room is seen from outside, through the door: the room's frame carried back into the world.
  const seenAt = (id, p) => { const o = halls[id]; if (!o) return null; const R = o.r.room; return p.clone().sub(new THREE.Vector3(R.cx, R.y, 0)).applyMatrix4(m4.copy(o.mat.uniforms.uW2R.value).invert()); };
  return { halls, tick, retake, takeAll, seenAt,
    report: () => ({ halls: Object.fromEntries(Object.entries(halls).map(([k, o]) => [k, { want: o.want, taken: o.taken, fade: +o.fade.toFixed(2) }])), queued: queue.map((o) => o.hall.id), busy: busy && busy.o.hall.id, size, steps, keep, dropped, mb: +(bytes() / 2 ** 20).toFixed(2), worstFaceMs: +worst.toFixed(1), worstFrameMs: +worstFrame.toFixed(1), lastFacesMs: faces.slice(), spikes: spikes.slice(), warm: { ...warmStats, longestMs: +warmStats.longestMs.toFixed(1) } }) };
}
