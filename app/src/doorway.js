// What is seen of a hall from outside, through its open door (issue #218). The real room stands sixty metres under the
// courts (interior.js), so behind the leaves there is nothing but a dark box. Each hall's own room is drawn when the
// site is built (tools/bake-doorways.mjs with doorway-capture.js) onto the faces of a cube from just inside its door,
// at a grown eye's height, in the light of a day and of a night, together with how far away each thing stood; the page
// fetches those pictures as he comes near a hall, and the box behind the leaves then paints that room. For every point of the box, the line from the eye is followed
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

import { EYE, INSET, DIST, GAIN, ATLAS } from "./doorway-shape.js";
export { EYE, INSET, DIST, GAIN, ATLAS } from "./doorway-shape.js";

// The material of one hall's dark box. `steps` is how many times the line is tried against the distances. The room's
// colour comes in two cubes, a day's and a night's, already as bright as the doorway shows them, mixed by the hour's
// lamp light; the distances in a third, sixteen bits over red and green, read exactly (no filtering between texels).
function doorMaterial(U, steps) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: true,
    defines: { STEPS: steps },
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      tDay: { value: null }, tNight: { value: null }, tDist: { value: null }, uHas: { value: 0 },
      // #320's trials: the face into the room alone and larger (`uHi`), and the room drawn live through the door (`uLive`).
      tInDay: { value: null }, tInNight: { value: null }, tInDist: { value: null }, uHi: { value: 0 },
      tLive: { value: null }, uLive: { value: 0 }, uLiveOn: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGain: { value: GAIN[0] },
      uW2R: { value: new THREE.Matrix4() }, uMin: { value: new THREE.Vector3() }, uMax: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uDoor: { value: new THREE.Vector4(-1, 1, 0, 3) },
      uLamp: U.uLamp,
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
      uniform samplerCube tDay, tNight, tDist; uniform float uHas, uLamp; uniform mat4 uW2R; uniform vec3 uMin, uMax, uC; uniform vec4 uDoor;
      uniform sampler2D tInDay, tInNight, tInDist, tLive; uniform float uHi, uLive, uLiveOn, uGain; uniform vec2 uRes;
      varying vec3 vWP;
      // On the face into the room (-z, as the capture's sixth camera saw it). Its rows come to the card top first, as the
      // cube's do (doorway-capture.js keeps them as read back), so up in the room is down the picture (T4, #320).
      bool inward(vec3 q){ return uHi>0. && q.z<0. && abs(q.x)< -q.z && abs(q.y)< -q.z; }
      vec2 inUV(vec3 q){ return vec2(q.x,-q.y)/max(-q.z,1e-3)*.5+.5; }
      float far(vec3 q){ vec2 s=(inward(q)?texture(tInDist,inUV(q)).rg:texture(tDist,q).rg)*255.; return (s.x*256.+s.y)/65535.*${DIST.toFixed(1)}; }
      float gap(vec3 ro, vec3 rd, float t){ vec3 q=ro+rd*t-uC; return length(q)-far(q); }
      void main(){
        vec3 ro=(uW2R*vec4(cameraPosition,1.)).xyz, wp=(uW2R*vec4(vWP,1.)).xyz, rd=(wp-ro)/max(length(wp-ro),1e-6), inv=1./rd;
        // Until the room has come, the dark box as it always was: warmest low down round its lamps (materials.js's interior).
        float d0=length(vec2(wp.x,(wp.y-1.05)*1.3));
        vec3 c=mix(vec3(.052,.022,.0095),vec3(.0065,.0045,.003),smoothstep(.15,3.6,d0))*(.75+1.7*uLamp);
        vec3 a=(uMin-ro)*inv, b=(uMax-ro)*inv, lo=min(a,b), hi=max(a,b);
        float tin=max(max(max(lo.x,lo.y),lo.z),0.), tout=min(min(hi.x,hi.y),hi.z);
        // How far apart neighbouring pixels fall on the larger face, taken from the walls (smooth) and outside any branch.
        vec2 uw=inUV(ro+rd*tout-uC), gx=dFdx(uw), gy=dFdy(uw);
        vec3 liveC=vec3(0.); float lw=0.;
        // The room is seen only through the open door, not through the paper of the windows either side.
        vec3 dp=ro+rd*((uMax.z-ro.z)/rd.z);
        bool through=rd.z<0. && dp.x>uDoor.x && dp.x<uDoor.y && dp.y>uDoor.z && dp.y<uDoor.w;
        // Live only within the room's own opening, whose jambs stand 3 cm inside the court's door either side
        // (interior.js): through that strip the room's lit plaster beyond the jamb showed as a thin pale line.
        if(uLiveOn>0. && uLive>0. && tout>tin && through && dp.x>uDoor.x+.04 && dp.x<uDoor.y-.04){ liveC=texture(tLive,gl_FragCoord.xy/uRes).rgb*uGain; lw=uLive; }
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
          vec3 q=ro+rd*t-uC;
          vec3 room=inward(q) ? mix(textureGrad(tInDay,inUV(q),gx,gy).rgb,textureGrad(tInNight,inUV(q),gx,gy).rgb,clamp(uLamp,0.,1.)) : mix(texture(tDay,q).rgb,texture(tNight,q).rgb,clamp(uLamp,0.,1.));
          c=mix(c,room,uHas);
        }
        gl_FragColor=vec4(c,1.);
        #include <fog_fragment>
        // The room drawn live has had the air between the eye and every point of it already (doorway-live.js).
        gl_FragColor.rgb=mix(gl_FragColor.rgb,liveC,lw);
      }`,
  });
}

// A cube of six faces cut from one picture laid out as ATLAS; `exact`: the distances, kept byte for byte.
const cube = (faces, exact) => {
  const t = new THREE.CubeTexture(faces); t.needsUpdate = true; t.flipY = false;
  if (exact) { t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; }
  else { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }   // no mipmaps made on the card: on a cold page their first making held a frame 160 ms (T4, low tier)
  return t;
};
// One face alone (#320's larger face into the room): colour mipmapped (seen from far it is made smaller), distances exact.
const flat = (img, exact) => {
  const t = new THREE.Texture(img); t.needsUpdate = true; t.flipY = false;
  if (exact) { t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; }
  else { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; }
  return t;
};
const cut = async (bitmap) => {
  const n = bitmap.width / ATLAS[0];
  return Promise.all([0, 1, 2, 3, 4, 5].map((f) => createImageBitmap(bitmap, (f % ATLAS[0]) * n, Math.floor(f / ATLAS[0]) * n, n, n, { colorSpaceConversion: "none", premultiplyAlpha: "none" })));
};
const picture = async (url) => createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });

// `site.doorways` (the dark box of each hall and how its building stands), `rooms` (buildInteriors), the scene and the
// renderer. `base`: where the baked pictures lie (`<base>t00.json` names them by hall); `steps`: see doorMaterial.
//
// Nothing is fetched when the page opens. When the visitor first comes within `NEAR` of a hall's door, or sees it within
// `SEEN`, its three pictures are fetched and decoded off the page's thread, sent to the card one a frame, and the room
// fades in over the dark box. No shader of the room is compiled and nothing is drawn into a cube while he walks. A hall
// with no pictures (none baked, or the fetch failed) keeps the dark box. At most `keep` rooms are held at a time: past
// that, the one farthest away (and not near) gives its cubes back, to be fetched again if he comes near it.
export const NEAR = 40, SEEN = 90, FADE = 0.8;
// `modes` (#320's trials, `?doorway=`): `hires` also fetches each hall's larger face into the room; `live` (doorway-live.js)
// draws the near room itself through its door on the middle and high tiers.
export function createDoorways({ renderer, scene, site, rooms, U, steps = 12, keep = 4, base = null, modes = new Set() }) {
  const halls = {}, frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), sphere = new THREE.Sphere();
  let manifest = null, asked = null, failed = 0, lastTick = 0, worstFrame = 0, busyFor = 0; const spikes = [];
  // The first picture a page ever sends to the card as a cube takes the browser's slow road once (a cold T4 held a frame
  // for it): a cube of one pixel of each kind is sent while the page is still loading, so no hall pays it on the walk.
  if (renderer && typeof createImageBitmap !== "undefined" && typeof ImageData !== "undefined") {
    createImageBitmap(new ImageData(1, 1), { colorSpaceConversion: "none", premultiplyAlpha: "none" }).then((b) => {
      for (const exact of [false, true]) { const t = cube([b, b, b, b, b, b], exact); try { renderer.initTexture(t); } catch { /* nothing to warm */ } t.dispose(); }
    }).catch(() => {});
  }
  for (const h of site.halls) {
    const d = site.doorways[h.id], r = rooms.rooms[h.id]; if (!d || !r) continue;
    const R = r.room, wx = (R.x1 - R.x0) / 2 + 0.3, zs = R.z1 + 0.3, zn = R.z0 - 0.3;
    const mat = doorMaterial(U, steps), u = mat.uniforms;
    u.uMin.value.set(-wx, 0, zn); u.uMax.value.set(wx, R.h + 0.45, zs); u.uC.value.set(0, EYE, zs - INSET);
    // The opening between the two leaves of the middle bay (building.js: each leaf 1.05 m, a quarter metre in from the column).
    const xs = [...h.xs].sort((a, b) => a - b), mid = Math.floor((xs.length - 1) / 2);
    u.uDoor.value.set(xs[mid] + 1.3 - 0.02, xs[mid + 1] - 1.3 + 0.02, 0.1, 3.1);
    d.mesh.material = mat;
    const o = { hall: h, d, r, mat, zs, door: new THREE.Vector3(), want: false, taken: 0, fade: 0, tex: null, pending: null, source: null };
    place(o); d.mesh.geometry.computeBoundingSphere();
    const [x, z] = h.door; o.door.set(x, d.group.position.y + d.platH + 1.5, z);
    halls[h.id] = o;
  }
  // From the world into the room's own frame (x across, y up from its floor, z toward its door): through the building's
  // inverse placement into its own space, then its floor down to the room's and its front wall onto the room's.
  function place(o) {
    o.d.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(o.d.group.matrixWorld).invert();
    o.mat.uniforms.uW2R.value.makeTranslation(0, -o.d.platH, o.zs - o.d.Z).multiply(inv);
  }
  const list = () => (asked ||= (base && typeof fetch !== "undefined" ? fetch(base + "t00.json").then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null)).then((m) => { manifest = m; return m; }));
  // The three pictures of one hall, fetched and cut into faces; the cubes are made but not yet sent to the card.
  const fetchHall = async (o) => {
    const m = await list(), e = m?.halls?.[o.hall.id]; if (!e) return null;
    const [day, night, dist] = await Promise.all([e.day, e.night, e.dist].map((f) => picture(base + f).then(cut)));
    const out = /** @type {THREE.Texture[]} */ ([cube(day), cube(night), cube(dist, true)]);
    if (modes.has("hires") && e.in) out.push(...(await Promise.all([e.in.day, e.in.night, e.in.dist].map((f) => picture(base + f)))).map((b, i) => flat(b, i === 2)));
    return out;
  };
  const show = (o, tex) => {
    o.tex = tex; const u = o.mat.uniforms; [u.tDay.value, u.tNight.value, u.tDist.value] = tex; o.taken++;
    if (tex.length === 6) { [u.tInDay.value, u.tInNight.value, u.tInDist.value] = tex.slice(3); u.uHi.value = 1; o.hi = true; }
  };
  const want = (o) => {
    if (o.want) return; o.want = true;
    o.pending = { stage: "fetch", up: 0 };
    fetchHall(o).then((tex) => { if (!o.want) { tex?.forEach((t) => t.dispose()); return; } if (!tex) { o.pending = null; o.source = "none"; return; } o.pending = { stage: "upload", up: 0, tex }; })
      .catch(() => { failed++; o.pending = null; o.source = "failed"; });
  };
  // Every frame from outside: who is near or seen, one picture sent to the card, the fading in, and what is given back.
  const tick = (camera, dt, eye) => {
    const now = performance.now(), interval = lastTick ? now - lastTick : 0; lastTick = now;
    const busy = Object.values(halls).some((o) => o.pending);
    if (busy || busyFor < 1) { worstFrame = Math.max(worstFrame, interval); if (interval > 100 && spikes.length < 24) spikes.push(+interval.toFixed(0)); }
    busyFor = busy ? 0 : busyFor + dt;
    if (camera) { camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    let sent = false;
    for (const o of Object.values(halls)) {
      if (!o.want) {
        const far = eye.distanceTo(o.door), held = Object.values(halls).filter((x) => x.want).length;
        if (far < NEAR || (camera && held < keep && far < SEEN && frustum.intersectsSphere(sphere.copy(o.d.mesh.geometry.boundingSphere).applyMatrix4(o.d.mesh.matrixWorld)))) want(o);
      }
      if (!sent && o.pending?.stage === "upload") {   // one cube a frame to the card, then the room is there
        const p = o.pending; try { renderer?.initTexture(p.tex[p.up]); } catch { /* sent when first drawn */ }
        sent = true;
        if (++p.up === p.tex.length) { show(o, p.tex); o.pending = null; o.source = "baked"; }
      }
      if (o.taken && o.fade < 1) {
        o.fade = Math.min(1, o.fade + dt / FADE); o.mat.uniforms.uHas.value = o.fade * o.fade * (3 - 2 * o.fade);
        for (const f of o.d.flames) f.visible = o.fade < 0.5;   // the two points of lamp the dark box had give way to the room's own lamps
      }
    }
    const held = Object.values(halls).filter((x) => x.tex);
    if (held.length > keep && !pinned) {
      const out = held.filter((x) => eye.distanceTo(x.door) > NEAR).sort((a, b) => eye.distanceTo(b.door) - eye.distanceTo(a.door))[0];
      if (out) drop(out);
    }
  };
  let pinned = false, dropped = 0;
  // Give a room's cubes back: its door is the dark box again until it is fetched anew.
  function drop(o) {
    o.tex?.forEach((t) => t.dispose()); o.tex = null; o.pending = null;
    o.want = false; o.taken = 0; o.fade = 0; o.mat.uniforms.uHas.value = 0; o.mat.uniforms.tDay.value = o.mat.uniforms.tNight.value = o.mat.uniforms.tDist.value = null;
    o.mat.uniforms.uHi.value = 0; o.mat.uniforms.tInDay.value = o.mat.uniforms.tInNight.value = o.mat.uniforms.tInDist.value = null; o.hi = false;
    for (const f of o.d.flames) f.visible = true;
    dropped++;
  }
  // The rooms drawn in the page now (or the one hall named), for a tool: the same drawing the baked pictures were made
  // with (doorway-capture.js, loaded only here), shown at once and kept.
  let capture = null;
  const drawn = async (o, cap, inward = null) => {
    const c = await cap.bake(o.hall, o.r, mood.set, mood.keep, inward);
    const faces = await Promise.all([c.day, c.night, c.dist].map((cv) => createImageBitmap(cv, { colorSpaceConversion: "none", premultiplyAlpha: "none" }).then(cut)));
    return { c, tex: [cube(faces[0]), cube(faces[1]), cube(faces[2], true)] };
  };
  let mood = { set: () => {}, keep: () => () => {} };   // how a tool sets the page's hour for the drawing, and how the hour it had is kept to be put back (yard.js)
  const takeAll = async (only = null) => {
    pinned = true;   // none is given back while (and after) a tool has them drawn
    capture ||= (await import("./doorway-capture.js")).createCapture({ renderer, scene, U });
    await rooms.ready;
    for (const o of Object.values(halls).filter((x) => !only || x.hall.id === only)) {
      const { tex } = await drawn(o, capture);
      o.tex?.forEach((t) => t.dispose()); o.want = true; o.pending = null; show(o, tex); o.source = "drawn"; o.fade = 1; o.mat.uniforms.uHas.value = 1; for (const f of o.d.flames) f.visible = false;
    }
  };
  // For the bake: one hall drawn, its three pictures as files would hold them (WebP for colour, PNG for distances).
  const bakeHall = async (id, quality = 0.9, lossless = false, inward = null) => {   // `lossless`: PNG for all three (to measure what WebP loses); `inward`: also the larger face into the room (#320)
    capture ||= (await import("./doorway-capture.js")).createCapture({ renderer, scene, U });
    await rooms.ready;
    const { c } = await drawn(halls[id], capture, inward);
    const col = (cv) => (lossless ? cv.toDataURL("image/png") : cv.toDataURL("image/webp", quality));
    const out = { day: col(c.day), night: col(c.night), dist: c.dist.toDataURL("image/png") };
    if (c.inDay) Object.assign(out, { inDay: col(c.inDay), inNight: col(c.inNight), inDist: c.inDist.toDataURL("image/png") });
    return out;
  };
  const bytes = () => Object.values(halls).reduce((n, o) => n + (o.tex ? o.tex.reduce((m, t) => m + (t.isCubeTexture ? (t.images[0]?.width || 0) ** 2 * 6 : (t.image?.width || 0) ** 2) * 4 * (t.generateMipmaps ? 4 / 3 : 1), 0) : 0), 0);
  // Where a point of a room is seen from outside, through the door: the room's frame carried back into the world.
  const seenAt = (id, p) => { const o = halls[id]; if (!o) return null; const R = o.r.room; return p.clone().sub(new THREE.Vector3(R.cx, R.y, 0)).applyMatrix4(m4.copy(o.mat.uniforms.uW2R.value).invert()); };
  return { halls, tick, takeAll, bakeHall, seenAt, moods: (m) => { mood = m; }, modes,
    report: () => ({ modes: [...modes], halls: Object.fromEntries(Object.entries(halls).map(([k, o]) => [k, { want: o.want, taken: o.taken, fade: +o.fade.toFixed(2), hi: !!o.hi, source: o.source || (o.pending ? o.pending.stage : null) }])), baked: manifest ? Object.keys(manifest.halls || {}) : null, failed, steps, keep, dropped, mb: +(bytes() / 2 ** 20).toFixed(2), worstFrameMs: +worstFrame.toFixed(1), spikes: spikes.slice() }) };
}
